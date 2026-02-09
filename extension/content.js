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

  const line = document.createElement("div");
  line.id = "lr-learning-line";
  line.textContent = "Waiting for subtitles...";

  const secondaryLine = document.createElement("div");
  secondaryLine.id = "lr-learning-line-secondary";
  secondaryLine.textContent = "Secondary subtitle (mirrors primary for now).";

  const popup = document.createElement("div");
  popup.id = "lr-learning-popup";
  popup.textContent = "";
  popup.style.display = "none";

  overlay.appendChild(status);
  overlay.appendChild(line);
  overlay.appendChild(secondaryLine);
  overlay.appendChild(popup);

  document.documentElement.appendChild(overlay);
  console.log("[Language Helper] content script injected on", window.location.href);

  const isYouTube =
    window.location.hostname.includes("youtube.com") ||
    window.location.hostname.includes("youtube-nocookie.com");

  if (!isYouTube) {
    line.textContent = "YouTube reader only (for now).";
    return;
  }

  let lastText = "";

  const sourceLanguage = "en";
  const targetLanguage = "zh";
  const cache = new Map();
  const lineCache = new Map();

  const showPopup = (target, word) => {
    popup.textContent = `${word} → (translating...)`;
    popup.style.display = "block";
    const rect = target.getBoundingClientRect();
    popup.style.left = `${Math.round(rect.left)}px`;
    popup.style.top = `${Math.round(rect.top - 28)}px`;

    if (cache.has(word)) {
      popup.textContent = `${word} → ${cache.get(word)}`;
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
        if (!response || !response.ok) {
          const errorText = response?.error ? `error: ${response.error}` : "translation error";
          popup.textContent = `${word} → (${errorText})`;
          return;
        }
        cache.set(word, response.translatedText);
        popup.textContent = `${word} → ${response.translatedText}`;
      }
    );
  };

  const hidePopup = () => {
    popup.style.display = "none";
  };

  const renderInteractiveLine = (text) => {
    line.textContent = "";
    const tokens = text.split(/(\s+)/);
    tokens.forEach((token) => {
      if (token.trim() === "") {
        line.appendChild(document.createTextNode(token));
        return;
      }
      const span = document.createElement("span");
      span.className = "lr-learning-word";
      span.textContent = token;
      span.addEventListener("mouseenter", () => showPopup(span, token));
      span.addEventListener("mouseleave", hidePopup);
      line.appendChild(span);
    });
  };

  const updateLine = (text) => {
    if (!text) {
      line.textContent = "Captions not detected yet.";
      hidePopup();
      secondaryLine.textContent = "Secondary subtitle (waiting...)";
      return;
    }
    if (text !== lastText) {
      lastText = text;
      renderInteractiveLine(text);
      if (lineCache.has(text)) {
        secondaryLine.textContent = lineCache.get(text);
        return;
      }

      secondaryLine.textContent = "Translating...";
      chrome.runtime.sendMessage(
        {
          type: "translate",
          payload: {
            text,
            source: sourceLanguage,
            target: targetLanguage,
          },
        },
        (response) => {
          if (!response || !response.ok) {
            const errorText = response?.error ? `error: ${response.error}` : "translation error";
            secondaryLine.textContent = `(${errorText})`;
            return;
          }
          lineCache.set(text, response.translatedText);
          secondaryLine.textContent = response.translatedText;
        }
      );
    }
  };

  const readCaptionText = () => {
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

  const startObserver = (container) => {
    const observer = new MutationObserver(() => {
      updateLine(readCaptionText());
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    updateLine(readCaptionText());
  };

  const initYouTubeCaptions = () => {
    const container = document.querySelector(".ytp-caption-window-container");
    if (container) {
      startObserver(container);
      return;
    }

    setTimeout(initYouTubeCaptions, 1000);
  };

  initYouTubeCaptions();
})();
