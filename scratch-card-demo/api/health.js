const { Pool } = require('pg');

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

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    try {
        await pool.query('SELECT 1');
        return res.status(200).json({
            success: true,
            database: "connected"
        });
    } catch (err) {
        console.error('[Vercel Health Check Error]', err.message);
        return res.status(500).json({
            success: false,
            database: "disconnected",
            error: err.message
        });
    }
};
