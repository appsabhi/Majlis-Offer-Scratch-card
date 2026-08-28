const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL Connection Pool (Supports Neon POSTGRES_URL / DATABASE_URL connection string and local dev params)
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
        password: process.env.DB_PASSWORD || '',
        client_encoding: 'UTF8'
    });

// Helper function to sanitize text input and convert un-encodable characters (e.g. ₹ to Rs.)
const sanitizeText = (str) => {
    if (!str) return '';
    return String(str)
        .replace(/₹/g, 'Rs.')
        .trim();
};

// Verification of pool connection log
pool.on('error', (err) => {
    console.error('[PostgreSQL Pool Error]', err);
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
        console.error('[Health Check Error]', err.message);
        return res.status(500).json({
            success: false,
            database: "disconnected",
            error: err.message
        });
    }
});

/**
 * Submit Claim Endpoint
 * Accepts customer claim payload and inserts into public.claims table
 */
app.post('/api/claims', async (req, res) => {
    try {
        const { fullName, mobileNumber, email, offer, claimDateTime } = req.body || {};

        // Validation for mandatory fields
        if (!fullName || !mobileNumber) {
            return res.status(400).json({
                success: false,
                error: "fullName and mobileNumber are required."
            });
        }

        const cleanMobile = String(mobileNumber).trim();
        const cleanName = sanitizeText(fullName);
        const cleanEmail = email ? sanitizeText(email) : 'Not Provided';
        const cleanOffer = sanitizeText(offer);
        
        // Parse claimDateTime into a valid Date object for TIMESTAMP WITHOUT TIME ZONE column
        const rawDate = claimDateTime ? new Date(claimDateTime) : new Date();
        const validClaimDateTime = (!isNaN(rawDate.getTime())) ? rawDate : new Date();

        // 1. Check if mobile number already exists in public.claims
        const duplicateCheckQuery = 'SELECT id FROM public.claims WHERE mobile_number = $1 LIMIT 1';
        const existingClaim = await pool.query(duplicateCheckQuery, [cleanMobile]);

        if (existingClaim.rows.length > 0) {
            return res.status(200).json({
                success: false,
                error: "ALREADY_CLAIMED"
            });
        }

        // 2. Insert new claim record using parameterized query matching public.claims table columns:
        // (full_name, mobile_number, email, offer, claim_date_time, created_at)
        const insertQuery = `
            INSERT INTO public.claims 
            (full_name, mobile_number, email, offer, claim_date_time, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
        `;
        const insertValues = [
            cleanName,
            cleanMobile,
            cleanEmail,
            cleanOffer,
            validClaimDateTime
        ];

        await pool.query(insertQuery, insertValues);

        return res.status(200).json({
            success: true
        });

    } catch (err) {
        if (err.code === '23505') {
            return res.status(200).json({
                success: false,
                error: "ALREADY_CLAIMED"
            });
        }
        console.error('[Submit Claim Error]', err);
        return res.status(500).json({
            success: false,
            error: "Failed to record claim. Please try again."
        });
    }
});

// Start Express Server
app.listen(PORT, () => {
    console.log(`[Majlis Backend] Server listening on http://127.0.0.1:${PORT}`);
});
