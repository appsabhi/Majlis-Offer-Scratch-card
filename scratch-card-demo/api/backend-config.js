"use strict";

function loadBackendConfig(dotenv, processEnv = process.env) {
    const explicitEnvPath = Boolean(processEnv.DOTENV_CONFIG_PATH);
    const envFile = explicitEnvPath ? processEnv.DOTENV_CONFIG_PATH : ".env";
    const dotenvResult = dotenv.config({ path: envFile });

    if (explicitEnvPath && dotenvResult.error) {
        throw new Error("Unable to load the environment file specified by DOTENV_CONFIG_PATH.");
    }

    if (explicitEnvPath) {
        const fileVariables = dotenvResult.parsed || {};
        const databaseUrlVariable = fileVariables.DATABASE_URL
            ? "DATABASE_URL"
            : fileVariables.POSTGRES_URL
                ? "POSTGRES_URL"
                : null;

        if (!databaseUrlVariable) {
            throw new Error("The selected environment file must define DATABASE_URL or POSTGRES_URL.");
        }

        return {
            envFile,
            databaseUrlVariable,
            connectionString: fileVariables[databaseUrlVariable]
        };
    }

    const databaseUrlVariable = processEnv.POSTGRES_URL
        ? "POSTGRES_URL"
        : processEnv.DATABASE_URL
            ? "DATABASE_URL"
            : null;

    return {
        envFile,
        databaseUrlVariable,
        connectionString: processEnv.POSTGRES_URL || processEnv.DATABASE_URL || null
    };
}

module.exports = { loadBackendConfig };
