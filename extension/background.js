chrome.runtime.onInstalled.addListener(() => {
  console.log("Language Helper installed");
});

const LIBRETRANSLATE_INSTANCES = [
  "https://libretranslate.com",
  "https://libretranslate.org",
];
const LIBRETRANSLATE_API_KEY = "";

const translateText = async ({ text, source = "auto", target = "zh" }) => {
  let lastError = "Unknown error";

  for (const baseUrl of LIBRETRANSLATE_INSTANCES) {
    const response = await fetch(`${baseUrl}/translate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        q: text,
        source,
        target,
        format: "text",
        api_key: LIBRETRANSLATE_API_KEY || undefined,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.translatedText || "";
    }

    let errorDetail = "";
    try {
      const errorJson = await response.json();
      errorDetail = errorJson.error || JSON.stringify(errorJson);
    } catch {
      try {
        errorDetail = await response.text();
      } catch {
        errorDetail = "";
      }
    }

    lastError = `LibreTranslate ${response.status} from ${baseUrl}${
      errorDetail ? `: ${errorDetail}` : ""
    }`;
  }

  throw new Error(lastError);
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
