"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
    claimsFromResponse,
    inferLegacyOfferId,
    offerClaimedAtKey,
    offerClaimedKey,
    normalizeMobileNumber: normalizeClaimStateMobile,
    resolveClassicRewardId
} = require("../shared/claim-state");
const { normalizeIndianMobileNumber } = require("../shared/mobile-number");

test("claim state keys are scoped to normalized customer mobile and immutable offer ID", () => {
    assert.notEqual(
        offerClaimedKey("9876543210", "offer20"),
        offerClaimedKey("9876543210", "delivery_5_percent_orders_v1")
    );
    assert.notEqual(
        offerClaimedKey("9876543210", "offer20"),
        offerClaimedKey("9123456789", "offer20")
    );
    assert.notEqual(
        offerClaimedAtKey("9876543210", "offer20"),
        offerClaimedAtKey("9876543210", "delivery_5_percent_orders_v1")
    );
    assert.equal(
        offerClaimedKey("+91 98765-43210", "offer20"),
        offerClaimedKey("09876543210", "offer20")
    );
});

test("frontend claim-state and backend mobile normalization stay aligned", () => {
    for (const mobile of ["9876543210", "+91 98765 43210", "09876543210", "0091-9876543210"]) {
        assert.equal(normalizeClaimStateMobile(mobile), normalizeIndianMobileNumber(mobile));
    }
});

test("preserves old classic delivery reward assignments using their saved label", () => {
    assert.equal(
        resolveClassicRewardId("offer10PercentNext", "5% OFF <br> on delivery orders"),
        "delivery_5_percent_orders_v1"
    );
    assert.equal(
        resolveClassicRewardId("offer10PercentNext", "10% OFF on next purchase"),
        "offer10PercentNext"
    );
});

test("keeps the ambiguous historical offer label mapped only to its placeholder", () => {
    assert.equal(
        inferLegacyOfferId("10% OFF on next purchase"),
        "legacy_unresolved_10pct_next_purchase"
    );
    assert.equal(inferLegacyOfferId("5% OFF on delivery orders"), "delivery_5_percent_orders_v1");
});

test("reads both new multi-claim and legacy single-claim API responses", () => {
    const claims = [{ offerId: "offer20" }, { offerId: "offer5" }];
    assert.deepEqual(claimsFromResponse({ claims }), claims);
    assert.deepEqual(claimsFromResponse({ claim: claims[0] }), [claims[0]]);
    assert.deepEqual(claimsFromResponse({}), []);
});
