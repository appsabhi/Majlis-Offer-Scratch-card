"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createClaimHandlers } = require("../api/claim-handlers");

function makeResponse() {
    return {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        }
    };
}

function makePool(options = {}) {
    const claims = [];
    let nextId = 1;
    return {
        claims,
        async query(sql, values) {
            if (/^\s*SELECT/i.test(sql)) {
                let rows = claims;
                if (/normalized_mobile_number\s*=\s*\$1\s+AND\s+offer_id\s*=\s*\$2/i.test(sql)) {
                    rows = claims.filter(row =>
                        row.normalized_mobile_number === values[0] && row.offer_id === values[1]);
                } else if (/normalized_mobile_number\s*=\s*\$1/i.test(sql)) {
                    rows = claims.filter(row => row.normalized_mobile_number === values[0]);
                }
                return { rows: rows.slice() };
            }

            assert.match(sql, /^\s*INSERT INTO public\.claims/i);
            const [, mobileNumber, normalizedMobile, email, offer, offerId, claimDateTime] = values;
            const duplicatePair = claims.find(row =>
                row.normalized_mobile_number === normalizedMobile && row.offer_id === offerId);
            if (duplicatePair) {
                const error = new Error("unique violation");
                error.code = "23505";
                error.constraint = "claims_normalized_mobile_number_offer_id_key";
                throw error;
            }
            if (options.mobileOnlyUnique && claims.some(row => row.mobile_number === mobileNumber)) {
                const error = new Error("unique violation");
                error.code = "23505";
                error.constraint = "claims_mobile_number_key";
                throw error;
            }

            claims.push({
                id: nextId++,
                full_name: values[0],
                mobile_number: mobileNumber,
                normalized_mobile_number: normalizedMobile,
                email,
                offer,
                offer_id: offerId,
                claim_date_time: claimDateTime,
                created_at: claimDateTime
            });
            return { rowCount: 1, rows: [] };
        }
    };
}

function postRequest(body) {
    return { body, query: {} };
}

test("creates a claim with canonical mobile and stable offer ID", async () => {
    const pool = makePool();
    const { createClaim } = createClaimHandlers(pool);
    const response = makeResponse();

    await createClaim(postRequest({
        fullName: "A Customer",
        mobileNumber: "+91 98765-43210",
        offerId: "delivery_5_percent_orders_v1",
        offer: "5% OFF on delivery orders"
    }), response);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, { success: true, offerId: "delivery_5_percent_orders_v1" });
    assert.equal(pool.claims.length, 1);
    assert.equal(pool.claims[0].mobile_number, "9876543210");
    assert.equal(pool.claims[0].normalized_mobile_number, "9876543210");
    assert.equal(pool.claims[0].offer_id, "delivery_5_percent_orders_v1");
});

test("requires explicit offer ID for the ambiguous label but accepts the valid explicit ID", async () => {
    const pool = makePool();
    const { createClaim } = createClaimHandlers(pool);
    const legacyResponse = makeResponse();

    await createClaim(postRequest({
        fullName: "A Customer",
        mobileNumber: "9876543210",
        offer: "10% OFF on next purchase"
    }), legacyResponse);

    assert.equal(legacyResponse.statusCode, 400);
    assert.equal(legacyResponse.body.error, "OFFER_ID_REQUIRED_FOR_AMBIGUOUS_LABEL");
    assert.match(legacyResponse.body.message, /offerId is required/i);
    assert.equal(pool.claims.length, 0);

    const explicitResponse = makeResponse();
    await createClaim(postRequest({
        fullName: "A Customer",
        mobileNumber: "9876543210",
        offerId: "offer10PercentNext",
        offer: "10% OFF on next purchase"
    }), explicitResponse);

    assert.equal(explicitResponse.statusCode, 200);
    assert.equal(explicitResponse.body.success, true);
    assert.equal(explicitResponse.body.offerId, "offer10PercentNext");
    assert.equal(pool.claims[0].offer_id, "offer10PercentNext");
});

