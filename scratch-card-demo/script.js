/* ==========================================================================
   MAJLIS ONAM PROMOTION - CLIENT LOGIC
   ========================================================================== */

// --- CONFIGURATION SECTION ---
// Copy the Web App URL from your deployed Google Apps Script and paste it below:
const GOOGLE_SHEETS_API_URL = "https://script.google.com/macros/s/AKfycbxh12R_ZP_9oyP8rXT2SB2qhZGgpERhyrquQ6rcb_8rbT6-w8oTh4L0Pl_ecwI64wJH/exec";

// ==========================================================================
// REWARD POOL CONFIGURATION
// Add, remove, or edit offers here. Each entry must have:
//   label      — Display text shown in the scratch reveal and all UI elements
//   coupon     — Coupon code string. Set to null for non-winning outcomes.
//   isWinner   — true if this is a real prize; false for "Better Luck" outcomes
// ==========================================================================
const REWARD_POOL = [
    { id: "offer20",      label: "20% OFF",              coupon: "ONAM20",   isWinner: true  },
    { id: "offer15",      label: "15% OFF",              coupon: "ONAM15",   isWinner: true  },
    { id: "offer10",      label: "10% OFF",              coupon: "ONAM10",   isWinner: true  },
    { id: "offerDessert", label: "Free Dessert",         coupon: "ONAMDESS", isWinner: true  },
    { id: "betterLuck",   label: "Better Luck Next Time",coupon: null,       isWinner: false }
];

// Holds the ONE reward assigned for this session. Set once on page load.
let sessionReward = null;

const VISITOR_KEY = "majlis_campaign_visitor_id";
const DEV_MODE = false;

// 5 HOURS = 18,000 seconds = 18,000,000 milliseconds
const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;

let visitorId = null;
let currentCycleId = null;
let cycleStartedAt = null;
let cycleExpiresAt = null;

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

/**
 * Generates a unique cycle identifier for a 5-hour campaign window.
 */
