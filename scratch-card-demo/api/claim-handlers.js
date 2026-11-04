"use strict";

const { normalizeIndianMobileNumber } = require("../shared/mobile-number");
const { getOfferById, resolveClaimableOffer } = require("../shared/offer-catalog");

const CLAIM_COLUMNS = `
    id, full_name, mobile_number, normalized_mobile_number, email,
    offer, offer_id, claim_date_time, created_at
`;

function toClaim(row) {
    return {
        id: row.id,
        fullName: row.full_name,
        mobileNumber: row.mobile_number,
        email: row.email,
        offer: row.offer,
        offerId: row.offer_id,
        claimDateTime: row.claim_date_time || row.created_at
    };
}

function sendDuplicate(res, row) {
    return res.status(200).json({
        success: false,
        error: "ALREADY_CLAIMED",
        claim: toClaim(row)
    });
}

function createClaimHandlers(pool) {
    async function getClaims(req, res) {
        try {
            const mobile = req.query.mobileNumber || req.query.mobile;
            if (!mobile) {
                return res.status(400).json({
                    success: false,
                    error: "mobileNumber query parameter is required."
                });
            }

            const normalizedMobile = normalizeIndianMobileNumber(mobile);
            if (!normalizedMobile) {
                return res.status(400).json({
                    success: false,
                    error: "INVALID_MOBILE_NUMBER"
                });
            }

            const requestedOfferId = req.query.offerId || req.query.offer_id;
            let result;
            if (requestedOfferId) {
                const offer = getOfferById(String(requestedOfferId));
                if (!offer) {
                    return res.status(400).json({
                        success: false,
                        error: "INVALID_OFFER_ID"
                    });
                }
                result = await pool.query(
                    `SELECT ${CLAIM_COLUMNS}
                     FROM public.claims
                     WHERE normalized_mobile_number = $1 AND offer_id = $2
                     ORDER BY created_at DESC NULLS LAST, id DESC`,
                    [normalizedMobile, offer.id]
                );
            } else {
                result = await pool.query(
                    `SELECT ${CLAIM_COLUMNS}
                     FROM public.claims
                     WHERE normalized_mobile_number = $1
                     ORDER BY created_at DESC NULLS LAST, id DESC`,
                    [normalizedMobile]
                );
            }

            const claims = result.rows.map(toClaim);
            return res.status(200).json({
                success: true,
                claimed: claims.length > 0,
                claims,
                claim: claims[0] || null
            });
        } catch (error) {
            console.error("[GET Claim Error]", error);
            return res.status(500).json({
                success: false,
                error: "Failed to fetch claim status. Please try again."
            });
        }
    }

    async function createClaim(req, res) {
        try {
            const body = req.body || {};
            const fullName = body.fullName || body.name || body["Full Name"];
            const mobileNumber = body.mobileNumber || body.mobile || body.phone || body["Mobile Number"];
            const email = body.email || body.Email;
            const offerLabel = body.offer || body.Offer || body.reward;
            const offerId = body.offerId || body.offer_id;

            if (!fullName || !mobileNumber) {
                return res.status(400).json({
                    success: false,
                    error: "fullName and mobileNumber are required."
                });
            }

            const normalizedMobile = normalizeIndianMobileNumber(mobileNumber);
            if (!normalizedMobile) {
                return res.status(400).json({
                    success: false,
                    error: "INVALID_MOBILE_NUMBER"
                });
            }

            const resolution = resolveClaimableOffer(offerId, offerLabel);
            if (!resolution.offer) {
                const response = {
                    success: false,
                    error: resolution.error
                };
                if (resolution.error === "OFFER_ID_REQUIRED_FOR_AMBIGUOUS_LABEL") {
                    response.message = "offerId is required because this offer label is ambiguous.";
                }
                return res.status(400).json({
                    ...response
                });
            }

            const cleanText = value => String(value || "")
                .replace(/₹/g, "Rs.")
                .trim();
            const cleanName = cleanText(fullName);
            if (cleanName.length < 2) {
                return res.status(400).json({
                    success: false,
                    error: "fullName must contain at least two characters."
                });
            }
            const cleanEmail = email ? cleanText(email) : "Not Provided";
            const rawDate = body.claimDateTime ? new Date(body.claimDateTime) : new Date();
            const claimDateTime = Number.isNaN(rawDate.getTime()) ? new Date() : rawDate;
            const selectedOffer = resolution.offer;

            const existing = await pool.query(
                `SELECT ${CLAIM_COLUMNS}
                 FROM public.claims
                 WHERE normalized_mobile_number = $1 AND offer_id = $2
                 LIMIT 1`,
                [normalizedMobile, selectedOffer.id]
            );
            if (existing.rows.length > 0) return sendDuplicate(res, existing.rows[0]);

            await pool.query(
                `INSERT INTO public.claims
                    (full_name, mobile_number, normalized_mobile_number, email, offer,
                     offer_id, claim_date_time, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
                [
                    cleanName,
                    normalizedMobile,
                    normalizedMobile,
                    cleanEmail,
                    selectedOffer.label,
                    selectedOffer.id,
                    claimDateTime
                ]
            );

            return res.status(200).json({ success: true, offerId: selectedOffer.id });
        } catch (error) {
            if (error.code === "23505") {
                try {
                    const body = req.body || {};
                    const mobile = body.mobileNumber || body.mobile || body.phone || body["Mobile Number"];
                    const normalizedMobile = normalizeIndianMobileNumber(mobile);
                    const resolution = resolveClaimableOffer(
                        body.offerId || body.offer_id,
                        body.offer || body.Offer || body.reward
                    );

                    if (normalizedMobile && resolution.offer) {
                        const existing = await pool.query(
                            `SELECT ${CLAIM_COLUMNS}
                             FROM public.claims
                             WHERE normalized_mobile_number = $1 AND offer_id = $2
                             LIMIT 1`,
                            [normalizedMobile, resolution.offer.id]
                        );
                        if (existing.rows.length > 0) return sendDuplicate(res, existing.rows[0]);
                    }
                } catch (lookupError) {
                    console.error("[Duplicate Claim Lookup Error]", lookupError);
                    return res.status(500).json({
                        success: false,
                        error: "Failed to verify claim status. Please try again."
                    });
                }

                if (error.constraint === "claims_mobile_number_key") {
                    return res.status(409).json({
                        success: false,
                        error: "MOBILE_ONLY_CONSTRAINT_ACTIVE",
                        message: "The database update required for multiple offers per customer is not complete."
                    });
                }
            }

            console.error("[Submit Claim Error]", error);
            return res.status(500).json({
                success: false,
                error: "Failed to record claim. Please try again."
            });
        }
    }

    return { getClaims, createClaim };
}

module.exports = { createClaimHandlers };
