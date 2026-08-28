const { Pool } = require('pg');

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

// Helper function to sanitize text input
const sanitizeText = (str) => {
    if (!str) return '';
    return String(str)
        .replace(/₹/g, 'Rs.')
        .trim();
};

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

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    try {
        const { fullName, mobileNumber, email, offer, couponCode, coupon, claimDateTime } = req.body || {};

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
        const cleanCoupon = sanitizeText(couponCode || coupon);
        
        // Parse claimDateTime into a valid Date object for TIMESTAMP WITHOUT TIME ZONE column
        const rawDate = claimDateTime ? new Date(claimDateTime) : new Date();
        const validClaimDateTime = (!isNaN(rawDate.getTime())) ? rawDate : new Date();

        // 1. Duplicate Mobile Check
        const duplicateCheckQuery = 'SELECT id FROM public.claims WHERE mobile_number = $1 LIMIT 1';
        const existingClaim = await pool.query(duplicateCheckQuery, [cleanMobile]);

        if (existingClaim.rows.length > 0) {
            return res.status(200).json({
                success: false,
                error: "ALREADY_CLAIMED"
            });
        }

        // 2. Atomic Insertion into public.claims table
        const insertQuery = `
            INSERT INTO public.claims 
            (full_name, mobile_number, email, offer, coupon_code, claim_date_time, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `;
        const insertValues = [
            cleanName,
            cleanMobile,
            cleanEmail,
            cleanOffer,
            cleanCoupon,
            validClaimDateTime
        ];

        await pool.query(insertQuery, insertValues);

        return res.status(200).json({
            success: true
        });

    } catch (err) {
        // Atomic handle for PostgreSQL UNIQUE constraint violation (code 23505)
        if (err.code === '23505') {
            return res.status(200).json({
                success: false,
                error: "ALREADY_CLAIMED"
            });
        }
        console.error('[Vercel Claims API Error]', err);
        return res.status(500).json({
            success: false,
            error: "Failed to record claim. Please try again."
        });
    }
};
