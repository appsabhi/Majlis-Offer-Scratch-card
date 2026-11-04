/* ==========================================================================
   MAJLIS DIWALI FESTIVAL - 3D CARTOON LAMP EXPERIENCE
   Client-Side Interaction, 3D Diya Matchstick Lighting & Offer Reveal
   ========================================================================== */

(function () {
    "use strict";

    // --- BACKEND & STORAGE CONFIGURATION ---
    const BACKEND_API_URL = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') 
        ? "http://127.0.0.1:5000/api/claims" 
        : "/api/claims";

    const GOOGLE_SHEETS_API_URL = "https://script.google.com/macros/s/AKfycbyXm_94jLRyCPccQQ2bYxB6DjPveIW2Mh9YZ6dFIiHHfkJsKTHck2U8o1V2S41mDISssA/exec";

    // ==========================================================================
    // REWARD POOL (Mirrored faithfully from existing Majlis campaign pool)
    // ==========================================================================
    const REWARD_POOL = [
        { id: "offer50Rs",          label: `₹50 OFF <br> on bill above ₹499`,   coupon: "OFF50",  isWinner: true },
        { id: "offer75Rs",          label: `₹75 OFF <br> on bill above ₹699`,   coupon: "OFF75",  isWinner: true },
        { id: "offer100Rs",         label: `₹100 OFF <br> on bill above ₹999`,  coupon: "OFF100", isWinner: true },
        { id: "offer150Rs",         label: `₹150 OFF <br> on bill above ₹1299`, coupon: "OFF150", isWinner: true },
        { id: "offer5PercentNext",  label: `5% OFF <br> on next purchase`,       coupon: "NEXT5",  isWinner: true },
        { id: "offer10PercentNext", label: `10% OFF <br> on next purchase`,      coupon: "NEXT10", isWinner: true }
    ];

    const LEGACY_REWARD_MAP = {
        "offer20":        { id: "offer20",        label: "21% OFF",                                  coupon: "ONAM20",    isWinner: true },
        "offer174":       { id: "offer174",       label: `₹174 <br> for Unlimited <br> Mandi (qtr)`, coupon: "ONAMDESS",  isWinner: true },
        "offer5":         { id: "offer5",         label: "5% OFF",                                   coupon: "ONAM5",     isWinner: true },
        "offerDessert":   { id: "offerDessert",   label: `₹200 <br> for Unlimited <br> Mandi (qtr)`, coupon: "ONAMDESS",  isWinner: true },
        "offerChampagne": { id: "offerChampagne", label: `Free <br> Saudi Champagne`,                coupon: "ONAMCHAMP", isWinner: true },
        "offerdelivery":  { id: "offerdelivery",  label: `5% OFF <br> on delivery orders`,           coupon: "DEL5",      isWinner: true }
    };

    // Safe In-Memory Storage Fallback for Private Browsing / iOS Safari
    const memoryStorage = {};
    const safeStorage = {
        getItem(key) {
            try {
                return localStorage.getItem(key);
            } catch (e) {
                console.warn("[Majlis Diwali] Storage getItem fallback:", e);
                return memoryStorage[key] || null;
            }
        },
        setItem(key, value) {
            try {
                localStorage.setItem(key, value);
            } catch (e) {
                console.warn("[Majlis Diwali] Storage setItem fallback:", e);
                memoryStorage[key] = String(value);
            }
        },
        removeItem(key) {
            try {
                localStorage.removeItem(key);
            } catch (e) {
                console.warn("[Majlis Diwali] Storage removeItem fallback:", e);
                delete memoryStorage[key];
            }
        }
    };

    const VISITOR_KEY = "majlis_visitor_id";
    let visitorId = null;

    function getOrCreateVisitorId() {
        let vid = safeStorage.getItem(VISITOR_KEY);
        if (!vid) {
            const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
            vid = "";
            for (let i = 0; i < 16; i++) {
                vid += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            safeStorage.setItem(VISITOR_KEY, vid);
        }
        return vid;
    }

    visitorId = getOrCreateVisitorId();

    // Storage Key Helpers
    function getRewardStorageKey() {
        return `majlis_diwali_reward_id_${visitorId}`;
    }
    function getRewardLabelStorageKey() {
        return `majlis_diwali_reward_label_${visitorId}`;
    }
    function getRewardCouponStorageKey() {
        return `majlis_diwali_reward_coupon_${visitorId}`;
    }
    function getLitStorageKey() {
        return `majlis_diwali_lit_${visitorId}`;
    }
    function getClaimedStorageKey() {
        return `majlis_campaign_claimed_${visitorId}`;
    }
    function getClaimedAtStorageKey() {
        return `majlis_campaign_claimed_at_${visitorId}`;
    }

    function isClaimedState() {
        return safeStorage.getItem(getClaimedStorageKey()) === "true";
    }

    function isDiyaLitState() {
        return safeStorage.getItem(getLitStorageKey()) === "true";
    }

    function stripHtml(htmlStr) {
        if (!htmlStr) return "";
        return htmlStr.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    }

    function validateEmail(email) {
        const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(String(email).toLowerCase());
    }

    const fetchWithTimeout = (url, options = {}, timeoutMs = 15000) => {
        const controller = (typeof AbortController !== "undefined") ? new AbortController() : null;
        const signal = controller ? controller.signal : undefined;
        const timer = setTimeout(() => {
            if (controller) controller.abort();
        }, timeoutMs);

        return fetch(url, { ...options, signal })
            .finally(() => clearTimeout(timer));
    };

    // Assigned Session Reward (Resolved once, persisted across reloads)
    let sessionReward = null;

    function initSessionReward() {
        try {
            const savedRewardId = safeStorage.getItem(getRewardStorageKey());
            const savedRewardLabel = safeStorage.getItem(getRewardLabelStorageKey());
            const savedRewardCoupon = safeStorage.getItem(getRewardCouponStorageKey());

            if (savedRewardId) {
                if (isClaimedState()) {
                    if (LEGACY_REWARD_MAP[savedRewardId]) {
                        sessionReward = LEGACY_REWARD_MAP[savedRewardId];
                        return;
                    }
                    if (savedRewardLabel) {
                        sessionReward = {
                            id: savedRewardId,
                            label: savedRewardLabel,
                            coupon: savedRewardCoupon || null,
                            isWinner: true
                        };
                        return;
                    }
                } else {
                    const found = REWARD_POOL.find(item => item.id === savedRewardId);
                    if (found) {
                        sessionReward = found;
                        return;
                    }
                }
            }
        } catch (e) {
            console.warn("[Majlis Diwali] Error loading saved reward:", e);
        }

        // Pick random reward from active pool
        const idx = Math.floor(Math.random() * REWARD_POOL.length);
        sessionReward = REWARD_POOL[idx];

        try {
            safeStorage.setItem(getRewardStorageKey(), sessionReward.id);
            safeStorage.setItem(getRewardLabelStorageKey(), sessionReward.label);
            if (sessionReward.coupon) {
                safeStorage.setItem(getRewardCouponStorageKey(), sessionReward.coupon);
            }
        } catch (e) {
            console.warn("[Majlis Diwali] Error saving reward:", e);
        }
    }

    initSessionReward();

    // ==========================================================================
    // DOM CONTROLLER & INTERACTION ENGINE
    // ==========================================================================
    document.addEventListener("DOMContentLoaded", () => {
        
        // --- Screen Containers ---
        const screenDiwali = document.getElementById("screen-diwali");
        const screenForm = document.getElementById("screen-form");
        const screenSuccess = document.getElementById("screen-success");
        const screens = [screenDiwali, screenForm, screenSuccess];

        // --- Diya & Matchstick Elements ---
        const lampStage = document.getElementById("lamp-stage");
        const diyaSvg = document.getElementById("diya-svg");
        const diyaFlame = document.getElementById("diya-flame");
        const lampAmbientGlow = document.getElementById("lamp-ambient-glow");
        const goldenLightWave = document.getElementById("golden-light-wave");
        const wickTarget = document.getElementById("wick-target");
        const wickRing = document.getElementById("wick-ring");
        const wickEmber = document.getElementById("wick-ember");
        const matchstick = document.getElementById("matchstick");
        const matchHeadElement = document.getElementById("match-head-element");
        const matchStrikeSpark = document.getElementById("match-strike-spark");
        const instructionPill = document.getElementById("instruction-pill");
        const instructionText = document.getElementById("instruction-text");

        // --- Offer Modal Popup ---
        const offerModal = document.getElementById("offer-modal");
        const modalOfferText = document.getElementById("modal-offer-text");
        const btnProceedToClaim = document.getElementById("btn-proceed-to-claim");

        // --- Registration Form Elements ---
        const customerForm = document.getElementById("customer-form");
        const inputName = document.getElementById("input-name");
        const inputMobile = document.getElementById("input-mobile");
        const inputEmail = document.getElementById("input-email");
        const errorName = document.getElementById("error-name");
        const errorMobile = document.getElementById("error-mobile");
        const errorEmail = document.getElementById("error-email");
        const btnSubmitForm = document.getElementById("btn-submit-form");
        const formLoader = document.getElementById("form-loader");

        // --- Ticket Stub Elements ---
        const ticketOfferText = document.getElementById("ticket-offer-text");

        // --- Claim Lookup Modal Elements ---
        const btnOpenLookup = document.getElementById("btn-open-lookup");
        const modalLookup = document.getElementById("modal-claim-lookup");
        const btnCloseLookup = document.getElementById("btn-close-lookup");
        const formLookupClaim = document.getElementById("form-lookup-claim");
        const inputLookupMobile = document.getElementById("input-lookup-mobile");
        const errorLookupMobile = document.getElementById("error-lookup-mobile");
        const lookupLoader = document.getElementById("lookup-loader");

        // --- Sparkle Canvas Engine ---
        const sparkleCanvas = document.getElementById("diwali-sparkle-canvas");
        let sparkleCtx = sparkleCanvas ? sparkleCanvas.getContext("2d") : null;
        let sparkleParticles = [];
        let sparkleAnimationId = null;

        function resizeSparkleCanvas() {
            if (!sparkleCanvas) return;
            sparkleCanvas.width = window.innerWidth;
            sparkleCanvas.height = window.innerHeight;
        }
        window.addEventListener("resize", resizeSparkleCanvas);
        resizeSparkleCanvas();

        function triggerFestiveConfetti() {
            if (!sparkleCanvas || !sparkleCtx) return;
            resizeSparkleCanvas();
            sparkleParticles = [];

            const colors = ["#ffd700", "#ffaa00", "#ff5722", "#fff59d", "#ffffff", "#4caf50", "#dfc896"];
            const count = 90;

            for (let i = 0; i < count; i++) {
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
                sparkleCtx.clearRect(0, 0, sparkleCanvas.width, sparkleCanvas.height);
                let alive = 0;

                for (let i = 0; i < sparkleParticles.length; i++) {
                    const p = sparkleParticles[i];
                    if (p.alpha <= 0.01) continue;
                    alive++;

                    p.x += p.vx;
                    p.y += p.vy;
                    p.vy += 0.35; // gravity
                    p.vx *= 0.98; // air drag
                    p.alpha -= 0.012;
                    p.rotation += p.vRot;

                    sparkleCtx.save();
                    sparkleCtx.translate(p.x, p.y);
                    sparkleCtx.rotate((p.rotation * Math.PI) / 180);
                    sparkleCtx.globalAlpha = Math.max(0, p.alpha);
                    sparkleCtx.fillStyle = p.color;

                    if (p.shape === "star") {
                        // 4-point golden sparkle star
                        const r = p.size;
                        sparkleCtx.beginPath();
                        sparkleCtx.moveTo(0, -r);
                        sparkleCtx.quadraticCurveTo(0, 0, r, 0);
                        sparkleCtx.quadraticCurveTo(0, 0, 0, r);
                        sparkleCtx.quadraticCurveTo(0, 0, -r, 0);
                        sparkleCtx.quadraticCurveTo(0, 0, 0, -r);
                        sparkleCtx.closePath();
                        sparkleCtx.fill();
                    } else {
                        sparkleCtx.beginPath();
                        sparkleCtx.arc(0, 0, p.size * 0.5, 0, Math.PI * 2);
                        sparkleCtx.fill();
                    }
                    sparkleCtx.restore();
                }

                if (alive > 0) {
                    sparkleAnimationId = requestAnimationFrame(renderSparkles);
                } else {
                    sparkleCtx.clearRect(0, 0, sparkleCanvas.width, sparkleCanvas.height);
                }
            }
            renderSparkles();
        }

        // --- Screen Switching Controller ---
        function showScreen(target) {
            if (isClaimedState() && target !== screenSuccess) {
                target = screenSuccess;
            }

            screens.forEach(s => {
                if (!s) return;
                if (s === target) {
                    s.classList.remove("hidden");
                    // Force reflow
                    void s.offsetWidth;
                    s.classList.add("active");
                } else {
                    s.classList.remove("active");
                    s.classList.add("hidden");
                }
            });
            window.scrollTo({ top: 0, behavior: "smooth" });
        }

        // Apply Session Reward to DOM
        function applyRewardToDOM() {
            if (!sessionReward) return;
            if (modalOfferText) {
                modalOfferText.innerHTML = sessionReward.label;
            }
            if (ticketOfferText) {
                ticketOfferText.innerHTML = sessionReward.label;
            }
        }
        applyRewardToDOM();

        // Toast Helper
        function showToast(message) {
            const container = document.getElementById("toast-container");
            if (!container) return;

            container.innerHTML = "";
            const toast = document.createElement("div");
            toast.className = "toast";
            toast.innerHTML = `<span>🪔</span><span>${message}</span>`;
            container.appendChild(toast);

            void toast.offsetWidth;
            toast.classList.add("show");

            setTimeout(() => {
                toast.classList.remove("show");
                setTimeout(() => {
                    if (toast.parentNode === container) {
                        container.removeChild(toast);
                    }
                }, 350);
            }, 3200);
        }

        // Helper to format raw DB offer text
        function formatDbOfferLabel(rawOffer) {
            if (!rawOffer) return "Diwali Special Offer";
            return String(rawOffer).replace(/Rs\./g, "₹");
        }

        // Handle DB-Claimed Offer Restoration
        function handleDbClaimedOffer(claimData, successToastMsg) {
            if (!claimData || !claimData.offer) return false;

            const dbOfferLabel = formatDbOfferLabel(claimData.offer);
            sessionReward = {
                id: "claimed_db",
                label: dbOfferLabel,
                coupon: null,
                isWinner: true
            };

            let claimTimestamp = Date.now();
            if (claimData.claimDateTime) {
                const parsedDate = new Date(claimData.claimDateTime);
                if (!isNaN(parsedDate.getTime())) {
                    claimTimestamp = parsedDate.getTime();
                }
            }

            if (claimData.mobileNumber) {
                safeStorage.setItem("majlis_claimed_mobile", String(claimData.mobileNumber).trim());
            }
            safeStorage.setItem(getClaimedStorageKey(), "true");
            safeStorage.setItem(getRewardLabelStorageKey(), dbOfferLabel);
            safeStorage.setItem(getClaimedAtStorageKey(), claimTimestamp.toString());
            safeStorage.setItem(getLitStorageKey(), "true");

            applyRewardToDOM();
            showScreen(screenSuccess);

            if (successToastMsg) {
                showToast(successToastMsg);
            }
            return true;
        }

        // Fetch Claim by Mobile Number from PostgreSQL Backend
        function fetchClaimByMobile(mobileNumber) {
            const cleanMobile = String(mobileNumber).trim();
            const url = `${BACKEND_API_URL}?mobileNumber=${encodeURIComponent(cleanMobile)}`;

            return fetchWithTimeout(url, { method: "GET" }, 15000)
                .then(res => res.json())
                .then(data => {
                    if (data && data.success && data.claimed && data.claim) {
                        handleDbClaimedOffer(data.claim, "Found your claimed Diwali ticket!");
                        return true;
                    } else if (data && data.success && !data.claimed) {
                        showToast("No claimed offer found for this mobile number.");
                        return false;
                    } else {
                        throw new Error(data && data.error ? data.error : "Failed to fetch claim status.");
                    }
                });
        }

        // ==========================================================================
        // DIYA LIGHTING & FLAME STATE CONTROLLER
        // ==========================================================================
        let isLit = isDiyaLitState();
        let isIgniting = false;

        function setDiyaLitVisuals(animated) {
            if (diyaFlame) diyaFlame.classList.add("lit");
            if (lampAmbientGlow) lampAmbientGlow.classList.add("lit");
            if (diyaSvg) diyaSvg.classList.add("lit");
            if (wickRing) wickRing.classList.add("lit");
            if (wickEmber) wickEmber.style.opacity = "1";
            if (matchstick) {
                matchstick.classList.remove("idle", "dragging", "near");
                matchstick.classList.add("lit-away");
            }
            if (instructionPill) {
                instructionPill.style.display = "none";
            }

            if (animated) {
                // Expanding golden shockwave light wave
                if (goldenLightWave) {
                    goldenLightWave.classList.add("spreading");
                    setTimeout(() => {
                        goldenLightWave.classList.remove("spreading");
                    }, 1200);
                }

                // Celebratory particles
                triggerFestiveConfetti();

                // Persist lit state in safe storage
                safeStorage.setItem(getLitStorageKey(), "true");
                isLit = true;

                // After 900ms, reveal the Diwali Offer Popup Modal
                setTimeout(() => {
                    if (offerModal && !isClaimedState()) {
                        offerModal.classList.add("show");
                    }
                }, 900);
            } else {
                // Instantly lit state (on page refresh / reload)
                safeStorage.setItem(getLitStorageKey(), "true");
                isLit = true;
                if (offerModal && !isClaimedState()) {
                    offerModal.classList.add("show");
                }
            }
        }

        function triggerIgnition() {
            if (isIgniting || isLit) return;
            isIgniting = true;

            // 1. Strike spark on match head
            if (matchStrikeSpark) matchStrikeSpark.style.opacity = "1";
            if (instructionText) instructionText.innerText = "Igniting the Diya... ✨";

            // 2. Play lighting animation
            setTimeout(() => {
                setDiyaLitVisuals(true);
            }, 250);
        }

        // If visitor already lit the Diya, restore it immediately
        if (isLit && !isClaimedState()) {
            setDiyaLitVisuals(false);
        }

        // Align Wick Target accurately over the SVG cotton wick tip
        function alignWickTarget() {
            const wickTipEl = document.getElementById("wick-tip");
            if (!wickTipEl || !lampStage || !wickTarget) return;

            const wickTipRect = wickTipEl.getBoundingClientRect();
            const stageRect = lampStage.getBoundingClientRect();

            if (wickTipRect.width > 0 || wickTipRect.height > 0) {
                const relX = wickTipRect.left - stageRect.left + wickTipRect.width / 2;
                const relY = wickTipRect.top - stageRect.top + wickTipRect.height / 2;
                wickTarget.style.left = `${relX}px`;
                wickTarget.style.top = `${relY}px`;
                wickTarget.style.transform = "translate(-50%, -50%)";
            }
        }

        window.addEventListener("resize", alignWickTarget);
        setTimeout(alignWickTarget, 100);
        setTimeout(alignWickTarget, 500);

        // ==========================================================================
        // DRAGGABLE MATCHSTICK INTERACTION ENGINE (Touch & Mouse with PointerEvents)
        // ==========================================================================
        if (matchstick && lampStage && wickTarget) {
            let isDragging = false;
            let startPointerX = 0;
            let startPointerY = 0;
            let startMatchX = 0;
            let startMatchY = 0;
            let currentX = 0;
            let currentY = 0;

            function onPointerDown(e) {
                if (isLit || isIgniting) return;

                // Only allow primary button (left mouse or primary finger)
                if (e.isPrimary === false) return;
                if (e.button && e.button !== 0) return;

                isDragging = true;
                matchstick.classList.remove("idle");
                matchstick.classList.add("dragging");

                startPointerX = e.clientX;
                startPointerY = e.clientY;
                startMatchX = currentX;
                startMatchY = currentY;

                try {
                    matchstick.setPointerCapture(e.pointerId);
                } catch (err) {
                    console.warn("[Majlis Diwali] setPointerCapture error:", err);
                }

                if (instructionText) {
                    instructionText.innerText = "Bring the match head to the wick! 🔥";
                }
            }

            function onPointerMove(e) {
                if (!isDragging || isLit || isIgniting) return;

                const deltaX = e.clientX - startPointerX;
                const deltaY = e.clientY - startPointerY;

                currentX = startMatchX + deltaX;
                currentY = startMatchY + deltaY;

                // Move matchstick smoothly with dynamic tilt angle towards lamp
                matchstick.style.transform = `translate(${currentX}px, ${currentY}px) rotate(-26deg)`;

                // Collision detection between Match Head and Wick Tip
                // Match head is on the left edge of matchstick element (approx x: 19px, y: 24px)
                const matchRect = matchstick.getBoundingClientRect();
                const wickRect = wickTarget.getBoundingClientRect();

                const matchHeadX = matchRect.left + matchRect.width * 0.18;
                const matchHeadY = matchRect.top + matchRect.height * 0.5;

                const wickCenterX = wickRect.left + wickRect.width * 0.5;
                const wickCenterY = wickRect.top + wickRect.height * 0.5;

                const distance = Math.hypot(matchHeadX - wickCenterX, matchHeadY - wickCenterY);

                // Proximity feedback
                if (distance < 90) {
                    matchstick.classList.add("near");
                    if (wickRing) wickRing.classList.add("near");
                    if (instructionPill) instructionPill.classList.add("near-wick");
                    if (instructionText) instructionText.innerText = "Almost there! Touch the wick! 🪔";
                } else {
                    matchstick.classList.remove("near");
                    if (wickRing) wickRing.classList.remove("near");
                    if (instructionPill) instructionPill.classList.remove("near-wick");
                    if (instructionText) instructionText.innerText = "Bring the match head to the wick! 🔥";
                }

                // Ignition threshold reached!
                if (distance < 44) {
                    isDragging = false;
                    try {
                        matchstick.releasePointerCapture(e.pointerId);
                    } catch (err) {}

                    triggerIgnition();
                }
            }

            function onPointerUp(e) {
                if (!isDragging) return;
                isDragging = false;
                matchstick.classList.remove("dragging", "near");
                if (wickRing) wickRing.classList.remove("near");
                if (instructionPill) instructionPill.classList.remove("near-wick");

                try {
                    matchstick.releasePointerCapture(e.pointerId);
                } catch (err) {}

                if (!isLit && !isIgniting) {
                    // Smoothly bounce back to starting position if not lit
                    matchstick.style.transition = "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)";
                    currentX = 0;
                    currentY = 0;
                    matchstick.style.transform = "translate(0px, 0px)";

                    setTimeout(() => {
                        matchstick.style.transition = "";
                        matchstick.classList.add("idle");
                        if (instructionText) {
                            instructionText.innerText = "Drag the matchstick to light the Diya";
                        }
                    }, 400);
                }
            }

            matchstick.addEventListener("pointerdown", onPointerDown);
            matchstick.addEventListener("pointermove", onPointerMove);
            matchstick.addEventListener("pointerup", onPointerUp);
            matchstick.addEventListener("pointercancel", onPointerUp);

            // Click / tap fallback helper (for users on assistive tech or small viewports)
            matchstick.addEventListener("click", () => {
                if (!isLit && !isIgniting) {
                    // Animate towards wick automatically on click if drag was difficult
                    matchstick.style.transition = "transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)";
                    const stageRect = lampStage.getBoundingClientRect();
                    const matchRect = matchstick.getBoundingClientRect();
                    const wickRect = wickTarget.getBoundingClientRect();

                    const targetX = wickRect.left - matchRect.left + 15;
                    const targetY = wickRect.top - matchRect.top + 6;

                    matchstick.style.transform = `translate(${targetX}px, ${targetY}px) rotate(-35deg)`;

                    setTimeout(() => {
                        triggerIgnition();
                    }, 450);
                }
            });
        }

        // ==========================================================================
        // OFFER MODAL CLAIM BUTTON HANDLER
        // ==========================================================================
        if (btnProceedToClaim) {
            btnProceedToClaim.addEventListener("click", () => {
                if (offerModal) {
                    offerModal.classList.remove("show");
                }
                showScreen(screenForm);
            });
        }

        const btnBackToLamp = document.getElementById("btn-back-to-lamp");
        if (btnBackToLamp) {
            btnBackToLamp.addEventListener("click", () => {
                showScreen(screenDiwali);
                if (offerModal && !isClaimedState()) {
                    offerModal.classList.add("show");
                }
            });
        }

        // ==========================================================================
        // CUSTOMER REGISTRATION FORM SUBMISSION
        // ==========================================================================
        if (customerForm) {
            customerForm.addEventListener("submit", (e) => {
                e.preventDefault();

                const offerVal = sessionReward ? stripHtml(sessionReward.label) : "Diwali Surprise Offer";
                const couponVal = sessionReward && sessionReward.coupon ? sessionReward.coupon : "DIWALI5";

                let isValid = true;

                // Validate Name
                const nameVal = inputName.value.trim();
                if (nameVal.length < 2) {
                    inputName.classList.add("invalid");
                    if (errorName) errorName.style.display = "block";
                    isValid = false;
                } else {
                    inputName.classList.remove("invalid");
                    if (errorName) errorName.style.display = "none";
                }

                // Validate Mobile (10 Digits)
                const mobileVal = inputMobile.value.trim();
                if (mobileVal.length !== 10 || !/^\d{10}$/.test(mobileVal)) {
                    inputMobile.classList.add("invalid");
                    if (errorMobile) errorMobile.style.display = "block";
                    isValid = false;
                } else {
                    inputMobile.classList.remove("invalid");
                    if (errorMobile) errorMobile.style.display = "none";
                }

                // Validate Email (Optional)
                const emailVal = inputEmail.value.trim();
                if (emailVal !== "" && !validateEmail(emailVal)) {
                    inputEmail.classList.add("invalid");
                    if (errorEmail) errorEmail.style.display = "block";
                    isValid = false;
                } else {
                    inputEmail.classList.remove("invalid");
                    if (errorEmail) errorEmail.style.display = "none";
                }

                if (!isValid) return;

                // Set Loading State
                btnSubmitForm.disabled = true;
                const btnText = btnSubmitForm.querySelector(".btn-text");
                if (btnText) btnText.innerText = "Claiming Offer...";
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

                const emailValFinal = emailVal !== "" ? emailVal : "Not Provided";

                const claimPayload = {
                    fullName: nameVal,
                    mobileNumber: mobileVal,
                    email: emailValFinal,
                    offer: offerVal,
                    couponCode: couponVal,
                    coupon: couponVal,
                    claimDateTime: formattedClaimDateTime,
                    name: nameVal,
                    mobile: mobileVal,
                    phone: mobileVal,
                    "Full Name": nameVal,
                    "Mobile Number": mobileVal,
                    "Email": emailValFinal,
                    "Offer": offerVal,
                    "Coupon Code": couponVal,
                    "Claim Date & Time": formattedClaimDateTime
                };

                // Submit to PostgreSQL Backend API
                fetchWithTimeout(BACKEND_API_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
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
                        // Background Google Sheets Backup
                        if (GOOGLE_SHEETS_API_URL && GOOGLE_SHEETS_API_URL.startsWith("http") && !GOOGLE_SHEETS_API_URL.includes("PASTE_YOUR")) {
                            fetchWithTimeout(GOOGLE_SHEETS_API_URL, {
                                method: "POST",
                                body: JSON.stringify(claimPayload)
                            }, 15000).catch(err => console.warn("[Google Sheets Backup]", err));
                        }

                        // Save claimed state
                        safeStorage.setItem("majlis_claimed_mobile", mobileVal);
                        safeStorage.setItem(getClaimedStorageKey(), "true");
                        safeStorage.setItem(getClaimedAtStorageKey(), Date.now().toString());
                        safeStorage.setItem(getRewardLabelStorageKey(), offerVal);

                        applyRewardToDOM();
                        showScreen(screenSuccess);
                        triggerFestiveConfetti();
                    } else if (data && data.error === "ALREADY_CLAIMED") {
                        if (data.claim) {
                            handleDbClaimedOffer(data.claim, "Welcome back! Here is your claimed Diwali ticket.");
                        } else {
                            fetchClaimByMobile(mobileVal).catch(() => {
                                inputMobile.classList.add("invalid");
                                if (errorMobile) {
                                    errorMobile.innerText = "This mobile number has already claimed an offer!";
                                    errorMobile.style.display = "block";
                                }
                                showToast("This mobile number has already claimed an offer!");
                            });
                        }
                    } else {
                        throw new Error(data && data.error ? data.error : "Claim recording failed.");
                    }
                })
                .catch(err => {
                    console.error("[Majlis Diwali Submission Error]", err);
                    showToast("Failed to connect. Please verify your connection and try again.");
                })
                .finally(() => {
                    btnSubmitForm.disabled = false;
                    if (btnText) btnText.innerText = "CLAIM OFFER 🎁";
                    if (formLoader) formLoader.classList.add("hidden");
                });
            });
        }

        // ==========================================================================
        // CLAIM LOOKUP MODAL CONTROLLER
        // ==========================================================================
        if (btnOpenLookup && modalLookup) {
            btnOpenLookup.addEventListener("click", () => {
                modalLookup.classList.remove("hidden");
                if (inputLookupMobile) inputLookupMobile.focus();
            });
        }

        if (btnCloseLookup && modalLookup) {
            btnCloseLookup.addEventListener("click", () => {
                modalLookup.classList.add("hidden");
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
                const mobile = inputLookupMobile.value.trim();

                if (mobile.length !== 10 || !/^\d{10}$/.test(mobile)) {
                    inputLookupMobile.classList.add("invalid");
                    if (errorLookupMobile) errorLookupMobile.style.display = "block";
                    return;
                }

                inputLookupMobile.classList.remove("invalid");
                if (errorLookupMobile) errorLookupMobile.style.display = "none";

                if (lookupLoader) lookupLoader.classList.remove("hidden");

                fetchClaimByMobile(mobile)
                    .then(found => {
                        if (found && modalLookup) {
                            modalLookup.classList.add("hidden");
                        }
                    })
                    .finally(() => {
                        if (lookupLoader) lookupLoader.classList.add("hidden");
                    });
            });
        }

        // ==========================================================================
        // INITIAL ROUTING & RETURNING VISITOR CHECK
        // ==========================================================================
        const savedClaimedMobile = safeStorage.getItem("majlis_claimed_mobile");

        if (savedClaimedMobile || isClaimedState()) {
            console.log("[Majlis Diwali] Returning customer with claimed ticket. Showing ticket stub.");
            showScreen(screenSuccess);

            if (savedClaimedMobile) {
                fetchClaimByMobile(savedClaimedMobile).catch(err => {
                    console.warn("[Majlis Diwali] Syncing DB claim background notice:", err);
                });
            }
        } else {
            showScreen(screenDiwali);
        }

    });
})();
