import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import auth from "@react-native-firebase/auth";
import { getParentStudents, setUnauthorizedHandler } from "@/src/api/auth";

// Parents who log in by email may have no phone on file, so the signed-in
// marker falls back to email, then id. An empty phone used to read as
// "logged out" and bounced them back to the login screen.
function signedInKey(parent: { phone?: string; email?: string | null; id?: string }): string | null {
  return parent.phone || parent.email || parent.id || null;
}

type AuthContextType = {
  phone: string | null;
  isLoading: boolean;
  activeStudentId: string | null;
  setActiveStudentId: (id: string) => Promise<void>;
  /** True when the last logout happened because the login ran out. */
  sessionExpired: boolean;
  login: (phone: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType>({
  phone: null,
  isLoading: true,
  activeStudentId: null,
  setActiveStudentId: async () => {},
  sessionExpired: false,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [phone, setPhone] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeStudentId, setActiveStudentIdState] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const signedIn = useRef(false);

  useEffect(() => {
    async function restore() {
      try {
        const token = await AsyncStorage.getItem("auth_token");
        if (token) {
          const raw = await AsyncStorage.getItem("parent");
          if (raw) {
            const parent = JSON.parse(raw);
            const key = signedInKey(parent);
            setPhone(key);
            signedIn.current = !!key;
            // Restore active student — fall back to first student if not saved
            const saved = await AsyncStorage.getItem("active_student_id");
            const firstId = parent.students?.[0]?.id ?? null;
            // Validate saved ID still belongs to this parent
            const valid = parent.students?.some((s: { id: string }) => s.id === saved);
            setActiveStudentIdState(valid ? saved : firstId);
            void refreshStudents(parent, token, valid ? saved : firstId);
          }
        }
      } finally {
        setIsLoading(false);
      }
    }
    restore();
  }, []);

  // Any API call that comes back 401 (login ran out) signs the parent out.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (!signedIn.current) return;
      setSessionExpired(true);
      logout();
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  // Update the saved children list in the background, so a newly added child
  // or a batch change shows up without logging out and in again.
  async function refreshStudents(
    parent: { id: string; students?: { id: string }[] },
    token: string,
    currentId: string | null,
  ) {
    const students = await getParentStudents(parent.id, token);
    if (!students || !signedIn.current) return;
    await AsyncStorage.setItem("parent", JSON.stringify({ ...parent, students }));
    if (!students.some(s => s.id === currentId)) {
      const firstId = students[0]?.id ?? null;
      setActiveStudentIdState(firstId);
      if (firstId) await AsyncStorage.setItem("active_student_id", firstId);
    }
  }

  async function setActiveStudentId(id: string) {
    setActiveStudentIdState(id);
    await AsyncStorage.setItem("active_student_id", id);
  }

  function logout() {
    signedIn.current = false;
    setPhone(null);
    setActiveStudentIdState(null);
    // Sign out of Firebase so its session doesn't auto-login the next visitor
    void Promise.all([
      AsyncStorage.multiRemove(["auth_token", "parent", "active_student_id"]),
      auth().signOut().catch(() => {}),
    ]);
  }

  return (
    <AuthContext.Provider
      value={{
        phone,
        isLoading,
        activeStudentId,
        setActiveStudentId,
        sessionExpired,
        login: (p) => {
          signedIn.current = true;
          setSessionExpired(false);
          setPhone(p);
        },
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
