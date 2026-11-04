/* ==========================================================================
   MAJLIS ONAM PROMOTION - CLIENT LOGIC
   ========================================================================== */

// --- CONFIGURATION SECTION ---
const BACKEND_API_URL = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') 
    ? "http://127.0.0.1:5000/api/claims" 
    : "/api/claims";
// ==========================================================================
// REWARD POOL CONFIGURATION
// Add, remove, or edit offers here. Each entry must have:
//   label      — Display text shown in the scratch reveal and all UI elements
//   coupon     — Coupon code string. Set to null for non-winning outcomes.
//   isWinner   — true if this is a real prize; false for "Better Luck" outcomes
// ==========================================================================
const REWARD_POOL = [
    // { id: "offerdelivery",          label: `₹50 OFF <br> on bill above ₹499`,   coupon: "OFF50",  isWinner: true },
    // { id: "offer75Rs",          label: `₹75 OFF <br> on bill above ₹699`,   coupon: "OFF75",  isWinner: true },
    // { id: "offer100Rs",         label: `₹100 OFF <br> on bill above ₹999`,  coupon: "OFF100", isWinner: true },
    // { id: "offer150Rs",         label: `₹150 OFF <br> on bill above ₹1299`, coupon: "OFF150", isWinner: true },
    // { id: "offer5PercentNext",  label: `5% OFF <br> on next purchase`,       coupon: "NEXT5",  isWinner: true },
    { id: "delivery_5_percent_orders_v1", label: `5% OFF <br> on delivery orders`, coupon: "NEXT10", isWinner: true }
];

// Legacy reward map to ensure users who previously claimed old campaign offers keep their exact claimed reward when returning
const LEGACY_REWARD_MAP = {
    "offer20":        { id: "offer20",        label: "21% OFF",                                  coupon: "ONAM20",    isWinner: true },
    "offer174":       { id: "offer174",       label: `₹174 <br> for Unlimited <br> Mandi (qtr)`, coupon: "ONAMDESS",  isWinner: true },
    "offer5":         { id: "offer5",         label: "5% OFF",                                   coupon: "ONAM5",     isWinner: true },
    "offerDessert":   { id: "offerDessert",   label: `₹200 <br> for Unlimited <br> Mandi (qtr)`, coupon: "ONAMDESS",  isWinner: true },
    "offerChampagne": { id: "offerChampagne", label: `Free <br> Saudi Champagne`,                coupon: "ONAMCHAMP", isWinner: true }
};

// Holds the ONE reward assigned for this session. Set once on page load.
let sessionReward = null;

const DEV_MODE = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';

function isLocalDevResetAllowed() {
    return DEV_MODE && (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost');
}

const VISITOR_KEY = "majlis_visitor_id";

// Safe Storage Helper with memory fallback for iOS Safari / Mobile Firefox Private Browsing
const memoryStorage = {};
const safeStorage = {
    getItem(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            console.warn("[Majlis] Storage getItem fallback:", e);
            return memoryStorage[key] || null;
        }
    },
    setItem(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            console.warn("[Majlis] Storage setItem fallback:", e);
            memoryStorage[key] = String(value);
        }
    },
    removeItem(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.warn("[Majlis] Storage removeItem fallback:", e);
            delete memoryStorage[key];
        }
    }
};

let visitorId = null;

/**
 * Generates a stable unique anonymous visitor/session identifier.
 */
