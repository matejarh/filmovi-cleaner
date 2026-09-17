(() => {
    "use strict";

    const PREFIX = "[FilmoviPlex Cleaner Bridge]";


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
            data.type !== "BLOCKED"
        ) {
            return;
        }

        chrome.runtime.sendMessage({
            type: "BLOCKED",
            domain: data.domain
        });
    });


    /*
     * Ask background for current settings.
     */

    chrome.runtime.sendMessage({
        type: "GET_DOMAINS"
    }, response => {

        if (
            chrome.runtime.lastError ||
            !response
        ) {
            return;
        }

        window.postMessage({
            source: "filmoviPlexCleanerExtension",
            type: "SET_DOMAINS",
            domains: response.domains
        }, "*");
    });

})();