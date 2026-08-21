# Onam Promo - QR Code Scratch Card Promotional Web Demo

A simple, professional, fully working **Onam Festive Campaign** web application. It features a mobile-first scratch card, real-time scratch progress detection, vanilla JS confetti animation, Instagram follow step, registration form validation, and coupon-code delivery.

Designed for **Majlis Restaurant & Banquet** festive marketing demo.

---

## 📁 File Structure

```text
scratch-card-demo/
├── index.html   # Main structure (Scratch Card, Instagram step, Details Form, Success ticket stub)
├── style.css    # Festive Onam color tokens, layout styling, and animations
├── script.js    # Logic for Canvas scratching, Progress math, Confetti particles, Form validating, screen state machine
└── README.md    # Documentation and running guide (this file)
```

---

## 🚀 Real-World Campaign Architecture

In the updated campaign flow, the QR Code is **external** to the website (printed on posters, flyers, or shared on social media). The customer experience follows this flow:

```text
  [ External QR Code on Poster/Flyer ]
                   │
                   ▼  (Customer scans with mobile camera)
  [ Mobile Web Browser opens Promotional Webpage URL ]
                   │
                   ▼  (Webpage loads directly to Scratch Card)
  [ Interactive Scratch Card Screen ]
                   │
                   ▼  (User scratches 50% of the surface)
  [ Congratulations Screen & Confetti Burst ]
                   │
                   ▼  (After 3.8s delay, user is prompted to Follow Instagram)
  [ Follow @MajlisKerala on Instagram ]
                   │
                   ▼  (User clicks Continue to details)
  [ Customer Registration Form (Name, Mobile, Email) ]
                   │
                   ▼  (User submits details, system validates)
  [ Success Screen (Unlocks Coupon: ONAM20) ]
```

---

## ⚙️ Running the Demo Locally

1. Open a terminal in the `scratch-card-demo` directory.
2. Launch a local web server (to permit local network access):
   - **Python:** `python -m http.server 8000`
   - **NodeJS:** `npx http-server -p 8000`
3. Access the webpage on your desktop or mobile browser via the local IP address (e.g. `http://localhost:8000` or `http://192.168.1.50:8000`).
4. Test the smooth touch scratching and customer registration flow immediately!

---

## 🏗️ Backend Integration Readiness

The client-side code is structured specifically to make backend hooks easy to insert later:

### 1. Database & API Submission Hook
Inside `script.js`, look for the `handleFormSubmit(e)` function. When validation is successful, the app compiles the customer's data into a JSON object:
```javascript
const demoUserData = {
    name: inputName.value.trim(),
    mobile: inputMobile.value.trim(),
    email: inputEmail.value.trim(),
    claimedOffer: "20% OFF",
    couponCode: "ONAM20",
    timestamp: new Date().toISOString()
};
```
Currently, this is printed to the developer console and a `setTimeout` simulates network latency (1.2s). To connect a real backend:
- Replace the `setTimeout` with a fetch query:
  ```javascript
  fetch('/api/claim-coupon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(demoUserData)
  })
  .then(response => response.json())
  .then(data => {
      if(data.success) {
          showScreen(screenSuccess);
      } else {
          alert(data.message || 'Already claimed!');
      }
  });
  ```

### 2. Double-Claim Verification
You can easily prevent duplicates by having your server inspect the database for duplicate `mobile` numbers before returning `success: true`. If a duplicate is found, the server can return a status of `400 Bad Request` and your script can apply an error class to `inputMobile` showing *"This number has already claimed this offer!"*.
