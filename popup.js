const setBlockingState = enabled => {
    document.getElementById("blockingEnabled").checked = enabled;
    document.getElementById("blockingStatus").textContent = enabled ? "Blocking enabled" : "Blocking disabled";
};

const renderStats = data => {
    document.getElementById("totalBlocked").textContent = formatCompactNumber(data.totalBlocked);
    document.getElementById("exactBlocked").textContent = `(${data.totalBlocked || 0})`;
    setBlockingState(data.blockingEnabled);

    const lastBlocked = document.getElementById("lastBlocked");

    if (data.lastBlocked && data.lastBlockedDomain) {
        const date = new Date(data.lastBlocked);
        lastBlocked.textContent = "";

        const dateLabel = document.createElement("strong");
        dateLabel.textContent = formatDateTime(data.lastBlocked, data.dateLocale);

        const domainLabel = document.createElement("strong");
        domainLabel.textContent = data.lastBlockedDomain;

        lastBlocked.append("Last blocked ", dateLabel, document.createElement("br"), "Domain ", domainLabel);
    } else {
        lastBlocked.textContent = "No blocks recorded yet.";
    }

    const domainStats = document.getElementById("domainStats");
    const entries = Object.entries(data.blockedByDomain || {})
        .sort((a, b) => Number(b[1]) - Number(a[1]));

    domainStats.innerHTML = "";

    if (entries.length === 0) {
        domainStats.innerHTML = '<div class="empty">No domain activity yet.</div>';
        return;
    }

    entries.forEach(([domain, count]) => {
        const row = document.createElement("div");
        row.className = "domain-row";

        const name = document.createElement("span");
        name.className = "domain-name";
        name.textContent = domain;

        const value = document.createElement("span");
        value.className = "domain-count";
        value.textContent = formatCompactNumber(count);

        row.append(name, value);
        domainStats.appendChild(row);
    });
};


const loadStats = () => chrome.storage.local.get({
    totalBlocked: 0,
    blockedByDomain: {},
    lastBlocked: null,
    lastBlockedDomain: null,
    dateLocale: "",
    blockingEnabled: true
}).then(renderStats);

loadStats();

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.totalBlocked || changes.blockingEnabled)) loadStats();
});

document.getElementById("blockingEnabled").addEventListener("change", event => {
    setBlockingState(event.target.checked);
    chrome.storage.local.set({ blockingEnabled: event.target.checked });
});

document.getElementById("openOptions").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
});
