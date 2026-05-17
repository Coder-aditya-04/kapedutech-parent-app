import {
  ScrollView, View, RefreshControl, ActivityIndicator,
  TouchableOpacity, Animated, AppState, AppStateStatus, StyleSheet,
} from "react-native";
import { Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/context/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState, useCallback, useRef } from "react";
import { useFocusEffect, router } from "expo-router";
import {
  getStudentAttendance, getTodayAttendance, getAttendanceSummary,
  type AttendanceRecord, type TodayAttendance, type AttendanceSummary,
} from "@/src/api/auth";
import { useTheme, ACCENT, ACCENT_2, GOOD, BAD, WARN, GlassCard as BlurGlassCard, BgBlobs } from "@/src/theme";

type Student = { id: string; name: string; enrollmentNo: string; batch: string };
type Parent = { id: string; name: string; phone: string; students: Student[] };

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning 👋";
  if (h < 17) return "Good afternoon ☀️";
  return "Good evening 🌙";
}
function fmtTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}
function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

function Ring({ pct, size = 110, stroke = 10 }: { pct: number; size?: number; stroke?: number }) {
  const t = useTheme();
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: pct, duration: 1100, useNativeDriver: false }).start();
  }, [pct]);
  const half = size / 2;
  const angle = anim.interpolate({ inputRange: [0, 100], outputRange: [0, 360] });
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View style={{ position: "absolute", width: size, height: size, borderRadius: half, borderWidth: stroke, borderColor: t.neutralSoft }} />
      <View style={{ position: "absolute", width: half, height: size, left: 0, overflow: "hidden" }}>
        <Animated.View style={[{ position: "absolute", left: 0, width: size, height: size, borderRadius: half, borderWidth: stroke, borderColor: ACCENT }, {
          transform: [{ rotate: angle.interpolate({ inputRange: [0, 180, 360], outputRange: ["-180deg", "0deg", "0deg"] }) }],
        }]} />
      </View>
      <View style={{ position: "absolute", left: half, width: half, height: size, overflow: "hidden" }}>
        <Animated.View style={[{ position: "absolute", right: 0, width: size, height: size, borderRadius: half, borderWidth: stroke, borderColor: ACCENT }, {
          transform: [{ rotate: angle.interpolate({ inputRange: [0, 180, 360], outputRange: ["-180deg", "-180deg", "0deg"] }) }],
        }]} />
      </View>
      <View style={{ position: "absolute", top: stroke, left: stroke, width: size - stroke * 2, height: size - stroke * 2, borderRadius: (size - stroke * 2) / 2, backgroundColor: t.card, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 26, fontWeight: "800", color: t.text, letterSpacing: -0.5 }}>{Math.round(pct)}<Text style={{ fontSize: 13, color: t.text3 }}>%</Text></Text>
      </View>
    </View>
  );
}

function Chip({ label, tone }: { label: string; tone: "good" | "accent" | "warn" | "neutral" }) {
  const t = useTheme();
  const map = { good: { bg: t.goodSoft, fg: GOOD }, accent: { bg: t.accentSoft, fg: ACCENT }, warn: { bg: t.warnSoft, fg: WARN }, neutral: { bg: t.neutralSoft, fg: t.text2 } };
  const c = map[tone];
  return (
    <View style={{ backgroundColor: c.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ fontSize: 11, fontWeight: "700", color: c.fg }}>{label}</Text>
    </View>
  );
}

function GlassCard({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <BlurGlassCard intensity={55} style={{ padding: 18, marginBottom: 14, ...(style as object ?? {}) }}>
      {children}
    </BlurGlassCard>
  );
}

