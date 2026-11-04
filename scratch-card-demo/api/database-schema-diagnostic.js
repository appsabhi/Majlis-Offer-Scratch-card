"use strict";

const SCHEMA_DIAGNOSTIC_QUERY = `
    SELECT
        current_database() AS database_name,
        EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'claims'
              AND column_name = 'normalized_mobile_number'
        ) AS has_normalized_mobile_number,
        EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'claims'
              AND column_name = 'offer_id'
        ) AS has_offer_id
`;

function createDatabaseSchemaDiagnostic(pool) {
    return async function databaseSchemaDiagnostic(req, res) {
        try {
            const result = await pool.query(SCHEMA_DIAGNOSTIC_QUERY);
            const row = result.rows[0];
            return res.status(200).json({
                success: true,
                databaseName: row.database_name,
                claimsColumns: {
                    normalized_mobile_number: row.has_normalized_mobile_number,
                    offer_id: row.has_offer_id
                }
            });
        } catch {
            return res.status(500).json({
                success: false,
                error: "Database schema diagnostic failed."
            });
        }
    };
}

module.exports = { createDatabaseSchemaDiagnostic };
