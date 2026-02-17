(() => {
  const existing = document.getElementById("lr-learning-overlay");
  if (existing) {
    return;
  }

  const overlay = document.createElement("div");
  overlay.id = "lr-learning-overlay";

  const status = document.createElement("div");
  status.id = "lr-learning-status";
  status.textContent = "Language Helper active";

  const controls = document.createElement("div");
  controls.id = "lr-learning-controls";

  const toggle = document.createElement("button");
  toggle.id = "lr-learning-toggle";
  toggle.type = "button";
  toggle.textContent = "Translation: ON";

  const directionToggle = document.createElement("button");
  directionToggle.id = "lr-learning-direction";
  directionToggle.type = "button";
  directionToggle.textContent = "Direction: EN→ZH";

  const extensionToggle = document.createElement("button");
  extensionToggle.id = "lr-learning-extension";
  extensionToggle.type = "button";
  extensionToggle.textContent = "Extension: ON";

  const line = document.createElement("div");
  line.id = "lr-learning-line";
  line.textContent = "Waiting for subtitles...";

  const pinyinLine = document.createElement("div");
  pinyinLine.id = "lr-learning-line-pinyin";
  pinyinLine.textContent = "Pinyin will appear here.";

  const secondaryLine = document.createElement("div");
  secondaryLine.id = "lr-learning-line-secondary";
  secondaryLine.textContent = "Translation will appear here.";

  const popup = document.createElement("div");
  popup.id = "lr-learning-popup";
  popup.textContent = "";
  popup.style.display = "none";

  controls.appendChild(extensionToggle);
  controls.appendChild(directionToggle);
  controls.appendChild(toggle);

  overlay.appendChild(status);
  overlay.appendChild(controls);
  overlay.appendChild(line);
  overlay.appendChild(pinyinLine);
  overlay.appendChild(secondaryLine);
  overlay.appendChild(popup);

  const appendOverlay = () => document.documentElement.appendChild(overlay);

  const syncOverlayToFullscreen = () => {
    const fs = document.fullscreenElement ?? document.webkitFullscreenElement;
    const target = fs || document.documentElement;
    if (overlay.parentElement !== target) target.appendChild(overlay);
  };

  const onFullscreenChange = () => {
    syncOverlayToFullscreen();
  };

  document.addEventListener("fullscreenchange", onFullscreenChange);
  document.addEventListener("webkitfullscreenchange", onFullscreenChange);

  console.log("[Language Helper] content script injected on", window.location.href);

  const isYouTube =
    window.location.hostname.includes("youtube.com") ||
    window.location.hostname.includes("youtube-nocookie.com");

  const isHitv =
    window.location.hostname.includes("hitv.vip");

  if (!isYouTube && !isHitv) {
    line.textContent = "YouTube and HiTV only (for now).";
    return;
  }

  if (isHitv && window !== window.top) {
    return;
  }

  if (isYouTube || isHitv) {
    appendOverlay();
  }

  let lastText = "";
  let hitvPollInterval = null;
  let hitvBodyObserver = null;

  let sourceLanguage = "en";
  let targetLanguage = "zh";
  const cache = new Map();
  const lineCache = new Map();
  const isPinyinReady = () => typeof globalThis?.pinyinPro?.pinyin === "function";
  let lastTranslatedText = "";
  const cedictMap = new Map();
  let cedictLoadPromise = null;
  let popupRequestId = 0;
  let captionObserver = null;
  let extensionEnabled = true;
  let translationDirection = "en-zh";
  let translateEnabled = true;
  let translateTimer = null;
  const translateDebounceMs = 350;

  const updateDirection = () => {
    if (translationDirection === "zh-en") {
      sourceLanguage = "zh";
      targetLanguage = "en";
      return;
    }
    sourceLanguage = "en";
    targetLanguage = "zh";
  };

  const updateToggleUI = () => {
    extensionToggle.textContent = `Extension: ${extensionEnabled ? "ON" : "OFF"}`;
    directionToggle.textContent =
      translationDirection === "zh-en" ? "Direction: ZH→EN" : "Direction: EN→ZH";
    toggle.textContent = `Translation: ${translateEnabled ? "ON" : "OFF"}`;
    if (!extensionEnabled) {
      status.textContent = "Language Helper paused";
      line.textContent = "Extension is off.";
      secondaryLine.textContent = "";
      pinyinLine.textContent = "";
      return;
    }
    status.textContent = "Language Helper active";
    secondaryLine.textContent = translateEnabled
      ? "Waiting for subtitles..."
      : "Translation is off.";
    if (hasChinese(lastText)) {
      pinyinLine.style.display = "none";
      pinyinLine.textContent = "";
    } else if (translateEnabled) {
      pinyinLine.style.display = "block";
      pinyinLine.textContent = isPinyinReady()
        ? "Pinyin will appear here."
        : "Pinyin not loaded (reload extension).";
    } else {
      pinyinLine.style.display = "none";
      pinyinLine.textContent = "";
    }
  };

  const stopObserver = () => {
    if (captionObserver) {
      captionObserver.disconnect();
      captionObserver = null;
    }
  };

  const startObserver = (container) => {
    stopObserver();
    captionObserver = new MutationObserver(() => {
      updateLine(readCaptionText());
    });

    captionObserver.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    updateLine(readCaptionText());
  };

  extensionToggle.addEventListener("click", () => {
    extensionEnabled = !extensionEnabled;
    if (!extensionEnabled) {
      stopObserver();
      if (hitvPollInterval) {
        clearInterval(hitvPollInterval);
        hitvPollInterval = null;
      }
      if (hitvBodyObserver) {
        hitvBodyObserver.disconnect();
        hitvBodyObserver = null;
      }
      hidePopup();
    } else {
      initCaptions();
    }
    updateToggleUI();
  });

  directionToggle.addEventListener("click", () => {
    translationDirection = translationDirection === "zh-en" ? "en-zh" : "zh-en";
    updateDirection();
    lineCache.clear();
    cache.clear();
    if (extensionEnabled && lastText) {
      const currentText = lastText;
      lastText = "";
      updateLine(currentText);
    }
    updateToggleUI();
  });

  toggle.addEventListener("click", () => {
    translateEnabled = !translateEnabled;
    if (!translateEnabled && translateTimer) {
      clearTimeout(translateTimer);
      translateTimer = null;
    }
    updateToggleUI();
    hidePopup();
    if (lastText) {
      const currentText = lastText;
      lastText = "";
      updateLine(currentText);
    }
  });
  const hasChinese = (text) => /[\u4e00-\u9fff]/.test(text);

  const loadCedict = async () => {
    if (cedictLoadPromise) {
      return cedictLoadPromise;
    }
    const cedictUrl = chrome.runtime.getURL("data/cedict_ts.u8");
    cedictLoadPromise = fetch(cedictUrl)
      .then((response) => response.text())
      .then((body) => {
        body.split("\n").forEach((line) => {
          if (!line || line.startsWith("#")) {
            return;
          }
          const match = line.match(/^(\S+)\s+(\S+)\s+\[(.+?)\]\s+\/(.+)\/$/);
          if (!match) {
            return;
          }
          const [, traditional, simplified, pinyin, defsRaw] = match;
          const defs = defsRaw.split("/").filter(Boolean);
          const entry = { pinyin, defs };
          if (!cedictMap.has(traditional)) {
            cedictMap.set(traditional, entry);
          }
          if (!cedictMap.has(simplified)) {
            cedictMap.set(simplified, entry);
          }
        });
      })
      .catch((error) => {
        console.warn("[Language Helper] CEDICT load failed:", error);
      });
    return cedictLoadPromise;
  };

  const lookupCedict = async (word) => {
    await loadCedict();
    return cedictMap.get(word) || null;
  };

  updateDirection();
  updateToggleUI();
  loadCedict();

  const escapeHtml = (value) =>
    String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const setPopupContent = (meaningText) => {
    popup.innerHTML = "";
    const meaning = document.createElement("div");
    meaning.className = "lr-popup-meaning";
    meaning.textContent = meaningText;
    popup.appendChild(meaning);
  };

  const showPopup = async (target, word, mode = "en") => {
    const requestId = ++popupRequestId;
    if (!extensionEnabled) {
      popup.textContent = "Extension is off.";
      popup.style.display = "block";
      const rect = target.getBoundingClientRect();
      popup.style.left = `${Math.round(rect.left)}px`;
      popup.style.top = `${Math.round(rect.top - 28)}px`;
      return;
    }
    if (mode !== "zh" && !translateEnabled) {
      popup.textContent = "Translation is off.";
      popup.style.display = "block";
      const rect = target.getBoundingClientRect();
      popup.style.left = `${Math.round(rect.left)}px`;
      popup.style.top = `${Math.round(rect.top - 28)}px`;
      return;
    }

    popup.style.display = "block";
    const rect = target.getBoundingClientRect();
    popup.style.left = `${Math.round(rect.left)}px`;
    popup.style.top = `${Math.round(rect.top - 28)}px`;

    if (mode === "zh") {
      if (!hasChinese(word)) {
        popup.style.display = "none";
        return;
      }
      popup.textContent = `${word} → (looking up...)`;
      const entry = await lookupCedict(word);
      if (requestId !== popupRequestId) {
        return;
      }
      if (!entry) {
        popup.textContent = `${word} → (no match)`;
        return;
      }
      const meaning = entry.defs?.[0] || "definition unavailable";
      const pinyinPart = entry.pinyin ? ` [${entry.pinyin}]` : "";
      setPopupContent(`${word}${pinyinPart} → ${meaning}`);
      return;
    }

    popup.textContent = `${word} → (translating...)`;

    if (cache.has(word)) {
      const cached = cache.get(word);
      setPopupContent(`${word} → ${cached}`);
      return;
    }

    chrome.runtime.sendMessage(
      {
        type: "translate",
        payload: {
          text: word,
          source: sourceLanguage,
          target: targetLanguage,
        },
      },
      (response) => {
        if (requestId !== popupRequestId) {
          return;
        }
        if (!response || !response.ok) {
          const errorText = response?.error ? `error: ${response.error}` : "translation error";
          popup.textContent = `${word} → (${errorText})`;
          return;
        }
        cache.set(word, response.translatedText);
        setPopupContent(`${word} → ${response.translatedText}`);
      }
    );
  };

  const hidePopup = () => {
    popupRequestId += 1;
    popup.style.display = "none";
  };

  const getPinyin = (text) => {
    if (!text) {
      return "";
    }
    const engine = globalThis?.pinyinPro?.pinyin;
    if (typeof engine !== "function") {
      return "";
    }
    try {
      const result = engine(text, { toneType: "symbol", type: "array" });
      return Array.isArray(result) ? result.join(" ") : String(result);
    } catch (error) {
      console.warn("[Language Helper] Pinyin error:", error);
      return "";
    }
  };

  const renderChineseStack = (text) => {
    secondaryLine.textContent = "";
    const engine = globalThis?.pinyinPro?.pinyin;
    const chars = Array.from(text);
    chars.forEach((char) => {
      if (char.trim() === "") {
        secondaryLine.appendChild(document.createTextNode(char));
        return;
      }
      if (!hasChinese(char)) {
        secondaryLine.appendChild(document.createTextNode(char));
        return;
      }
      const wrapper = document.createElement("span");
      wrapper.className = "lr-stack";

      const pinyin = document.createElement("span");
      pinyin.className = "lr-stack-pinyin";
      pinyin.textContent = typeof engine === "function" ? engine(char, { toneType: "symbol" }) : "";

      const hanzi = document.createElement("span");
      hanzi.className = "lr-stack-char";
      hanzi.textContent = char;

      const entry = cedictMap.get(char);
      const meaning = document.createElement("span");
      meaning.className = "lr-stack-meaning";
      meaning.textContent = entry?.defs?.[0] || "";

      wrapper.appendChild(pinyin);
      wrapper.appendChild(hanzi);
      wrapper.appendChild(meaning);
      secondaryLine.appendChild(wrapper);
    });
  };

  const renderChineseWithPinyin = (targetLine, text) => {
    targetLine.textContent = "";
    const engine = globalThis?.pinyinPro?.pinyin;
    const chars = Array.from(text);
    chars.forEach((char) => {
      if (char.trim() === "") {
        targetLine.appendChild(document.createTextNode(char));
        return;
      }
      if (!hasChinese(char)) {
        targetLine.appendChild(document.createTextNode(char));
        return;
      }
      const wrapper = document.createElement("span");
      wrapper.className = "lr-learning-word lr-char-pinyin-stack";

      const hanzi = document.createElement("span");
      hanzi.className = "lr-stack-char";
      hanzi.textContent = char;

      const pinyin = document.createElement("span");
      pinyin.className = "lr-stack-pinyin";
      pinyin.textContent = typeof engine === "function" ? engine(char, { toneType: "symbol" }) : "";

      wrapper.appendChild(hanzi);
      wrapper.appendChild(pinyin);
      wrapper.addEventListener("mouseenter", () => showPopup(wrapper, char, "zh"));
      wrapper.addEventListener("mouseleave", hidePopup);
      targetLine.appendChild(wrapper);
    });
  };

  const renderInteractiveLine = (targetLine, text, mode = "en") => {
    targetLine.textContent = "";
    const tokens = mode === "zh" ? Array.from(text) : text.split(/(\s+)/);
    tokens.forEach((token) => {
      if (token.trim() === "") {
        targetLine.appendChild(document.createTextNode(token));
        return;
      }
      if (mode === "zh" && !hasChinese(token)) {
        targetLine.appendChild(document.createTextNode(token));
        return;
      }
      const span = document.createElement("span");
      span.className = "lr-learning-word";
      span.textContent = token;
      span.addEventListener("mouseenter", () => showPopup(span, token, mode));
      span.addEventListener("mouseleave", hidePopup);
      targetLine.appendChild(span);
    });
  };

  const renderSecondaryLine = (text) => {
    if (!text) {
      secondaryLine.textContent = "";
      return;
    }
    if (!extensionEnabled) {
      secondaryLine.textContent = "";
      return;
    }
    const mode = hasChinese(text) ? "zh" : "en";
    if (mode === "zh") {
      renderChineseStack(text);
      pinyinLine.style.display = "none";
      return;
    }
    pinyinLine.style.display = "block";
    renderInteractiveLine(secondaryLine, text, mode);
  };

  const updateLine = (text) => {
    if (!extensionEnabled) {
      return;
    }
    if (!text) {
      line.textContent = "Captions not detected yet.";
      hidePopup();
      secondaryLine.textContent = translateEnabled
        ? "Secondary subtitle (waiting...)"
        : "Translation is off.";
      pinyinLine.textContent = translateEnabled ? "Pinyin (waiting...)" : "";
      return;
    }
    if (text !== lastText) {
      lastText = text;
      if (hasChinese(text)) {
        renderChineseWithPinyin(line, text);
        pinyinLine.style.display = "none";
      } else {
        renderInteractiveLine(line, text, "en");
        pinyinLine.style.display = "block";
      }
      if (!translateEnabled) {
        secondaryLine.textContent = "Translation is off.";
        return;
      }
      if (lineCache.has(text)) {
        const cached = lineCache.get(text);
        if (cached && typeof cached === "object") {
          lastTranslatedText = cached.translation || "";
          renderSecondaryLine(cached.translation || "");
          pinyinLine.textContent = cached.pinyin || "";
        } else {
          lastTranslatedText = cached || "";
          renderSecondaryLine(cached || "");
          pinyinLine.textContent = "";
        }
        return;
      }

      secondaryLine.textContent = "Translating...";
      pinyinLine.textContent = "Pinyin (translating...)";

      if (translateTimer) {
        clearTimeout(translateTimer);
      }

      translateTimer = setTimeout(() => {
        const requestedText = text;
        chrome.runtime.sendMessage(
          {
            type: "translate",
            payload: {
              text: requestedText,
              source: sourceLanguage,
              target: targetLanguage,
            },
          },
          (response) => {
            if (requestedText !== lastText) {
              return;
            }
            if (!response || !response.ok) {
              const errorText = response?.error ? `error: ${response.error}` : "translation error";
              secondaryLine.textContent = `(${errorText})`;
              pinyinLine.textContent = "";
              return;
            }
            const translatedText = response.translatedText;
            const chineseRegex = /[\u4e00-\u9fff]/;
            const pinyinSource = chineseRegex.test(translatedText) ? translatedText : text;
            const pinyin = getPinyin(pinyinSource);
            lineCache.set(requestedText, { translation: translatedText, pinyin });
            lastTranslatedText = translatedText;
            renderSecondaryLine(translatedText);
            if (!pinyin && !isPinyinReady()) {
              pinyinLine.textContent = "Pinyin not loaded (reload extension).";
              return;
            }
            pinyinLine.textContent = pinyin;
          }
        );
      }, translateDebounceMs);
    }
  };

  const readYouTubeCaptionText = () => {
    const segments = document.querySelectorAll(".ytp-caption-segment");
    if (segments.length > 0) {
      const text = Array.from(segments)
        .map((segment) => segment.textContent.trim())
        .filter(Boolean)
        .join(" ");
      return text;
    }

    const captionText = document.querySelector(".captions-text");
    if (captionText) {
      return captionText.textContent.trim();
    }

    return "";
  };

  const queryHitvIncludingShadow = (root, selector) => {
    const r = root || document;
    const found = r.querySelector(selector);
    if (found) return found;
    const all = r.querySelectorAll("*");
    for (const node of all) {
      if (node.shadowRoot) {
        const inner = node.shadowRoot.querySelector(selector);
        if (inner) return inner;
        const inShadow = queryHitvIncludingShadow(node.shadowRoot, selector);
        if (inShadow) return inShadow;
      }
    }
    return null;
  };

  const queryHitvAllIncludingShadow = (root, selector) => {
    const r = root || document;
    const found = r.querySelectorAll(selector);
    if (found.length) return found;
    const all = r.querySelectorAll("*");
    for (const node of all) {
      if (node.shadowRoot) {
        const inner = node.shadowRoot.querySelectorAll(selector);
        if (inner.length) return inner;
        const inShadow = queryHitvAllIncludingShadow(node.shadowRoot, selector);
        if (inShadow.length) return inShadow;
      }
    }
    return [];
  };

  const readHitvCaptionText = () => {
    const wrapper = queryHitvIncludingShadow(document, ".hiplayer-subtitle-wrapper");
    const spans = wrapper
      ? wrapper.querySelectorAll(".subtitle-cue span")
      : queryHitvAllIncludingShadow(document, ".subtitle-cue span");
    if (spans.length) {
      return Array.from(spans)
        .map((s) => s.textContent.trim())
        .filter(Boolean)
        .join(" ");
    }
    const cues = queryHitvAllIncludingShadow(document, ".subtitle-cue");
    if (cues.length) {
      return Array.from(cues)
        .map((c) => c.textContent.trim())
        .filter(Boolean)
        .join(" ");
    }
    return "";
  };

  const readCaptionText = () => {
    if (isHitv) return readHitvCaptionText();
    if (isYouTube) return readYouTubeCaptionText();
    return "";
  };

  const initYouTubeCaptions = () => {
    if (!extensionEnabled) return;

    const container = document.querySelector(".ytp-caption-window-container");
    if (container) {
      startObserver(container);
      return;
    }

    setTimeout(initYouTubeCaptions, 1000);
  };

  const initHitvCaptions = () => {
    if (!extensionEnabled) return;

    appendOverlay();

    if (hitvPollInterval) {
      clearInterval(hitvPollInterval);
      hitvPollInterval = null;
    }

    hitvPollInterval = setInterval(() => {
      if (!extensionEnabled) return;
      chrome.runtime.sendMessage({ type: "getHitvSubtitle" }, (response) => {
        if (chrome.runtime.lastError) return;
        const text = response?.text;
        if (text) updateLine(text);
      });
    }, 280);

    chrome.runtime.sendMessage({ type: "getHitvSubtitle" }, (response) => {
      if (chrome.runtime.lastError) return;
      const text = response?.text;
      if (text) updateLine(text);
    });
  };

  const initCaptions = () => {
    if (isYouTube) initYouTubeCaptions();
    else if (isHitv) initHitvCaptions();
  };

  initCaptions();
})();
