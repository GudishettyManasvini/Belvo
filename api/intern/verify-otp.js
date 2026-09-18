// Vercel Serverless Function — /api/intern/verify-otp
import app from "../index.js";

export default function handler(req, res) {
  return app(req, res);
}
