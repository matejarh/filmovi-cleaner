const formatNumber = value => {
    const number = Number(value || 0);

    if (!Number.isFinite(number)) {
        return "0";
    }

    return new Intl.NumberFormat().format(number);
};


const renderStats = data => {
    document.getElementById("totalBlocked").textContent = formatNumber(data.totalBlocked);

    const lastBlocked = document.getElementById("lastBlocked");

    if (data.lastBlocked && data.lastBlockedDomain) {
        const date = new Date(data.lastBlocked);
        lastBlocked.textContent = "";

        const dateLabel = document.createElement("strong");
        dateLabel.textContent = date.toLocaleString();

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
        value.textContent = formatNumber(count);

        row.append(name, value);
        domainStats.appendChild(row);
    });
};


chrome.storage.local.get({
    totalBlocked: 0,
    blockedByDomain: {},
    lastBlocked: null,
    lastBlockedDomain: null
}).then(renderStats);


document.getElementById("openOptions").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
});
