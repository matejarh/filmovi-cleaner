const DEFAULT_DOMAINS = [
    "remitalamends.qpon"
];

const THEME_STORAGE_KEY = "filmoviplex-theme";


function getThemePreference() {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);

    if (savedTheme === "light" || savedTheme === "dark") {
        return savedTheme;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}


function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);

    const toggle = document.getElementById("themeToggle");

    if (toggle) {
        toggle.textContent = theme === "dark" ? "☀️ Light" : "🌙 Dark";
        toggle.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
    }
}


function formatCompactNumber(value) {
    const number = Number(value || 0);

    if (!Number.isFinite(number) || number === 0) {
        return "0";
    }

    if (number >= 1000000) {
        const millions = number / 1000000;
        return `${millions >= 10 ? millions.toFixed(0) : millions.toFixed(1).replace(/\.0$/, "")}M`;
    }

    if (number >= 1000) {
        const thousands = number / 1000;

        if (thousands >= 100) {
            return `${thousands.toFixed(0)}k`;
        }

        return `${thousands.toFixed(1).replace(/\.0$/, "")}k`;
    }

    return String(Math.round(number));
}


function normalizeDomain(domain) {

    return String(domain || "")
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .split("/")[0]
        .split(":")[0]
        .replace(/^\*\./, "");
}


async function addDomainToList(domain) {
    const normalizedDomain = normalizeDomain(domain);

    if (!normalizedDomain) {
        return false;
    }

    const data = await chrome.storage.local.get({
        blockedDomains: []
    });

    if (data.blockedDomains.includes(normalizedDomain)) {
        return false;
    }

    await chrome.storage.local.set({
        blockedDomains: [
            ...data.blockedDomains,
            normalizedDomain
        ]
    });

    return true;
}


/*
 * ---------------------------------------------------------
 * Load everything
 * ---------------------------------------------------------
 */

async function load() {

    applyTheme(getThemePreference());

    const data =
        await chrome.storage.local.get({

            blockedDomains:
                DEFAULT_DOMAINS,

            totalBlocked:
                0,

            blockedByDomain:
                {},

            lastBlocked:
                null,

            lastBlockedDomain:
                null
        });


    renderDomains(data.blockedDomains);

    renderStats(data);
}


/*
 * ---------------------------------------------------------
 * Render domains
 * ---------------------------------------------------------
 */

function renderDomains(domains) {

    const container =
        document.getElementById("domains");

    container.innerHTML = "";


    domains.forEach(domain => {

        const row =
            document.createElement("div");

        row.className = "domain";


        const name =
            document.createElement("span");

        name.className = "domain-name";

        name.textContent = domain;


        const button =
            document.createElement("button");

        button.className = "remove";

        button.textContent = "Remove";


        button.addEventListener(
            "click",
            async () => {

                const data =
                    await chrome.storage.local.get({
                        blockedDomains: []
                    });

                const updated =
                    data.blockedDomains.filter(
                        d => d !== domain
                    );

                await chrome.storage.local.set({
                    blockedDomains: updated
                });

                showMessage(
                    `Removed ${domain}`
                );

                load();
            }
        );


        row.appendChild(name);
        row.appendChild(button);

        container.appendChild(row);
    });
}


/*
 * ---------------------------------------------------------
 * Add domain
 * ---------------------------------------------------------
 */

document
    .getElementById("themeToggle")
    .addEventListener("click", () => {
        const nextTheme = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";

        localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
        applyTheme(nextTheme);
    });


document
    .getElementById("addDomain")
    .addEventListener("click", async () => {

        const input =
            document.getElementById("domainInput");

        const domain =
            normalizeDomain(input.value);


        if (!domain) {

            showMessage(
                "Please enter a domain."
            );

            return;
        }

        const alreadyExists =
            await addDomainToList(domain);

        if (!alreadyExists) {
            showMessage(
                "That domain is already blocked."
            );

            return;
        }


        input.value = "";

        showMessage(
            `Added ${domain}`
        );

        load();
    });


/*
 * ---------------------------------------------------------
 * Enter key in domain input
 * ---------------------------------------------------------
 */

document
    .getElementById("domainInput")
    .addEventListener("keydown", event => {

        if (event.key === "Enter") {

            document
                .getElementById("addDomain")
                .click();
        }
    });


/*
 * ---------------------------------------------------------
 * Statistics
 * ---------------------------------------------------------
 */

function renderStats(data) {

    document
        .getElementById("totalBlocked")
        .textContent =
            formatCompactNumber(data.totalBlocked || 0);


    const last =
        document.getElementById("lastBlocked");

    const lastDomainText =
        document.getElementById("lastBlockedDomainText");


    lastDomainText.textContent = "";

    if (
        data.lastBlocked &&
        data.lastBlockedDomain
    ) {

        const date =
            new Date(data.lastBlocked);


        last.textContent =
            `Last blocked: ${date.toLocaleString()}`;

        const label =
            document.createElement("span");

        label.textContent = "Last blocked domain: ";

        lastDomainText.appendChild(label);

        const domain = normalizeDomain(data.lastBlockedDomain);

        if (data.blockedDomains.includes(domain)) {
            const value =
                document.createElement("span");

            value.textContent = domain;
            lastDomainText.appendChild(value);
        } else {
            const button =
                document.createElement("button");

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

        last.textContent =
            "No blocks recorded yet.";

        lastDomainText.textContent =
            "Last blocked domain: none";
    }


    const stats =
        document.getElementById("domainStats");

    stats.innerHTML = "";


    const byDomain =
        data.blockedByDomain || {};


    Object.entries(byDomain)
        .sort((a, b) => b[1] - a[1])
        .forEach(([domain, count]) => {

            const row =
                document.createElement("div");

            row.textContent =
                `${domain}: ${formatCompactNumber(count)}`;

            stats.appendChild(row);
        });
}


/*
 * ---------------------------------------------------------
 * Reset counters
 * ---------------------------------------------------------
 */

document
    .getElementById("resetStats")
    .addEventListener("click", async () => {

        await chrome.storage.local.set({

            totalBlocked: 0,

            blockedByDomain: {},

            lastBlocked: null,

            lastBlockedDomain: null
        });


        showMessage(
            "Counters reset."
        );

        load();
    });


/*
 * ---------------------------------------------------------
 * Message
 * ---------------------------------------------------------
 */

function showMessage(text) {

    const element =
        document.getElementById("message");

    element.textContent = text;

    setTimeout(() => {
        element.textContent = "";
    }, 2500);
}


load();