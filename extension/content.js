(() => {
  const existing = document.getElementById("lr-learning-overlay");
  if (existing) {
    return;
  }

  const overlay = document.createElement("div");
  overlay.id = "lr-learning-overlay";
  overlay.textContent =
    "Language Helper active: ready to read subtitles on this page.";

  document.documentElement.appendChild(overlay);
  console.log(
    "[Language Helper] content script injected on",
    window.location.href
  );
})();
