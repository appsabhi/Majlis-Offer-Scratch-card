/**
 * Google Apps Script backend for Scratch & Win Customer Database
 * 
 * INSTRUCTIONS FOR DEPLOYMENT / REDEPLOYMENT:
 * 1. Open your Google Sheet (https://sheets.google.com) and open the linked spreadsheet.
 * 2. Verify your headers in Row 1 (A1 to E1):
 *    A1: Full Name
 *    B1: Mobile Number
 *    C1: Email
 *    D1: Offer
 *    E1: Claim Date & Time
 * 3. Go to Extensions -> Apps Script.
 * 4. Replace the entire contents of Code.gs with this code and click Save (disk icon).
 * 5. Click "Deploy" -> "Manage deployments" -> Click Pencil Icon (Edit) -> Select "New version" -> Click "Deploy".
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = spreadsheet.getActiveSheet();
    
    var data = {};
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (err) {
        data = e.parameter || {};
      }
    } else if (e && e.parameter) {
      data = e.parameter;
    }
    
    // Extract fields with fallback aliases so no data is ever missed
    var fullName = data.fullName || data["Full Name"] || data.name || "";
    var mobile = data.mobileNumber || data["Mobile Number"] || data.mobile || data.phone || "";
    var email = data.email || data["Email"] || "";
    if (!email || String(email).trim() === "" || String(email).trim().toLowerCase() === "undefined") {
      email = "Not Provided";
    }
    var offer = data.offer || data["Offer"] || data.reward || "";
    var coupon = data.couponCode || data.coupon || data["Coupon Code"] || "";
    
    var dateString = data.claimDateTime || data["Claim Date & Time"] || data.timestamp || data.date || Utilities.formatDate(new Date(), "GMT+5:30", "dd/MM/yyyy HH:mm");

    // Read Row 1 headers from the Sheet to dynamically match exact columns A, B, C, D, E
    var lastCol = Math.max(sheet.getLastColumn(), 5);
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    
    var rowData = [];
    
    if (headers && headers.length > 0 && String(headers[0]).trim() !== "") {
      for (var i = 0; i < headers.length; i++) {
        var h = String(headers[i]).trim().toLowerCase();
        if (h.indexOf("name") !== -1) {
          rowData.push(fullName);
        } else if (h.indexOf("mobile") !== -1 || h.indexOf("phone") !== -1 || h.indexOf("number") !== -1) {
          rowData.push(mobile);
        } else if (h.indexOf("email") !== -1) {
          rowData.push(email);
        } else if (h.indexOf("coupon") !== -1 || h.indexOf("code") !== -1) {
          rowData.push(coupon);
        } else if (h.indexOf("offer") !== -1 || h.indexOf("reward") !== -1) {
          rowData.push(offer);
        } else if (h.indexOf("date") !== -1 || h.indexOf("time") !== -1 || h.indexOf("claim") !== -1) {
          rowData.push(dateString);
        } else {
          rowData.push("");
        }
      }
    } else {
      // Default 5-column fallback matching A: Full Name, B: Mobile Number, C: Email, D: Offer, E: Claim Date & Time
      rowData = [fullName, mobile, email, offer, dateString];
    }

    sheet.appendRow(rowData);
    
    return ContentService.createTextOutput(
      JSON.stringify({ success: true, message: "Claim successfully recorded." })
    ).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: error.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
    
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return ContentService.createTextOutput(
    JSON.stringify({ status: "healthy", service: "Scratch & Win Google Sheets Connector" })
  ).setMimeType(ContentService.MimeType.JSON);
}
