// In production the Express handler is served by Vercel under /api.  Keeping
// this relative also makes the portal work on preview deployments and custom
// domains instead of trying to contact the visitor's localhost.
const API_BASE = "/api";
const TOKEN_KEY = "belvo_intern_token";
const EMAIL_KEY = "belvo_intern_email";
const OTP_CHALLENGE_KEY = "belvo_intern_otp_challenge";

// ── Token Management ─────────────────────────────────

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EMAIL_KEY);
  sessionStorage.removeItem(OTP_CHALLENGE_KEY);
}

export function getEmail(): string | null {
  return localStorage.getItem(EMAIL_KEY);
}

function setEmail(email: string): void {
  localStorage.setItem(EMAIL_KEY, email);
}

export function isAuthenticated(): boolean {
  const token = getToken();
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

// ── API Helper ───────────────────────────────────────

async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const contentType = res.headers.get("content-type") || "";
  let data: any = {};

  if (contentType.includes("application/json")) {
    try {
      data = await res.json();
    } catch {
      data = {};
    }
  } else {
    if (!res.ok) {
      if (res.status === 503) {
        throw new Error("Unable to send OTP right now. Please try again later.");
      }
      throw new Error(`Server returned error (${res.status}). Please try again.`);
    }
    throw new Error("Unexpected response format from server.");
  }

  if (!res.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

// ── OTP Auth ─────────────────────────────────────────

export async function sendOtp(email: string): Promise<void> {
  const data = await api<{ success: boolean; message: string; otpChallenge: string }>("/intern/send-otp", {
    method: "POST",
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
  sessionStorage.setItem(OTP_CHALLENGE_KEY, data.otpChallenge);
}

export async function verifyOtp(
  email: string,
  otp: string
): Promise<{ token: string; email: string }> {
  const otpChallenge = sessionStorage.getItem(OTP_CHALLENGE_KEY);
  if (!otpChallenge) {
    throw new Error("OTP session expired. Please request a new code.");
  }

  const data = await api<{
    success: boolean;
    token: string;
    email: string;
  }>("/intern/verify-otp", {
    method: "POST",
    body: JSON.stringify({ email: email.trim().toLowerCase(), otp, otpChallenge }),
  });

  setToken(data.token);
  setEmail(data.email);
  sessionStorage.removeItem(OTP_CHALLENGE_KEY);
  clearChecklist();

  return { token: data.token, email: data.email };
}

// ── Checklist (per-device via localStorage) ──────────

export interface ChecklistStatus {
  watchedLms: boolean;
  offerLetter: boolean;
  idCard: boolean;
  instagram: boolean;
  linkedin: boolean;
  whatsapp: boolean;
  nda: boolean;
}

const defaultStatus: ChecklistStatus = {
  watchedLms: false,
  offerLetter: false,
  idCard: false,
  instagram: false,
  linkedin: false,
  whatsapp: false,
  nda: false,
};

const CHECKLIST_KEY = "belvo_intern_checklist";

function getStoredChecklist(): ChecklistStatus {
  try {
    const raw = localStorage.getItem(CHECKLIST_KEY);
    if (!raw) return { ...defaultStatus };
    return { ...defaultStatus, ...JSON.parse(raw) };
  } catch {
    return { ...defaultStatus };
  }
}

function setStoredChecklist(status: ChecklistStatus): void {
  localStorage.setItem(CHECKLIST_KEY, JSON.stringify(status));
}

export function clearChecklist(): void {
  localStorage.removeItem(CHECKLIST_KEY);
}

export function getChecklistStatus(): ChecklistStatus {
  return getStoredChecklist();
}

export function markSocial(item: "instagram" | "linkedin" | "whatsapp"): void {
  const status = getStoredChecklist();
  status[item] = true;
  setStoredChecklist(status);
}

export function markChecklistItem(
  item: "watchedLms" | "offerLetter" | "idCard"
): boolean {
  const status = getStoredChecklist();
  status[item] = !status[item];
  setStoredChecklist(status);
  return status[item];
}

export async function submitNda(pdfBase64: string): Promise<void> {
  const email = getEmail();
  if (!email) throw new Error("Not authenticated");

  try {
    await api<{ success: boolean; message: string }>("/intern/submit-nda", {
      method: "POST",
      body: JSON.stringify({ email, pdfBase64 }),
    });
  } catch {
    // Backend unreachable — offline mode: mark locally
  }

  const status = getStoredChecklist();
  status.nda = true;
  setStoredChecklist(status);
}

export async function submitOfferLetter(formData: {
  name: string;
  age: string;
  aadharNumber: string;
  designation: string;
  tenure: string;
  address: string;
}): Promise<void> {
  const email = getEmail();
  if (!email) throw new Error("Not authenticated");

  try {
    await api<{ success: boolean; message: string }>(
      "/intern/submit-offer-letter",
      {
        method: "POST",
        body: JSON.stringify({ email, ...formData }),
      }
    );
  } catch {
    // Backend unreachable — offline mode: mark locally
  }

  const status = getStoredChecklist();
  status.offerLetter = true;
  setStoredChecklist(status);
}

export async function submitIdCard(formData: {
  name: string;
  department: string;
  photoBase64: string;
}): Promise<void> {
  const email = getEmail();
  if (!email) throw new Error("Not authenticated");

  try {
    await api<{ success: boolean; message: string }>("/intern/submit-id-card", {
      method: "POST",
      body: JSON.stringify({ email, ...formData }),
    });
  } catch {
    // Backend unreachable — offline mode: mark locally
  }

  const status = getStoredChecklist();
  status.idCard = true;
  setStoredChecklist(status);
}

// ── Logout ───────────────────────────────────────────

export function logout(): void {
  clearToken();
  clearChecklist();
}
