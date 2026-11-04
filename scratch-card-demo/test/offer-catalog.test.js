"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
    getOfferById,
    normalizeOfferLabel,
    resolveClaimableOffer
} = require("../shared/offer-catalog");

test("provides stable IDs for active offers and historical labels", () => {
    assert.equal(getOfferById("delivery_5_percent_orders_v1").label, "5% OFF on delivery orders");
    assert.equal(getOfferById("offer20").label, "21% OFF");
    assert.equal(getOfferById("offer10PercentNext").label, "10% OFF on next purchase");
});

test("keeps the historical placeholder non-claimable and rejects ambiguous label-only claims", () => {
    const unresolved = getOfferById("legacy_unresolved_10pct_next_purchase");
    assert.ok(unresolved);
    assert.equal(unresolved.claimable, false);
    assert.equal(resolveClaimableOffer(unresolved.id, unresolved.label).error, "INVALID_OFFER_ID");
    assert.equal(
        resolveClaimableOffer(undefined, unresolved.label).error,
        "OFFER_ID_REQUIRED_FOR_AMBIGUOUS_LABEL"
    );
    const explicitNewOffer = resolveClaimableOffer("offer10PercentNext", unresolved.label);
    assert.equal(explicitNewOffer.error, null);
    assert.equal(explicitNewOffer.offer.id, "offer10PercentNext");
});

test("accepts a legacy label only when it maps unambiguously", () => {
    const result = resolveClaimableOffer(undefined, "<b>₹174</b> for Unlimited Mandi (qtr)");
    assert.equal(result.error, null);
    assert.equal(result.offer.id, "offer174");
    assert.equal(normalizeOfferLabel(" ₹174 <br> for Unlimited Mandi (qtr) "),
        normalizeOfferLabel("Rs.174 for Unlimited Mandi (qtr)"));
});

test("rejects mismatched IDs and labels", () => {
    assert.equal(
        resolveClaimableOffer("offer20", "Free Saudi Champagne").error,
        "OFFER_LABEL_MISMATCH"
    );
    assert.equal(resolveClaimableOffer("not-an-offer", "21% OFF").error, "INVALID_OFFER_ID");
});
