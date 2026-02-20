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

  const pinyinToggle = document.createElement("button");
  pinyinToggle.id = "lr-learning-pinyin";
  pinyinToggle.type = "button";
  pinyinToggle.textContent = "Pinyin: ON";

  const hideEnToggle = document.createElement("button");
  hideEnToggle.id = "lr-learning-hide-en";
  hideEnToggle.type = "button";
  hideEnToggle.textContent = "Show EN: ON";

  const hideVideoSubsToggle = document.createElement("button");
  hideVideoSubsToggle.id = "lr-learning-hide-video-subs";
  hideVideoSubsToggle.type = "button";
  hideVideoSubsToggle.textContent = "Hide video subs: ON";

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
  controls.appendChild(pinyinToggle);
  controls.appendChild(hideEnToggle);
  controls.appendChild(hideVideoSubsToggle);
  controls.appendChild(toggle);

  overlay.appendChild(status);
  overlay.appendChild(controls);
  overlay.appendChild(line);
  overlay.appendChild(pinyinLine);
  overlay.appendChild(secondaryLine);
  overlay.appendChild(popup);

  const appendOverlay = () => document.documentElement.appendChild(overlay);

  let lastFsElement = null;

  const syncOverlayToFullscreen = () => {
    const fs = document.fullscreenElement ?? document.webkitFullscreenElement;
    const target = fs || document.documentElement;
    if (overlay.parentElement !== target) target.appendChild(overlay);
    overlay.classList.toggle("lr-fullscreen", !!fs);

    if (lastFsElement && lastFsElement !== fs) {
      overlay.classList.remove("lr-fullscreen-padding");
      lastFsElement.classList.remove("lr-fs-container", "lr-fs-video", "lr-fs-padding");
      lastFsElement.style.removeProperty("display");
      lastFsElement.style.removeProperty("flex-direction");
      lastFsElement.style.removeProperty("height");
      lastFsElement.style.removeProperty("overflow");
      lastFsElement.style.removeProperty("box-sizing");
      lastFsElement.style.removeProperty("--lr-overlay-height");
      lastFsElement.style.removeProperty("object-fit");
      lastFsElement.style.removeProperty("padding-bottom");
      Array.from(lastFsElement.children).forEach((child) => {
        if (child !== overlay) {
          child.style.removeProperty("flex");
          child.style.removeProperty("min-height");
          child.style.removeProperty("overflow");
        }
      });
      lastFsElement = null;
    }

    if (fs) {
      lastFsElement = fs;
      if (fs.tagName === "VIDEO") {
        fs.classList.add("lr-fs-video");
        fs.style.setProperty("height", "calc(100vh - var(--lr-overlay-height, 22vh))", "important");
        fs.style.setProperty("object-fit", "contain", "important");
      } else if (isHitv) {
        fs.classList.add("lr-fs-padding");
        overlay.classList.add("lr-fullscreen-padding");
        fs.style.setProperty("box-sizing", "border-box", "important");
        fs.style.setProperty("padding-bottom", "var(--lr-overlay-height, 22vh)", "important");
      } else {
        overlay.classList.remove("lr-fullscreen-padding");
        fs.classList.add("lr-fs-container");
        fs.style.setProperty("display", "flex", "important");
        fs.style.setProperty("flex-direction", "column", "important");
        fs.style.setProperty("height", "100vh", "important");
        fs.style.setProperty("overflow", "hidden", "important");
        fs.style.setProperty("box-sizing", "border-box", "important");
        Array.from(fs.children).forEach((child) => {
          if (child !== overlay) {
            child.style.setProperty("flex", "1 1 0", "important");
            child.style.setProperty("min-height", "0", "important");
            child.style.setProperty("overflow", "visible", "important");
          }
        });
      }
    }
    if (isHitv && !fs) {
      document.documentElement.classList.toggle("lr-fullscreen-active", false);
    }
  };

  const onFullscreenChange = () => {
    syncOverlayToFullscreen();
    requestAnimationFrame(updateOverlayHeightVar);
  };

  const updateOverlayHeightVar = () => {
    const h = overlay.offsetHeight;
    const target = overlay.parentElement || document.documentElement;
    target.style.setProperty("--lr-overlay-height", `${h}px`);
  };
  const ro = new ResizeObserver(updateOverlayHeightVar);
  ro.observe(overlay);
  updateOverlayHeightVar();

  document.addEventListener("fullscreenchange", onFullscreenChange);
  document.addEventListener("webkitfullscreenchange", onFullscreenChange);

  console.log("[Language Helper] content script injected on", window.location.href);

  const isYouTube =
    window.location.hostname.includes("youtube.com") ||
    window.location.hostname.includes("youtube-nocookie.com");

  const isHitv =
    window.location.hostname.includes("hitv.vip");

  if (!isYouTube && !isHitv) {
    line.textContent = "HiTV only.";
    return;
  }

  if (isHitv && window !== window.top) {
    return;
  }

  if (isYouTube || isHitv) {
    appendOverlay();
    if (isHitv) {
      overlay.classList.add("lr-hitv");
      document.documentElement.classList.add("lr-hitv-layout");
    }
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
  const STORAGE_KEY = "lr-extension-enabled";

  const loadExtensionEnabled = (cb) => {
    chrome.storage.local.get(STORAGE_KEY, (data) => {
      extensionEnabled = data[STORAGE_KEY] !== false;
      if (typeof cb === "function") cb();
    });
  };

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[STORAGE_KEY]) return;
    extensionEnabled = changes[STORAGE_KEY].newValue !== false;
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
  let translationDirection = "en-zh";
  let translateEnabled = true;
  let pinyinEnabled = true;
  let showEnTranslation = true;
  let hideNativeSubtitles = true;
  let translateTimer = null;

  const HIDE_VIDEO_SUBS_CSS = `
    .hiplayer-subtitle-wrapper,
    .hiplayer-subtitle-wrapper *,
    .subtitle-cue,
    .ytp-caption-window-container,
    .ytp-caption-window,
    #caption-window-1 {
      display: none !important;
      visibility: hidden !important;
    }
  `;

  const syncHideNativeSubtitles = () => {
    let el = document.getElementById("lr-hide-native-subs");
    if (hideNativeSubtitles) {
      if (!el) {
        el = document.createElement("style");
        el.id = "lr-hide-native-subs";
        el.textContent = HIDE_VIDEO_SUBS_CSS;
        document.head.appendChild(el);
      }
    } else if (el) {
      el.remove();
    }
  };
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

  const syncOverlayVisibility = () => {
    overlay.style.display = extensionEnabled ? "" : "none";
  };

  const updateToggleUI = () => {
    syncOverlayVisibility();
    extensionToggle.textContent = `Extension: ${extensionEnabled ? "ON" : "OFF"}`;
    directionToggle.textContent =
      translationDirection === "zh-en" ? "Direction: ZH→EN" : "Direction: EN→ZH";
    pinyinToggle.textContent = `Pinyin: ${pinyinEnabled ? "ON" : "OFF"}`;
    hideEnToggle.textContent = `Show EN: ${showEnTranslation ? "ON" : "OFF"}`;
    hideVideoSubsToggle.textContent = `Hide video subs: ${hideNativeSubtitles ? "ON" : "OFF"}`;
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
    chrome.storage.local.set({ [STORAGE_KEY]: extensionEnabled });
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

  pinyinToggle.addEventListener("click", () => {
    pinyinEnabled = !pinyinEnabled;
    updateToggleUI();
    if (lastText) {
      const currentText = lastText;
      lastText = "";
      updateLine(currentText);
    }
  });

  hideEnToggle.addEventListener("click", () => {
    showEnTranslation = !showEnTranslation;
    updateToggleUI();
    syncSecondaryLineVisibility();
  });

  hideVideoSubsToggle.addEventListener("click", () => {
    hideNativeSubtitles = !hideNativeSubtitles;
    updateToggleUI();
    syncHideNativeSubtitles();
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
      const entry = await lookupCedict(word);
      const pinyinPart = entry?.pinyin ? ` [${entry.pinyin}]` : "";

      if (translationDirection === "zh-en" && translateEnabled) {
        popup.textContent = `${word}${pinyinPart} → (translating...)`;
        chrome.runtime.sendMessage(
          {
            type: "translate",
            payload: { text: word, source: "zh", target: "en" },
          },
          (response) => {
            if (requestId !== popupRequestId) return;
            if (response?.ok && response.translatedText) {
              setPopupContent(`${word}${pinyinPart} → ${response.translatedText}`);
            } else if (entry) {
              setPopupContent(`${word}${pinyinPart} → ${entry.defs?.[0] || "definition unavailable"}`);
            } else {
              popup.textContent = `${word} → (no match)`;
            }
          }
        );
        return;
      }

      if (!entry) {
        popup.textContent = `${word} → (no match)`;
        return;
      }
      const meaning = entry.defs?.[0] || "definition unavailable";
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

  const renderChineseLine = (targetLine, text, showPinyin = true) => {
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
      wrapper.className = showPinyin ? "lr-learning-word lr-char-pinyin-stack" : "lr-learning-word lr-char-only";

      const hanzi = document.createElement("span");
      hanzi.className = "lr-stack-char";
      hanzi.textContent = char;

      wrapper.appendChild(hanzi);
      if (showPinyin) {
        const pinyin = document.createElement("span");
        pinyin.className = "lr-stack-pinyin";
        pinyin.textContent = typeof engine === "function" ? engine(char, { toneType: "symbol" }) : "";
        wrapper.appendChild(pinyin);
      }
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

  const syncSecondaryLineVisibility = () => {
    if (translationDirection === "zh-en" && !showEnTranslation && hasChinese(lastText)) {
      secondaryLine.style.display = "none";
    } else {
      secondaryLine.style.display = "";
    }
  };

  const renderSecondaryLine = (text) => {
    if (!text) {
      secondaryLine.textContent = "";
      syncSecondaryLineVisibility();
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
      syncSecondaryLineVisibility();
      return;
    }
    if (hasChinese(lastText)) {
      pinyinLine.style.display = "none";
    } else {
      pinyinLine.style.display = "block";
    }
    renderInteractiveLine(secondaryLine, text, mode);
    syncSecondaryLineVisibility();
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
      secondaryLine.style.display = "";
      pinyinLine.textContent = translateEnabled ? "Pinyin (waiting...)" : "";
      return;
    }
    if (text !== lastText) {
      lastText = text;
      if (hasChinese(text)) {
        renderChineseLine(line, text, pinyinEnabled);
        pinyinLine.style.display = "none";
      } else {
        renderInteractiveLine(line, text, "en");
        pinyinLine.style.display = "block";
      }
      if (!translateEnabled) {
        secondaryLine.textContent = "Translation is off.";
        syncSecondaryLineVisibility();
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
        syncSecondaryLineVisibility();
        return;
      }

      secondaryLine.textContent = "Translating...";
      syncSecondaryLineVisibility();
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
            syncSecondaryLineVisibility();
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

  loadExtensionEnabled(() => {
    initCaptions();
    syncHideNativeSubtitles();
    updateToggleUI();
  });
})();