test("rejects invalid mobile numbers, unknown offers and the unresolved historical ID", async () => {
    const { createClaim } = createClaimHandlers(makePool());
    const requests = [
        [{ fullName: "A Customer", mobileNumber: "12345", offerId: "offer20" }, "INVALID_MOBILE_NUMBER"],
        [{ fullName: "A Customer", mobileNumber: "9876543210", offerId: "unknown" }, "INVALID_OFFER_ID"],
        [{
            fullName: "A Customer",
            mobileNumber: "9876543210",
            offerId: "legacy_unresolved_10pct_next_purchase",
            offer: "10% OFF on next purchase"
        }, "INVALID_OFFER_ID"],
        [{
            fullName: "A Customer",
            mobileNumber: "9876543210",
            offer: "Unrecognized offer"
        }, "INVALID_OFFER"]
    ];

    for (const [body, error] of requests) {
        const response = makeResponse();
        await createClaim(postRequest(body), response);
        assert.equal(response.statusCode, 400);
        assert.equal(response.body.error, error);
    }
});

test("supports distinct offers for one customer and lists normalized customer claims", async () => {
    const pool = makePool();
    const { createClaim, getClaims } = createClaimHandlers(pool);
    for (const [offerId, offer] of [
        ["offer20", "21% OFF"],
        ["delivery_5_percent_orders_v1", "5% OFF on delivery orders"]
    ]) {
        const response = makeResponse();
        await createClaim(postRequest({
            fullName: "A Customer",
            mobileNumber: "9876543210",
            offerId,
            offer
        }), response);
        assert.equal(response.body.success, true);
    }

    const response = makeResponse();
    await getClaims({ query: { mobileNumber: "+91 98765 43210" } }, response);
    assert.equal(response.body.claimed, true);
    assert.equal(response.body.claims.length, 2);
    assert.deepEqual(
        response.body.claims.map(claim => claim.offerId).sort(),
        ["delivery_5_percent_orders_v1", "offer20"]
    );
});

test("prevents duplicate claims for the same customer and offer, including races", async () => {
    const pool = makePool();
    const { createClaim } = createClaimHandlers(pool);
    const request = () => postRequest({
        fullName: "A Customer",
        mobileNumber: "9876543210",
        offerId: "offer20",
        offer: "21% OFF"
    });

    const first = makeResponse();
    await createClaim(request(), first);
    assert.equal(first.body.success, true);

    const duplicate = makeResponse();
    await createClaim(request(), duplicate);
    assert.equal(duplicate.body.error, "ALREADY_CLAIMED");
    assert.equal(duplicate.body.claim.offerId, "offer20");

    const concurrentPool = makePool();
    const concurrentHandlers = createClaimHandlers(concurrentPool);
    const responses = [makeResponse(), makeResponse()];
    await Promise.all(responses.map(response => concurrentHandlers.createClaim(request(), response)));
    assert.equal(concurrentPool.claims.length, 1);
    assert.equal(responses.filter(response => response.body.success).length, 1);
    assert.equal(responses.filter(response => response.body.error === "ALREADY_CLAIMED").length, 1);
});

test("reports the existing mobile-only constraint without mislabeling a different offer as duplicate", async () => {
    const pool = makePool({ mobileOnlyUnique: true });
    const { createClaim } = createClaimHandlers(pool);
    for (const [offerId, offer] of [["offer20", "21% OFF"], ["offer5", "5% OFF"]]) {
        const response = makeResponse();
        await createClaim(postRequest({
            fullName: "A Customer",
            mobileNumber: "9876543210",
            offerId,
            offer
        }), response);
        if (offerId === "offer20") {
            assert.equal(response.body.success, true);
        } else {
            assert.equal(response.statusCode, 409);
            assert.equal(response.body.error, "MOBILE_ONLY_CONSTRAINT_ACTIVE");
        }
    }
});

test("looks up one offer by normalized mobile and offer ID", async () => {
    const pool = makePool();
    const handlers = createClaimHandlers(pool);
    await handlers.createClaim(postRequest({
        fullName: "A Customer",
        mobileNumber: "9876543210",
        offerId: "offer20",
        offer: "21% OFF"
    }), makeResponse());

    const response = makeResponse();
    await handlers.getClaims({
        query: { mobileNumber: "09876543210", offerId: "offer20" }
    }, response);
    assert.equal(response.body.claimed, true);
    assert.equal(response.body.claim.offerId, "offer20");
    assert.equal(response.body.claims.length, 1);
});
