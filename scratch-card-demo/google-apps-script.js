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
    
    var dateString = data.claimDateTime || data["Claim Date & Time"] || data.timestamp || data.date || Utilities.formatDate(new Date(), "GMT+5:30", "dd/MM/yyyy HH:mm");

    // Read Row 1 headers from the Sheet
    var lastCol = Math.max(sheet.getLastColumn(), 5);
    var rawHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    
    // Trim trailing empty headers so we don't append to phantom columns
    var lastNonEmpty = -1;
    for (var k = 0; k < rawHeaders.length; k++) {
      if (rawHeaders[k] && String(rawHeaders[k]).trim() !== "") {
        lastNonEmpty = k;
      }
    }
    
    var headers = (lastNonEmpty !== -1) ? rawHeaders.slice(0, lastNonEmpty + 1) : rawHeaders;

    // Helper to normalize mobile number for reliable duplicate matching
    function normalizeMobile(numStr) {
      if (!numStr) return "";
      var cleaned = String(numStr).replace(/\D/g, "");
      if (cleaned.length === 12 && cleaned.indexOf("91") === 0) {
        cleaned = cleaned.substring(2);
      }
      if (cleaned.length > 10) {
        cleaned = cleaned.substring(cleaned.length - 10);
      }
      return cleaned;
    }

    var cleanSubmittedMobile = normalizeMobile(mobile);

    // Identify Mobile Number column index from headers (default Column 2 / B)
    var mobileColIndex = 2;
    if (headers && headers.length > 0) {
      for (var hIdx = 0; hIdx < headers.length; hIdx++) {
        var hName = String(headers[hIdx]).trim().toLowerCase();
        if (hName.indexOf("mobile") !== -1 || hName.indexOf("phone") !== -1) {
          mobileColIndex = hIdx + 1;
          break;
        }
      }
    }

    // Check existing rows for duplicate mobile number BEFORE appending
    var lastRow = sheet.getLastRow();
    if (lastRow > 1 && cleanSubmittedMobile !== "") {
      var existingMobiles = sheet.getRange(2, mobileColIndex, lastRow - 1, 1).getValues();
      for (var r = 0; r < existingMobiles.length; r++) {
        var existingVal = normalizeMobile(existingMobiles[r][0]);
        if (existingVal !== "" && existingVal === cleanSubmittedMobile) {
          return ContentService.createTextOutput(
            JSON.stringify({
              success: false,
              error: "ALREADY_CLAIMED",
              message: "This mobile number has already claimed an offer!"
            })
          ).setMimeType(ContentService.MimeType.JSON);
        }
      }
    }

    var rowData = [];
    
    if (headers && headers.length > 0 && String(headers[0]).trim() !== "") {
      for (var i = 0; i < headers.length; i++) {
        var h = String(headers[i]).trim().toLowerCase();
        if (h.indexOf("name") !== -1) {
          rowData.push(fullName);
        } else if (h.indexOf("mobile") !== -1 || h.indexOf("phone") !== -1) {
          rowData.push(mobile);
        } else if (h.indexOf("email") !== -1) {
          rowData.push(email);
        } else if (h.indexOf("offer") !== -1 || h.indexOf("reward") !== -1) {
          rowData.push(offer);
        } else if (h.indexOf("date") !== -1 || h.indexOf("time") !== -1 || h.indexOf("claim") !== -1) {
          rowData.push(dateString);
        } else {
          rowData.push("");
        }
      }
    } else {
      // Default 5-column fallback: A: Full Name, B: Mobile Number, C: Email, D: Offer, E: Claim Date & Time
      rowData = [fullName, mobile, email, offer, dateString];
    }

    sheet.appendRow(rowData);
    
    // Explicitly left-align the newly inserted row so dates & numbers align neatly under column headers
    var newRowIndex = sheet.getLastRow();
    if (newRowIndex > 1) {
      var rowRange = sheet.getRange(newRowIndex, 1, 1, rowData.length);
      rowRange.setHorizontalAlignment("left");
      rowRange.setNumberFormat("@"); // Treat as plain text to prevent auto date right-alignment shifts
    }
    
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
  if (e && e.parameter && e.parameter.action === "read") {
    try {
      var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = spreadsheet.getActiveSheet();
      var lastRow = sheet.getLastRow();
      var lastCol = Math.max(sheet.getLastColumn(), 5);
      var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      var latestRow = lastRow > 1 ? sheet.getRange(lastRow, 1, 1, lastCol).getValues()[0] : [];
      return ContentService.createTextOutput(
        JSON.stringify({
          status: "healthy",
          headers: headers,
          lastRowIndex: lastRow,
          latestRow: latestRow
        })
      ).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(
        JSON.stringify({ status: "error", error: err.toString() })
      ).setMimeType(ContentService.MimeType.JSON);
    }
  }
  return ContentService.createTextOutput(
    JSON.stringify({ status: "healthy", service: "Scratch & Win Google Sheets Connector" })
  ).setMimeType(ContentService.MimeType.JSON);
}

