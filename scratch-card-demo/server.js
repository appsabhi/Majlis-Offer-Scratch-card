const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { createClaimHandlers } = require('./api/claim-handlers');
const { createDatabaseSchemaDiagnostic } = require('./api/database-schema-diagnostic');
const { loadBackendConfig } = require('./api/backend-config');

const backendConfig = loadBackendConfig(require('dotenv'), process.env);
console.log(`[Majlis Backend] Environment file selected: ${backendConfig.envFile}`);
console.log(`[Majlis Backend] Database URL variable selected: ${backendConfig.databaseUrlVariable || 'none (local connection settings)'}`);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL Connection Pool (Supports Neon POSTGRES_URL / DATABASE_URL connection string and local dev params)
const connectionString = backendConfig.connectionString;

const pool = connectionString
    ? new Pool({
        connectionString,
        ssl: connectionString.includes('sslmode=') || connectionString.includes('neon.tech') ? { rejectUnauthorized: false } : false
    })
    : new Pool({
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT || '5434', 10),
        database: process.env.DB_NAME || 'majlis_scratchcard',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        client_encoding: 'UTF8'
    });

// Verification of pool connection log
pool.on('error', (err) => {
    console.error('[PostgreSQL Pool Error]', err.code || 'unknown error');
});

/**
 * Health Check Endpoint
 * Verifies PostgreSQL database connectivity
 */
app.get('/api/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        return res.status(200).json({
            success: true,
            database: "connected"
        });
    } catch (err) {
        console.error('[Health Check Error]', err.code || 'unknown error');
        return res.status(500).json({
            success: false,
            database: "disconnected",
            error: "Database connection failed."
        });
    }
});

app.get('/api/health/schema', createDatabaseSchemaDiagnostic(pool));

const claimHandlers = createClaimHandlers(pool);
app.get('/api/claims', claimHandlers.getClaims);
app.post('/api/claims', claimHandlers.createClaim);

// Start Express Server
app.listen(PORT, () => {
    console.log(`[Majlis Backend] Server listening on http://127.0.0.1:${PORT}`);
});
