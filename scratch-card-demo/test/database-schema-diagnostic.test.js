"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createDatabaseSchemaDiagnostic } = require("../api/database-schema-diagnostic");

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

test("reports the connected database and expected claims columns without connection details", async () => {
    let queryText;
    const handler = createDatabaseSchemaDiagnostic({
        async query(sql) {
            queryText = sql;
            return {
                rows: [{
                    database_name: "staging_db",
                    has_normalized_mobile_number: true,
                    has_offer_id: false
                }]
            };
        }
    });
    const response = makeResponse();

    await handler({}, response);

    assert.match(queryText, /current_database\(\)/i);
    assert.match(queryText, /information_schema\.columns/i);
    assert.match(queryText, /column_name = 'normalized_mobile_number'/i);
    assert.match(queryText, /column_name = 'offer_id'/i);
    assert.doesNotMatch(queryText, /\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE)\b/i);
    assert.deepEqual(response.body, {
        success: true,
        databaseName: "staging_db",
        claimsColumns: {
            normalized_mobile_number: true,
            offer_id: false
        }
    });
});

test("does not expose database error details from the schema diagnostic", async () => {
    const handler = createDatabaseSchemaDiagnostic({
        async query() {
            throw new Error("sensitive connection information");
        }
    });
    const response = makeResponse();

    await handler({}, response);

    assert.equal(response.statusCode, 500);
    assert.deepEqual(response.body, {
        success: false,
        error: "Database schema diagnostic failed."
    });
});
