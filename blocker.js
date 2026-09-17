(() => {
    "use strict";

    const PREFIX = "[FilmoviPlex Cleaner]";

    let blockedDomains = [
        "remitalamends.qpon"
    ];


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
     * Check whether URL belongs to a blocked domain
     * ---------------------------------------------------------
     */

    function getBlockedDomain(value) {

        if (!value)
            return null;

        try {

            const url =
                new URL(value, location.href);

            const hostname =
                url.hostname.toLowerCase();

            for (const domain of blockedDomains) {

                if (
                    hostname === domain ||
                    hostname.endsWith("." + domain)
                ) {
                    return domain;
                }
            }

        } catch {
            // Invalid URL.
        }

        return null;
    }


    /*
     * ---------------------------------------------------------
     * Tell extension service worker about a block
     * ---------------------------------------------------------
     */

    function recordBlock(domain) {

        try {

            window.postMessage({
                source: "filmoviPlexCleaner",
                type: "BLOCKED",
                domain: domain
            }, "*");

        } catch (error) {

            console.error(
                PREFIX,
                "Could not report block:",
                error
            );
        }
    }


    /*
     * ---------------------------------------------------------
     * Listen for settings from extension context
     * ---------------------------------------------------------
     */

    window.addEventListener(
        "message",
        event => {

            if (event.source !== window)
                return;

            const data = event.data;

            if (
                !data ||
                data.source !== "filmoviPlexCleanerExtension"
            ) {
                return;
            }

            if (
                data.type === "SET_DOMAINS" &&
                Array.isArray(data.domains)
            ) {

                blockedDomains =
                    data.domains
                        .map(normalizeDomain)
                        .filter(Boolean);

                console.log(
                    PREFIX,
                    "Updated domains:",
                    blockedDomains
                );
            }
        }
    );


    /*
     * ---------------------------------------------------------
     * FORM.submit()
     * ---------------------------------------------------------
     */

    const originalSubmit =
        HTMLFormElement.prototype.submit;

    HTMLFormElement.prototype.submit =
        function () {

            const domain =
                getBlockedDomain(this.action);

            if (domain) {

                console.log(
                    PREFIX,
                    "BLOCKED FORM.SUBMIT:",
                    domain,
                    this.action
                );

                recordBlock(domain);

                return;
            }

            return originalSubmit.call(this);
        };


    /*
     * ---------------------------------------------------------
     * FORM.requestSubmit()
     * ---------------------------------------------------------
     */

    if (HTMLFormElement.prototype.requestSubmit) {

        const originalRequestSubmit =
            HTMLFormElement.prototype.requestSubmit;

        HTMLFormElement.prototype.requestSubmit =
            function (...args) {

                const domain =
                    getBlockedDomain(this.action);

                if (domain) {

                    console.log(
                        PREFIX,
                        "BLOCKED FORM.REQUEST_SUBMIT:",
                        domain,
                        this.action
                    );

                    recordBlock(domain);

                    return;
                }

                return originalRequestSubmit.apply(
                    this,
                    args
                );
            };
    }


    /*
     * ---------------------------------------------------------
     * window.open()
     * ---------------------------------------------------------
     */

    const originalOpen =
        window.open;

    window.open =
        function (url, target, features) {

            const domain =
                getBlockedDomain(url);

            if (domain) {

                console.log(
                    PREFIX,
                    "BLOCKED WINDOW.OPEN:",
                    domain,
                    url
                );

                recordBlock(domain);

                return null;
            }

            return originalOpen.call(
                this,
                url,
                target,
                features
            );
        };


    console.log(
        PREFIX,
        window === window.top
            ? "TOP"
            : "FRAME",
        location.href
    );

})();