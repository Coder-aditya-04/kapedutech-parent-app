import { ScrollView, View, ActivityIndicator, RefreshControl } from "react-native";
import { Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { getStudentHomework, type HomeworkItem, type HomeworkStatus } from "@/src/api/auth";
import { useTheme, ACCENT, GOOD, BAD, WARN } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";

type Student = { id: string; name: string };
type Parent = { students: Student[] };

const STATUS: Record<HomeworkStatus, { label: string; color: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = {
  done: { label: "Done", color: GOOD, icon: "check-circle" },
  partial: { label: "Partly done", color: WARN, icon: "progress-check" },
  not_done: { label: "Not done", color: BAD, icon: "close-circle" },
  pending: { label: "Not checked yet", color: ACCENT, icon: "clock-outline" },
};

function fmtDay(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

export default function HomeworkScreen() {
  const t = useTheme();
  const { activeStudentId } = useAuth();
  const [items, setItems] = useState<HomeworkItem[]>([]);
  const [available, setAvailable] = useState(true);
  const [studentName, setStudentName] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [raw, token] = await Promise.all([AsyncStorage.getItem("parent"), AsyncStorage.getItem("auth_token")]);
      if (!raw || !token) return;
      const p: Parent = JSON.parse(raw);
      const student = (activeStudentId ? p.students?.find(s => s.id === activeStudentId) : null) ?? p.students?.[0];
      if (!student) return;
      setStudentName(student.name);
      const res = await getStudentHomework(student.id, token);
      setAvailable(res.available);
      setItems(res.homework);
    } finally { setLoading(false); setRefreshing(false); }
  }, [activeStudentId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const upcoming = items.filter(h => h.due_on >= today);
  const past = items.filter(h => h.due_on < today);
  const doneCount = past.filter(h => h.status === "done").length;

  function Card({ h }: { h: HomeworkItem }) {
    const s = STATUS[h.status] ?? STATUS.pending;
    return (
      <View style={{ backgroundColor: t.card, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: t.cardBorder }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <Text style={{ fontSize: 11, fontWeight: "800", color: ACCENT, letterSpacing: 0.4 }}>{h.subject.toUpperCase()}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: `${s.color}18`, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
            <MaterialCommunityIcons name={s.icon} size={13} color={s.color} />
            <Text style={{ fontSize: 11, fontWeight: "700", color: s.color }}>{s.label}</Text>
          </View>
        </View>
        <Text style={{ fontSize: 15, fontWeight: "700", color: t.text, marginTop: 6 }}>{h.title}</Text>
        {h.details ? <Text style={{ fontSize: 13, color: t.text2, marginTop: 4 }}>{h.details}</Text> : null}
        <Text style={{ fontSize: 12, color: t.text3, marginTop: 8 }}>
          Due {fmtDay(h.due_on)} · set by {h.set_by}
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} />}
      >
        <View style={{ paddingVertical: 16 }}>
          <Text style={{ fontSize: 26, fontWeight: "800", color: t.text, letterSpacing: -0.5 }}>Homework</Text>
          <Text style={{ fontSize: 13, color: t.text3, marginTop: 2 }}>
            {studentName ? `${studentName} · ` : ""}last 30 days
          </Text>
        </View>

        {!available ? (
          <Text style={{ fontSize: 13, color: t.text3 }}>Homework could not be loaded right now. Pull down to try again.</Text>
        ) : items.length === 0 ? (
          <Text style={{ fontSize: 13, color: t.text3 }}>No homework set yet.</Text>
        ) : (
          <>
            {upcoming.length > 0 && (
              <>
                <Text style={{ fontSize: 12, fontWeight: "700", color: t.text3, marginBottom: 8 }}>DUE SOON</Text>
                {upcoming.map(h => <Card key={h.homework_id} h={h} />)}
              </>
            )}
            {past.length > 0 && (
              <>
                <Text style={{ fontSize: 12, fontWeight: "700", color: t.text3, marginTop: 8, marginBottom: 8 }}>
                  EARLIER · {doneCount}/{past.length} DONE
                </Text>
                {past.map(h => <Card key={h.homework_id} h={h} />)}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
