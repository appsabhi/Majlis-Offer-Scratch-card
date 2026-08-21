/**
 * Google Apps Script backend for Scratch & Win Customer Database
 * 
 * INSTRUCTIONS FOR DEPLOYMENT:
 * 1. Open Google Sheets (https://sheets.google.com) and create a new spreadsheet.
 * 2. Set the sheet columns in the first row (Row 1):
 *    A1: Full Name
 *    B1: Mobile Number
 *    C1: Email
 *    D1: Offer
 *    E1: Coupon Code
 *    F1: Claim Date & Time
 * 3. Go to Extensions -> Apps Script in the Google Sheets menu.
 * 4. Delete any default code in the Apps Script editor (e.g. Code.gs) and paste this entire code.
 * 5. Click the "Save" (disk icon) button.
 * 6. Click the "Deploy" button at the top-right and choose "New deployment".
 * 7. Click the gear icon next to "Select type" and select "Web app".
 * 8. Set the configuration options:
 *    - Description: Scratch & Win Backend
 *    - Execute as: Me (your email address)
 *    - Who has access: Anyone (Important: this allows the frontend to submit details)
 * 9. Click "Deploy". You may need to "Authorize Access" and click "Advanced" -> "Go to Untitled project (unsafe)" to grant permissions.
 * 10. Copy the generated Web App URL (the URL ending in /exec) and paste it into GOOGLE_SHEETS_API_URL in script.js.
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    // Acquire a script lock for up to 30 seconds to prevent race conditions during concurrent writes
    lock.waitLock(30000);
    
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = spreadsheet.getActiveSheet();
    
    // Parse the payload sent from the frontend
    var data = JSON.parse(e.postData.contents);
    
    // Format timestamp: Indian Standard Time (IST - GMT+5:30)
    var dateString = Utilities.formatDate(new Date(), "GMT+5:30", "dd/MM/yyyy HH:mm");
    
    // Append the row matching these columns:
    // Full Name | Mobile Number | Email | Offer | Coupon Code | Claim Date & Time
    sheet.appendRow([
      data.fullName || "",
      data.mobileNumber || "",
      data.email || "",
      data.offer || "",
      data.couponCode || "",
      dateString
    ]);
    
    // Return a success JSON response with CORS headers
    return ContentService.createTextOutput(
      JSON.stringify({ success: true, message: "Claim successfully recorded." })
    ).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    // Return an error JSON response
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: error.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
    
  } finally {
    // Ensure the lock is released
    lock.releaseLock();
  }
}

// Optional GET response to verify active deployment health status
function doGet(e) {
  return ContentService.createTextOutput(
    JSON.stringify({ status: "healthy", service: "Scratch & Win Google Sheets Database Connector" })
  ).setMimeType(ContentService.MimeType.JSON);
}
