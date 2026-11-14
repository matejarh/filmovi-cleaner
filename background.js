importScripts("format.js");

const DEFAULT_DOMAINS = ["remitalamends.qpon"];

const RULE_ID_BASE = 1000;

/*
 * ---------------------------------------------------------
 * Normalize domain
 * ---------------------------------------------------------
 */

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
  return String(domain || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split(":")[0]
    .replace(/^\*\./, "");
};

/*
 * ---------------------------------------------------------
 * Get settings
 * ---------------------------------------------------------
 */

const getDomains = async () => {
  const data = await chrome.storage.local.get({
    blockedDomains: DEFAULT_DOMAINS,
  });

  return data.blockedDomains.map(normalizeDomain).filter(Boolean);
};

/*
 * ---------------------------------------------------------
 * Dynamic network rules
 * ---------------------------------------------------------
 */

const updateRules = async (domains) => {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();

  const removeRuleIds = existing.map((rule) => rule.id);

  const addRules = domains.map((domain, index) => ({
    id: RULE_ID_BASE + index,

    priority: 100,

    action: {
      type: "block",
    },

    condition: {
      // These are user-selected blocked destinations. Keep the rule effective
      // for direct clicks and browser history navigations too, where Chromium
      // may not report FilmoviPlex as the request initiator.
      requestDomains: [domain],

      resourceTypes: [
        "main_frame",
        "sub_frame",
        "script",
        "xmlhttprequest",
        "other",
      ],
    },
  }));

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules,
  });
};

/*
 * ---------------------------------------------------------
 * Initialize
 * ---------------------------------------------------------
 */

const initialize = async () => {
  await refreshRules();
  await refreshBadge();
};

/*
 * ---------------------------------------------------------
 * Block counter
 * ---------------------------------------------------------
 */

const recordBlock = async (domain) => {
  const data = await chrome.storage.local.get({
    totalBlocked: 0,

    blockedByDomain: {},

    lastBlocked: null,

    lastBlockedDomain: null,
  });

  const total = Number(data.totalBlocked) || 0;

  const byDomain = data.blockedByDomain || {};

  byDomain[domain] = (Number(byDomain[domain]) || 0) + 1;

  await chrome.storage.local.set({
    totalBlocked: total + 1,

    blockedByDomain: byDomain,

    lastBlocked: new Date().toISOString(),

    lastBlockedDomain: domain,
  });

};

let blockQueue = Promise.resolve();

const queueStats = (operation) => {
  const task = blockQueue.then(operation);
  blockQueue = task.catch((error) => console.error("Could not update statistics:", error));
  return task;
};

const queueBlock = (domain) => queueStats(() => recordBlock(domain)).catch(() => {});

chrome.declarativeNetRequest.onRuleMatchedDebug?.addListener((info) => {
  if (!info.request?.url) {
    return;
  }

  try {
    queueBlock(new URL(info.request.url).hostname);
  } catch {
    // Ignore malformed request URLs.
  }
});

/*
 * ---------------------------------------------------------
 * Badge
 * ---------------------------------------------------------
 */

const updateBadge = async () => {
  const data = await chrome.storage.local.get({
    totalBlocked: 0,
    blockingEnabled: true,
  });

  const count = Number(data.totalBlocked) || 0;

  await chrome.action.setBadgeText({
    text: data.blockingEnabled ? (count > 0 ? formatCompactNumber(count) : "") : "OFF",
  });

  await chrome.action.setBadgeBackgroundColor({
    color: "#d93025",
  });
};

let badgeQueue = Promise.resolve();
const refreshBadge = () => {
  badgeQueue = badgeQueue.then(updateBadge).catch(console.error);
  return badgeQueue;
};

let ruleQueue = Promise.resolve();
const refreshRules = () => {
  ruleQueue = ruleQueue.then(async () => {
    const data = await chrome.storage.local.get({
      blockedDomains: DEFAULT_DOMAINS,
      blockingEnabled: true,
    });
    await updateRules(data.blockingEnabled ? data.blockedDomains.map(normalizeDomain).filter(Boolean) : []);
  }).catch(console.error);
  return ruleQueue;
};

/*
 * ---------------------------------------------------------
 * Messages from bridge.js
 * ---------------------------------------------------------
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "BLOCKED") {
    const domain = normalizeDomain(message.domain);
    if (domain && sender.url && /^https?:\/\/(?:[^/]+\.)?filmoviplex\.com(?::\d+)?(?:\/|$)/i.test(sender.url)) {
      queueBlock(domain);
    }

    return;
  }

  if (message.type === "RESET_STATS" && !sender.tab) {
    queueStats(() => chrome.storage.local.set({
      totalBlocked: 0,
      blockedByDomain: {},
      lastBlocked: null,
      lastBlockedDomain: null,
    })).then(() => sendResponse({ ok: true }), () => sendResponse({ ok: false }));
    return true;
  }

  if (message.type === "GET_DOMAINS") {
    getDomains()
      .then((domains) => {
        sendResponse({
          domains,
        });
      })
      .catch((error) => {
        console.error(error);

        sendResponse({
          domains: DEFAULT_DOMAINS,
        });
      });

    return true;
  }
});

/*
 * ---------------------------------------------------------
 * Settings changed
 * ---------------------------------------------------------
 */

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") {
    return;
  }

  if (changes.blockedDomains || changes.blockingEnabled) {
    refreshRules();
  }
  if (changes.totalBlocked || changes.blockingEnabled) {
    refreshBadge();
  }
});

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
