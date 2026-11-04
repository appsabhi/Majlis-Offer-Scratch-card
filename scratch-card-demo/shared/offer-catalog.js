"use strict";

const offers = [
    { id: "delivery_5_percent_orders_v1", label: "5% OFF on delivery orders" },
    { id: "offer50Rs", label: "Rs.50 OFF on bill above Rs.499" },
    { id: "offer75Rs", label: "Rs.75 OFF on bill above Rs.699" },
    { id: "offer100Rs", label: "Rs.100 OFF on bill above Rs.999" },
    { id: "offer150Rs", label: "Rs.150 OFF on bill above Rs.1299" },
    { id: "offer5PercentNext", label: "5% OFF on next purchase" },
    { id: "offer10PercentNext", label: "10% OFF on next purchase" },
    { id: "offer20", label: "21% OFF" },
    { id: "offer174", label: "Rs.174 for Unlimited Mandi (qtr)" },
    { id: "offer5", label: "5% OFF" },
    { id: "offerDessert", label: "Rs.200 for Unlimited Mandi (qtr)" },
    { id: "offerChampagne", label: "Free Saudi Champagne" },
    {
        id: "legacy_unresolved_10pct_next_purchase",
        label: "10% OFF on next purchase",
        claimable: false
    }
];

const offerById = new Map(offers.map(offer => [offer.id, Object.freeze({
    ...offer,
    claimable: offer.claimable !== false
})]));

function normalizeOfferLabel(value) {
    return String(value || "")
        .replace(/<[^>]*>/g, " ")
        .replace(/₹/g, "Rs.")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

function getOfferById(id) {
    if (typeof id !== "string") return null;
    return offerById.get(id.trim()) || null;
}

function resolveClaimableOffer(offerId, label) {
    if (offerId !== undefined && offerId !== null && String(offerId).trim() !== "") {
        const offer = getOfferById(String(offerId));
        if (!offer || !offer.claimable) {
            return { offer: null, error: "INVALID_OFFER_ID" };
        }

        if (label !== undefined && label !== null && String(label).trim() !== ""
            && normalizeOfferLabel(label) !== normalizeOfferLabel(offer.label)) {
            return { offer: null, error: "OFFER_LABEL_MISMATCH" };
        }

        return { offer, error: null };
    }

    const normalizedLabel = normalizeOfferLabel(label);
    if (!normalizedLabel) return { offer: null, error: "OFFER_ID_REQUIRED" };

    const matches = offers.filter(offer => normalizeOfferLabel(offer.label) === normalizedLabel);
    if (matches.length > 1) {
        return { offer: null, error: "OFFER_ID_REQUIRED_FOR_AMBIGUOUS_LABEL" };
    }

    if (matches.length !== 1) {
        return { offer: null, error: "INVALID_OFFER" };
    }

    const resolved = offerById.get(matches[0].id);
    if (!resolved.claimable) return { offer: null, error: "INVALID_OFFER" };
    return { offer: resolved, error: null };
}

module.exports = {
    offers: Object.freeze(Array.from(offerById.values())),
    getOfferById,
    normalizeOfferLabel,
    resolveClaimableOffer
};
