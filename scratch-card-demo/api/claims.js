const { Pool } = require('pg');
const { createClaimHandlers } = require('./claim-handlers');

// Shared PostgreSQL Pool instance across serverless warm invocations
const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

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
        password: process.env.DB_PASSWORD || ''
    });

const claimHandlers = createClaimHandlers(pool);

module.exports = async function handler(req, res) {
    // Set CORS headers for security and cross-origin compatibility
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') return claimHandlers.getClaims(req, res);
    if (req.method === 'POST') return claimHandlers.createClaim(req, res);
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
};
