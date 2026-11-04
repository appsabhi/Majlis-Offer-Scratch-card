"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeIndianMobileNumber } = require("../shared/mobile-number");

test("normalizes common Indian mobile number formats", () => {
    const canonical = "9876543210";
    for (const input of [
        canonical,
        "98765 43210",
        "+91 98765-43210",
        "91-9876543210",
        "09876543210",
        "0091 9876543210",
        "0919876543210"
    ]) {
        assert.equal(normalizeIndianMobileNumber(input), canonical, input);
    }
});

test("rejects invalid Indian mobile numbers without truncating them", () => {
    for (const input of [
        null,
        undefined,
        "",
        "tel:9876543210",
        "1234567890",
        "5876543210",
        "19876543210",
        "91987654321000",
        "987654321"
    ]) {
        assert.equal(normalizeIndianMobileNumber(input), null, String(input));
    }
});
