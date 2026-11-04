"use strict";

(function (root, factory) {
    const claimState = factory();
    if (typeof module === "object" && module.exports) {
        module.exports = claimState;
    } else {
        root.MajlisClaimState = claimState;
    }
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
    function normalizeOfferLabel(label) {
        return String(label || "")
            .replace(/<[^>]*>/g, " ")
            .replace(/₹/g, "Rs.")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
    }

    function normalizeMobileNumber(value) {
        if (value === null || value === undefined) return null;

        const formatted = String(value).trim();
        if (!/^[\d\s()+.-]+$/.test(formatted)) return null;

        let digits = formatted.replace(/\D/g, "");
        if (digits.length === 14 && digits.startsWith("0091")) {
            digits = digits.slice(4);
        } else if (digits.length === 13 && digits.startsWith("091")) {
            digits = digits.slice(3);
        } else if (digits.length === 12 && digits.startsWith("91")) {
            digits = digits.slice(2);
        } else if (digits.length === 11 && digits.startsWith("0")) {
            digits = digits.slice(1);
        }

        return /^[6-9]\d{9}$/.test(digits) ? digits : null;
    }

    function offerClaimedKey(mobileNumber, offerId) {
        const normalizedMobile = normalizeMobileNumber(mobileNumber);
        return normalizedMobile && offerId
            ? `majlis_claimed_${normalizedMobile}_${encodeURIComponent(offerId)}`
            : null;
    }

    function offerClaimedAtKey(mobileNumber, offerId) {
        const normalizedMobile = normalizeMobileNumber(mobileNumber);
        return normalizedMobile && offerId
            ? `majlis_claimed_at_${normalizedMobile}_${encodeURIComponent(offerId)}`
            : null;
    }

    function resolveClassicRewardId(rewardId, label) {
        if (rewardId === "offer10PercentNext"
            && normalizeOfferLabel(label) === "5% off on delivery orders") {
            return "delivery_5_percent_orders_v1";
        }
        return rewardId;
    }

    function inferLegacyOfferId(label) {
        const normalizedLabel = normalizeOfferLabel(label);
        const idsByLabel = {
            "5% off on delivery orders": "delivery_5_percent_orders_v1",
            "rs.50 off on bill above rs.499": "offer50Rs",
            "rs.75 off on bill above rs.699": "offer75Rs",
            "rs.100 off on bill above rs.999": "offer100Rs",
            "rs.150 off on bill above rs.1299": "offer150Rs",
            "5% off on next purchase": "offer5PercentNext",
            "10% off on next purchase": "legacy_unresolved_10pct_next_purchase",
            "21% off": "offer20",
            "rs.174 for unlimited mandi (qtr)": "offer174",
            "5% off": "offer5",
            "rs.200 for unlimited mandi (qtr)": "offerDessert",
            "free saudi champagne": "offerChampagne"
        };
        return idsByLabel[normalizedLabel] || null;
    }

    function claimsFromResponse(data) {
        if (data && Array.isArray(data.claims)) return data.claims;
        if (data && data.claim) return [data.claim];
        return [];
    }

    return {
        offerClaimedKey,
        offerClaimedAtKey,
        normalizeMobileNumber,
        resolveClassicRewardId,
        inferLegacyOfferId,
        claimsFromResponse
    };
}));
