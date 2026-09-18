import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

export const SMTP_USER = (process.env.SMTP_USER || "").trim().replace(/^["']|["']$/g, "");
export const SMTP_PASS = (process.env.SMTP_PASS || "").trim().replace(/^["']|["']$/g, "").replace(/\s+/g, "");
export const HR_EMAIL = (process.env.HR_EMAIL || "").trim().replace(/^["']|["']$/g, "");

export const EMAIL_SERVICE_ERROR_MESSAGE =
  "Email service is not configured. Ask the administrator to add a Gmail App Password.";

function isPlaceholder(value) {
  return !value || /your|change|placeholder|example|password-here|secret-here/i.test(value);
}

export function getEmailConfigurationError() {
  if (isPlaceholder(SMTP_USER) || isPlaceholder(SMTP_PASS)) {
    return EMAIL_SERVICE_ERROR_MESSAGE;
  }
  return null;
}

export function logEmailConfiguration() {
  const configurationError = getEmailConfigurationError();
  if (configurationError) {
    console.error(configurationError);
  }
}

export function logEmailError(context, error) {
  console.error(`${context}:`, {
    name: error?.name,
    message: error?.message,
    code: error?.code,
    command: error?.command,
    responseCode: error?.responseCode,
    response: error?.response,
  });
}

export const emailTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});
