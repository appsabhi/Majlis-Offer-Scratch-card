"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

for (const file of ["script.js", "diwali.js"]) {
    test(`${file} submits claims only through the PostgreSQL API`, () => {
        const source = fs.readFileSync(path.join(root, file), "utf8");

        assert.match(source, /BACKEND_API_URL[\s\S]{0,250}\/api\/claims/);
        assert.doesNotMatch(source, /script\.google\.com|GOOGLE_SHEETS_API_URL|Google Sheets/i);
    });
}
