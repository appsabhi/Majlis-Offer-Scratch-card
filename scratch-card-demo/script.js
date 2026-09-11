/* ==========================================================================
   MAJLIS ONAM PROMOTION - CLIENT LOGIC
   ========================================================================== */

// --- CONFIGURATION SECTION ---
const BACKEND_API_URL = "/api/claims";
// Copy the Web App URL from your deployed Google Apps Script and paste it below (optional backup):
const GOOGLE_SHEETS_API_URL = "https://script.google.com/macros/s/AKfycbyXm_94jLRyCPccQQ2bYxB6DjPveIW2Mh9YZ6dFIiHHfkJsKTHck2U8o1V2S41mDISssA/exec";
// ==========================================================================
// REWARD POOL CONFIGURATION
// Add, remove, or edit offers here. Each entry must have:
//   label      — Display text shown in the scratch reveal and all UI elements
//   coupon     — Coupon code string. Set to null for non-winning outcomes.
//   isWinner   — true if this is a real prize; false for "Better Luck" outcomes
// ==========================================================================
const REWARD_POOL = [
    { id: "offer5",       label: "5% OFF",               coupon: "ONAM5",    isWinner: true  },
    { id: "offerDessert", label: `₹200 <br> for Unlimited <br> Mandi (qtr)`,         coupon: "ONAMDESS", isWinner: true  },
    // { id: "betterLuck",   label: "Better Luck Next Time",coupon: null,       isWinner: false }
];

// Legacy reward map to ensure users who claimed previous campaign offers (e.g. 21% OFF or ₹174 Mandi) keep their exact claimed reward when returning
const LEGACY_REWARD_MAP = {
    "offer20":      { id: "offer20",      label: "21% OFF",                                      coupon: "ONAM20",   isWinner: true },
    "offer174":     { id: "offer174",     label: `₹174 <br> for Unlimited <br> Mandi (qtr)`,     coupon: "ONAMDESS", isWinner: true }
};

// Holds the ONE reward assigned for this session. Set once on page load.
let sessionReward = null;

const DEV_MODE = true;

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
 * Helper to get the claimed storage key for the current visitor.
 */
function getClaimedStorageKey() {
    return `majlis_campaign_claimed_${visitorId || "fallback"}`;
}

/**
 * Helper to get the claimed timestamp storage key for the current visitor.
 */
function getClaimedAtStorageKey() {
    return `majlis_campaign_claimed_at_${visitorId || "fallback"}`;
}

/**
 * Checks whether the visitor has successfully claimed their reward.
 */