function generateCycleId() {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let result = "cycle_";
    for (let i = 0; i < 12; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Helper to get the reward storage key for the current visitor.
 */
function getRewardStorageKey() {
    return `majlis_campaign_reward_id_${visitorId || "fallback"}`;
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
 * Helper to get the cycle ID storage key for the current visitor.
 */
function getCycleIdStorageKey() {
    return `majlis_campaign_cycle_id_${visitorId || "fallback"}`;
}

/**
 * Helper to get the cycle started timestamp storage key for the current visitor.
 */
function getCycleStartedAtStorageKey() {
    return `majlis_campaign_cycle_started_at_${visitorId || "fallback"}`;
}

/**
 * Helper to get the cycle expires timestamp storage key for the current visitor.
 */
function getCycleExpiresAtStorageKey() {
    return `majlis_campaign_cycle_expires_at_${visitorId || "fallback"}`;
}

/**
 * Checks whether the visitor has successfully claimed in the current 5-hour cycle.
 */
function isClaimedState() {
    try {
        return localStorage.getItem(getClaimedStorageKey()) === "true";
    } catch (e) {
        console.warn("[Majlis] Error reading claimed state:", e);
        return false;
    }
}

/**
 * Persists the successfully claimed state for the visitor's current 5-hour cycle.
 */
function setClaimedState() {
    try {
        localStorage.setItem(getClaimedStorageKey(), "true");
        console.log("[Majlis] Persisted claimed success state for visitor:", visitorId, "| Cycle:", currentCycleId);
    } catch (e) {
        console.warn("[Majlis] Error persisting claimed state:", e);
    }
}

/**
 * Clears local campaign cycle state for the current visitor (used upon 5-hour expiration or dev reset).
 * Does NOT delete the visitorId identity or Google Sheet claims.
 */
function clearCurrentCycleState() {
    try {
        if (visitorId) {
            localStorage.removeItem(getRewardStorageKey());
            localStorage.removeItem(getRevealedStorageKey());
            localStorage.removeItem(getClaimedStorageKey());
            localStorage.removeItem(getCycleIdStorageKey());
            localStorage.removeItem(getCycleStartedAtStorageKey());
            localStorage.removeItem(getCycleExpiresAtStorageKey());
            console.log("[Majlis] Cleared old local campaign cycle state for visitor:", visitorId);
        }
    } catch (e) {
        console.warn("[Majlis] Error clearing campaign cycle state:", e);
    }
    sessionReward = null;
    currentCycleId = null;
    cycleStartedAt = null;
    cycleExpiresAt = null;
}

/**
 * Starts a fresh 5-hour campaign cycle for the visitor.
 */
function startNewCycle() {
    const now = Date.now();
    currentCycleId = generateCycleId();
    cycleStartedAt = now;

    let durationMs = FIVE_HOURS_MS;
    if (DEV_MODE) {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const devSec = urlParams.get("dev_duration_sec");
            if (devSec && !isNaN(Number(devSec)) && Number(devSec) > 0) {
                durationMs = Number(devSec) * 1000;
                console.log("[Majlis DEV] Using shortened cycle duration from URL param:", devSec, "seconds");
            }
        } catch (e) {
            // fallback
        }
    }

    cycleExpiresAt = now + durationMs;

    // Select a new random reward from REWARD_POOL
    const idx = Math.floor(Math.random() * REWARD_POOL.length);
    sessionReward = REWARD_POOL[idx];

    try {
        localStorage.setItem(getCycleIdStorageKey(), currentCycleId);
        localStorage.setItem(getCycleStartedAtStorageKey(), cycleStartedAt.toString());
        localStorage.setItem(getCycleExpiresAtStorageKey(), cycleExpiresAt.toString());
        localStorage.setItem(getRewardStorageKey(), sessionReward.id);
        console.log(
            "[Majlis] Started NEW 5-hour campaign cycle:", currentCycleId,
            "| Reward:", sessionReward.label,
            "| Expires at:", new Date(cycleExpiresAt).toLocaleTimeString()
        );
    } catch (e) {
        console.warn("[Majlis] Error saving new cycle state to localStorage:", e);
    }
}

/**
 * Resolves visitor identity and checks/manages the 5-hour campaign cycle expiration.
 * Restores existing valid cycle or creates a new 5-hour cycle on expiration.
 */
function initializeReward() {
    // 1. Resolve or generate visitorId
    try {
        visitorId = localStorage.getItem(VISITOR_KEY);
        if (!visitorId) {
            visitorId = generateVisitorId();
            localStorage.setItem(VISITOR_KEY, visitorId);
            console.log("[Majlis] Generated new visitor identity:", visitorId);
        } else {
            console.log("[Majlis] Restored existing visitor identity:", visitorId);
        }
    } catch (e) {
        console.warn("[Majlis] Error accessing localStorage for visitor identity:", e);
        if (!visitorId) visitorId = "fallback";
    }

    // 2. Resolve or check existing 5-hour campaign cycle
    const now = Date.now();
    try {
        const savedExpiresAt = localStorage.getItem(getCycleExpiresAtStorageKey());
        const savedCycleId = localStorage.getItem(getCycleIdStorageKey());
        const savedRewardId = localStorage.getItem(getRewardStorageKey());

        if (savedExpiresAt && savedCycleId && savedRewardId) {
            const expiresTimestamp = Number(savedExpiresAt);
            if (!isNaN(expiresTimestamp) && now < expiresTimestamp) {
                // Cycle is still VALID! Restore existing state
                const foundReward = REWARD_POOL.find(item => item.id === savedRewardId);
                if (foundReward) {
                    currentCycleId = savedCycleId;
                    cycleStartedAt = Number(localStorage.getItem(getCycleStartedAtStorageKey()) || now);
                    cycleExpiresAt = expiresTimestamp;
                    sessionReward = foundReward;

                    const remainingSec = Math.round((cycleExpiresAt - now) / 1000);
                    console.log(
                        "[Majlis] Restored VALID active cycle:", currentCycleId,
                        "| Reward:", sessionReward.label,
                        "| Time remaining:", remainingSec, "seconds",
                        "| Expires at:", new Date(cycleExpiresAt).toLocaleTimeString()
                    );
                    return;
                }
            } else {
                console.log(
                    "[Majlis] Existing campaign cycle has EXPIRED.",
                    "Now:", new Date(now).toLocaleTimeString(),
                    "| Expired at:", new Date(expiresTimestamp).toLocaleTimeString()
                );
            }
        } else {
            console.log("[Majlis] No existing cycle found. Creating initial cycle.");
        }
    } catch (e) {
        console.warn("[Majlis] Error accessing localStorage for cycle expiration:", e);
    }

    // 3. If cycle expired or missing: clear old cycle local state & create fresh 5-hour cycle
    clearCurrentCycleState();
    startNewCycle();
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

    if (offerAmountEl)       offerAmountEl.innerText       = r.label;
    if (overlayOfferEl)      overlayOfferEl.innerText      = r.label;
    if (congratsOfferAmtEl)  congratsOfferAmtEl.innerText  = r.label;
    if (ticketPercentEl)     ticketPercentEl.innerText     = r.label;
    if (btnSubmitTextEl)     btnSubmitTextEl.innerText     = r.isWinner
        ? "CLAIM MY " + r.label.toUpperCase()
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

    if (r.isWinner && r.coupon) {
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
        // Non-winner (Better Luck Next Time): hide coupon sections gracefully
        if (revealCouponParent)   revealCouponParent.style.display   = "none";
        if (overlayCouponParent)  overlayCouponParent.style.display  = "none";
        if (congratsCouponParent) congratsCouponParent.style.display = "none";
        if (ticketCouponBox)      ticketCouponBox.style.display      = "none";
        // Clear the success code element so copy button copies empty string
        if (successCouponCode)    successCouponCode.innerText        = "";
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
    }

    // ==========================================================================
    // 3. CANVAS SCRATCH CARD LOGIC
    // ==========================================================================
    function initScratchCanvas() {
        // Check if already revealed in persistent storage
        let savedRevealed = false;
        try {
            savedRevealed = localStorage.getItem(getRevealedStorageKey()) === "true";
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
        e.preventDefault(); // Prevents dragging/scrolling on mobile devices

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
    }

    function revealOffer() {
        isRevealed = true;
        isDrawing = false;
        
        progressBarFill.style.width = "100%";
        scratchProgressText.innerText = sessionReward.isWinner ? "Revealed! 🎉" : "Revealed! 🍀";

        // Save scratch revealed state to localStorage
        try {
            localStorage.setItem(getRevealedStorageKey(), "true");
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

    // Attach Scratch Canvas Event Listeners
    // Pointer Events are general, but Mouse + Touch covers all bases cleanly
    canvas.addEventListener("mousedown", startScratching);
    canvas.addEventListener("mousemove", scratch);
    window.addEventListener("mouseup", stopScratching);

    canvas.addEventListener("touchstart", startScratching, { passive: false });
    canvas.addEventListener("touchmove", scratch, { passive: false });
    window.addEventListener("touchend", stopScratching);

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
        
        // Use the session reward directly — single source of truth, never re-reads DOM
        const offerVal  = sessionReward ? sessionReward.label  : "Unknown";
        const couponVal = sessionReward ? (sessionReward.coupon || "") : "";
        
        const dynamicBtnText = "CLAIM MY " + offerVal.toUpperCase();

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

        if (!isValid) return;

        // If Valid, Enter Loading State
        btnSubmitForm.disabled = true;
        const btnText = btnSubmitForm.querySelector(".btn-text");
        btnText.innerText = "Submitting...";
        formLoader.classList.remove("hidden");

        const claimPayload = {
            fullName: inputName.value.trim(),
            mobile: inputMobile.value.trim(),
            mobileNumber: inputMobile.value.trim(), // Defensively send both mobile and mobileNumber
            email: inputEmail.value.trim(),
            offer: offerVal,
            couponCode: couponVal
        };

        // Fallback simulation check if URL is the default placeholder (for local test safety)
        if (GOOGLE_SHEETS_API_URL === "PASTE_YOUR_GOOGLE_APPS_SCRIPT_URL_HERE" || !GOOGLE_SHEETS_API_URL.startsWith("http")) {
            console.warn("GOOGLE_SHEETS_API_URL is placeholder or invalid. Simulating API submission success for local testing.");
            setTimeout(() => {
                btnSubmitForm.disabled = false;
                btnText.innerText = dynamicBtnText;
                formLoader.classList.add("hidden");
                // Persist successfully claimed state
                setClaimedState();
                showScreen(screenSuccess);
                triggerConfetti();
            }, 1200);
            return;
        }

        // Real Google Apps Script Web App request
        fetch(GOOGLE_SHEETS_API_URL, {
            method: "POST",
            body: JSON.stringify(claimPayload)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error("Network response was not ok");
            }
            return response.json();
        })
        .then(data => {
            btnSubmitForm.disabled = false;
            btnText.innerText = dynamicBtnText;
            formLoader.classList.add("hidden");

            if (data && data.success) {
                // Persist successfully claimed state
                setClaimedState();
                // Transition to success screen
                showScreen(screenSuccess);
                triggerConfetti();
            } else {
                throw new Error(data ? data.error || "Submission unsuccessful status" : "Invalid response");
            }
        })
        .catch(err => {
            console.error("Submission error:", err);
            
            btnSubmitForm.disabled = false;
            btnText.innerText = dynamicBtnText;
            formLoader.classList.add("hidden");

            // Display error toast warning using our custom toast utility
            showToast("Failed to save details. Please check your connection and try again.");
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

    btnClaimOffer.addEventListener("click", () => {
        showScreen(screenForm);
    });

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
    btnBackToScratch.addEventListener("click", () => {
        showScreen(screenScratch);
    });

    if (btnBackToInstagram) {
        btnBackToInstagram.addEventListener("click", () => {
            showScreen(screenScratch);
        });
    }

    btnScratchContinue.addEventListener("click", () => {
        showScreen(screenForm);
    });

    // Reset Campaign Flow
    btnRestart.addEventListener("click", () => {
        // Reset forms & styles
        customerForm.reset();
        [inputName, inputMobile, inputEmail].forEach(input => {
            input.classList.remove("invalid");
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
            initLoader.remove();
        }, 400);
    }

    // Step 5: Inject Development Test Controls if DEV_MODE is active
    if (DEV_MODE) {
        const devContainer = document.createElement("div");
        devContainer.id = "dev-controls-container";
        devContainer.style.position = "fixed";
        devContainer.style.bottom = "12px";
        devContainer.style.right = "12px";
        devContainer.style.zIndex = "99999";
        devContainer.style.display = "flex";
        devContainer.style.gap = "8px";

        const devResetBtn = document.createElement("button");
        devResetBtn.id = "dev-reset-btn";
        devResetBtn.innerText = "DEV: RESET TEST";
        devResetBtn.style.background = "#d32f2f";
        devResetBtn.style.color = "#ffffff";
        devResetBtn.style.border = "1px solid rgba(255,255,255,0.3)";
        devResetBtn.style.padding = "8px 12px";
        devResetBtn.style.borderRadius = "6px";
        devResetBtn.style.cursor = "pointer";
        devResetBtn.style.fontFamily = "'Poppins', sans-serif";
        devResetBtn.style.fontWeight = "600";
        devResetBtn.style.fontSize = "11px";
        devResetBtn.style.boxShadow = "0 4px 12px rgba(0,0,0,0.4)";
        devResetBtn.style.transition = "background-color 0.2s ease";

        const devExpireBtn = document.createElement("button");
        devExpireBtn.id = "dev-expire-btn";
        devExpireBtn.innerText = "DEV: EXPIRE 5H CYCLE";
        devExpireBtn.style.background = "#e65c00";
        devExpireBtn.style.color = "#ffffff";
        devExpireBtn.style.border = "1px solid rgba(255,255,255,0.3)";
        devExpireBtn.style.padding = "8px 12px";
        devExpireBtn.style.borderRadius = "6px";
        devExpireBtn.style.cursor = "pointer";
        devExpireBtn.style.fontFamily = "'Poppins', sans-serif";
        devExpireBtn.style.fontWeight = "600";
        devExpireBtn.style.fontSize = "11px";
        devExpireBtn.style.boxShadow = "0 4px 12px rgba(0,0,0,0.4)";
        devExpireBtn.style.transition = "background-color 0.2s ease";

        const executeDevReset = (expire = false) => {
            console.log("[Majlis DEV] Action triggered. Expire first:", expire);
            if (expire) {
                // Set cycle expiry timestamp into the past to simulate expiration
                try {
                    localStorage.setItem(getCycleExpiresAtStorageKey(), (Date.now() - 1000).toString());
                } catch (e) {
                    console.warn(e);
                }
            } else {
                clearCurrentCycleState();
            }

            initializeReward();
            applyRewardToDOM();

            if (customerForm) {
                customerForm.reset();
                [inputName, inputMobile, inputEmail].forEach(input => {
                    if (input) input.classList.remove("invalid");
                });
            }

            isInstagramClicked = false;
            if (btnSubmitForm) {
                btnSubmitForm.disabled = true;
                btnSubmitForm.classList.add("btn-locked");
                const btnText = btnSubmitForm.querySelector(".btn-text");
                if (btnText && sessionReward) {
                    btnText.innerText = sessionReward.isWinner
                        ? "CLAIM MY " + sessionReward.label.toUpperCase()
                        : "SUBMIT DETAILS";
                }
            }

            if (instagramInitialState) instagramInitialState.classList.remove("hidden");
            if (instagramSuccessState) instagramSuccessState.classList.add("hidden");
            if (instagramStatusText) {
                instagramStatusText.innerText = "Instagram step required *";
                instagramStatusText.classList.remove("verified");
            }

            if (isClaimedState()) {
                showScreen(screenSuccess);
            } else {
                showScreen(screenScratch);
                initScratchCanvas();
            }
        };

        devResetBtn.addEventListener("click", () => executeDevReset(false));
        devExpireBtn.addEventListener("click", () => executeDevReset(true));

        devContainer.appendChild(devResetBtn);
        devContainer.appendChild(devExpireBtn);
        document.body.appendChild(devContainer);
    }
});
