import { ScrollView, View, TouchableOpacity, ActivityIndicator, RefreshControl, Modal } from "react-native";
import { Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { getStudentAttendance, getAttendanceSummary, type AttendanceRecord, type AttendanceSummary } from "@/src/api/auth";
import { useTheme, ACCENT, GOOD, BAD } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";

type Student = { id: string; name: string; enrollmentNo: string; batch: string };
type Parent = { id: string; name: string; phone: string; students: Student[] };
type DayStatus = "present" | "absent" | "late" | "holiday" | "future";
type CalDay = { d: number; status: DayStatus; today?: boolean; dim?: boolean };

function buildCalendar(year: number, month: number, presentDates: Set<string>, workingDatesSet: Set<string>, todayStr: string): CalDay[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: CalDay[] = [];
  for (let i = 0; i < firstDay; i++) days.push({ d: 0, status: "holiday", dim: true });
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const isToday = dateStr === todayStr;
    const isFuture = dateStr > todayStr;
    const isWorkingDay = workingDatesSet.has(dateStr);
    let status: DayStatus = "holiday";
    if (isFuture) status = "future";
    else if (presentDates.has(dateStr)) status = "present";
    else if (isWorkingDay) status = "absent"; // batch had school but student was absent
    else status = "holiday"; // no school that day (weekend/holiday)
    days.push({ d, status, today: isToday });
  }
  return days;
}

function LegendDot({ color, label }: { color: string; label: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color }} />
      <Text style={{ fontSize: 11, fontWeight: "600", color: t.text2 }}>{label}</Text>
    </View>
  );
}

