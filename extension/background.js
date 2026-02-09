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
