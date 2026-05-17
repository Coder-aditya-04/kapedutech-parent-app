import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

type AuthContextType = {
  phone: string | null;
  isLoading: boolean;
  activeStudentId: string | null;
  setActiveStudentId: (id: string) => Promise<void>;
  login: (phone: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType>({
  phone: null,
  isLoading: true,
  activeStudentId: null,
  setActiveStudentId: async () => {},
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [phone, setPhone] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeStudentId, setActiveStudentIdState] = useState<string | null>(null);

  useEffect(() => {
    async function restore() {
      try {
        const token = await AsyncStorage.getItem("auth_token");
        if (token) {
          const raw = await AsyncStorage.getItem("parent");
          if (raw) {
            const parent = JSON.parse(raw);
            setPhone(parent.phone ?? null);
            // Restore active student — fall back to first student if not saved
            const saved = await AsyncStorage.getItem("active_student_id");
            const firstId = parent.students?.[0]?.id ?? null;
            // Validate saved ID still belongs to this parent
            const valid = parent.students?.some((s: { id: string }) => s.id === saved);
            setActiveStudentIdState(valid ? saved : firstId);
          }
        }
      } finally {
        setIsLoading(false);
      }
    }
    restore();
  }, []);

  async function setActiveStudentId(id: string) {
    setActiveStudentIdState(id);
    await AsyncStorage.setItem("active_student_id", id);
  }

  function logout() {
    setPhone(null);
    setActiveStudentIdState(null);
    AsyncStorage.multiRemove(["auth_token", "parent", "active_student_id"]);
  }

  return (
    <AuthContext.Provider
      value={{
        phone,
        isLoading,
        activeStudentId,
        setActiveStudentId,
        login: (p) => setPhone(p),
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
