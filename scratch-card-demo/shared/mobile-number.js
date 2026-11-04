"use strict";

function normalizeIndianMobileNumber(value) {
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

module.exports = { normalizeIndianMobileNumber };
