const storageKey = "migaki-theme";
const themeChoices = new Set(["light", "dark"]);
const toggle = document.querySelector("[data-theme-toggle]");
const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");

function activeTheme() {
  const saved = localStorage.getItem(storageKey);
  if (themeChoices.has(saved)) {
    return saved;
  }

  return systemTheme.matches ? "dark" : "light";
}

function applyTheme(theme, { persist = false } = {}) {
  document.documentElement.dataset.theme = theme;
  if (persist) {
    localStorage.setItem(storageKey, theme);
  }

  if (toggle) {
    const isDark = theme === "dark";
    toggle.setAttribute("aria-pressed", String(isDark));
    toggle.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} theme`);
  }
}

if (toggle) {
  toggle.addEventListener("click", () => {
    applyTheme(activeTheme() === "dark" ? "light" : "dark", { persist: true });
  });
}

function handleSystemThemeChange() {
  if (!themeChoices.has(localStorage.getItem(storageKey))) {
    applyTheme(activeTheme());
  }
}

if (typeof systemTheme.addEventListener === "function") {
  systemTheme.addEventListener("change", handleSystemThemeChange);
} else {
  systemTheme.addListener(handleSystemThemeChange);
}

applyTheme(activeTheme());
