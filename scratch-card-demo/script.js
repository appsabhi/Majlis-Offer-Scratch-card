/* ==========================================================================
   MAJLIS ONAM PROMOTION - CLIENT LOGIC
   ========================================================================== */

// --- CONFIGURATION SECTION ---
// Copy the Web App URL from your deployed Google Apps Script and paste it below:
const GOOGLE_SHEETS_API_URL = "https://script.google.com/macros/s/AKfycbxh12R_ZP_9oyP8rXT2SB2qhZGgpERhyrquQ6rcb_8rbT6-w8oTh4L0Pl_ecwI64wJH/exec";

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
        
        // A premium metallic silver/gold gradient
        const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        grad.addColorStop(0, '#d1d1d1'); // Silver base
        grad.addColorStop(0.3, '#f5f5f5'); // Shiny metallic highlight
        grad.addColorStop(0.5, '#b5b5b5'); // Dark shadow
        grad.addColorStop(0.7, '#e6c66c'); // Subtle golden festive tint
        grad.addColorStop(1, '#9e9e9e'); // Base finish
        
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Add subtle traditional Onam Pookalam floral circles overlay (pure canvas vectors)
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = 2;
        
        // Draw decorative flower pattern in the center
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        // Outer concentric circles
        ctx.beginPath();
        ctx.arc(centerX, centerY, 80, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, 50, 0, Math.PI * 2);
        ctx.stroke();
        
        // Petal lines radiating from center
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        for (let i = 0; i < 12; i++) {
            const angle = (i * Math.PI) / 6;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(
                centerX + Math.cos(angle) * 110,
                centerY + Math.sin(angle) * 110
            );
            ctx.stroke();
        }

        // Draw gold inner frame border
        ctx.strokeStyle = "rgba(212, 175, 55, 0.4)";
        ctx.lineWidth = 8;
        ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

        // Scratch Text Label
        ctx.fillStyle = "#3a2212"; // Deep brown text for legibility
        ctx.font = "bold 20px 'Outfit', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        
        // Text drop shadow (canvas style)
        ctx.shadowColor = "rgba(255, 255, 255, 0.6)";
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 1;
        
        ctx.fillText("SCRATCH HERE 🎁", centerX, centerY);
        
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
        scratchProgressText.innerText = "Revealed! 🎉";

        // Smooth fade out animation for the canvas layer
        canvas.style.transition = "opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)";
        canvas.style.opacity = "0";
        canvas.style.pointerEvents = "none";

        // Confetti party
        triggerConfetti();

        // Hide progress bar area cleanly when revealed (surrounding layout stays stable)
        if (scratchProgressArea) {
            scratchProgressArea.classList.add("hidden");
        }
        if (scratchContinueArea) {
            scratchContinueArea.classList.add("hidden");
        }

        // Animate congratulations overlay into view inside the scratch card
        if (congratsOverlay) {
            congratsOverlay.classList.remove("hidden");
            // Force reflow to trigger scale transition animation
            void congratsOverlay.offsetWidth;
            congratsOverlay.classList.add("show");
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
        
        // Block submission if Instagram button was not clicked
        // if (!isInstagramClicked) {
        //     showToast("Please follow us on Instagram to claim your offer.");
        //     return;
        // }

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

        // Dynamically get the offer and coupon code from the UI
        const overlayOfferEl = document.querySelector(".congrats-overlay-offer");
        const overlayCouponEl = document.querySelector(".congrats-overlay-coupon .coupon-code");
        
        const offerVal = overlayOfferEl ? overlayOfferEl.innerText.trim() : "20% OFF";
        const couponVal = overlayCouponEl ? overlayCouponEl.innerText.trim() : "ONAM20";

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
                btnText.innerText = "Claim My 20% OFF Coupon";
                formLoader.classList.add("hidden");
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
            btnText.innerText = "Claim My 20% OFF Coupon";
            formLoader.classList.add("hidden");

            if (data && data.success) {
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
            btnText.innerText = "Claim My 20% OFF Coupon";
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

    btnBackToInstagram.addEventListener("click", () => {
        showScreen(screenScratch);
    });

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
    initScratchCanvas();
});
