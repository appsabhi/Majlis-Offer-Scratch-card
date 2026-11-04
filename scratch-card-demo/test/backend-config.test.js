"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadBackendConfig } = require("../api/backend-config");

function makeDotenv(parsed, error) {
    const calls = [];
    return {
        calls,
        config(options) {
            calls.push(options);
            return { parsed, error };
        }
    };
}

test("explicit environment file supplies its own URL, preferring its DATABASE_URL over inherited URLs", () => {
    const dotenv = makeDotenv({
        DATABASE_URL: "staging-url",
        POSTGRES_URL: "other-url"
    });
    const config = loadBackendConfig(dotenv, {
        DOTENV_CONFIG_PATH: ".env.staging",
        POSTGRES_URL: "inherited-url",
        DATABASE_URL: "inherited-database-url"
    });

    assert.deepEqual(dotenv.calls, [{ path: ".env.staging" }]);
    assert.equal(config.envFile, ".env.staging");
    assert.equal(config.databaseUrlVariable, "DATABASE_URL");
    assert.equal(config.connectionString, "staging-url");
});

test("explicit environment file does not fall back to inherited connection URLs", () => {
    const dotenv = makeDotenv({});

    assert.throws(
        () => loadBackendConfig(dotenv, {
            DOTENV_CONFIG_PATH: ".env.staging",
            POSTGRES_URL: "inherited-url",
            DATABASE_URL: "inherited-database-url"
        }),
        /selected environment file must define DATABASE_URL or POSTGRES_URL/
    );
});

test("default environment file and URL precedence remain unchanged", () => {
    const dotenv = makeDotenv({ DATABASE_URL: "file-database-url" });
    const config = loadBackendConfig(dotenv, {
        POSTGRES_URL: "inherited-postgres-url",
        DATABASE_URL: "inherited-database-url"
    });

    assert.deepEqual(dotenv.calls, [{ path: ".env" }]);
    assert.equal(config.envFile, ".env");
    assert.equal(config.databaseUrlVariable, "POSTGRES_URL");
    assert.equal(config.connectionString, "inherited-postgres-url");
});

test("an explicit environment file load failure stops startup without exposing details", () => {
    const dotenv = makeDotenv(undefined, new Error("sensitive path details"));

    assert.throws(
        () => loadBackendConfig(dotenv, { DOTENV_CONFIG_PATH: ".env.staging" }),
        error => {
            assert.equal(error.message, "Unable to load the environment file specified by DOTENV_CONFIG_PATH.");
            assert.doesNotMatch(error.message, /sensitive path details/);
            return true;
        }
    );
});
