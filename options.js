const DEFAULT_DOMAINS = [
    "remitalamends.qpon"
];


function normalizeDomain(domain) {

    return String(domain || "")
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .split("/")[0]
        .split(":")[0]
        .replace(/^\*\./, "");
}


/*
 * ---------------------------------------------------------
 * Load everything
 * ---------------------------------------------------------
 */

async function load() {

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


        const data =
            await chrome.storage.local.get({
                blockedDomains: []
            });


        if (
            data.blockedDomains.includes(domain)
        ) {

            showMessage(
                "That domain is already blocked."
            );

            return;
        }


        const domains = [
            ...data.blockedDomains,
            domain
        ];


        await chrome.storage.local.set({
            blockedDomains: domains
        });


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
            data.totalBlocked || 0;


    const last =
        document.getElementById("lastBlocked");


    if (
        data.lastBlocked &&
        data.lastBlockedDomain
    ) {

        const date =
            new Date(data.lastBlocked);


        last.textContent =
            `Last blocked: ${data.lastBlockedDomain} — ${date.toLocaleString()}`;

    } else {

        last.textContent =
            "No blocks recorded yet.";
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
                `${domain}: ${count}`;

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