function isClaimedState() {
    try {
        return safeStorage.getItem(getClaimedStorageKey()) === "true";
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
        const claimedAtStr = safeStorage.getItem(getClaimedAtStorageKey());
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
function setClaimedState() {
    try {
        const now = Date.now();
        safeStorage.setItem(getClaimedStorageKey(), "true");
        if (sessionReward) {
            safeStorage.setItem(getRewardLabelStorageKey(), sessionReward.label);
            if (sessionReward.coupon) {
                safeStorage.setItem(getRewardCouponStorageKey(), sessionReward.coupon);
            }
        }
        if (!safeStorage.getItem(getClaimedAtStorageKey())) {
            safeStorage.setItem(getClaimedAtStorageKey(), now.toString());
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
    try {
        if (visitorId) {
            safeStorage.removeItem(getRewardStorageKey());
            safeStorage.removeItem(getRewardLabelStorageKey());
            safeStorage.removeItem(getRewardCouponStorageKey());
            safeStorage.removeItem(getRevealedStorageKey());
            safeStorage.removeItem(getClaimedStorageKey());
            safeStorage.removeItem(getClaimedAtStorageKey());
            console.log("[Majlis] Cleared local campaign state for visitor:", visitorId);
        }
    } catch (e) {
        console.warn("[Majlis] Error clearing campaign state:", e);
    }
    sessionReward = null;
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
        const savedRewardId = safeStorage.getItem(getRewardStorageKey());
        const savedRewardLabel = safeStorage.getItem(getRewardLabelStorageKey());
        const savedRewardCoupon = safeStorage.getItem(getRewardCouponStorageKey());

        if (savedRewardId) {
            // First check if an explicit saved reward label exists (persisted for claimed visitors)
            if (savedRewardLabel) {
                sessionReward = {
                    id: savedRewardId,
                    label: savedRewardLabel,
                    coupon: savedRewardCoupon || null,
                    isWinner: true
                };
                console.log("[Majlis] Restored saved reward label for visitor:", sessionReward.label);
                return;
            }

            // Check legacy map for old reward IDs (e.g. offer20 -> 21% OFF)
            if (LEGACY_REWARD_MAP[savedRewardId]) {
                sessionReward = LEGACY_REWARD_MAP[savedRewardId];
                console.log("[Majlis] Restored legacy reward for visitor:", sessionReward.label);
                return;
            }

            // Fallback: if visitor claimed offerDessert before the ₹200 update
            if (savedRewardId === "offerDessert" && isClaimedState()) {
                sessionReward = {
                    id: "offerDessert",
                    label: `₹174 <br> for Unlimited <br> Mandi (qtr)`,
                    coupon: "ONAMDESS",
                    isWinner: true
                };
                console.log("[Majlis] Restored claimed legacy Mandi reward:", sessionReward.label);
                return;
            }

            // Check active REWARD_POOL next
            const foundReward = REWARD_POOL.find(item => item.id === savedRewardId);
            if (foundReward) {
                sessionReward = foundReward;
                console.log("[Majlis] Restored existing reward for visitor:", sessionReward.label);
                return;
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
    const btnCopyCode = document.getElementById("btn-copy-code");
    const copyText = document.getElementById("copy-text");
    
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

    // --- Scratch Canvas Elements ---
    const canvas = document.getElementById("scratch-canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const progressBarFill = document.getElementById("progress-bar-fill");
    const scratchProgressText = document.getElementById("scratch-progress-text");
    const scratchProgressArea = document.getElementById("scratch-progress-area");
    const scratchContinueArea = document.getElementById("scratch-continue-area");
    const btnScratchContinue = document.getElementById("btn-scratch-continue");
    const congratsOverlay = document.getElementById("congrats-overlay");

    // --- State Variables ---
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    let isRevealed = false;
    let lastPercentCheck = 0;
    let scratchProgress = 0;
    let isInstagramClicked = false;

    // --- Confetti Variables & Setup ---
    const confettiCanvas = document.getElementById("confetti-canvas");
    const confettiCtx = confettiCanvas.getContext("2d");
    let confettiParticles = [];
    let isConfettiRunning = false;
    let confettiAnimationId = null;

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
    // 3. CANVAS SCRATCH CARD LOGIC
    // ==========================================================================
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
            scratchProgress = 100;
            progressBarFill.style.width = "100%";
            scratchProgressText.innerText = sessionReward.isWinner ? "Revealed! 🎉" : "Revealed! 🍀";
            canvas.style.opacity = "0";
            canvas.style.pointerEvents = "none";
            
            if (congratsOverlay) {
                if (sessionReward.isWinner) {
                    congratsOverlay.classList.remove("hidden");
                    congratsOverlay.classList.add("show");
                } else {
                    congratsOverlay.classList.add("hidden");
                    congratsOverlay.classList.remove("show");
                }
            }
            if (scratchProgressArea) {
                scratchProgressArea.classList.add("hidden");
            }
            if (scratchContinueArea) {
                scratchContinueArea.classList.add("hidden");
            }
            return;
        }

        // Reset properties
        isRevealed = false;
        scratchProgress = 0;
        progressBarFill.style.width = "0%";
        scratchProgressText.innerText = "Scratch: 0%";
        canvas.style.opacity = "1";
        canvas.style.pointerEvents = "auto";

        // Reset congratulations overlay
        if (congratsOverlay) {
            congratsOverlay.classList.add("hidden");
            congratsOverlay.classList.remove("show");
        }
        
        // Reset progress/continue button visibility
        if (scratchProgressArea && scratchContinueArea) {
            scratchProgressArea.classList.remove("hidden");
            scratchContinueArea.classList.add("hidden");
        }

        // Ensure proper resolutions for retina / high-DPI screens
        const size = 300; 
        canvas.width = size;
        canvas.height = size;

        // Draw Cover Layer
        drawScratchCover();
    }

    function drawScratchCover() {
        ctx.save();
        
        // Premium Arabian green gradient
        const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        grad.addColorStop(0, '#073520'); // Deep forest green
        grad.addColorStop(0.5, '#0c472d'); // Rich mid green
        grad.addColorStop(1, '#052a19'); // Dark shadow green
        
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        // Draw elegant concentric Arabian diamond patterns
        ctx.strokeStyle = "rgba(197, 160, 89, 0.15)";
        ctx.lineWidth = 1.5;
        for (let r = 20; r <= 100; r += 20) {
            ctx.beginPath();
            ctx.moveTo(centerX, centerY - r);
            ctx.lineTo(centerX + r, centerY);
            ctx.lineTo(centerX, centerY + r);
            ctx.lineTo(centerX - r, centerY);
            ctx.closePath();
            ctx.stroke();
        }
        
        // Draw elegant radiating geometric lines
        ctx.strokeStyle = "rgba(197, 160, 89, 0.08)";
        ctx.lineWidth = 1;
        for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI) / 4;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(
                centerX + Math.cos(angle) * 120,
                centerY + Math.sin(angle) * 120
            );
            ctx.stroke();
        }

        // Draw elegant gold double frame border
        ctx.strokeStyle = "rgba(197, 160, 89, 0.4)";
        ctx.lineWidth = 2;
        ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

        ctx.strokeStyle = "rgba(197, 160, 89, 0.2)";
        ctx.lineWidth = 1;
        ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);

        // Scratch Text Label
        ctx.fillStyle = "#faf7f2"; // Cream white text
        ctx.font = "600 14px 'Poppins', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        
        // Text drop shadow (canvas style)
        ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 1.5;
        
        ctx.fillText("SCRATCH TO REVEAL 👆", centerX, centerY);
        
        ctx.restore();
    }

    // Event Coordinators
    function getMousePos(e) {
        const rect = canvas.getBoundingClientRect();
        // Calculate coordinate scale in case canvas element width/height differs from css client width/height
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        let clientX, clientY;
        
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    function startScratching(e) {
        if (isRevealed) return;
        isDrawing = true;
        const pos = getMousePos(e);
        lastX = pos.x;
        lastY = pos.y;
    }

    function scratch(e) {
        if (!isDrawing || isRevealed) return;
        if (e.cancelable) e.preventDefault(); // Prevents dragging/scrolling on mobile devices

        const pos = getMousePos(e);
        
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out'; // Transparent paint brush
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(pos.x, pos.y);
        ctx.lineWidth = 42; // Brush size
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.restore();

        lastX = pos.x;
        lastY = pos.y;

        // Perform throttled scratch percentage check
        const now = Date.now();
        if (now - lastPercentCheck > 120) {
            lastPercentCheck = now;
            checkScratchPercentage();
        }
    }

    function stopScratching() {
        if (isDrawing) {
            isDrawing = false;
            checkScratchPercentage(); // final check on release
        }
    }

    function checkScratchPercentage() {
        if (isRevealed) return;

        try {
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const pixels = imgData.data;
            const totalPixels = pixels.length / 4;
            let transparentPixels = 0;

            // Optimize: Check every 8th pixel (32 bytes jump) for fast responsive calculations
            for (let i = 3; i < pixels.length; i += 32) {
                if (pixels[i] === 0) {
                    transparentPixels++;
                }
            }

            // Multiplying back by 8 since we sampled 1/8th of pixels
            const percentage = Math.min(((transparentPixels * 8) / totalPixels) * 100, 100);
            
            scratchProgress = Math.round(percentage);
            progressBarFill.style.width = `${scratchProgress}%`;
            scratchProgressText.innerText = `Scratch: ${scratchProgress}%`;

            // Reveal threshold reached
            if (scratchProgress >= 50) {
                revealOffer();
            }
        } catch (err) {
            console.warn("[Majlis] Error calculating scratch percentage:", err);
        }
    }

    function revealOffer() {
        isRevealed = true;
        isDrawing = false;
        
        progressBarFill.style.width = "100%";
        scratchProgressText.innerText = sessionReward.isWinner ? "Revealed! 🎉" : "Revealed! 🍀";

        // Save scratch revealed state to safeStorage
        try {
            safeStorage.setItem(getRevealedStorageKey(), "true");
        } catch (e) {
            console.warn(e);
        }

        // Smooth fade out animation for the canvas layer
        canvas.style.transition = "opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)";
        canvas.style.opacity = "0";
        canvas.style.pointerEvents = "none";

        // Confetti party only for winners
        if (sessionReward.isWinner) {
            triggerConfetti();
        }

        // Hide progress bar area cleanly when revealed (surrounding layout stays stable)
        if (scratchProgressArea) {
            scratchProgressArea.classList.add("hidden");
        }
        if (scratchContinueArea) {
            scratchContinueArea.classList.add("hidden");
        }

        // Animate congratulations overlay into view inside the scratch card only for winners
        if (sessionReward.isWinner && congratsOverlay) {
            congratsOverlay.classList.remove("hidden");
            // Force reflow to trigger scale transition animation
            void congratsOverlay.offsetWidth;
            congratsOverlay.classList.add("show");
        }

        // Enable the form submit button if winner
        if (sessionReward.isWinner && btnSubmitForm) {
            btnSubmitForm.disabled = false;
            btnSubmitForm.classList.remove("btn-locked");
        }
    }

    // Attach Scratch Canvas Event Listeners cleanly with touch/pointer interruption handling
    canvas.addEventListener("mousedown", startScratching);
    canvas.addEventListener("mousemove", scratch);
    window.addEventListener("mouseup", stopScratching);

    canvas.addEventListener("touchstart", (e) => {
        if (e.cancelable) e.preventDefault();
        startScratching(e);
    }, { passive: false });
    canvas.addEventListener("touchmove", scratch, { passive: false });
    window.addEventListener("touchend", stopScratching);
    window.addEventListener("touchcancel", stopScratching);

    if (window.PointerEvent) {
        canvas.addEventListener("pointerdown", (e) => {
            if (e.pointerType === "touch" && e.cancelable) e.preventDefault();
            startScratching(e);
        });
        canvas.addEventListener("pointermove", scratch);
        window.addEventListener("pointerup", stopScratching);
        window.addEventListener("pointercancel", stopScratching);
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

        // Claim Payload: Exactly matched keys & fallbacks for PostgreSQL Backend & Google Sheets backup
        const claimPayload = {
            fullName: nameVal,
            mobileNumber: mobileValFinal,
            email: emailValFinal,
            offer: offerVal,
            couponCode: couponVal,
            coupon: couponVal,
            claimDateTime: formattedClaimDateTime,

            // Fallback aliases for maximum server script compatibility
            name: nameVal,
            mobile: mobileValFinal,
            phone: mobileValFinal,
            "Full Name": nameVal,
            "Mobile Number": mobileValFinal,
            "Email": emailValFinal,
            "Offer": offerVal,
            "Coupon Code": couponVal,
            "Claim Date & Time": formattedClaimDateTime
        };

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
                // Background backup post to Google Sheets (if configured)
                if (GOOGLE_SHEETS_API_URL && GOOGLE_SHEETS_API_URL.startsWith("http") && !GOOGLE_SHEETS_API_URL.includes("PASTE_YOUR")) {
                    fetchWithTimeout(GOOGLE_SHEETS_API_URL, {
                        method: "POST",
                        body: JSON.stringify(claimPayload)
                    }, 15000).catch(e => console.warn("[Google Sheets Backup Error]", e));
                }

                // Persist successfully claimed state & show success ticket screen
                setClaimedState();
                showScreen(screenSuccess);
                triggerConfetti();
            } else if (data && data.error === "ALREADY_CLAIMED") {
                inputMobile.classList.add("invalid");
                const errorMobile = document.getElementById("error-mobile");
                if (errorMobile) {
                    errorMobile.innerText = "This mobile number has already claimed an offer!";
                    errorMobile.style.display = "block";
                }
                showToast("This mobile number has already claimed an offer!");
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

    // Reset Campaign Flow
    if (btnRestart) {
        btnRestart.addEventListener("click", () => {
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
    
    // Step 3: Determine correct start screen based on claimed status
    if (isClaimedState()) {
        console.log("[Majlis] Visitor has already claimed their reward. Restoring Success screen.");
        showScreen(screenSuccess);
    } else {
        // Initialize the scratch canvas normally
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