export default function AttendanceScreen() {
  const t = useTheme();
  const { activeStudentId } = useAuth();
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary>({ totalPresent: 0, totalWorkingDays: 0, currentStreak: 0, allTimePct: 0, workingDates: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pickedDay, setPickedDay] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [raw, token] = await Promise.all([AsyncStorage.getItem("parent"), AsyncStorage.getItem("auth_token")]);
      if (!raw || !token) return;
      const p: Parent = JSON.parse(raw);
      const student = (activeStudentId ? p.students?.find(s => s.id === activeStudentId) : null) ?? p.students?.[0];
      if (!student) return;
      const [hist, summ] = await Promise.all([
        getStudentAttendance(student.id, token),
        getAttendanceSummary(student.id, token),
      ]);
      setHistory(hist);
      setSummary(summ);
    } finally { setLoading(false); setRefreshing(false); }
  }, [activeStudentId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const presentDates = new Set(history.filter(r => r.type === "PUNCH_IN").map(r => r.date));
  const workingDatesSet = new Set(summary.workingDates ?? []);
  const days = buildCalendar(year, month, presentDates, workingDatesSet, todayStr);

  // Month stats for current view
  const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthPresent = history.filter(r => r.type === "PUNCH_IN" && r.date.startsWith(monthStr)).length;
  const monthLabel = new Date(year, month).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }
  function nextMonth() {
    const now = new Date();
    if (year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth())) return;
    if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1);
  }

  // Day detail from history
  const pickedRecords = pickedDay ? history.filter(r => r.date === pickedDay) : [];
  const punchIn = pickedRecords.find(r => r.type === "PUNCH_IN");
  const punchOut = pickedRecords.find(r => r.type === "PUNCH_OUT");
  const isPresent = presentDates.has(pickedDay ?? "");

  const recentLog = (() => {
    const seen = new Set<string>();
    return history.filter(r => { if (seen.has(r.date)) return false; seen.add(r.date); return true; }).slice(0, 10);
  })();

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
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, paddingTop: 4 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={ACCENT} />}
      >
        {/* Header */}
        <View style={{ paddingVertical: 16 }}>
          <Text style={{ fontSize: 26, fontWeight: "800", color: t.text, letterSpacing: -0.5 }}>Attendance</Text>
          <Text style={{ fontSize: 13, color: t.text3, marginTop: 2 }}>{monthLabel}</Text>
        </View>

        {/* Progress bar card */}
        <View style={{ backgroundColor: t.card, borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: t.cardBorder, shadowColor: t.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 3 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <View>
              <Text style={{ fontSize: 10, fontWeight: "700", color: t.text3, textTransform: "uppercase", letterSpacing: 0.8 }}>This month</Text>
              <Text style={{ fontSize: 28, fontWeight: "800", color: t.text, letterSpacing: -0.5, marginTop: 4 }}>
                {summary.allTimePct}<Text style={{ fontSize: 16, color: t.text3 }}>%</Text>
              </Text>
            </View>
            <View style={{ backgroundColor: `${GOOD}20`, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons name="arrow-up" size={12} color={GOOD} />
              <Text style={{ fontSize: 12, fontWeight: "700", color: GOOD }}>{monthPresent} days</Text>
            </View>
          </View>
          <View style={{ height: 8, backgroundColor: t.neutralSoft, borderRadius: 8, overflow: "hidden" }}>
            <View style={{ height: 8, width: `${summary.allTimePct}%`, backgroundColor: ACCENT, borderRadius: 8 }} />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
            <Text style={{ fontSize: 11, color: t.text3, fontWeight: "600" }}>{summary.totalPresent} of {summary.totalWorkingDays} working days</Text>
            <Text style={{ fontSize: 11, color: t.text3, fontWeight: "600" }}>Target 95%</Text>
          </View>
        </View>

        {/* Calendar */}
        <View style={{ backgroundColor: t.card, borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: t.cardBorder, shadowColor: t.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 3 }}>
          {/* Month nav */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <View>
              <Text style={{ fontSize: 17, fontWeight: "700", color: t.text, letterSpacing: -0.3 }}>{monthLabel}</Text>
              <Text style={{ fontSize: 12, color: t.text3, marginTop: 2 }}>{monthPresent} present • {summary.currentStreak} streak</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <TouchableOpacity onPress={prevMonth} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: t.neutralSoft, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="chevron-back" size={16} color={t.text2} />
              </TouchableOpacity>
              <TouchableOpacity onPress={nextMonth} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: t.neutralSoft, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="chevron-forward" size={16} color={t.text2} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Day headers */}
          <View style={{ flexDirection: "row", marginBottom: 6 }}>
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <View key={i} style={{ flex: 1, alignItems: "center" }}>
                <Text style={{ fontSize: 10, fontWeight: "700", color: t.text3, letterSpacing: 0.5 }}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Calendar grid */}
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {days.map((day, i) => {
              if (day.dim || day.d === 0) return <View key={i} style={{ width: "14.28%", aspectRatio: 1 }} />;
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day.d).padStart(2, "0")}`;
              const cellBg = day.today ? ACCENT
                : day.status === "present" ? `${GOOD}20`
                : day.status === "absent" ? `${BAD}18`
                : "transparent";
              const cellColor = day.today ? "#fff"
                : day.status === "present" ? GOOD
                : day.status === "absent" ? BAD
                : day.status === "future" ? t.text3
                : t.text3;
              const tappable = day.status === "present" || day.status === "absent";
              return (
                <TouchableOpacity
                  key={i}
                  disabled={!tappable}
                  onPress={() => setPickedDay(dateStr)}
                  style={{ width: "14.28%", aspectRatio: 1, alignItems: "center", justifyContent: "center", padding: 2 }}
                  activeOpacity={0.75}
                >
                  <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: cellBg, alignItems: "center", justifyContent: "center", ...(day.today ? {} : day.status === "present" ? {} : {}) }}>
                    <Text style={{ fontSize: 13, fontWeight: day.today ? "800" : "600", color: cellColor }}>{day.d}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ height: 1, backgroundColor: t.divider, marginVertical: 14 }} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
            <LegendDot color={GOOD} label="Present" />
            <LegendDot color={BAD} label="Absent" />
            <LegendDot color={ACCENT} label="Today" />
            <LegendDot color={t.text3} label="Holiday / weekend" />
          </View>
          <Text style={{ fontSize: 11, color: t.text3, marginTop: 8, textAlign: "center" }}>Tap any day to see punch in/out time</Text>
        </View>

        {/* Recent log */}
        {recentLog.length > 0 && (
          <>
            <View style={{ paddingHorizontal: 4, marginBottom: 10 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: t.text }}>Recent activity</Text>
            </View>
            <View style={{ backgroundColor: t.card, borderRadius: 18, padding: 8, borderWidth: 1, borderColor: t.cardBorder }}>
              {recentLog.map((r, i) => {
                const punchInR = history.find(h => h.date === r.date && h.type === "PUNCH_IN");
                const punchOutR = history.find(h => h.date === r.date && h.type === "PUNCH_OUT");
                return (
                  <View key={r.id}>
                    {i > 0 && <View style={{ height: 1, backgroundColor: t.divider, marginHorizontal: 4 }} />}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12 }}>
                      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${GOOD}20`, alignItems: "center", justifyContent: "center" }}>
                        <MaterialCommunityIcons name="check" size={18} color={GOOD} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: "600", color: t.text }}>
                          {new Date(r.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                        </Text>
                        <Text style={{ fontSize: 12, color: t.text3 }}>
                          {punchInR ? `In ${new Date(punchInR.markedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}` : ""}
                          {punchOutR ? ` • Out ${new Date(punchOutR.markedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}` : ""}
                        </Text>
                      </View>
                      {punchInR && punchOutR && (() => {
                        const mins = Math.round((new Date(punchOutR.markedAt).getTime() - new Date(punchInR.markedAt).getTime()) / 60000);
                        return <Text style={{ fontSize: 13, fontWeight: "700", color: t.text }}>{Math.floor(mins / 60)}h {mins % 60}m</Text>;
                      })()}
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      {/* Day detail sheet */}
      <Modal visible={!!pickedDay} transparent animationType="slide" onRequestClose={() => setPickedDay(null)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} activeOpacity={1} onPress={() => setPickedDay(null)}>
          <View style={{ flex: 1 }} />
          <TouchableOpacity activeOpacity={1} style={{ backgroundColor: t.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: 40 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: t.text3, opacity: 0.4, alignSelf: "center", marginBottom: 16 }} />
            {pickedDay && (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 14 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: isPresent ? `${GOOD}20` : `${BAD}20`, alignItems: "center", justifyContent: "center" }}>
                    <MaterialCommunityIcons name={isPresent ? "check" : "close"} size={22} color={isPresent ? GOOD : BAD} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 18, fontWeight: "800", color: t.text, letterSpacing: -0.3 }}>{isPresent ? "Present" : "Absent"}</Text>
                    <Text style={{ fontSize: 12, color: t.text3 }}>
                      {new Date(pickedDay + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                    </Text>
                  </View>
                  <View style={{ backgroundColor: isPresent ? `${GOOD}20` : `${BAD}20`, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: isPresent ? GOOD : BAD }}>{isPresent ? "Present" : "Absent"}</Text>
                  </View>
                </View>

                {(punchIn || punchOut) && (
                  <View style={{ backgroundColor: t.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: t.cardBorder }}>
                    <View style={{ flexDirection: "row" }}>
                      <View style={{ flex: 1, alignItems: "center", gap: 4 }}>
                        <Text style={{ fontSize: 10, fontWeight: "700", color: t.text3, textTransform: "uppercase", letterSpacing: 0.5 }}>Punch in</Text>
                        <Text style={{ fontSize: 30, fontWeight: "800", color: t.text, letterSpacing: -1 }}>
                          {punchIn ? new Date(punchIn.markedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : "—"}
                        </Text>
                      </View>
                      <View style={{ width: 1, backgroundColor: t.divider, marginVertical: 4 }} />
                      <View style={{ flex: 1, alignItems: "center", gap: 4 }}>
                        <Text style={{ fontSize: 10, fontWeight: "700", color: t.text3, textTransform: "uppercase", letterSpacing: 0.5 }}>Punch out</Text>
                        <Text style={{ fontSize: 30, fontWeight: "800", color: t.text, letterSpacing: -1 }}>
                          {punchOut ? new Date(punchOut.markedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : "—"}
                        </Text>
                      </View>
                    </View>
                    {punchIn && punchOut && (
                      <>
                        <View style={{ height: 1, backgroundColor: t.divider, marginVertical: 12 }} />
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <MaterialCommunityIcons name="clock-outline" size={16} color={t.text3} />
                            <Text style={{ fontSize: 13, color: t.text2 }}>Total duration</Text>
                          </View>
                          <Text style={{ fontSize: 15, fontWeight: "700", color: t.text }}>
                            {(() => { const m = Math.round((new Date(punchOut.markedAt).getTime() - new Date(punchIn.markedAt).getTime()) / 60000); return `${Math.floor(m / 60)}h ${m % 60}m`; })()}
                          </Text>
                        </View>
                      </>
                    )}
                  </View>
                )}

                <TouchableOpacity onPress={() => setPickedDay(null)} style={{ backgroundColor: t.neutralSoft, borderRadius: 14, paddingVertical: 14, alignItems: "center" }}>
                  <Text style={{ fontSize: 15, fontWeight: "600", color: t.text }}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
