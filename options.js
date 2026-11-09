const DEFAULT_DOMAINS = ["remitalamends.qpon"];

const THEME_STORAGE_KEY = "filmoviplex-theme";

const getThemePreference = () => {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);

  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

const applyTheme = (theme) => {
  document.documentElement.setAttribute("data-theme", theme);

  const toggle = document.getElementById("themeToggle");

  if (toggle) {
    toggle.textContent = theme === "dark" ? "☀️ Light" : "🌙 Dark";
    toggle.setAttribute(
      "aria-label",
      theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
    );
  }
};


/* const normalizeDomain = domain => {

    return String(domain || "")
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .split("/")[0]
        .split(":")[0]
        .replace(/^\*\./, "");
}; */
const normalizeDomain = (domain) => {
  const input = String(domain || "").trim().replace(/^\*\./, "");
  if (!input) return "";

  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `https://${input}`);
    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    const labels = hostname.split(".");
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
        labels.length < 2 || hostname.length > 253 ||
        labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) ||
        !/^(?:[a-z]{2,}|xn--[a-z0-9-]+)$/.test(labels[labels.length - 1])) {
      return "";
    }
    return hostname;
  } catch {
    return "";
  }
};

const addDomainToList = async (domain) => {
  const normalizedDomain = normalizeDomain(domain);

  if (!normalizedDomain) {
    return false;
  }

  const data = await chrome.storage.local.get({
    blockedDomains: [],
  });

  if (data.blockedDomains.some((item) => normalizeDomain(item) === normalizedDomain)) {
    return false;
  }

  await chrome.storage.local.set({
    blockedDomains: [...data.blockedDomains, normalizedDomain],
  });

  return true;
};

/*
 * ---------------------------------------------------------
 * Load everything
 * ---------------------------------------------------------
 */

const load = async () => {
  applyTheme(getThemePreference());

  const data = await chrome.storage.local.get({
    blockedDomains: DEFAULT_DOMAINS,

    dateLocale: "",

    totalBlocked: 0,

    blockedByDomain: {},

    lastBlocked: null,

    lastBlockedDomain: null,
    blockingEnabled: true,
  });

  document.getElementById("blockingEnabled").checked = data.blockingEnabled;
  document.getElementById("dateLocale").value = data.dateLocale;

  renderDomains(data.blockedDomains);

  renderStats(data);
};

/*
 * ---------------------------------------------------------
 * Render domains
 * ---------------------------------------------------------
 */

const renderDomains = (domains) => {
  const container = document.getElementById("domains");

  container.innerHTML = "";

  domains.forEach((domain) => {
    const row = document.createElement("div");

    row.className = "domain";

    const name = document.createElement("span");

    name.className = "domain-name";

    name.textContent = domain;

    const button = document.createElement("button");

    button.className = "remove";

    button.textContent = "Remove";

    button.addEventListener("click", async () => {
      const data = await chrome.storage.local.get({
        blockedDomains: [],
      });

      const updated = data.blockedDomains.filter((d) => d !== domain);

      await chrome.storage.local.set({
        blockedDomains: updated,
      });

      showMessage(`Removed ${domain}`);

      load();
    });

    row.appendChild(name);
    row.appendChild(button);

    container.appendChild(row);
  });
};

/*
 * ---------------------------------------------------------
 * Add domain
 * ---------------------------------------------------------
 */

document.getElementById("themeToggle").addEventListener("click", () => {
  const nextTheme =
    document.documentElement.getAttribute("data-theme") === "dark"
      ? "light"
      : "dark";

  localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  applyTheme(nextTheme);
});

document.getElementById("blockingEnabled").addEventListener("change", async (event) => {
  await chrome.storage.local.set({ blockingEnabled: event.target.checked });
});

document.getElementById("addDomain").addEventListener("click", async () => {
  const input = document.getElementById("domainInput");

  const domain = normalizeDomain(input.value);

  if (!domain) {
    showMessage("Enter a valid domain or HTTP(S) URL.");

    return;
  }

  const alreadyExists = await addDomainToList(domain);

  if (!alreadyExists) {
    showMessage("That domain is already blocked.");

    return;
  }

  input.value = "";

  showMessage(`Added ${domain} and its subdomains.`);

  load();
});

/*
 * ---------------------------------------------------------
 * Enter key in domain input
 * ---------------------------------------------------------
 */

document.getElementById("domainInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    document.getElementById("addDomain").click();
  }
});

/*
 * ---------------------------------------------------------
 * Statistics
 * ---------------------------------------------------------
 */

const renderStats = (data) => {
  document.getElementById("totalBlocked").textContent = formatCompactNumber(
    data.totalBlocked || 0,
  );
  document.getElementById("exactBlocked").textContent = `(${data.totalBlocked || 0})`;

  const last = document.getElementById("lastBlocked");

  const lastDomainText = document.getElementById("lastBlockedDomainText");

  lastDomainText.textContent = "";

  if (data.lastBlocked && data.lastBlockedDomain) {
    const date = new Date(data.lastBlocked);

    last.textContent = `Last blocked: ${formatDateTime(data.lastBlocked, data.dateLocale)}`;

    const label = document.createElement("span");

    label.textContent = "Last blocked domain: ";

    lastDomainText.appendChild(label);

    const domain = normalizeDomain(data.lastBlockedDomain);

    if (data.blockedDomains.some((item) => {
      const blockedDomain = normalizeDomain(item);
      return blockedDomain && (domain === blockedDomain || domain.endsWith(`.${blockedDomain}`));
    })) {
      const value = document.createElement("span");

      value.textContent = domain;
      lastDomainText.appendChild(value);
    } else {
      const button = document.createElement("button");

      button.type = "button";
      button.className = "clickable-domain";
      button.textContent = domain;

      button.addEventListener("click", async () => {
        const added = await addDomainToList(domain);

        if (added) {
          showMessage(`Added ${domain}`);
          load();
        }
      });

      lastDomainText.appendChild(button);
    }
  } else {
    last.textContent = "No blocks recorded yet.";

    lastDomainText.textContent = "Last blocked domain: none";
  }

  const stats = document.getElementById("domainStats");

  stats.innerHTML = "";

  const byDomain = data.blockedByDomain || {};

  Object.entries(byDomain)
    .sort((a, b) => b[1] - a[1])
    .forEach(([domain, count]) => {
      const row = document.createElement("div");

      row.textContent = `${domain}: ${formatCompactNumber(count)}`;

      stats.appendChild(row);
    });
};

/*
 * ---------------------------------------------------------
 * Date format
 * ---------------------------------------------------------
 */

document.getElementById("dateLocale").addEventListener("change", async (event) => {
  await chrome.storage.local.set({ dateLocale: event.target.value });

  load();
});

/*
 * ---------------------------------------------------------
 * Reset counters
 * ---------------------------------------------------------
 */

document.getElementById("resetStats").addEventListener("click", async () => {
  if (!window.confirm("Reset all blocking statistics? This cannot be undone.")) return;

  try {
    const result = await chrome.runtime.sendMessage({ type: "RESET_STATS" });
    if (!result?.ok) throw new Error("Could not reset counters");
  } catch {
    showMessage("Could not reset counters.");
    return;
  }

  showMessage("Counters reset.");

  load();
});

/*
 * ---------------------------------------------------------
 * Message
 * ---------------------------------------------------------
 */

const showMessage = (text) => {
  const element = document.getElementById("message");

  element.textContent = text;

  setTimeout(() => {
    element.textContent = "";
  }, 2500);
};

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.blockingEnabled || changes.totalBlocked || changes.blockedDomains)) {
    load();
  }
});

load();
