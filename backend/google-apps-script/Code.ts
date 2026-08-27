/**
 * IS³A³ 2026 - International Symposium on Smart Systems, Algorithms & Applications
 * Department of Computer Science & Engineering, Tezpur University
 * 
 * TypeScript Backend Engine for Google Apps Script
 * Integrates Google Sheets (Database), Google Drive (Receipt PDFs), and Excel Export
 */

// =============================================================================
// TYPE DEFINITIONS & INTERFACES
// =============================================================================

export interface RegistrationPayload {
  registrationId: string;
  leadName: string;
  email: string;
  phone: string;
  institution: string;
  country: string;
  categoryName: string;
  categoryFee: string;
  paperId: string;
  paperTitle: string;
  allAuthors: string;
  certName: string;
  certRole: string;
  presentationMode: string;
  accommodation: string;
  gst: string;
  paymentStatus: string;
  transactionId: string;
  paymentTime: string;
  pdfName?: string;
  pdfBase64?: string;
}

export interface RegistrationRecord extends RegistrationPayload {
  timestamp: string;
  receiptDriveUrl: string;
  verificationStatus: "Verified" | "Pending" | "Flagged";
}

export interface ApiResponse<T = any> {
  status: "success" | "error";
  message?: string;
  data?: T;
  registrationId?: string;
  driveUrl?: string;
  excelDownloadUrl?: string;
}

// =============================================================================
// CONFIGURATION CONSTANTS
// =============================================================================

const CONFIG = {
  RECEIPT_FOLDER_NAME: "IS3A3_2026_Payment_Receipts",
  RECEIPT_FOLDER_ID: "", // Optional: Paste a specific Google Drive Folder ID if desired
  SYMPOSIUM_EMAIL: "is3a3@tezu.ernet.in",
  CONFERENCE_NAME: "IS³A³ 2026 Symposium (Tezpur University)",
  ADMIN_API_KEY: "is3a3@2026" // Passcode for Admin Panel sync
};

// =============================================================================
// POST ENDPOINT: INGEST REGISTRATIONS, STORE PDF IN DRIVE, LOG TO SHEET
// =============================================================================

