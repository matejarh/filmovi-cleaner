(() => {
    "use strict";

    const PREFIX = "[FilmoviPlex Cleaner Bridge]";

    const safeSendMessage = (message, callback) => {
        try {
            if (!chrome?.runtime?.id) {
                return;
            }

            chrome.runtime.sendMessage(message, callback || (() => {}));
        } catch (error) {
            if (error && error.message && error.message.includes("Extension context invalidated")) {
                return;
            }

            console.warn(`${PREFIX} Unable to send message`, error);
        }
    };


    /*
     * Receive messages from MAIN-world blocker.js
     */

    window.addEventListener("message", event => {

        if (event.source !== window)
            return;

        const data = event.data;

        if (
            !data ||
            data.source !== "filmoviPlexCleaner" ||
            (data.type !== "BLOCKED" && data.type !== "POPUP")
        ) {
            return;
        }

        safeSendMessage({
            type: data.type,
            domain: data.domain
        });
    });


    /*
     * Ask background for current settings.
     */

    let settingsVersion = 0;
    const refreshSettings = async () => {
        const version = ++settingsVersion;
        try {
            const settings = await chrome.storage.local.get({
                blockedDomains: ["remitalamends.qpon"],
                blockingEnabled: true
            });
            if (version !== settingsVersion) return;
            window.postMessage({
                source: "filmoviPlexCleanerExtension",
                type: "SET_DOMAINS",
                domains: settings.blockedDomains,
                enabled: settings.blockingEnabled
            }, "*");
        } catch (error) {
            if (!(error && error.message && error.message.includes("Extension context invalidated"))) {
                console.warn(`${PREFIX} Unable to update settings`, error);
            }
        }
    };
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && (changes.blockedDomains || changes.blockingEnabled)) {
            refreshSettings();
        }
    });

    refreshSettings();
})();