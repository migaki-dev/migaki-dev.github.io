const storageKey = "migaki-theme";
const themeChoices = new Set(["system", "light", "dark"]);
const buttons = document.querySelectorAll("[data-theme-choice]");

function activeTheme() {
  const saved = localStorage.getItem(storageKey);
  return themeChoices.has(saved) ? saved : "system";
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  for (const button of buttons) {
    button.setAttribute("aria-pressed", String(button.dataset.themeChoice === theme));
  }
}

for (const button of buttons) {
  button.addEventListener("click", () => {
    const theme = button.dataset.themeChoice;
    if (!themeChoices.has(theme)) {
      return;
    }

    if (theme === "system") {
      localStorage.removeItem(storageKey);
    } else {
      localStorage.setItem(storageKey, theme);
    }

    applyTheme(theme);
  });
}

applyTheme(activeTheme());
