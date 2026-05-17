const BASE_URL = "https://kapedutech-platform.onrender.com/api/auth";
const FIREBASE_VERIFY_URL = `${BASE_URL}/parent/firebase-verify`;
const EMAIL_OTP_URL = `${BASE_URL}/parent/request-otp-email`;
const EMAIL_VERIFY_URL = `${BASE_URL}/parent/verify-otp-email`;
const ATTENDANCE_URL = "https://kapedutech-platform.onrender.com/api/attendance";

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
    const res = await fetch(`${ATTENDANCE_URL}/student/${studentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
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
    const res = await fetch(`${ATTENDANCE_URL}/student/${studentId}/summary`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { totalPresent: 0, totalWorkingDays: 0, currentStreak: 0, allTimePct: 0, workingDates: [] };
    return res.json();
  } catch { return { totalPresent: 0, totalWorkingDays: 0, currentStreak: 0, allTimePct: 0, workingDates: [] }; }
}

export async function getTodayAttendance(studentId: string, token: string): Promise<TodayAttendance> {
  try {
    const res = await fetch(`${ATTENDANCE_URL}/student/${studentId}/today`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { punchIn: null, punchOut: null };
    return res.json();
  } catch { return { punchIn: null, punchOut: null }; }
}

export type Student = {
  id: string;
  name: string;
  enrollmentNo: string;
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
  await fetch(`${BASE_URL}/parent/push-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

export async function getStudentResults(studentId: string, token: string): Promise<TestResult[]> {
  try {
    const res = await fetch(`${ATTENDANCE_URL}/student/${studentId}/results`, {
      headers: { Authorization: `Bearer ${token}` },
    });
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
