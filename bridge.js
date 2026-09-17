(() => {
    "use strict";

    const PREFIX = "[FilmoviPlex Cleaner Bridge]";

    function safeSendMessage(message, callback) {
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
    }


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

        safeSendMessage({
            type: "BLOCKED",
            domain: data.domain
        });
    });


    /*
     * Ask background for current settings.
     */

    safeSendMessage({
        type: "GET_DOMAINS"
    }, response => {

        if (!response) {
            return;
        }

        try {
            window.postMessage({
                source: "filmoviPlexCleanerExtension",
                type: "SET_DOMAINS",
                domains: response.domains
            }, "*");
        } catch (error) {
            if (!(error && error.message && error.message.includes("Extension context invalidated"))) {
                console.warn(`${PREFIX} Unable to post domains`, error);
            }
        }
    });

})();