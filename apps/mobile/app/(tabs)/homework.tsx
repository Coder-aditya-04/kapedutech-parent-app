import { ScrollView, View, ActivityIndicator, RefreshControl } from "react-native";
import { Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { getStudentHomework, istToday, type HomeworkItem, type HomeworkStatus } from "@/src/api/auth";
import { useTheme, ACCENT, GOOD, BAD, WARN } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";

type Student = { id: string; name: string };
type Parent = { students: Student[] };
type Icon = keyof typeof MaterialCommunityIcons.glyphMap;

// Status words come from the homework spec. Every status shows a word and an
// icon, never colour alone, so it reads the same for colour-blind parents.
const STATUS: Record<HomeworkStatus, { label: string; color: string; icon: Icon }> = {
  done: { label: "Done", color: GOOD, icon: "check-circle" },
  partial: { label: "Partly done", color: WARN, icon: "progress-check" },
  not_done: { label: "Not done", color: BAD, icon: "close-circle" },
  pending: { label: "Pending", color: ACCENT, icon: "clock-outline" },
  cancelled: { label: "Cancelled", color: "#64748B", icon: "cancel" },
};

function fmtDay(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

function dueLabel(due: string, today: string) {
  if (due === today) return "Due today";
  const tomorrow = new Date(new Date(today + "T00:00:00").getTime() + 86400000).toLocaleDateString("en-CA");
  if (due === tomorrow) return "Due tomorrow";
  return `Due ${fmtDay(due)}`;
}

function Pill({ label, color, icon }: { label: string; color: string; icon: Icon }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: `${color}18`, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
      <MaterialCommunityIcons name={icon} size={13} color={color} />
      <Text style={{ fontSize: 11, fontWeight: "700", color }}>{label}</Text>
    </View>
  );
}

function HomeworkCard({ h, today }: { h: HomeworkItem; today: string }) {
  const t = useTheme();
  const s = STATUS[h.status] ?? STATUS.pending;
  const cancelled = h.status === "cancelled";
  // Overdue: the due date has passed and nobody has ticked it yet.
  const overdue = !cancelled && h.status === "pending" && h.due_on < today;
  return (
    <View
      style={{
        backgroundColor: t.card, borderRadius: 16, padding: 14, marginBottom: 10,
        borderWidth: 1, borderColor: overdue ? `${BAD}55` : t.cardBorder,
        opacity: cancelled ? 0.65 : 1,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <Text style={{ fontSize: 11, fontWeight: "800", color: ACCENT, letterSpacing: 0.4, flexShrink: 1 }} numberOfLines={1}>
          {h.subject.toUpperCase()}
        </Text>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {overdue && <Pill label="Overdue" color={BAD} icon="alert-circle-outline" />}
          <Pill label={s.label} color={s.color} icon={s.icon} />
        </View>
      </View>
      <Text
        style={{
          fontSize: 15, fontWeight: "700", color: t.text, marginTop: 6,
          textDecorationLine: cancelled ? "line-through" : "none",
        }}
      >
        {h.title}
      </Text>
      {h.details ? <Text style={{ fontSize: 13, color: t.text2, marginTop: 4, lineHeight: 19 }}>{h.details}</Text> : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 }}>
        <MaterialCommunityIcons name="calendar-blank-outline" size={13} color={overdue ? BAD : t.text3} />
        <Text style={{ fontSize: 12, color: overdue ? BAD : t.text3, fontWeight: overdue ? "700" : "400" }}>
          {dueLabel(h.due_on, today)}
        </Text>
        <Text style={{ fontSize: 12, color: t.text3 }}>·</Text>
        <Text style={{ fontSize: 12, color: t.text3, flexShrink: 1 }} numberOfLines={1}>set by {h.set_by}</Text>
      </View>
    </View>
  );
}

function EmptyState({ icon, title, body }: { icon: Icon; title: string; body: string }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: "center", paddingVertical: 48, paddingHorizontal: 24 }}>
      <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: t.accentSoft, alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
        <MaterialCommunityIcons name={icon} size={30} color={ACCENT} />
      </View>
      <Text style={{ fontSize: 16, fontWeight: "700", color: t.text, textAlign: "center" }}>{title}</Text>
      <Text style={{ fontSize: 13, color: t.text3, marginTop: 6, textAlign: "center", lineHeight: 19 }}>{body}</Text>
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  const t = useTheme();
  return (
    <Text style={{ fontSize: 11, fontWeight: "700", color: t.text3, letterSpacing: 0.8, marginTop: 8, marginBottom: 8 }}>
      {children}
    </Text>
  );
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
    } catch {
      setAvailable(false);
    } finally { setLoading(false); setRefreshing(false); }
  }, [activeStudentId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const today = istToday();
  const live = items.filter(h => h.status !== "cancelled");
  const upcoming = live.filter(h => h.due_on >= today).sort((a, b) => a.due_on.localeCompare(b.due_on));
  const past = live.filter(h => h.due_on < today).sort((a, b) => b.due_on.localeCompare(a.due_on));
  const cancelled = items.filter(h => h.status === "cancelled");
  const doneCount = past.filter(h => h.status === "done").length;
  const overdueCount = past.filter(h => h.status === "pending").length;

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={{ color: t.text3, marginTop: 14, fontSize: 14 }}>Loading homework…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={ACCENT} colors={[ACCENT]} />
        }
      >
        <View style={{ paddingVertical: 16 }}>
          <Text style={{ fontSize: 26, fontWeight: "800", color: t.text, letterSpacing: -0.5 }}>Homework</Text>
          <Text style={{ fontSize: 13, color: t.text3, marginTop: 2 }}>
            {studentName ? `${studentName} · ` : ""}last 30 days
          </Text>
        </View>

        {!available ? (
          <EmptyState
            icon="cloud-off-outline"
            title="Couldn't load homework"
            body="Check your internet connection, then pull down to try again."
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon="book-open-page-variant-outline"
            title="No homework yet"
            body="When a teacher sets homework for this batch, it will show up here."
          />
        ) : (
          <>
            {past.length > 0 && (
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
                <View style={{ flex: 1, backgroundColor: t.goodSoft, borderRadius: 12, paddingVertical: 10, alignItems: "center" }}>
                  <Text style={{ fontSize: 20, fontWeight: "800", color: GOOD }}>{doneCount}/{past.length}</Text>
                  <Text style={{ fontSize: 11, color: t.text3, fontWeight: "600", marginTop: 2 }}>Done</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: overdueCount ? t.badSoft : t.neutralSoft, borderRadius: 12, paddingVertical: 10, alignItems: "center" }}>
                  <Text style={{ fontSize: 20, fontWeight: "800", color: overdueCount ? BAD : t.text }}>{overdueCount}</Text>
                  <Text style={{ fontSize: 11, color: t.text3, fontWeight: "600", marginTop: 2 }}>Overdue</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: t.accentSoft, borderRadius: 12, paddingVertical: 10, alignItems: "center" }}>
                  <Text style={{ fontSize: 20, fontWeight: "800", color: ACCENT }}>{upcoming.length}</Text>
                  <Text style={{ fontSize: 11, color: t.text3, fontWeight: "600", marginTop: 2 }}>Due soon</Text>
                </View>
              </View>
            )}
            {upcoming.length > 0 && (
              <>
                <SectionLabel>DUE SOON</SectionLabel>
                {upcoming.map(h => <HomeworkCard key={h.homework_id} h={h} today={today} />)}
              </>
            )}
            {past.length > 0 && (
              <>
                <SectionLabel>EARLIER</SectionLabel>
                {past.map(h => <HomeworkCard key={h.homework_id} h={h} today={today} />)}
              </>
            )}
            {cancelled.length > 0 && (
              <>
                <SectionLabel>CANCELLED</SectionLabel>
                {cancelled.map(h => <HomeworkCard key={h.homework_id} h={h} today={today} />)}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
