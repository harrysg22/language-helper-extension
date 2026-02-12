chrome.runtime.onInstalled.addListener(() => {
  console.log("Language Helper installed");
});

const MYMEMORY_URL = "https://api.mymemory.translated.net/get";

const translateText = async ({ text, source = "en", target = "zh" }) => {
  const query = new URLSearchParams({
    q: text,
    langpair: `${source}|${target}`,
  });

  const response = await fetch(`${MYMEMORY_URL}?${query.toString()}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const textBody = await response.text();
    throw new Error(`MyMemory HTTP ${response.status}: ${textBody.slice(0, 200)}`);
  }

  const data = await response.json();
  const status = data?.responseStatus;
  if (status !== 200) {
    const details = data?.responseDetails || "Unknown error";
    throw new Error(`MyMemory error ${status}: ${details}`);
  }

  return data?.responseData?.translatedText || "";
};

function getHitvSubtitleFromPage() {
  const spans = document.querySelectorAll(".subtitle-cue span");
  if (spans.length) {
    return Array.from(spans)
      .map((s) => s.textContent.trim())
      .filter(Boolean)
      .join(" ");
  }
  const cues = document.querySelectorAll(".subtitle-cue");
  return Array.from(cues)
    .map((c) => c.textContent.trim())
    .filter(Boolean)
    .join(" ");
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "getHitvSubtitle") {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ text: "" });
      return;
    }
    chrome.scripting
      .executeScript({
        target: { tabId, allFrames: true },
        func: getHitvSubtitleFromPage,
        world: "MAIN",
      })
      .then((results) => {
        const text =
          results?.map((r) => r.result).find((t) => t && typeof t === "string") || "";
        sendResponse({ text });
      })
      .catch(() => sendResponse({ text: "" }));
    return true;
  }

  if (message?.type !== "translate") {
    return;
  }

  translateText(message.payload)
    .then((translatedText) => {
      sendResponse({ ok: true, translatedText });
    })
    .catch((error) => {
      sendResponse({ ok: false, error: error.message });
    });

  return true;
});
