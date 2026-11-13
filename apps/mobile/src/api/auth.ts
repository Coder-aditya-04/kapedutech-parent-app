import AsyncStorage from "@react-native-async-storage/async-storage";

// ── Session expiry ───────────────────────────────────────────────────────────
// Login tokens last 30 days. When one runs out every API answers 401, and
// before this the screens quietly showed empty data forever. Any 401 now
// calls this handler (AuthContext sets it) so the parent is sent to login.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

async function authFetch(url: string, token: string): Promise<Response> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) onUnauthorized?.();
  return res;
}

// "Today" in India, as YYYY-MM-DD. toISOString() gives the UTC date, which is
// still yesterday between midnight and 5:30 AM IST.
export function istToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}
const BASE_URL = "https://kapedutech-platform.vercel.app/api/auth";
const FIREBASE_VERIFY_URL = `${BASE_URL}/parent/firebase-verify`;
const EMAIL_OTP_URL = `${BASE_URL}/parent/request-otp-email`;
const EMAIL_VERIFY_URL = `${BASE_URL}/parent/verify-otp-email`;

export async function checkPhoneRegistered(phone: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${BASE_URL}/parent/check-phone/${phone}`, { signal: controller.signal });
    clearTimeout(timeout);
    const data = await res.json() as { registered: boolean };
    return data.registered;
  } catch {
    return true; // timeout or network error → let Firebase proceed
  }
}
const ATTENDANCE_URL = "https://kapedutech-platform.vercel.app/api/attendance";

export type AttendanceRecord = {
  id: string;
  date: string;
  type: "PUNCH_IN" | "PUNCH_OUT";
  markedAt: string;
};

export type TodayAttendance = {
  punchIn: string | null;
  punchOut: string | null;
};

export async function getStudentAttendance(studentId: string, token: string): Promise<AttendanceRecord[]> {
  try {
    const res = await authFetch(`${ATTENDANCE_URL}/student/${studentId}`, token);
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

export type AttendanceSummary = {
  totalPresent: number;
  totalWorkingDays: number;
  currentStreak: number;
  allTimePct: number;
  workingDates: string[];
};

export async function getAttendanceSummary(studentId: string, token: string): Promise<AttendanceSummary> {
  try {
    const res = await authFetch(`${ATTENDANCE_URL}/student/${studentId}/summary`, token);
    if (!res.ok) return { totalPresent: 0, totalWorkingDays: 0, currentStreak: 0, allTimePct: 0, workingDates: [] };
    return res.json();
  } catch { return { totalPresent: 0, totalWorkingDays: 0, currentStreak: 0, allTimePct: 0, workingDates: [] }; }
}

export async function getTodayAttendance(studentId: string, token: string): Promise<TodayAttendance> {
  try {
    const res = await authFetch(`${ATTENDANCE_URL}/student/${studentId}/today`, token);
    if (!res.ok) return { punchIn: null, punchOut: null };
    return res.json();
  } catch { return { punchIn: null, punchOut: null }; }
}

export type Student = {
  id: string;
  name: string;
  enrollmentNo: string;
  batch?: string;
  qrCode: string;
};

export type Parent = {
  id: string;
  name: string;
  phone: string;
  students: Student[];
};

export type VerifyOtpResponse = {
  token: string;
  parent: Parent;
};

export async function requestOtp(phone: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/parent/request-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message ?? "Failed to send OTP.");
  }
}

export async function verifyOtp(phone: string, otp: string): Promise<VerifyOtpResponse> {
  const res = await fetch(`${BASE_URL}/parent/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, otp }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message ?? "OTP verification failed.");
  }

  return data as VerifyOtpResponse;
}

export async function savePushToken(parentId: string, pushToken: string): Promise<void> {
  // The server identifies the parent from the login token, not from parentId.
  const authToken = await AsyncStorage.getItem("auth_token");
  if (!authToken) return;
  await fetch(`${BASE_URL}/parent/push-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
    body: JSON.stringify({ parentId, pushToken }),
  });
}

export async function requestOtpEmail(email: string): Promise<void> {
  const res = await fetch(EMAIL_OTP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "Failed to send OTP.");
}

export async function verifyOtpEmail(email: string, otp: string): Promise<VerifyOtpResponse> {
  const res = await fetch(EMAIL_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "OTP verification failed.");
  return data as VerifyOtpResponse;
}

export type TestResult = {
  id: string;
  testName: string;
  testDate: string;
  rank: number | null;
  totalInBatch: number | null;
  scores: Record<string, number>;
  subjectMaxes: Record<string, number> | null;
  classAvgScores: Record<string, number> | null;
  total: number;
  percentage: number;
  percentile: number | null;
  uploadedAt: string;
};

// Recalculate percentage from raw scores — the stored `percentage` field can be
// corrupted at upload time if the total-marks denominator was wrong.
export function realPct(r: TestResult): number {
  const maxes = r.subjectMaxes;
  if (maxes && Object.keys(maxes).length > 0) {
    const totalScore = Object.values(r.scores).reduce((a, b) => a + b, 0);
    const totalMax   = Object.values(maxes).reduce((a, b) => a + b, 0);
    if (totalMax > 0) return Math.round((totalScore / totalMax) * 1000) / 10;
  }
  return r.percentage;
}

export async function getStudentResults(studentId: string, token: string): Promise<TestResult[]> {
  try {
    const res = await authFetch(`${ATTENDANCE_URL}/student/${studentId}/results`, token);
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

export async function verifyFirebaseToken(idToken: string): Promise<VerifyOtpResponse> {
  const res = await fetch(FIREBASE_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "Login failed.");
  return data as VerifyOtpResponse;
}

// ── Homework (set by faculty and checked by operations in KAP Core) ──────────
const HOMEWORK_URL = "https://kapedutech-platform.vercel.app/api/homework";

// "cancelled" is not sent yet; the homework spec asks the feed to keep
// cancelled work visible for 7 days, and the screen is ready for it.
export type HomeworkStatus = "done" | "partial" | "not_done" | "pending" | "cancelled";
export type HomeworkItem = {
  homework_id: string;
  subject: string;
  title: string;
  details: string | null;
  assigned_on: string;
  due_on: string;
  set_by: string;
  status: HomeworkStatus;
  checked_at: string | null;
};

export async function getStudentHomework(
  studentId: string,
  token: string
): Promise<{ available: boolean; homework: HomeworkItem[] }> {
  try {
    const res = await authFetch(`${HOMEWORK_URL}/student/${studentId}`, token);
    if (!res.ok) return { available: false, homework: [] };
    const data = await res.json();
    return { available: !!data.available, homework: data.homework ?? [] };
  } catch {
    return { available: false, homework: [] };
  }
}

// Fresh list of the parent's children (with batch). The copy saved at login
// goes stale when a child is added or moves batch, so the app refreshes it on
// start. Returns null when offline or on any error, so callers keep the cache.
export async function getParentStudents(parentId: string, token: string): Promise<Student[] | null> {
  try {
    const res = await authFetch(`${BASE_URL}/parent/students/${parentId}`, token);
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? (data as Student[]) : null;
  } catch {
    return null;
  }
}
