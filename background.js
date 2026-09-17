const DEFAULT_DOMAINS = [
    "remitalamends.qpon"
];

const RULE_ID_BASE = 1000;


/*
 * ---------------------------------------------------------
 * Normalize domain
 * ---------------------------------------------------------
 */

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
 * Get settings
 * ---------------------------------------------------------
 */

async function getDomains() {

    const data =
        await chrome.storage.local.get({
            blockedDomains: DEFAULT_DOMAINS
        });

    return data.blockedDomains
        .map(normalizeDomain)
        .filter(Boolean);
}


/*
 * ---------------------------------------------------------
 * Dynamic network rules
 * ---------------------------------------------------------
 */

async function updateRules(domains) {

    const existing =
        await chrome.declarativeNetRequest
            .getDynamicRules();

    const removeRuleIds =
        existing.map(rule => rule.id);


    const addRules =
        domains.map((domain, index) => ({

            id: RULE_ID_BASE + index,

            priority: 100,

            action: {
                type: "block"
            },

            condition: {

                requestDomains: [
                    domain
                ],

                resourceTypes: [
                    "main_frame",
                    "sub_frame",
                    "script",
                    "xmlhttprequest",
                    "other"
                ]
            }
        }));


    await chrome.declarativeNetRequest
        .updateDynamicRules({
            removeRuleIds,
            addRules
        });
}


/*
 * ---------------------------------------------------------
 * Initialize
 * ---------------------------------------------------------
 */

async function initialize() {

    let domains =
        await getDomains();


    await chrome.storage.local.set({
        blockedDomains: domains
    });


    await updateRules(domains);

    await updateBadge();
}


/*
 * ---------------------------------------------------------
 * Block counter
 * ---------------------------------------------------------
 */

async function recordBlock(domain) {

    const data =
        await chrome.storage.local.get({

            totalBlocked: 0,

            blockedByDomain: {},

            lastBlocked: null,

            lastBlockedDomain: null
        });


    const total =
        Number(data.totalBlocked) || 0;


    const byDomain =
        data.blockedByDomain || {};


    byDomain[domain] =
        (Number(byDomain[domain]) || 0) + 1;


    await chrome.storage.local.set({

        totalBlocked: total + 1,

        blockedByDomain: byDomain,

        lastBlocked:
            new Date().toISOString(),

        lastBlockedDomain:
            domain
    });


    await updateBadge();
}


/*
 * ---------------------------------------------------------
 * Badge
 * ---------------------------------------------------------
 */

async function updateBadge() {

    const data =
        await chrome.storage.local.get({
            totalBlocked: 0
        });


    const count =
        Number(data.totalBlocked) || 0;


    await chrome.action.setBadgeText({
        text:
            count > 0
                ? String(count)
                : ""
    });


    await chrome.action.setBadgeBackgroundColor({
        color: "#d93025"
    });
}


/*
 * ---------------------------------------------------------
 * Messages from bridge.js
 * ---------------------------------------------------------
 */

chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {

        if (message.type === "BLOCKED") {

            recordBlock(
                normalizeDomain(message.domain)
            );

            return;
        }


        if (message.type === "GET_DOMAINS") {

            getDomains()
                .then(domains => {

                    sendResponse({
                        domains
                    });

                })
                .catch(error => {

                    console.error(error);

                    sendResponse({
                        domains:
                            DEFAULT_DOMAINS
                    });
                });


            return true;
        }
    }
);


/*
 * ---------------------------------------------------------
 * Settings changed
 * ---------------------------------------------------------
 */

chrome.storage.onChanged.addListener(
    async (changes, area) => {

        if (
            area !== "local" ||
            !changes.blockedDomains
        ) {
            return;
        }


        const domains =
            changes.blockedDomains.newValue || [];


        await updateRules(domains);
    }
);


/*
 * ---------------------------------------------------------
 * Startup
 * ---------------------------------------------------------
 */

chrome.runtime.onInstalled.addListener(() => {
    initialize().catch(console.error);
});


chrome.runtime.onStartup.addListener(() => {
    initialize().catch(console.error);
});


initialize().catch(console.error);