const preferenceKey = "invoicegenerator-theme";
const modes = ["system", "light", "dark"];

export function initTheme() {
  const select = document.getElementById("theme");
  const root = document.documentElement;
  const browserColor = document.querySelector('meta[name="theme-color"]');
  const system = window.matchMedia("(prefers-color-scheme: dark)");
  let mode = "system";
  try {
    const saved = localStorage.getItem(preferenceKey);
    if (modes.includes(saved)) mode = saved;
  } catch {
    // The selector also works when storage is unavailable.
  }

  function apply() {
    root.dataset.theme =
      mode === "system" ? (system.matches ? "dark" : "light") : mode;
    browserColor?.setAttribute(
      "content",
      getComputedStyle(root).getPropertyValue("--bg").trim(),
    );
  }

  select.value = mode;
  apply();
  select.addEventListener("change", () => {
    mode = modes.includes(select.value) ? select.value : "system";
    try {
      localStorage.setItem(preferenceKey, mode);
    } catch {
      // Keep the choice for the current session.
    }
    apply();
  });
  const syncSystem = () => {
    if (mode === "system") apply();
  };
  if (system.addEventListener) system.addEventListener("change", syncSystem);
  else system.addListener?.(syncSystem);
}
