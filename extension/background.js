chrome.runtime.onInstalled.addListener(() => {
  console.log("Language Helper installed");
});

const LIBRETRANSLATE_INSTANCES = [
  "https://libretranslate.org",
  "https://libretranslate.com/translate",
  "https://libretranslate.com",
];
const LIBRETRANSLATE_API_KEY = "";

const translateText = async ({ text, source = "auto", target = "zh" }) => {
  let lastError = "Unknown error";

  for (const baseUrl of LIBRETRANSLATE_INSTANCES) {
    const res = await fetch(`${baseUrl}/translate`, {
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

    const contentType = res.headers.get("content-type") || "";

    if (!res.ok) {
      const textBody = await res.text();
      lastError = `HTTP ${res.status} from ${baseUrl}. Body: ${textBody.slice(
        0,
        200
      )}`;
      continue;
    }

    if (!contentType.includes("application/json")) {
      const textBody = await res.text();
      lastError = `Expected JSON but got "${contentType}" from ${baseUrl}. Body starts: ${textBody.slice(
        0,
        200
      )}`;
      continue;
    }

    const data = await res.json();
    return data.translatedText || "";
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