function generateVisitorId() {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 16; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;

/**
 * Helper to get the reward storage key for the current visitor.
 */
function getRewardStorageKey() {
    return `majlis_campaign_reward_id_${visitorId || "fallback"}`;
}

function getRewardLabelStorageKey() {
    return `majlis_campaign_reward_label_${visitorId || "fallback"}`;
}

function getRewardCouponStorageKey() {
    return `majlis_campaign_reward_coupon_${visitorId || "fallback"}`;
}

/**
 * Helper to get the scratch revealed storage key for the current visitor.
 */
function getRevealedStorageKey() {
    return `majlis_campaign_scratch_revealed_${visitorId || "fallback"}`;
}

/**
 * Offer-specific claimed state, with the old visitor-level key retained for migration reads.
 */
function getLegacyClaimedStorageKey() {
    return `majlis_campaign_claimed_${visitorId || "fallback"}`;
}

function getClaimedStorageKey(
    offerId = sessionReward && sessionReward.id,
    mobileNumber = safeStorage.getItem("majlis_claimed_mobile")
) {
    return window.MajlisClaimState.offerClaimedKey(mobileNumber, offerId);
}

function getLegacyClaimedAtStorageKey() {
    return `majlis_campaign_claimed_at_${visitorId || "fallback"}`;
}

function getClaimedAtStorageKey(
    offerId = sessionReward && sessionReward.id,
    mobileNumber = safeStorage.getItem("majlis_claimed_mobile")
) {
    return window.MajlisClaimState.offerClaimedAtKey(mobileNumber, offerId);
}

/**
 * Checks whether the visitor has successfully claimed their reward.
 */
function isClaimedState(offerId = sessionReward && sessionReward.id) {
    if (!offerId) return false;
    try {
        const mobileNumber = safeStorage.getItem("majlis_claimed_mobile");
        if (!mobileNumber) return false;
        const claimKey = window.MajlisClaimState.offerClaimedKey(mobileNumber, offerId);
        if (claimKey && safeStorage.getItem(claimKey) === "true") return true;

        const savedRewardId = safeStorage.getItem(getRewardStorageKey());
        const savedRewardLabel = safeStorage.getItem(getRewardLabelStorageKey());
        const assignedOfferId = window.MajlisClaimState.resolveClassicRewardId(savedRewardId, savedRewardLabel);
        const wasLegacyClaimed = safeStorage.getItem(getLegacyClaimedStorageKey()) === "true";
        if (claimKey && wasLegacyClaimed && assignedOfferId === offerId) {
            safeStorage.setItem(claimKey, "true");
            const legacyClaimedAt = safeStorage.getItem(getLegacyClaimedAtStorageKey());
            if (legacyClaimedAt) {
                safeStorage.setItem(getClaimedAtStorageKey(offerId, mobileNumber), legacyClaimedAt);
            }
            return true;
        }
        return false;
    } catch (e) {
        console.warn("[Majlis] Error reading claimed state:", e);
        return false;
    }
}

/**
 * Checks whether 10 days have passed since the visitor claimed their offer.
 */
function isOfferExpired() {
    try {
        const claimedAtKey = getClaimedAtStorageKey();
        if (!claimedAtKey) return false;
        const claimedAtStr = safeStorage.getItem(claimedAtKey);
        if (!claimedAtStr) return false;
        const claimedAt = Number(claimedAtStr);
        if (isNaN(claimedAt) || claimedAt <= 0) return false;
        return (Date.now() - claimedAt) >= TEN_DAYS_MS;
    } catch (e) {
        console.warn("[Majlis] Error checking offer expiration:", e);
        return false;
    }
}

/**
 * Updates the Success screen UI elements based on the 10-day validity status.
 */
function updateExpiryUI() {
    const expired = isOfferExpired();
    
    const successTitleEl = document.querySelector(".success-title");
    const successIconWrapper = document.querySelector(".success-icon-wrapper");
    const ticketValidityPhrase = document.getElementById("ticket-validity-phrase");
    const ticketHeader = document.querySelector(".ticket-header");
    const ticketCard = document.querySelector(".ticket-card");
    const ticketInstaInstruction = document.getElementById("ticket-instagram-instruction");

    if (expired) {
        if (successTitleEl) {
            successTitleEl.innerText = "SORRY, YOU JUST MISSED IT!";
            successTitleEl.style.color = "#a82e2e";
        }
        if (successIconWrapper) {
            successIconWrapper.style.background = "rgba(168, 46, 46, 0.1)";
            successIconWrapper.style.color = "#a82e2e";
            successIconWrapper.innerHTML = `<span style="font-size: 30px; line-height: 1; display: inline-block;">😟</span>`;
        }
        if (ticketHeader) {
            ticketHeader.innerText = "OFFER EXPIRED ";
            ticketHeader.style.background = "linear-gradient(135deg, #a82e2e 0%, #d32f2f 100%)";
            ticketHeader.style.color = "#ffffff";
        }
        if (ticketValidityPhrase) {
            ticketValidityPhrase.innerHTML = `
              
                This offer was valid for 10 days and has now expired.`;
        }
        if (ticketCard) {
            ticketCard.style.borderColor = "rgba(168, 46, 46, 0.4)";
        }
        if (ticketInstaInstruction) {
            ticketInstaInstruction.style.display = "none";
        }
    } else {
        if (successTitleEl) {
            successTitleEl.innerText = "Offer Successfully Claimed!";
            successTitleEl.style.color = "";
        }
        if (successIconWrapper) {
            successIconWrapper.style.background = "";
            successIconWrapper.style.color = "";
            successIconWrapper.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="success-svg">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>`;
        }
        if (ticketHeader) {
            ticketHeader.innerText = "";
            ticketHeader.style.background = "";
            ticketHeader.style.color = "";
        }
        if (ticketValidityPhrase) {
            ticketValidityPhrase.innerText = "GRAB YOUR OFFER - VALID ONLY FOR 10 DAYS!";
        }
        if (ticketCard) {
            ticketCard.style.borderColor = "";
        }
        if (ticketInstaInstruction) {
            ticketInstaInstruction.style.display = "flex";
        }
    }
}

/**
 * Persists the successfully claimed state and claim timestamp for the visitor.
 */
function setClaimedState(mobileNumber, offerId = sessionReward && sessionReward.id) {
    try {
        const now = Date.now();
        if (!offerId) return;
        if (mobileNumber) {
            safeStorage.setItem("majlis_claimed_mobile", String(mobileNumber).trim());
        }
        const claimKey = window.MajlisClaimState.offerClaimedKey(mobileNumber, offerId);
        if (!claimKey) return;
        safeStorage.setItem(claimKey, "true");
        if (sessionReward) {
            if (sessionReward.id === offerId) {
                safeStorage.setItem(getRewardStorageKey(), offerId);
                safeStorage.setItem(getRewardLabelStorageKey(), sessionReward.label);
                if (sessionReward.coupon) {
                    safeStorage.setItem(getRewardCouponStorageKey(), sessionReward.coupon);
                }
            }
        }
        const claimAtKey = getClaimedAtStorageKey(offerId, mobileNumber);
        if (!safeStorage.getItem(claimAtKey)) {
            safeStorage.setItem(claimAtKey, now.toString());
        }
        console.log("[Majlis] Persisted claimed success state for visitor:", visitorId, "| Claimed at:", new Date(now).toLocaleString());
    } catch (e) {
        console.warn("[Majlis] Error persisting claimed state:", e);
    }
}

/**
 * Clears local campaign state for the current visitor (used for dev reset).
 */
function clearLocalState() {
    if (!isLocalDevResetAllowed()) return false;

    try {
        if (visitorId) {
            const assignedRewardId = window.MajlisClaimState.resolveClassicRewardId(
                safeStorage.getItem(getRewardStorageKey()),
                safeStorage.getItem(getRewardLabelStorageKey())
            );
            safeStorage.removeItem(getRewardStorageKey());
            safeStorage.removeItem(getRewardLabelStorageKey());
            safeStorage.removeItem(getRewardCouponStorageKey());
            safeStorage.removeItem(getRevealedStorageKey());
            const assignedClaimKey = getClaimedStorageKey(assignedRewardId);
            const assignedClaimAtKey = getClaimedAtStorageKey(assignedRewardId);
            const currentClaimKey = getClaimedStorageKey(sessionReward && sessionReward.id);
            const currentClaimAtKey = getClaimedAtStorageKey(sessionReward && sessionReward.id);
            if (assignedClaimKey) safeStorage.removeItem(assignedClaimKey);
            if (assignedClaimAtKey) safeStorage.removeItem(assignedClaimAtKey);
            if (currentClaimKey) safeStorage.removeItem(currentClaimKey);
            if (currentClaimAtKey) safeStorage.removeItem(currentClaimAtKey);
            safeStorage.removeItem(getLegacyClaimedStorageKey());
            safeStorage.removeItem(getLegacyClaimedAtStorageKey());
            safeStorage.removeItem("majlis_claimed_mobile");
            console.log("[Majlis] Cleared local campaign state for visitor:", visitorId);
        }
    } catch (e) {
        console.warn("[Majlis] Error clearing campaign state:", e);
    }
    sessionReward = null;
    return true;
}

/**
 * Resolves visitor identity and assigns or restores their campaign reward.
 */
function initializeReward() {
    // 1. Resolve or generate visitorId
    try {
        visitorId = safeStorage.getItem(VISITOR_KEY);
        if (!visitorId) {
            visitorId = generateVisitorId();
            safeStorage.setItem(VISITOR_KEY, visitorId);
            console.log("[Majlis] Generated new visitor identity:", visitorId);
        } else {
            console.log("[Majlis] Restored existing visitor identity:", visitorId);
        }
    } catch (e) {
        console.warn("[Majlis] Error accessing storage for visitor identity:", e);
        if (!visitorId) visitorId = "fallback";
    }

    // 2. Resolve existing reward or pick a new one for this visitor
    try {
        let savedRewardId = safeStorage.getItem(getRewardStorageKey());
        const savedRewardLabel = safeStorage.getItem(getRewardLabelStorageKey());
        const savedRewardCoupon = safeStorage.getItem(getRewardCouponStorageKey());

        if (savedRewardId) {
            const resolvedRewardId = window.MajlisClaimState.resolveClassicRewardId(savedRewardId, savedRewardLabel);
            if (resolvedRewardId !== savedRewardId) {
                savedRewardId = resolvedRewardId;
                safeStorage.setItem(getRewardStorageKey(), savedRewardId);
            }
            // A. If user has ALREADY claimed their reward, preserve what they claimed
            if (isClaimedState(savedRewardId)) {
                if (LEGACY_REWARD_MAP[savedRewardId]) {
                    sessionReward = LEGACY_REWARD_MAP[savedRewardId];
                    console.log("[Majlis] Restored claimed legacy reward for visitor:", sessionReward.label);
                    return;
                }
                if (savedRewardLabel) {
                    sessionReward = {
                        id: savedRewardId,
                        label: savedRewardLabel,
                        coupon: savedRewardCoupon || null,
                        isWinner: true
                    };
                    console.log("[Majlis] Restored claimed saved reward label for visitor:", sessionReward.label);
                    return;
                }
            } else {
                // B. Unclaimed visitor: strictly validate against active REWARD_POOL
                const foundReward = REWARD_POOL.find(item => item.id === savedRewardId);
                if (foundReward) {
                    sessionReward = foundReward;
                    console.log("[Majlis] Restored active reward for visitor:", sessionReward.label);
                    return;
                } else {
                    // Previously assigned reward is no longer active in REWARD_POOL.
                    // Clear previous scratch reveal state so visitor gets a fresh card with one of the 6 active offers.
                    safeStorage.removeItem(getRevealedStorageKey());
                    console.log("[Majlis] Saved reward was retired from pool. Re-assigning an active offer.");
                }
            }
        }
    } catch (e) {
        console.warn("[Majlis] Error accessing storage for saved reward:", e);
    }

    // Select a random reward from REWARD_POOL if none saved
    const idx = Math.floor(Math.random() * REWARD_POOL.length);
    sessionReward = REWARD_POOL[idx];

    try {
        safeStorage.setItem(getRewardStorageKey(), sessionReward.id);
        safeStorage.setItem(getRewardLabelStorageKey(), sessionReward.label);
        if (sessionReward.coupon) {
            safeStorage.setItem(getRewardCouponStorageKey(), sessionReward.coupon);
        }
        console.log("[Majlis] Assigned NEW reward for visitor:", sessionReward.label);
    } catch (e) {
        console.warn("[Majlis] Error saving reward to storage:", e);
    }
}

/**
 * Strips HTML tags (like <br>) from a label string for clean plain-text output.
 */
function stripHtml(htmlStr) {
    if (!htmlStr) return "";
    return htmlStr.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Writes the assigned sessionReward into every DOM element that
 * displays the offer label or coupon code.
 * Must be called ONCE after selectSessionReward(), before any user interaction.
 */
function applyRewardToDOM() {
    const r = sessionReward;

    // ---- Offer label elements (always updated) ----
    // Reveal layer inside scratch card
    const offerAmountEl       = document.querySelector(".offer-amount");
    // Congrats overlay (inside scratch card, appears after reveal)
    const overlayOfferEl      = document.querySelector(".congrats-overlay-offer");
    // Screen 2 congratulations section
    const congratsOfferAmtEl  = document.querySelector(".congrats-offer-amount");
    // Success ticket screen
    const ticketPercentEl     = document.querySelector(".ticket-percent");
    // Form submit button text
    const btnSubmitTextEl     = document.querySelector("#btn-submit-form .btn-text");

    if (offerAmountEl)       offerAmountEl.innerHTML       = r.label;
    const modalOfferText = document.getElementById("modal-offer-text");
    if (modalOfferText) modalOfferText.innerHTML = r.label;
    if (overlayOfferEl)      overlayOfferEl.innerHTML      = r.label;
    if (congratsOfferAmtEl)  congratsOfferAmtEl.innerHTML  = r.label;
    if (ticketPercentEl)     ticketPercentEl.innerHTML     = r.label;
    if (btnSubmitTextEl)     btnSubmitTextEl.innerText     = r.isWinner
        ? "CLAIM OFFER"
        : "SUBMIT DETAILS";

    // Reveal layer headers & badge
    const offerCongratsEl     = document.getElementById("offer-congrats");
    const offerDescEl         = document.querySelector(".offer-reveal-layer .offer-desc");
    const offerBadgeEl        = document.querySelector(".offer-reveal-layer .offer-badge");

    if (r.isWinner) {
        if (offerCongratsEl) offerCongratsEl.style.display = "";
        if (offerDescEl)     offerDescEl.style.display     = "";
        if (offerBadgeEl)    offerBadgeEl.style.display    = "";
    } else {
        if (offerCongratsEl) offerCongratsEl.style.display = "none";
        if (offerDescEl)     offerDescEl.style.display     = "none";
        if (offerBadgeEl)    offerBadgeEl.style.display    = "none";
    }

    // ---- Coupon code elements ----
    // Flag to control customer-facing coupon code visibility (set to false to temporarily hide coupon UI)
    const SHOW_COUPON_CODE = false;

    // Reveal layer coupon
    const revealCouponParent  = document.querySelector(".offer-reveal-layer .revealed-coupon");
    const revealCouponCode    = document.querySelector(".offer-reveal-layer .coupon-code");
    // Overlay coupon (inside congrats overlay)
    const overlayCouponParent = document.querySelector(".congrats-overlay-coupon");
    const overlayCouponCode   = document.querySelector(".congrats-overlay-coupon .coupon-code");
    // Screen 2 coupon
    const congratsCouponParent= document.querySelector(".congrats-coupon");
    const congratsCouponCode  = document.querySelector(".congrats-coupon .coupon-code");
    // Success screen coupon
    const successCouponCode   = document.getElementById("success-coupon-code");
    const ticketCouponBox     = document.querySelector(".ticket-coupon-box");

    if (SHOW_COUPON_CODE && r.isWinner && r.coupon) {
        // Winner: show all coupon elements with the correct code
        if (revealCouponParent)   revealCouponParent.style.display   = "";
        if (revealCouponCode)     revealCouponCode.innerText         = r.coupon;
        if (overlayCouponParent)  overlayCouponParent.style.display  = "";
        if (overlayCouponCode)    overlayCouponCode.innerText        = r.coupon;
        if (congratsCouponParent) congratsCouponParent.style.display = "";
        if (congratsCouponCode)   congratsCouponCode.innerText       = r.coupon;
        if (successCouponCode)    successCouponCode.innerText        = r.coupon;
        if (ticketCouponBox)      ticketCouponBox.style.display      = "";
    } else {
        // Hide coupon sections gracefully while keeping r.coupon intact for backend & future toggle
        if (revealCouponParent)   revealCouponParent.style.display   = "none";
        if (overlayCouponParent)  overlayCouponParent.style.display  = "none";
        if (congratsCouponParent) congratsCouponParent.style.display = "none";
        if (ticketCouponBox)      ticketCouponBox.style.display      = "none";
        // Store coupon code element text internally if needed for clipboard/future use
        if (successCouponCode)    successCouponCode.innerText        = r.coupon || "";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    
    // --- Screen Navigation Elements ---
    const screenScratch = document.getElementById("screen-scratch");
    const screenInstagram = document.getElementById("screen-instagram");
    const screenForm = document.getElementById("screen-form");
    const screenSuccess = document.getElementById("screen-success");

    // --- Buttons & Action Elements ---
    const btnRestart = document.getElementById("btn-restart");
    const btnDevReset = document.getElementById("btn-dev-reset");
    const btnCopyCode = document.getElementById("btn-copy-code");
    const copyText = document.getElementById("copy-text");

    // The reset control is exposed only on the app's existing localhost dev mode.
    if (btnDevReset) {
        if (isLocalDevResetAllowed()) {
            document.body.appendChild(btnDevReset);
            btnDevReset.hidden = false;
            btnDevReset.addEventListener("click", () => {
                if (!isLocalDevResetAllowed()) return;
                if (!window.confirm("Reset this local Diwali scratch-card test session?")) return;
                if (clearLocalState()) window.location.reload();
            });
        } else {
            btnDevReset.remove();
        }
    }
    
    // --- Congratulations Step Elements ---
    const btnClaimOffer = document.getElementById("btn-claim-offer");
    const btnBackToScratch = document.getElementById("btn-back-to-scratch");
    const btnBackToInstagram = document.getElementById("btn-back-to-instagram");

    // --- Form Elements ---
    const customerForm = document.getElementById("customer-form");
    const inputName = document.getElementById("input-name");
    const inputMobile = document.getElementById("input-mobile");
    const inputEmail = document.getElementById("input-email");
    const btnSubmitForm = document.getElementById("btn-submit-form");
    const formLoader = document.getElementById("form-loader");
    const btnInstagramFollow = document.getElementById("btn-instagram-follow");
    const instagramStatusText = document.getElementById("instagram-status-text");
    const instagramInitialState = document.getElementById("instagram-initial-state");
    const instagramSuccessState = document.getElementById("instagram-success-state");

    // --- Scratch Canvas Elements (kept for backwards compatibility) ---
    const canvas = document.getElementById("scratch-canvas");
    const ctx = canvas ? canvas.getContext("2d", { willReadFrequently: true }) : null;
    const progressBarFill = document.getElementById("progress-bar-fill");
    const scratchProgressText = document.getElementById("scratch-progress-text");
    const scratchProgressArea = document.getElementById("scratch-progress-area");
    const scratchContinueArea = document.getElementById("scratch-continue-area");
    const btnScratchContinue = document.getElementById("btn-scratch-continue");
    const congratsOverlay = document.getElementById("congrats-overlay");
    const offerModal = document.getElementById("offer-modal");
    const btnProceedToClaim = document.getElementById("btn-proceed-to-claim");

    // --- Diwali Lamp Experience Elements ---
    const lampStage = document.getElementById("diwali-lamp-stage");
    const diyaAmbientGlow = document.getElementById("diya-ambient-glow");
    const goldenLightWave = document.getElementById("golden-light-wave");
    const ignitionFlash = document.getElementById("ignition-flash");
    const diyaUnlitImg = document.getElementById("diya-unlit-img");
    const diyaLitImg = document.getElementById("diya-lit-img");
    const diyaWickTarget = document.getElementById("diya-wick-target");
    const diyaStageWrapper = document.querySelector(".diya-stage-wrapper");
    const floatingFlame = document.getElementById("draggable-floating-flame");
    const diwaliInstructionArea = document.getElementById("diwali-instruction-area");
    const diwaliInstructionPill = document.getElementById("diwali-instruction-pill");
    const diwaliInstructionText = document.getElementById("diwali-instruction-text");

    // --- State Variables ---
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    let isRevealed = false;
    let lastPercentCheck = 0;
    let scratchProgress = 0;
    let isInstagramClicked = false;
    let isDraggingFlame = false;
    let flameDragStartX = 0;
    let flameDragStartY = 0;
    let flameCurrentX = 0;
    let flameCurrentY = 0;
    let isIgnited = false;
    let hasInitializedDiwaliEvents = false;

    // --- Confetti Variables & Setup ---
    const confettiCanvas = document.getElementById("confetti-canvas");
    const confettiCtx = confettiCanvas.getContext("2d");
    let confettiParticles = [];
    let isConfettiRunning = false;
    let confettiAnimationId = null;
    let sparkleParticles = [];
    let sparkleAnimationId = null;

    /**
     * Instantly positions viewport at the card section without any visible scrolling animation.
     */
    function scrollToCard(targetScreen) {
        const target = targetScreen || document.querySelector(".screen-card.active");
        if (!target) return;
        
        const cardEl = target.querySelector(".scratch-card-outer, .form-ticket-card, .ticket-card, .congrats-step-card") || target;
        if (cardEl) {
            const rect = cardEl.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const targetTop = rect.top + scrollTop - 16;
            
            window.scrollTo({
                top: Math.max(0, targetTop),
                behavior: "instant"
            });
        }
    }

    // ==========================================================================
    // 1. SCREEN TRANSITION CONTROLLER
    // ==========================================================================
    function showScreen(targetScreen) {
        // Enforce that customers who already claimed can NEVER see the scratch card or form
        if (isClaimedState() && targetScreen !== screenSuccess) {
            targetScreen = screenSuccess;
        }

        const screens = [screenScratch, screenInstagram, screenForm, screenSuccess];
        
        screens.forEach(s => {
            if (s === targetScreen) {
                s.classList.remove("hidden");
                // Trigger reflow for transition animation
                void s.offsetWidth;
                s.classList.add("active");
            } else {
                s.classList.remove("active");
                s.classList.add("hidden");
            }
        });

        if (targetScreen === screenSuccess) {
            updateExpiryUI();
        }

        // Instantly focus the card section without visible scrolling animation
        scrollToCard(targetScreen);
    }

    // ==========================================================================
    // 3. DIWALI 3D LAMP LIGHTING LOGIC & INTERACTION
    // ==========================================================================
    function getElementCenter(el) {
        if (!el) return { x: 0, y: 0 };
        const rect = el.getBoundingClientRect();
        return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
    }

    // The wick is centered in the source artwork at roughly 28.6% of its
    // rendered height. Derive its viewport and wrapper coordinates from the
    // actual image rectangle so the target remains attached at every size.
    function alignDiyaFlameToWick() {
        if (!diyaUnlitImg || !diyaWickTarget || !diyaStageWrapper) return;

        const diyaRect = diyaUnlitImg.getBoundingClientRect();
        const wrapperRect = diyaStageWrapper.getBoundingClientRect();
        if (!diyaRect.width || !diyaRect.height || !wrapperRect.width) return;

        const wickX = diyaRect.left + diyaRect.width * 0.5;
        const wickY = diyaRect.top + diyaRect.height * 0.286;
        diyaWickTarget.style.left = `${wickX - wrapperRect.left}px`;
        diyaWickTarget.style.top = `${wickY - wrapperRect.top}px`;

        if (diyaLitImg) {
            const flameWidth = parseFloat(window.getComputedStyle(diyaLitImg).width);
            const flameHeight = parseFloat(window.getComputedStyle(diyaLitImg).height);
            if (flameWidth > 0 && flameHeight > 0) {
                // The PNG's visible flame base ends at ~90% of its canvas.
                // Anchor that edge to the wick rather than centering the PNG.
                diyaLitImg.style.left = `${wickX - wrapperRect.left - flameWidth / 2}px`;
                diyaLitImg.style.top = `${wickY - wrapperRect.top - flameHeight * 0.9}px`;
            }
        }
    }

    if (diyaStageWrapper) {
        if (typeof ResizeObserver !== "undefined") {
            const diyaResizeObserver = new ResizeObserver(alignDiyaFlameToWick);
            diyaResizeObserver.observe(diyaStageWrapper);
        } else {
            window.addEventListener("resize", alignDiyaFlameToWick, { passive: true });
        }
        if (diyaUnlitImg) diyaUnlitImg.addEventListener("load", alignDiyaFlameToWick);
        if (diyaLitImg) diyaLitImg.addEventListener("load", alignDiyaFlameToWick);
        requestAnimationFrame(alignDiyaFlameToWick);
    }

    function checkWickProximity() {
        if (!floatingFlame || !diyaWickTarget) return;

        const flameCenter = getElementCenter(floatingFlame);
        const wickCenter = getElementCenter(diyaWickTarget);

        const dx = flameCenter.x - wickCenter.x;
        const dy = flameCenter.y - wickCenter.y;
        const distance = Math.hypot(dx, dy);

        // Near wick visual feedback (glowing ring & pill highlight)
        if (distance < 75) {
            diyaWickTarget.classList.add("near");
            if (diwaliInstructionPill) diwaliInstructionPill.classList.add("highlight");
        } else {
            diyaWickTarget.classList.remove("near");
            if (diwaliInstructionPill) diwaliInstructionPill.classList.remove("highlight");
        }

        // Contact ignition threshold
        if (distance < 30) {
            igniteDiya();
        }
    }

    function onFlamePointerDown(e) {
        if (isIgnited || isRevealed || !floatingFlame) return;
        if (e.button !== undefined && e.button !== 0) return; // Primary mouse button only

        isDraggingFlame = true;
        floatingFlame.classList.add("dragging");
        floatingFlame.style.transition = "none";

        if (floatingFlame.setPointerCapture && e.pointerId !== undefined) {
            try {
                floatingFlame.setPointerCapture(e.pointerId);
            } catch (err) {}
        }

        flameDragStartX = e.clientX - flameCurrentX;
        flameDragStartY = e.clientY - flameCurrentY;

        if (e.cancelable) e.preventDefault();
    }

    function onFlamePointerMove(e) {
        if (!isDraggingFlame || isIgnited || isRevealed || !floatingFlame) return;
        if (e.cancelable) e.preventDefault();

        const flameRect = floatingFlame.getBoundingClientRect();
        const originX = flameRect.left - flameCurrentX;
        const originY = flameRect.top - flameCurrentY;
        const stageRect = lampStage ? lampStage.getBoundingClientRect() : null;
        if (!stageRect) return;
        const minX = stageRect.left - originX;
        const maxX = Math.max(minX, stageRect.right - originX - floatingFlame.offsetWidth);
        const minY = stageRect.top - originY;
        const maxY = Math.max(minY, stageRect.bottom - originY - floatingFlame.offsetHeight);

        flameCurrentX = Math.min(maxX, Math.max(minX, e.clientX - flameDragStartX));
        flameCurrentY = Math.min(maxY, Math.max(minY, e.clientY - flameDragStartY));

        floatingFlame.style.transform = `translate3d(${flameCurrentX}px, ${flameCurrentY}px, 0) scale(1.15)`;
        checkWickProximity();
    }

    function onFlamePointerUp(e) {
        if (!isDraggingFlame || isIgnited || !floatingFlame) return;
        isDraggingFlame = false;
        floatingFlame.classList.remove("dragging");

        if (diyaWickTarget) diyaWickTarget.classList.remove("near");
        if (diwaliInstructionPill) diwaliInstructionPill.classList.remove("highlight");

        if (floatingFlame.releasePointerCapture && e && e.pointerId !== undefined) {
            try {
                floatingFlame.releasePointerCapture(e.pointerId);
            } catch (err) {}
        }

        // Smooth spring return to origin if dropped before reaching wick
        floatingFlame.style.transition = "transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)";
        flameCurrentX = 0;
        flameCurrentY = 0;
        floatingFlame.style.transform = "translate3d(0, 0, 0)";

        setTimeout(() => {
            if (!isDraggingFlame && !isIgnited && floatingFlame) {
                floatingFlame.style.transition = "";
            }
        }, 460);
    }

    function animateFlameToWick() {
        if (isIgnited || isRevealed || !floatingFlame || !diyaWickTarget) return;

        const flameCenter = getElementCenter(floatingFlame);
        const wickCenter = getElementCenter(diyaWickTarget);
        const deltaX = wickCenter.x - flameCenter.x;
        const deltaY = wickCenter.y - flameCenter.y;

        floatingFlame.style.transition = "transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)";
        floatingFlame.style.transform = `translate3d(${flameCurrentX + deltaX}px, ${flameCurrentY + deltaY}px, 0) scale(1.1)`;

        setTimeout(() => {
            igniteDiya();
        }, 520);
    }

    function igniteDiya() {
        if (isIgnited) return;
        isIgnited = true;
        isDraggingFlame = false;

        // 1. Floating flame absorbs into wick
        if (floatingFlame) {
            floatingFlame.classList.remove("dragging");
            floatingFlame.classList.add("absorbing");
        }

        // 2. Trigger ignition flash & golden light wave
        if (ignitionFlash) {
            ignitionFlash.classList.remove("flash");
            void ignitionFlash.offsetWidth; // force reflow
            ignitionFlash.classList.add("flash");
        }

        if (goldenLightWave) {
            goldenLightWave.classList.remove("burst");
            void goldenLightWave.offsetWidth;
            goldenLightWave.classList.add("burst");
        }

        // 3. Bloom Diya lit flame layer and ambient glow
        if (diyaLitImg) {
            diyaLitImg.classList.add("lit");
        }
        if (diyaAmbientGlow) {
            diyaAmbientGlow.classList.add("lit");
        }
        if (diyaWickTarget) {
            diyaWickTarget.classList.add("lit");
            diyaWickTarget.classList.remove("near");
        }

        // 4. Update instruction pill
        if (diwaliInstructionPill) {
            diwaliInstructionPill.classList.remove("highlight");
            diwaliInstructionPill.classList.add("ignited");
        }
        if (diwaliInstructionText) {
            diwaliInstructionText.innerText = "Diya is Lit! ✨ Your Diwali Gift Awakens...";
        }

        // 5. Trigger offer reveal
        triggerFestiveConfetti();
        revealOffer();
        if (offerModal) {
            window.setTimeout(() => {
                if (!isClaimedState()) {
                    offerModal.classList.add("show");
                    offerModal.setAttribute("aria-hidden", "false");
                }
            }, 1500);
        }
    }

    function revealOffer() {
        isRevealed = true;

        if (progressBarFill) progressBarFill.style.width = "100%";
        if (scratchProgressText) scratchProgressText.innerText = (sessionReward && sessionReward.isWinner) ? "Revealed! 🎉" : "Revealed! 🍀";

        // Save scratch revealed state to safeStorage
        try {
            safeStorage.setItem(getRevealedStorageKey(), "true");
        } catch (e) {
            console.warn(e);
        }

        // Hide progress bar area cleanly when revealed (surrounding layout stays stable)
        if (scratchProgressArea) {
            scratchProgressArea.classList.add("hidden");
        }
        if (scratchContinueArea) {
            scratchContinueArea.classList.add("hidden");
        }

        // Animate congratulations overlay into view inside the scratch card only for winners
        setTimeout(() => {
            if (sessionReward && sessionReward.isWinner && congratsOverlay) {
                congratsOverlay.classList.remove("hidden");
                void congratsOverlay.offsetWidth;
                congratsOverlay.classList.add("show");
            }
            if (diwaliInstructionText) {
                diwaliInstructionText.innerText = "Happy Diwali! Claim your gift below 🎁";
            }
        }, 650);

        // Enable the form submit button if winner
        if (sessionReward && sessionReward.isWinner && btnSubmitForm) {
            btnSubmitForm.disabled = false;
            btnSubmitForm.classList.remove("btn-locked");
        }
    }

    function initDiwaliDragEvents() {
        if (hasInitializedDiwaliEvents || !floatingFlame) return;
        hasInitializedDiwaliEvents = true;

        let dragMoved = false;

        if (window.PointerEvent) {
            floatingFlame.addEventListener("pointerdown", (e) => {
                dragMoved = false;
                onFlamePointerDown(e);
            });

            window.addEventListener("pointermove", (e) => {
                if (isDraggingFlame) {
                    dragMoved = true;
                    onFlamePointerMove(e);
                }
            });

            window.addEventListener("pointerup", (e) => {
                if (isDraggingFlame) {
                    onFlamePointerUp(e);
                }
            });

            window.addEventListener("pointercancel", (e) => {
                if (isDraggingFlame) {
                    onFlamePointerUp(e);
                }
            });
        } else {
            // Touch & Mouse fallback
            floatingFlame.addEventListener("mousedown", (e) => {
                dragMoved = false;
                onFlamePointerDown(e);
            });
            window.addEventListener("mousemove", (e) => {
                if (isDraggingFlame) {
                    dragMoved = true;
                    onFlamePointerMove(e);
                }
            });
            window.addEventListener("mouseup", (e) => {
                if (isDraggingFlame) onFlamePointerUp(e);
            });

            floatingFlame.addEventListener("touchstart", (e) => {
                dragMoved = false;
                if (e.touches && e.touches.length > 0) {
                    const touch = e.touches[0];
                    onFlamePointerDown({
                        clientX: touch.clientX,
                        clientY: touch.clientY,
                        cancelable: e.cancelable,
                        preventDefault: () => e.preventDefault()
                    });
                }
            }, { passive: false });

            window.addEventListener("touchmove", (e) => {
                if (isDraggingFlame && e.touches && e.touches.length > 0) {
                    dragMoved = true;
                    const touch = e.touches[0];
                    onFlamePointerMove({
                        clientX: touch.clientX,
                        clientY: touch.clientY,
                        cancelable: e.cancelable,
                        preventDefault: () => e.preventDefault()
                    });
                }
            }, { passive: false });

            window.addEventListener("touchend", () => {
                if (isDraggingFlame) onFlamePointerUp();
            });
        }

        // Tap/Click fallback: clicking flame directly guides it to the wick
        floatingFlame.addEventListener("click", (e) => {
            if (!dragMoved && !isIgnited) {
                animateFlameToWick();
            }
        });

        // Accessibility keyboard support (Enter / Space)
        floatingFlame.addEventListener("keydown", (e) => {
            if ((e.key === "Enter" || e.key === " ") && !isIgnited) {
                e.preventDefault();
                animateFlameToWick();
            }
        });

        // Clicking the wick directly also guides flame to wick
        if (diyaWickTarget) {
            diyaWickTarget.style.cursor = "pointer";
            diyaWickTarget.addEventListener("click", () => {
                if (!isIgnited) {
                    animateFlameToWick();
                }
            });
        }
    }

    function initScratchCanvas() {
        // Check if already revealed in persistent storage
        let savedRevealed = false;
        try {
            savedRevealed = safeStorage.getItem(getRevealedStorageKey()) === "true";
        } catch (e) {
            console.warn(e);
        }

        if (savedRevealed) {
            isRevealed = true;
            isIgnited = true;

            if (diyaLitImg) diyaLitImg.classList.add("lit");
            if (diyaAmbientGlow) diyaAmbientGlow.classList.add("lit");
            if (diyaWickTarget) diyaWickTarget.classList.add("lit");
            if (floatingFlame) floatingFlame.classList.add("ignited");
            if (diwaliInstructionPill) diwaliInstructionPill.classList.add("ignited");
            if (diwaliInstructionText) diwaliInstructionText.innerText = "Diya Lit! Enjoy your surprise 🪔";
            if (offerModal && !isClaimedState()) {
                offerModal.classList.add("show");
                offerModal.setAttribute("aria-hidden", "false");
            }

            if (congratsOverlay) {
                if (sessionReward && sessionReward.isWinner) {
                    congratsOverlay.classList.remove("hidden");
                    congratsOverlay.classList.add("show");
                } else {
                    congratsOverlay.classList.add("hidden");
                    congratsOverlay.classList.remove("show");
                }
            }
            if (scratchProgressArea) scratchProgressArea.classList.add("hidden");
            if (scratchContinueArea) scratchContinueArea.classList.add("hidden");
            return;
        }

        // Reset properties for fresh unlit interaction
        isRevealed = false;
        isIgnited = false;
        isDraggingFlame = false;
        flameCurrentX = 0;
        flameCurrentY = 0;

        if (floatingFlame) {
            floatingFlame.classList.remove("dragging", "absorbing", "ignited");
            floatingFlame.style.transform = "translate3d(0, 0, 0)";
            floatingFlame.style.transition = "";
        }
        if (diyaLitImg) diyaLitImg.classList.remove("lit");
        if (diyaAmbientGlow) diyaAmbientGlow.classList.remove("lit");
        if (diyaWickTarget) diyaWickTarget.classList.remove("lit", "near");
        if (diwaliInstructionPill) diwaliInstructionPill.classList.remove("highlight", "ignited");
        if (diwaliInstructionText) diwaliInstructionText.innerText = "Drag the little flame to light the Diya";

        // Reset congratulations overlay
        if (congratsOverlay) {
            congratsOverlay.classList.add("hidden");
            congratsOverlay.classList.remove("show");
        }

        // Attach events
        initDiwaliDragEvents();
    }


    // ==========================================================================
    // 4. VANILLA PARTY CONFETTI ANIMATION
    // ==========================================================================
    function resizeConfettiCanvas() {
        confettiCanvas.width = window.innerWidth;
        confettiCanvas.height = window.innerHeight;
    }

    class ConfettiParticle {
        constructor() {
            this.x = Math.random() * confettiCanvas.width;
            // Spawn above screen, or burst from edges
            const spawnFromEdge = Math.random() > 0.5;
            if (spawnFromEdge) {
                // Burst from bottom left/right corners
                this.x = Math.random() > 0.5 ? 20 : confettiCanvas.width - 20;
                this.y = confettiCanvas.height - 20;
                this.speedX = (Math.random() * 15 + 5) * (this.x < confettiCanvas.width / 2 ? 1 : -1);
                this.speedY = -(Math.random() * 20 + 15);
            } else {
                // Drop from top
                this.y = -20;
                this.speedX = Math.random() * 4 - 2;
                this.speedY = Math.random() * 5 + 3;
            }
            
            this.size = Math.random() * 8 + 6;
            
            // Onam festive color array
            const colors = ['#e65c00', '#f9d423', '#d4af37', '#2e7d32', '#e91e63', '#ffffff'];
            this.color = colors[Math.floor(Math.random() * colors.length)];
            
            this.rotation = Math.random() * 360;
            this.rotationSpeed = Math.random() * 10 - 5;
            this.gravity = 0.4;
            this.friction = 0.98;
            this.opacity = 1;
            this.fadeSpeed = Math.random() * 0.01 + 0.005;
        }

        update() {
            this.speedY += this.gravity;
            this.speedX *= this.friction;
            this.speedY *= this.friction;
            
            this.x += this.speedX;
            this.y += this.speedY;
            this.rotation += this.rotationSpeed;
            
            // Start fading out after dropping halfway
            if (this.y > confettiCanvas.height / 2) {
                this.opacity -= this.fadeSpeed;
            }
        }

        draw() {
            confettiCtx.save();
            confettiCtx.translate(this.x, this.y);
            confettiCtx.rotate((this.rotation * Math.PI) / 180);
            confettiCtx.globalAlpha = this.opacity;
            confettiCtx.fillStyle = this.color;
            
            // Draw rectangle/strip confetti shape
            confettiCtx.fillRect(-this.size / 2, -this.size / 4, this.size, this.size / 2);
            confettiCtx.restore();
        }
    }

    function animateConfetti() {
        if (!isConfettiRunning) return;
        confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

        // Update & Draw existing particles
        for (let i = confettiParticles.length - 1; i >= 0; i--) {
            const p = confettiParticles[i];
            p.update();
            p.draw();

            // Remove dead or off-screen particles
            if (p.opacity <= 0 || p.y > confettiCanvas.height + 20 || p.x < -20 || p.x > confettiCanvas.width + 20) {
                confettiParticles.splice(i, 1);
            }
        }

        // Limit maximum particle count to keep mobile performance buttery smooth
        if (confettiParticles.length > 0) {
            confettiAnimationId = requestAnimationFrame(animateConfetti);
        } else {
            isConfettiRunning = false;
            confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        }
    }

    function triggerConfetti() {
        resizeConfettiCanvas();
        confettiParticles = [];
        isConfettiRunning = true;
        
        // Spawn 100 particles for high density festive effect
        for (let i = 0; i < 110; i++) {
            confettiParticles.push(new ConfettiParticle());
        }

        if (confettiAnimationId) cancelAnimationFrame(confettiAnimationId);
        animateConfetti();
    }

    // The Diwali page's original golden star and sparkle burst, rendered on
    // the production page's existing full-screen canvas.
    function triggerFestiveConfetti() {
        resizeConfettiCanvas();
        sparkleParticles = [];
        const colors = ["#ffd700", "#ffaa00", "#ff5722", "#fff59d", "#ffffff", "#4caf50", "#dfc896"];
        for (let i = 0; i < 90; i++) {
            sparkleParticles.push({
                x: window.innerWidth * 0.5 + (Math.random() - 0.5) * 80,
                y: window.innerHeight * 0.45,
                vx: (Math.random() - 0.5) * 14,
                vy: -Math.random() * 14 - 4,
                size: Math.random() * 6 + 3,
                color: colors[Math.floor(Math.random() * colors.length)],
                alpha: 1,
                rotation: Math.random() * 360,
                vRot: (Math.random() - 0.5) * 12,
                shape: Math.random() > 0.4 ? "star" : "circle"
            });
        }
        if (sparkleAnimationId) cancelAnimationFrame(sparkleAnimationId);
        function renderSparkles() {
            confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
            let alive = 0;
            for (const p of sparkleParticles) {
                if (p.alpha <= 0.01) continue;
                alive++;
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.35;
                p.vx *= 0.98;
                p.alpha -= 0.012;
                p.rotation += p.vRot;
                confettiCtx.save();
                confettiCtx.translate(p.x, p.y);
                confettiCtx.rotate((p.rotation * Math.PI) / 180);
                confettiCtx.globalAlpha = Math.max(0, p.alpha);
                confettiCtx.fillStyle = p.color;
                if (p.shape === "star") {
                    const radius = p.size;
                    confettiCtx.beginPath();
                    confettiCtx.moveTo(0, -radius);
                    confettiCtx.quadraticCurveTo(0, 0, radius, 0);
                    confettiCtx.quadraticCurveTo(0, 0, 0, radius);
                    confettiCtx.quadraticCurveTo(0, 0, -radius, 0);
                    confettiCtx.quadraticCurveTo(0, 0, 0, -radius);
                    confettiCtx.closePath();
                    confettiCtx.fill();
                } else {
                    confettiCtx.beginPath();
                    confettiCtx.arc(0, 0, p.size * 0.5, 0, Math.PI * 2);
                    confettiCtx.fill();
                }
                confettiCtx.restore();
            }
            if (alive) sparkleAnimationId = requestAnimationFrame(renderSparkles);
            else confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        }
        renderSparkles();
    }

    // Listen to resize to keep confetti canvas responsive
    window.addEventListener("resize", () => {
        if (isConfettiRunning) resizeConfettiCanvas();
    });

    // ==========================================================================
    // 5. REGISTRATION FORM VALIDATION & HANDLING
    // ==========================================================================
    
    // Clear validation error when typing
    [inputName, inputMobile, inputEmail].forEach(input => {
        input.addEventListener("input", () => {
            input.classList.remove("invalid");
        });
    });

    // Clean formatting inputs for numbers
    inputMobile.addEventListener("input", (e) => {
        // Strip non-numbers
        e.target.value = e.target.value.replace(/\D/g, "");
    });

    function validateEmail(email) {
        const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return re.test(String(email).toLowerCase());
    }

    // Fetch timeout helper using AbortController with 15 second limit
    const fetchWithTimeout = (url, options = {}, timeoutMs = 15000) => {
        const controller = (typeof AbortController !== "undefined") ? new AbortController() : null;
        const signal = controller ? controller.signal : undefined;
        const timer = setTimeout(() => {
            if (controller) controller.abort();
        }, timeoutMs);

        return fetch(url, { ...options, signal })
            .finally(() => clearTimeout(timer));
    };

    function handleFormSubmit(e) {
        e.preventDefault();
        
        // Prevent duplicate simultaneous submissions
        if (btnSubmitForm.dataset.submitting === "true") return;
        btnSubmitForm.dataset.submitting = "true";

        // Use the session reward directly — single source of truth, never re-reads DOM
        const offerVal  = sessionReward ? stripHtml(sessionReward.label) : "Unknown";
        const couponVal = sessionReward ? (sessionReward.coupon || "") : "";
        
        const dynamicBtnText = (sessionReward && sessionReward.isWinner) ? "CLAIM OFFER" : "SUBMIT DETAILS";

        let isValid = true;

        // Validate Name
        if (inputName.value.trim().length < 2) {
            inputName.classList.add("invalid");
            isValid = false;
        } else {
            inputName.classList.remove("invalid");
        }

        // Validate Mobile Number (Exactly 10 digits)
        const mobileVal = inputMobile.value.trim();
        if (mobileVal.length !== 10 || !/^\d{10}$/.test(mobileVal)) {
            inputMobile.classList.add("invalid");
            isValid = false;
        } else {
            inputMobile.classList.remove("invalid");
        }

        // Validate Email (Optional)
        const emailVal = inputEmail.value.trim();
        if (emailVal !== "" && !validateEmail(emailVal)) {
            inputEmail.classList.add("invalid");
            isValid = false;
        } else {
            inputEmail.classList.remove("invalid");
        }

        if (!isValid) {
            delete btnSubmitForm.dataset.submitting;
            return;
        }

        // If Valid, Enter Loading State
        btnSubmitForm.disabled = true;
        const btnText = btnSubmitForm.querySelector(".btn-text");
        if (btnText) btnText.innerText = "Submitting...";
        if (formLoader) formLoader.classList.remove("hidden");

        const now = new Date();
        const formattedClaimDateTime = now.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }) + ", " + now.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
        });

        const nameVal = inputName.value.trim();
        const mobileValFinal = inputMobile.value.trim();
        const emailValFinal = emailVal !== "" ? emailVal : "Not Provided";

        // Submit the canonical claim fields to PostgreSQL.
        const claimPayload = {
            fullName: nameVal,
            mobileNumber: mobileValFinal,
            email: emailValFinal,
            offer: offerVal,
            offerId: sessionReward ? sessionReward.id : "",
            claimDateTime: formattedClaimDateTime
        };

        // Primary API submission to PostgreSQL Backend
        fetchWithTimeout(BACKEND_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(claimPayload)
        }, 15000)
        .then(response => {
            if (!response.ok) {
                throw new Error("HTTP error " + response.status);
            }
            return response.json();
        })
        .then(data => {
            if (data && data.success) {
                // Persist successfully claimed state & show success ticket screen
                setClaimedState(mobileValFinal, sessionReward && sessionReward.id);
                showScreen(screenSuccess);
                triggerConfetti();
            } else if (data && data.error === "ALREADY_CLAIMED") {
                if (data.claim) {
                    handleDbClaimedOffer(data.claim, "Welcome back! Displaying your claimed offer from DB.");
                } else {
                    fetchClaimByMobile(mobileValFinal).catch(() => {
                        inputMobile.classList.add("invalid");
                        const errorMobile = document.getElementById("error-mobile");
                        if (errorMobile) {
                            errorMobile.innerText = "This mobile number has already claimed an offer!";
                            errorMobile.style.display = "block";
                        }
                        showToast("This mobile number has already claimed an offer!");
                    });
                }
            } else {
                throw new Error(data && data.error ? data.error : "Submission unsuccessful");
            }
        })
        .catch(err => {
            console.error("Submission error:", err);
            // Display error toast warning using our custom toast utility
            showToast("Failed to save details. Please check your connection and try again.");
        })
        .finally(() => {
            delete btnSubmitForm.dataset.submitting;
            btnSubmitForm.disabled = false;
            if (btnText) btnText.innerText = dynamicBtnText;
            if (formLoader) formLoader.classList.add("hidden");
        });
    }

    customerForm.addEventListener("submit", handleFormSubmit);

    // ==========================================================================
    // 6. UTILITY / RESET / COPY BUTTON FUNCTIONS
    // ==========================================================================
    
    // Copy Coupon Code Action
    btnCopyCode.addEventListener("click", () => {
        const codeText = document.getElementById("success-coupon-code").innerText;
        
        const performCopyFeedback = () => {
            copyText.innerText = "Copied!";
            btnCopyCode.style.background = "#2e7d32"; // Green success border tint
            
            setTimeout(() => {
                copyText.innerText = "Copy";
                btnCopyCode.style.background = ""; // Reset to default CSS style gradient
            }, 2000);
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(codeText)
                .then(performCopyFeedback)
                .catch(err => {
                    console.warn("Clipboard API blocked, using textarea fallback: ", err);
                    fallbackCopyToClipboard(codeText, performCopyFeedback);
                });
        } else {
            fallbackCopyToClipboard(codeText, performCopyFeedback);
        }
    });

    function fallbackCopyToClipboard(text, callback) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed"; // Avoid scrolling page
        textArea.style.left = "-9999px";
        textArea.style.top = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                callback();
            } else {
                console.error("Fallback copy command was unsuccessful");
            }
        } catch (err) {
            console.error("Fallback copy command threw: ", err);
        }
        
        document.body.removeChild(textArea);
    }

    // --- Toast Notification Helper ---
    function showToast(message) {
        const container = document.getElementById("toast-container");
        if (!container) return;

        // Clear existing toasts to prevent stacking
        container.innerHTML = "";

        const toast = document.createElement("div");
        toast.className = "toast";
        toast.innerHTML = `
            <span class="toast-icon">⚠️</span>
            <span class="toast-message">${message}</span>
        `;
        
        container.appendChild(toast);
        
        // Force reflow
        void toast.offsetWidth;
        
        toast.classList.add("show");
        
        setTimeout(() => {
            toast.classList.remove("show");
            setTimeout(() => {
                if (toast.parentNode === container) {
                    container.removeChild(toast);
                }
            }, 350);
        }, 3000);
    }

    // Helper to format raw DB offer text into clean HTML label if needed
    function formatDbOfferLabel(rawOffer) {
        if (!rawOffer) return "Exclusive Offer";
        let formatted = String(rawOffer).replace(/Rs\./g, "₹");
        return formatted;
    }

    // Helper to handle restoring and rendering DB-claimed offer details
    function handleDbClaimedOffer(claimData, successToastMsg) {
        if (!claimData || !claimData.offer) return false;

        const dbOfferLabel = formatDbOfferLabel(claimData.offer);
        const claimOfferId = claimData.offerId
            || window.MajlisClaimState.inferLegacyOfferId(claimData.offer)
            || "claimed_db";
        sessionReward = {
            id: claimOfferId,
            label: dbOfferLabel,
            coupon: null,
            isWinner: true
        };

        // Determine claim timestamp from DB claimDateTime or created_at
        let claimTimestamp = Date.now();
        if (claimData.claimDateTime) {
            const parsedDate = new Date(claimData.claimDateTime);
            if (!isNaN(parsedDate.getTime())) {
                claimTimestamp = parsedDate.getTime();
            }
        }
        
        // Persist claimed state to local storage so ticket remains visible
        if (claimData.mobileNumber) {
            safeStorage.setItem("majlis_claimed_mobile", String(claimData.mobileNumber).trim());
        }
        if (claimOfferId !== "claimed_db") {
            const claimKey = window.MajlisClaimState.offerClaimedKey(claimData.mobileNumber, claimOfferId);
            const claimAtKey = window.MajlisClaimState.offerClaimedAtKey(claimData.mobileNumber, claimOfferId);
            if (claimKey && claimAtKey) {
                safeStorage.setItem(claimKey, "true");
                safeStorage.setItem(claimAtKey, claimTimestamp.toString());
            }
        }

        // Apply reward label to DOM elements and show success ticket
        applyRewardToDOM();
        showScreen(screenSuccess);

        if (successToastMsg) {
            showToast(successToastMsg);
        }
        return true;
    }

    // Function to fetch claim from DB by mobile number
    function fetchClaimByMobile(mobileNumber) {
        const cleanMobile = String(mobileNumber).trim();
        const url = `${BACKEND_API_URL}?mobileNumber=${encodeURIComponent(cleanMobile)}`;

        return fetchWithTimeout(url, { method: "GET" }, 15000)
            .then(res => res.json())
            .then(data => {
                if (data && data.success) return window.MajlisClaimState.claimsFromResponse(data);
                throw new Error(data && data.error ? data.error : "Failed to fetch claim status.");
            });
    }

    const claimedTicketList = document.getElementById("claimed-ticket-list");
    const lookupClaimResults = document.getElementById("lookup-claim-results");

    function showClaimedTickets(claims, containers, activateFirst) {
        containers.forEach(container => {
            if (!container) return;
            container.replaceChildren();
            if (claims.length < 2) return;

            claims.forEach((claim, index) => {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "claimed-ticket-option";
                const claimDate = claim.claimDateTime ? ` — ${String(claim.claimDateTime)}` : "";
                button.textContent = `${formatDbOfferLabel(claim.offer)} — Ticket ${index + 1}${claimDate}`;
                button.addEventListener("click", () => {
                    handleDbClaimedOffer(claim);
                    if (modalLookup) modalLookup.classList.add("hidden");
                });
                container.appendChild(button);
            });
        });

        if (activateFirst && claims.length) {
            handleDbClaimedOffer(claims[0]);
        }
    }

    // --- Claimed Offer Lookup Modal Handlers ---
    const modalLookup = document.getElementById("modal-claim-lookup");
    const btnCloseLookup = document.getElementById("btn-close-lookup");
    const formLookupClaim = document.getElementById("form-lookup-claim");
    const inputLookupMobile = document.getElementById("input-lookup-mobile");
    const btnSubmitLookup = document.getElementById("btn-submit-lookup");
    const lookupLoader = document.getElementById("lookup-loader");
    const checkClaimedBtns = document.querySelectorAll(".btn-check-claimed-link");

    checkClaimedBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            if (modalLookup) {
                modalLookup.classList.remove("hidden");
                if (lookupClaimResults) lookupClaimResults.replaceChildren();
                if (inputLookupMobile) {
                    inputLookupMobile.value = "";
                    inputLookupMobile.classList.remove("invalid");
                    inputLookupMobile.focus();
                }
            }
        });
    });

    if (btnCloseLookup) {
        btnCloseLookup.addEventListener("click", () => {
            if (modalLookup) modalLookup.classList.add("hidden");
        });
    }

    if (modalLookup) {
        modalLookup.addEventListener("click", (e) => {
            if (e.target === modalLookup) {
                modalLookup.classList.add("hidden");
            }
        });
    }

    if (formLookupClaim) {
        formLookupClaim.addEventListener("submit", (e) => {
            e.preventDefault();
            const mobileVal = inputLookupMobile ? inputLookupMobile.value.trim() : "";
            if (mobileVal.length !== 10 || !/^\d{10}$/.test(mobileVal)) {
                if (inputLookupMobile) inputLookupMobile.classList.add("invalid");
                return;
            }

            if (btnSubmitLookup) btnSubmitLookup.disabled = true;
            if (lookupLoader) lookupLoader.classList.remove("hidden");

            fetchClaimByMobile(mobileVal)
                .then(claims => {
                    if (!claims.length) {
                        showToast("No claimed offer found for this mobile number.");
                        return;
                    }
                    showClaimedTickets(claims, [lookupClaimResults, claimedTicketList], claims.length === 1);
                    if (claims.length === 1 && modalLookup) modalLookup.classList.add("hidden");
                })
                .catch(err => {
                    console.error("[Lookup Error]", err);
                    showToast("No active claimed offer found for this number.");
                })
                .finally(() => {
                    if (btnSubmitLookup) btnSubmitLookup.disabled = false;
                    if (lookupLoader) lookupLoader.classList.add("hidden");
                });
        });
    }

    if (btnClaimOffer) {
        btnClaimOffer.addEventListener("click", () => {
            showScreen(screenForm);
        });
    }

    // Instagram Follow Button Listener
    if (btnInstagramFollow) {
        btnInstagramFollow.addEventListener("click", () => {
            isInstagramClicked = true;
            
            // Enable the submit button
            if (btnSubmitForm) {
                btnSubmitForm.disabled = false;
                btnSubmitForm.classList.remove("btn-locked");
            }
            
            // Hide initial state and show success welcome state
            if (instagramInitialState) {
                instagramInitialState.classList.add("hidden");
            }
            if (instagramSuccessState) {
                instagramSuccessState.classList.remove("hidden");
            }
        });
    }

    // Back Navigation button listeners
    if (btnBackToScratch) {
        btnBackToScratch.addEventListener("click", () => {
            showScreen(screenScratch);
        });
    }

    if (btnBackToInstagram) {
        btnBackToInstagram.addEventListener("click", () => {
            showScreen(screenScratch);
        });
    }

    if (btnScratchContinue) {
        btnScratchContinue.addEventListener("click", () => {
            showScreen(screenForm);
        });
    }

    if (btnProceedToClaim) {
        btnProceedToClaim.addEventListener("click", () => {
            offerModal.classList.remove("show");
            offerModal.setAttribute("aria-hidden", "true");
            showScreen(screenForm);
        });
    }

    // Reset Campaign Flow
    if (btnRestart) {
        if (DEV_MODE) {
            btnRestart.classList.remove("hidden");
        }

        btnRestart.addEventListener("click", () => {
            if (DEV_MODE) {
                clearLocalState();
                window.location.reload();
                return;
            }

            // Reset forms & styles
            if (customerForm) customerForm.reset();
            [inputName, inputMobile, inputEmail].forEach(input => {
                if (input) input.classList.remove("invalid");
            });

            // Reset Instagram Follow state
            isInstagramClicked = false;
            if (btnSubmitForm) {
                btnSubmitForm.disabled = true;
                btnSubmitForm.classList.add("btn-locked");
            }
            if (instagramInitialState) {
                instagramInitialState.classList.remove("hidden");
            }
            if (instagramSuccessState) {
                instagramSuccessState.classList.add("hidden");
            }
            if (instagramStatusText) {
                instagramStatusText.innerText = "Instagram step required *";
                instagramStatusText.classList.remove("verified");
            }

            // Go back to scratch card screen directly
            showScreen(screenScratch);
            initScratchCanvas();
        });
    }

    // ==========================================================================
    // 6. INITIALIZE CAMPAIGN APP
    // ==========================================================================
    // Step 1: Initialize persistent session reward (restores if exists, else generates once)
    initializeReward();
    // Step 2: Write that reward into all DOM display elements before any interaction
    applyRewardToDOM();
    
    // Step 3: Determine correct start screen based on claimed status & sync DB claim
    const savedClaimedMobile = safeStorage.getItem("majlis_claimed_mobile");

    if (isClaimedState()) {
        console.log("[Majlis] Visitor has already claimed their reward. Displaying Success screen directly.");
        showScreen(screenSuccess);

        if (savedClaimedMobile) {
            fetchClaimByMobile(savedClaimedMobile).then(claims => {
                showClaimedTickets(claims, [claimedTicketList], false);
                const currentClaim = claims.find(claim =>
                    (claim.offerId || window.MajlisClaimState.inferLegacyOfferId(claim.offer)) === sessionReward.id
                );
                if (currentClaim) handleDbClaimedOffer(currentClaim);
            }).catch(err => {
                console.warn("[Majlis] Failed to sync claim from DB, displaying local state:", err);
            });
        }
    } else {
        // Initialize the scratch canvas normally for new visitors
        initScratchCanvas();
    }

    // Step 3.5: Run form button eligibility check based on restore state
    const isEligible = isRevealed && sessionReward && sessionReward.isWinner;
    if (isEligible) {
        if (btnSubmitForm) {
            btnSubmitForm.disabled = false;
            btnSubmitForm.classList.remove("btn-locked");
        }
    } else {
        if (btnSubmitForm) {
            btnSubmitForm.disabled = true;
            btnSubmitForm.classList.add("btn-locked");
        }
    }

    // Step 4: Remove loading state and show the correct UI
    const initLoader = document.getElementById("init-loader");
    if (initLoader) {
        initLoader.style.transition = "opacity 0.4s ease";
        initLoader.style.opacity = "0";
        setTimeout(() => {
            if (initLoader.parentNode) {
                initLoader.parentNode.removeChild(initLoader);
            }
        }, 400);
    }
});
