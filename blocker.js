(() => {
  "use strict";

  const PREFIX = "[FilmoviPlex Cleaner]";

  let blockedDomains = [];

  /*
   * ---------------------------------------------------------
   * Normalize domain
   * ---------------------------------------------------------
   */

  /*     const normalizeDomain = domain => {

        return String(domain || "")
            .trim()
            .toLowerCase()
            .replace(/^https?:\/\//, "")
            .split("/")[0]
            .split(":")[0]
            .replace(/^\*\./, "");
    }; */
  const normalizeDomain = (domain) => {
    const input = String(domain || "")
      .trim()
      .toLowerCase();
    const suffixMatch = input.match(/^\.([a-z]{2,}|xn--[a-z0-9-]+)$/);
    if (suffixMatch) return `.${suffixMatch[1]}`;
    const wildcardMatch = input.match(/^\*\.([a-z]{2,}|xn--[a-z0-9-]+)$/);
    if (wildcardMatch) return `.${wildcardMatch[1]}`;
    const bareMatch = input.match(/^[a-z]{2,}$|^xn--[a-z0-9-]+$/);
    if (bareMatch) return `.${bareMatch[0]}`;

    return input
      .replace(/^https?:\/\//, "")
      .split("/")[0]
      .split(":")[0]
      .replace(/^\*\./, "")
      .replace(/^\.+|\.+$/g, "");
  };

  /*
   * ---------------------------------------------------------
   * Check whether URL belongs to a blocked domain
   * ---------------------------------------------------------
   */

  /*   const getBlockedDomain = (value) => {
    if (!value) return null;

    try {
      const url = new URL(value, location.href);

      const hostname = url.hostname.toLowerCase();

      for (const domain of blockedDomains) {
        if (hostname === domain || hostname.endsWith("." + domain)) {
          return domain;
        }
      }
    } catch {
      // Invalid URL.
    }

    return null;
  }; */
  const getBlockedDomain = (value) => {
    if (!value) return null;

    try {
      const url = new URL(value, location.href);
      const hostname = url.hostname.toLowerCase();

      for (const domain of blockedDomains) {
        const base = domain.startsWith(".")
          ? domain.slice(1)
          : domain.startsWith("*.")
            ? domain.slice(2)
            : domain;
        if (hostname === base || hostname.endsWith("." + base)) return hostname;
      }
    } catch {}

    return null;
  };

  // DNR remains the authoritative network block. Intercept ordinary links in
  // the page as well so popup tabs cannot be opened before that request runs.
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey ||
        event.shiftKey || event.altKey) return;

    const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!target) return;

    if (target.target && target.target.toLowerCase() !== "_self") {
      const popupDomain = normalizeDomain(target.href);
      if (popupDomain && !getBlockedDomain(target.href)) {
        recordPopup(popupDomain);
      }
      return;
    }

    const domain = getBlockedDomain(target.href);
    if (!domain) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    console.log(PREFIX, "BLOCKED LINK:", domain, target.href);
    recordBlock(domain);
  }, true);

  /*
   * ---------------------------------------------------------
   * Tell extension service worker about a block
   * ---------------------------------------------------------
   */

  const recordBlock = (domain) => {
    try {
      window.postMessage(
        {
          source: "filmoviPlexCleaner",
          type: "BLOCKED",
          domain: domain,
        },
        "*",
      );
    } catch (error) {
      console.error(PREFIX, "Could not report block:", error);
    }
  };

  const recordPopup = (domain) => {
    try {
      window.postMessage(
        {
          source: "filmoviPlexCleaner",
          type: "POPUP",
          domain: domain,
        },
        "*",
      );
    } catch (error) {
      console.error(PREFIX, "Could not report popup:", error);
    }
  };

  /*
   * ---------------------------------------------------------
   * Listen for settings from extension context
   * ---------------------------------------------------------
   */

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;

    const data = event.data;

    if (!data || data.source !== "filmoviPlexCleanerExtension") {
      return;
    }

    if (data.type === "SET_DOMAINS" && Array.isArray(data.domains)) {
      blockedDomains = data.enabled ? data.domains.map(normalizeDomain).filter(Boolean) : [];

      console.log(PREFIX, "Updated domains:", blockedDomains);
    }
  });

  /*
   * ---------------------------------------------------------
   * FORM.submit()
   * ---------------------------------------------------------
   */

  const originalSubmit = HTMLFormElement.prototype.submit;

  HTMLFormElement.prototype.submit = function () {
    const domain = getBlockedDomain(this.action);

    if (domain) {
      console.log(PREFIX, "BLOCKED FORM.SUBMIT:", domain, this.action);

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
    const originalRequestSubmit = HTMLFormElement.prototype.requestSubmit;

    HTMLFormElement.prototype.requestSubmit = function (...args) {
      const domain = getBlockedDomain(this.action);

      if (domain) {
        console.log(
          PREFIX,
          "BLOCKED FORM.REQUEST_SUBMIT:",
          domain,
          this.action,
        );

        recordBlock(domain);

        return;
      }

      return originalRequestSubmit.apply(this, args);
    };
  }

  /*
   * ---------------------------------------------------------
   * window.open()
   * ---------------------------------------------------------
   */

  const originalOpen = window.open;

  window.open = function (url, target, features) {
    const domain = getBlockedDomain(url);

    if (domain) {
      console.log(PREFIX, "BLOCKED WINDOW.OPEN:", domain, url);

      recordBlock(domain);

      return null;
    }

    let popupDomain = "";
    try {
      popupDomain = normalizeDomain(new URL(url, location.href).hostname);
    } catch {}
    if (popupDomain) {
      recordPopup(popupDomain);
    }

    return originalOpen.call(this, url, target, features);
  };

  console.log(PREFIX, window === window.top ? "TOP" : "FRAME", location.href);
})();