export default function DashboardScreen() {
  const { phone, activeStudentId } = useAuth();
  const t = useTheme();
  const [parent, setParent] = useState<Parent | null>(null);
  const [today, setToday] = useState<TodayAttendance>({ punchIn: null, punchOut: null });
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary>({ totalPresent: 0, totalWorkingDays: 0, currentStreak: 0, allTimePct: 0, workingDates: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [raw, token] = await Promise.all([AsyncStorage.getItem("parent"), AsyncStorage.getItem("auth_token")]);
      if (!raw || !token) return;
      const p: Parent = JSON.parse(raw);
      setParent(p);
      const student = (activeStudentId ? p.students?.find(s => s.id === activeStudentId) : null) ?? p.students?.[0];
      if (!student) return;
      const [todayData, hist, summ] = await Promise.all([
        getTodayAttendance(student.id, token),
        getStudentAttendance(student.id, token),
        getAttendanceSummary(student.id, token),
      ]);
      setToday(todayData);
      setHistory(hist);
      setSummary(summ);
    } catch (e) { console.log("[Dashboard] load error:", e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [activeStudentId]);

  useFocusEffect(useCallback(() => {
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, [load]));

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s: AppStateStatus) => { if (s === "active") load(); });
    return () => sub.remove();
  }, [load]);

  const student = parent?.students?.find(s => s.id === activeStudentId) ?? parent?.students?.[0];
  const todayStatus = today.punchIn && today.punchOut ? "complete" : today.punchIn ? "partial" : "none";
  const absent = Math.max(0, summary.totalWorkingDays - summary.totalPresent);

  // Duration
  let duration = "";
  if (today.punchIn && today.punchOut) {
    const mins = Math.round((new Date(today.punchOut).getTime() - new Date(today.punchIn).getTime()) / 60000);
    duration = `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

  // Recent unique-date records
  const recentDays = (() => {
    const seen = new Set<string>();
    const days: AttendanceRecord[] = [];
    for (const r of history) {
      if (!seen.has(r.date)) { seen.add(r.date); days.push(r); }
      if (days.length >= 4) break;
    }
    return days;
  })();

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={{ color: t.text3, marginTop: 14, fontSize: 14 }}>Loading dashboard…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      <BgBlobs />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 4 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={ACCENT} />}
      >
        {/* ─── Header ─── */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, color: t.text3, fontWeight: "500" }}>{getGreeting()}</Text>
            <Text style={{ fontSize: 22, fontWeight: "800", color: t.text, letterSpacing: -0.5, marginTop: 2 }} numberOfLines={1}>
              {parent ? parent.name.split(" ")[0] : "+91 " + phone}
            </Text>
            {student?.batch ? (
              <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
                <View style={{ backgroundColor: t.accentSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: ACCENT }}>{student.batch}</Text>
                </View>
              </View>
            ) : null}
          </View>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/attendance" as never)}
              style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: t.accentSoft, alignItems: "center", justifyContent: "center" }}
              activeOpacity={0.75}
            >
              <MaterialCommunityIcons name="calendar-check" size={22} color={ACCENT} />
            </TouchableOpacity>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: `${ACCENT}22`, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: ACCENT }}>{parent ? initials(parent.name) : "P"}</Text>
            </View>
          </View>
        </View>

        {/* ─── Today's Attendance ─── */}
        <GlassCard>
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, backgroundColor: ACCENT, borderTopLeftRadius: 18, borderTopRightRadius: 18 }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16, marginTop: 4 }}>
            <View>
              <Text style={{ fontSize: 10, fontWeight: "700", color: ACCENT, letterSpacing: 0.8, textTransform: "uppercase" }}>Today's attendance</Text>
              <Text style={{ fontSize: 12, color: t.text3, marginTop: 2 }}>
                {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
              </Text>
            </View>
            <View style={{ backgroundColor: todayStatus === "complete" ? `${GOOD}20` : todayStatus === "partial" ? `${WARN}20` : t.neutralSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, flexDirection: "row", alignItems: "center", gap: 5 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: todayStatus === "complete" ? GOOD : todayStatus === "partial" ? WARN : t.text3 }} />
              <Text style={{ fontSize: 11, fontWeight: "700", color: todayStatus === "complete" ? GOOD : todayStatus === "partial" ? WARN : t.text3 }}>
                {todayStatus === "complete" ? "Complete" : todayStatus === "partial" ? "In session" : "Not marked"}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row" }}>
            <View style={{ flex: 1, alignItems: "center", gap: 4 }}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: t.text3, letterSpacing: 0.5, textTransform: "uppercase" }}>In</Text>
              <Text style={{ fontSize: 32, fontWeight: "800", color: t.text, letterSpacing: -1, fontVariant: ["tabular-nums"] }}>{fmtTime(today.punchIn)}</Text>
              {today.punchIn && <Text style={{ fontSize: 11, fontWeight: "600", color: GOOD }}>Checked in</Text>}
            </View>
            <View style={{ width: 1, backgroundColor: t.divider, marginVertical: 4 }} />
            <View style={{ flex: 1, alignItems: "center", gap: 4 }}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: t.text3, letterSpacing: 0.5, textTransform: "uppercase" }}>Out</Text>
              <Text style={{ fontSize: 32, fontWeight: "800", color: t.text, letterSpacing: -1, fontVariant: ["tabular-nums"] }}>{fmtTime(today.punchOut)}</Text>
              {today.punchOut && <Text style={{ fontSize: 11, fontWeight: "600", color: t.text3 }}>Checked out</Text>}
            </View>
          </View>

          {duration ? (
            <>
              <View style={{ height: 1, backgroundColor: t.divider, marginVertical: 14 }} />
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <MaterialCommunityIcons name="clock-outline" size={16} color={t.text3} />
                  <Text style={{ fontSize: 13, color: t.text2 }}>Total duration</Text>
                </View>
                <Text style={{ fontSize: 15, fontWeight: "700", color: t.text }}>{duration}</Text>
              </View>
            </>
          ) : null}
        </GlassCard>

        {/* ─── Monthly Stats ─── */}
        <GlassCard>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
            <Ring pct={summary.allTimePct} size={108} stroke={10} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: t.text3, letterSpacing: 0.8, textTransform: "uppercase" }}>Overall attendance</Text>
              <Text style={{ fontSize: 18, fontWeight: "700", color: t.text, letterSpacing: -0.3, marginTop: 4 }}>
                {new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
              </Text>
              {summary.currentStreak > 0 && (
                <View style={{ flexDirection: "row", gap: 6, marginTop: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: t.warnSoft, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}>
                    <View style={{ width: 20, height: 20, borderRadius: 6, backgroundColor: WARN, alignItems: "center", justifyContent: "center" }}>
                      <MaterialCommunityIcons name="fire" size={12} color="#fff" />
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: WARN }}>{summary.currentStreak} day streak</Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          <View style={{ height: 1, backgroundColor: t.divider, marginVertical: 14 }} />

          <View style={{ flexDirection: "row", gap: 8 }}>
            {[
              { label: "Present", value: summary.totalPresent, tone: "good" as const },
              { label: "Working", value: summary.totalWorkingDays, tone: "neutral" as const },
              { label: "Streak", value: summary.currentStreak, tone: "accent" as const },
            ].map(s => {
              const map = { good: { fg: GOOD, bg: t.goodSoft }, neutral: { fg: t.text, bg: t.neutralSoft }, accent: { fg: ACCENT, bg: t.accentSoft } };
              const c = map[s.tone];
              return (
                <View key={s.label} style={{ flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12, backgroundColor: c.bg }}>
                  <Text style={{ fontSize: 22, fontWeight: "800", color: c.fg }}>{s.value}</Text>
                  <Text style={{ fontSize: 11, color: t.text3, fontWeight: "600", marginTop: 2 }}>{s.label}</Text>
                </View>
              );
            })}
          </View>
        </GlassCard>

        {/* ─── Results teaser ─── */}
        <TouchableOpacity activeOpacity={0.88} onPress={() => router.push("/(tabs)/results" as never)}>
          <GlassCard style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 14 }}>
            <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: ACCENT_2, alignItems: "center", justifyContent: "center" }}>
              <MaterialCommunityIcons name="trophy" size={24} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: t.text3, fontWeight: "600" }}>Academics</Text>
              <Text style={{ fontSize: 15, fontWeight: "700", color: t.text }}>View test results</Text>
              <Text style={{ fontSize: 12, color: t.text3, marginTop: 2 }}>Scores, ranks & subject breakdown</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={t.text3} />
          </GlassCard>
        </TouchableOpacity>

        {/* ─── Recent Activity ─── */}
        {recentDays.length > 0 && (
          <>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 4, marginBottom: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: t.text }}>Recent activity</Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/notifications" as never)} activeOpacity={0.7}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: ACCENT }}>See all</Text>
              </TouchableOpacity>
            </View>
            <GlassCard style={{ padding: 8 }}>
              {recentDays.map((item, i) => {
                const isIn = item.type === "PUNCH_IN";
                return (
                  <View key={item.id}>
                    {i > 0 && <View style={{ height: 1, backgroundColor: t.divider, marginHorizontal: 4 }} />}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12 }}>
                      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isIn ? t.goodSoft : t.accentSoft, alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name={isIn ? "arrow-up" : "arrow-down"} size={16} color={isIn ? GOOD : ACCENT} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: "600", color: t.text }}>
                          {new Date(item.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                        </Text>
                        <Text style={{ fontSize: 12, color: t.text3 }}>
                          {new Date(item.markedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                        </Text>
                      </View>
                      <View style={{ backgroundColor: isIn ? t.goodSoft : t.accentSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: isIn ? GOOD : ACCENT }}>{isIn ? "In" : "Out"}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </GlassCard>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
