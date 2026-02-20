const STORAGE_KEY = "lr-extension-enabled";

document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("toggle");
  chrome.storage.local.get(STORAGE_KEY, (data) => {
    const enabled = data[STORAGE_KEY] !== false;
    toggle.classList.toggle("on", enabled);
    toggle.setAttribute("aria-checked", enabled);
  });

  toggle.addEventListener("click", () => {
    const enabled = toggle.classList.toggle("on");
    toggle.setAttribute("aria-checked", enabled);
    chrome.storage.local.set({ [STORAGE_KEY]: enabled });
  });
});