function doPost(e: GoogleAppsScript.Events.DoPost): GoogleAppsScript.Content.TextOutput {
  const lock = LockService.getScriptLock();
  lock.tryLock(15000);

  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("Invalid request payload received.");
    }

    const payload: RegistrationPayload = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getActiveSheet();

    // Initialize Header Row with Styles if new
    if (sheet.getLastRow() === 0) {
      const headers = [
        "Timestamp",
        "Registration ID",
        "Verification Status",
        "Lead Name",
        "Email",
        "Phone",
        "Institution",
        "Country",
        "Category",
        "Fee Amount",
        "Paper ID",
        "Paper Title",
        "All Authors",
        "Certificate Name",
        "Certificate Role",
        "Presentation Mode",
        "Accommodation",
        "GSTIN / Invoice",
        "Payment Status",
        "Transaction ID",
        "Payment Date & Time",
        "Receipt Drive URL"
      ];
      sheet.appendRow(headers);
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#092B45");
      headerRange.setFontColor("#E5B422");
      sheet.setFrozenRows(1);
    }

    // 1. Process & Save PDF Receipt into Google Drive
    let receiptDriveUrl = "No Receipt Attached";
    if (payload.pdfBase64 && payload.pdfName) {
      receiptDriveUrl = savePdfToGoogleDrive(
        payload.pdfBase64,
        payload.pdfName,
        payload.registrationId
      );
    }

    // 2. Append Row to Google Sheet Database
    const timestamp = new Date().toISOString();
    const verificationStatus = "Pending";

    sheet.appendRow([
      timestamp,
      payload.registrationId,
      verificationStatus,
      payload.leadName,
      payload.email,
      payload.phone,
      payload.institution,
      payload.country,
      payload.categoryName,
      payload.categoryFee,
      payload.paperId,
      payload.paperTitle,
      payload.allAuthors,
      payload.certName,
      payload.certRole,
      payload.presentationMode,
      payload.accommodation,
      payload.gst,
      payload.paymentStatus,
      payload.transactionId,
      payload.paymentTime,
      receiptDriveUrl
    ]);

    // 3. Dispatch Official Confirmation Email to Registrant
    if (payload.email) {
      sendConfirmationEmail(payload, receiptDriveUrl);
    }

    const response: ApiResponse = {
      status: "success",
      registrationId: payload.registrationId,
      driveUrl: receiptDriveUrl,
      message: "Registration successfully recorded and saved to Google Drive."
    };

    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error: any) {
    const errorResponse: ApiResponse = {
      status: "error",
      message: error.toString()
    };
    return ContentService.createTextOutput(JSON.stringify(errorResponse))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// =============================================================================
// GET ENDPOINT: SERVE DATA TO ADMIN PANEL & EXPORT EXCEL
// =============================================================================

function doGet(e: GoogleAppsScript.Events.DoGet): GoogleAppsScript.Content.TextOutput {
  try {
    const action = e.parameter ? e.parameter.action : "list";
    const apiKey = e.parameter ? e.parameter.key : "";

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getActiveSheet();

    // 1. Direct Excel (.xlsx) Export Link Generation
    if (action === "exportExcel") {
      const spreadsheetId = ss.getId();
      const excelExportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx`;
      
      const response: ApiResponse = {
        status: "success",
        excelDownloadUrl: excelExportUrl
      };
      return ContentService.createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 2. Fetch All Records for Admin Portal
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();

    if (values.length <= 1) {
      return ContentService.createTextOutput(JSON.stringify({ status: "success", data: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const headers = values[0];
    const records: any[] = [];

    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      const record: any = {};
      for (let c = 0; c < headers.length; c++) {
        record[headers[c]] = row[c];
      }
      records.push(record);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      totalCount: records.length,
      data: records
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error: any) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// =============================================================================
// HELPER: SAVE PDF FILE TO GOOGLE DRIVE FOLDER
// =============================================================================

function savePdfToGoogleDrive(base64Data: string, originalFileName: string, registrationId: string): string {
  try {
    let targetFolder: GoogleAppsScript.Drive.Folder;

    if (CONFIG.RECEIPT_FOLDER_ID) {
      targetFolder = DriveApp.getFolderById(CONFIG.RECEIPT_FOLDER_ID);
    } else {
      const folders = DriveApp.getFoldersByName(CONFIG.RECEIPT_FOLDER_NAME);
      if (folders.hasNext()) {
        targetFolder = folders.next();
      } else {
        targetFolder = DriveApp.createFolder(CONFIG.RECEIPT_FOLDER_NAME);
      }
    }

    // Clean Base64 string if data URL prefix exists
    const cleanBase64 = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;
    const decodedBytes = Utilities.base64Decode(cleanBase64);
    const sanitizedFileName = `${registrationId}_${originalFileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    
    const blob = Utilities.newBlob(decodedBytes, "application/pdf", sanitizedFileName);
    const file = targetFolder.createFile(blob);
    
    // Set view permissions so committee can open the receipt link directly
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (err: any) {
    Logger.log("Drive save error: " + err.message);
    return "Drive Error: " + err.message;
  }
}

// =============================================================================
// HELPER: AUTOMATED EMAIL DISPATCH
// =============================================================================

function sendConfirmationEmail(payload: RegistrationPayload, driveUrl: string): void {
  try {
    const subject = `Registration Acknowledgement: ${payload.registrationId} | IS³A³ 2026`;
    const htmlBody = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #092B45; padding: 25px; text-align: center; color: #ffffff; border-bottom: 4px solid #E5B422;">
          <h2 style="margin: 0; font-size: 22px;">IS³A³ 2026</h2>
          <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">Department of Computer Science & Engineering, Tezpur University</p>
        </div>
        
        <div style="padding: 25px; background-color: #ffffff; color: #1E293B; line-height: 1.6;">
          <p style="font-size: 16px;">Dear <strong>${payload.leadName}</strong>,</p>
          <p>We have successfully received your registration details for the <strong>International Symposium on Smart Systems, Algorithms & Applications (IS³A³ 2026)</strong>.</p>
          
          <div style="background-color: #F8FAFC; border: 1.5px dashed #CBD5E1; border-radius: 6px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; font-size: 12px; text-transform: uppercase; color: #64748B; font-weight: bold;">Official Registration Reference</p>
            <p style="margin: 4px 0 0 0; font-size: 20px; font-weight: bold; color: #092B45; letter-spacing: 1px;">${payload.registrationId}</p>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 20px;">
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #F1F5F9; color: #64748B;">Paper ID:</td><td style="padding: 8px 0; border-bottom: 1px solid #F1F5F9; font-weight: bold;">${payload.paperId}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #F1F5F9; color: #64748B;">Paper Title:</td><td style="padding: 8px 0; border-bottom: 1px solid #F1F5F9; font-weight: bold;">${payload.paperTitle}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #F1F5F9; color: #64748B;">Category & Fee:</td><td style="padding: 8px 0; border-bottom: 1px solid #F1F5F9; font-weight: bold;">${payload.categoryName} (${payload.categoryFee})</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #F1F5F9; color: #64748B;">Transaction ID:</td><td style="padding: 8px 0; border-bottom: 1px solid #F1F5F9; font-weight: bold;">${payload.transactionId}</td></tr>
            <tr><td style="padding: 8px 0; border-bottom: 1px solid #F1F5F9; color: #64748B;">Presentation Mode:</td><td style="padding: 8px 0; border-bottom: 1px solid #F1F5F9; font-weight: bold;">${payload.presentationMode}</td></tr>
          </table>

          <p style="font-size: 13px; color: #64748B;">Our accounts and organizing committee are currently verifying your payment receipt. You will receive further symposium schedule updates shortly.</p>
        </div>

        <div style="background-color: #F8FAFC; padding: 15px; text-align: center; font-size: 12px; color: #94A3B8; border-top: 1px solid #E2E8F0;">
          IS³A³ 2026 Secretariat • Tezpur University, Napaam, Assam 784028 • <a href="mailto:${CONFIG.SYMPOSIUM_EMAIL}" style="color: #092B45;">${CONFIG.SYMPOSIUM_EMAIL}</a>
        </div>
      </div>
    `;

    MailApp.sendEmail({
      to: payload.email,
      subject: subject,
      htmlBody: htmlBody
    });
  } catch (err: any) {
    Logger.log("Email dispatch error: " + err.message);
  }
}
