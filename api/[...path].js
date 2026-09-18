// Vercel catch-all — handles /api/* preserving the original URL
import app from "./index.js";

export default function handler(req, res) {
  return app(req, res);
}
