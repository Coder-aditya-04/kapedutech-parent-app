import { ScrollView, StyleSheet, View, TouchableOpacity, ActivityIndicator } from "react-native";
import { Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getStudentAttendance, getTodayAttendance, getAttendanceSummary,
  type AttendanceRecord, type TodayAttendance, type AttendanceSummary,
} from "@/src/api/auth";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const WEEK_LABELS = ["S","M","T","W","T","F","S"];

function getMonthGrid(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

export default function AttendanceCalendarScreen() {
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [today, setToday] = useState<TodayAttendance>({ punchIn: null, punchOut: null });
  const [summary, setSummary] = useState<AttendanceSummary>({ totalPresent: 0, totalWorkingDays: 0, currentStreak: 0, allTimePct: 0, workingDates: [] });
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const now = new Date();
  const [calMonth, setCalMonth] = useState({ year: now.getFullYear(), month: now.getMonth() });

  const todayStr = now.toISOString().slice(0, 10);

  useEffect(() => {
    (async () => {
      try {
        const [raw, token] = await Promise.all([AsyncStorage.getItem("parent"), AsyncStorage.getItem("auth_token")]);
        if (!raw || !token) return;
        const p = JSON.parse(raw);
        const student = p.students?.[0];
        if (!student) return;
        const [hist, tod, summ] = await Promise.all([
          getStudentAttendance(student.id, token),
          getTodayAttendance(student.id, token),
          getAttendanceSummary(student.id, token),
        ]);
        setHistory(hist);
        setToday(tod);
        setSummary(summ);
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  const attendanceMap = useMemo(() => {
    const map: Record<string, { punchIn: string | null; punchOut: string | null }> = {};
    history.forEach(r => {
      if (!map[r.date]) map[r.date] = { punchIn: null, punchOut: null };
      if (r.type === "PUNCH_IN") map[r.date].punchIn = r.markedAt;
      if (r.type === "PUNCH_OUT") map[r.date].punchOut = r.markedAt;
    });
    if (today.punchIn || today.punchOut) map[todayStr] = { punchIn: today.punchIn, punchOut: today.punchOut };
    return map;
  }, [history, today, todayStr]);

  const isCurrentMonth = calMonth.year === now.getFullYear() && calMonth.month === now.getMonth();
  const monthGrid = getMonthGrid(calMonth.year, calMonth.month);
  const selectedAttendance = selectedDate ? (attendanceMap[selectedDate] ?? null) : null;

  const monthPrefix = `${calMonth.year}-${String(calMonth.month + 1).padStart(2, "0")}`;
  const monthPresent = Object.keys(attendanceMap).filter(d => d.startsWith(monthPrefix)).length;

  // Year summary — group all attendance by month
  const yearPresent = Object.keys(attendanceMap).filter(d => d.startsWith(`${calMonth.year}-`)).length;

  function prevMonth() {
    setCalMonth(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { year: p.year, month: p.month - 1 });
    setSelectedDate(null);
  }
  function nextMonth() {
    if (isCurrentMonth) return;
    setCalMonth(p => p.month === 11 ? { year: p.year + 1, month: 0 } : { year: p.year, month: p.month + 1 });
    setSelectedDate(null);
  }

  // Status color only used for the text label, not the ring
  const pctColor = summary.allTimePct >= 75 ? "#059669" : summary.allTimePct >= 50 ? "#D97706" : "#EF4444";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F0F2F8" }} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Attendance Calendar</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          {/* Year summary strip */}
          <View style={styles.yearStrip}>
            <View style={styles.yearStripItem}>
              <Text style={styles.yearStripNum}>{calMonth.year}</Text>
              <Text style={styles.yearStripLbl}>Year</Text>
            </View>
            <View style={styles.yearStripDiv} />
            <View style={styles.yearStripItem}>
              <Text style={[styles.yearStripNum, { color: "#059669" }]}>{yearPresent}</Text>
              <Text style={styles.yearStripLbl}>Days Present</Text>
            </View>
            <View style={styles.yearStripDiv} />
            <View style={styles.yearStripItem}>
              <Text style={[styles.yearStripNum, { color: pctColor }]}>{summary.allTimePct}%</Text>
              <Text style={styles.yearStripLbl}>Overall</Text>
            </View>
            <View style={styles.yearStripDiv} />
            <View style={styles.yearStripItem}>
              <Text style={[styles.yearStripNum, { color: "#D97706" }]}>{summary.currentStreak}</Text>
              <Text style={styles.yearStripLbl}>🔥 Streak</Text>
            </View>
          </View>

          {/* Calendar card */}
          <View style={styles.card}>
            {/* Month navigation */}
            <View style={styles.calTopBar}>
              <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
                <Ionicons name="chevron-back" size={18} color="#4F46E5" />
              </TouchableOpacity>
              <View style={{ alignItems: "center" }}>
                <Text style={styles.monthTitle}>{MONTH_NAMES[calMonth.month]} {calMonth.year}</Text>
                <Text style={styles.monthSub}>{monthPresent} day{monthPresent !== 1 ? "s" : ""} present this month</Text>
              </View>
              <TouchableOpacity onPress={nextMonth} style={[styles.navBtn, isCurrentMonth && styles.navBtnDim]} disabled={isCurrentMonth}>
                <Ionicons name="chevron-forward" size={18} color={isCurrentMonth ? "#CBD5E1" : "#4F46E5"} />
              </TouchableOpacity>
            </View>

            {/* Week day labels */}
            <View style={styles.weekLabels}>
              {WEEK_LABELS.map((l, i) => (
                <Text key={i} style={styles.weekLabel}>{l}</Text>
              ))}
            </View>

            {/* Grid */}
            <View style={styles.calGrid}>
              {monthGrid.map((day, idx) => {
                if (!day) return <View key={idx} style={styles.calCell} />;
                const dateStr = toDateStr(calMonth.year, calMonth.month, day);
                const isPresent = !!attendanceMap[dateStr];
                const isToday = dateStr === todayStr;
                const isFuture = dateStr > todayStr;
                const isAbsent = dateStr < todayStr && !isPresent;
                const isSelected = selectedDate === dateStr;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.calCell, styles.calDay,
                      isSelected && styles.calSelected,
                      !isSelected && isToday && styles.calToday,
                      !isSelected && !isToday && isPresent && styles.calPresent,
                      !isSelected && !isToday && isAbsent && styles.calAbsent,
                      isFuture && styles.calFuture,
                    ]}
                    onPress={() => { if (!isFuture) setSelectedDate(isSelected ? null : dateStr); }}
                    disabled={isFuture}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.calDayText,
                      (isSelected || isToday) && { color: "#fff", fontWeight: "700" },
                      !isSelected && !isToday && isPresent && { color: "#15803D", fontWeight: "700" },
                      !isSelected && !isToday && isAbsent && { color: "#EF4444" },
                      isFuture && { color: "#CBD5E1" },
                    ]}>{day}</Text>
                    {isPresent && !isSelected && !isToday && <View style={[styles.calDot, { backgroundColor: "#16A34A" }]} />}
                    {isAbsent && !isSelected && <View style={[styles.calDot, { backgroundColor: "#EF4444" }]} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Legend */}
            <View style={styles.legend}>
              {[
                { bg: "#DCFCE7", border: "#16A34A", label: "Present" },
                { bg: "#FEE2E2", border: "#EF4444", label: "Absent" },
                { bg: "#4F46E5", border: "#4F46E5", label: "Today" },
              ].map(item => (
                <View key={item.label} style={styles.legendItem}>
                  <View style={[styles.legendSwatch, { backgroundColor: item.bg, borderColor: item.border }]} />
                  <Text style={styles.legendLbl}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Selected date detail */}
          {selectedDate && (
            <View style={styles.card}>
              <Text style={styles.detailDate}>
                {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", {
                  weekday: "long", day: "numeric", month: "long", year: "numeric",
                })}
              </Text>
              {selectedAttendance ? (
                <View style={styles.detailRow}>
                  <View style={styles.detailBox}>
                    <View style={[styles.detailIcon, { backgroundColor: "#DCFCE7" }]}>
                      <Ionicons name="arrow-up-circle" size={24} color="#16A34A" />
                    </View>
                    <Text style={styles.detailLbl}>Punch In</Text>
                    <Text style={[styles.detailTime, { color: selectedAttendance.punchIn ? "#059669" : "#94A3B8" }]}>
                      {formatTime(selectedAttendance.punchIn)}
                    </Text>
                  </View>
                  <View style={styles.detailSep} />
                  <View style={styles.detailBox}>
                    <View style={[styles.detailIcon, { backgroundColor: "#DBEAFE" }]}>
                      <Ionicons name="arrow-down-circle" size={24} color="#2563EB" />
                    </View>
                    <Text style={styles.detailLbl}>Punch Out</Text>
                    <Text style={[styles.detailTime, { color: selectedAttendance.punchOut ? "#2563EB" : "#94A3B8" }]}>
                      {formatTime(selectedAttendance.punchOut)}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.absentBox}>
                  <View style={styles.absentIcon}>
                    <Ionicons name="close-circle-outline" size={30} color="#EF4444" />
                  </View>
                  <Text style={styles.absentTitle}>Absent</Text>
                  <Text style={styles.absentSub}>No attendance recorded for this day</Text>
                </View>
              )}
            </View>
          )}

          {/* All-time stats card */}
          <View style={styles.card}>
            <Text style={[styles.cardTitle, { marginBottom: 16 }]}>All-Time Summary</Text>
            <View style={styles.allTimeRow}>
              {[
                { label: "Total Working Days", value: summary.totalWorkingDays, color: "#0F172A" },
                { label: "Days Present", value: summary.totalPresent, color: "#059669" },
                { label: "Days Absent", value: Math.max(0, summary.totalWorkingDays - summary.totalPresent), color: "#EF4444" },
                { label: "Attendance %", value: `${summary.allTimePct}%`, color: pctColor },
              ].map((item, i) => (
                <View key={i} style={styles.allTimeItem}>
                  <Text style={[styles.allTimeNum, { color: item.color }]}>{item.value}</Text>
                  <Text style={styles.allTimeLbl}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>

        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1, borderBottomColor: "#F1F5F9",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#F1F5F9", justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  scroll: { padding: 16, gap: 14, paddingBottom: 48 },

  // Year strip
  yearStrip: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 16, flexDirection: "row", alignItems: "center", shadowColor: "#3730A3", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 },
  yearStripItem: { flex: 1, alignItems: "center", gap: 3 },
  yearStripDiv: { width: 1, height: 32, backgroundColor: "#E2E8F0" },
  yearStripNum: { fontSize: 20, fontWeight: "800", color: "#0F172A" },
  yearStripLbl: { fontSize: 10, color: "#94A3B8", fontWeight: "500" },

  card: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 18, shadowColor: "#3730A3", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#0F172A" },

  calTopBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  navBtn: { width: 36, height: 36, borderRadius: 11, backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center" },
  navBtnDim: { backgroundColor: "#F1F5F9" },
  monthTitle: { fontSize: 17, fontWeight: "800", color: "#0F172A" },
  monthSub: { fontSize: 12, color: "#94A3B8", marginTop: 3 },

  weekLabels: { flexDirection: "row", marginBottom: 6 },
  weekLabel: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "700", color: "#94A3B8", paddingVertical: 4 },

  calGrid: { flexDirection: "row", flexWrap: "wrap" },
  calCell: { width: "14.2857%", aspectRatio: 1, justifyContent: "center", alignItems: "center" },
  calDay: { borderRadius: 10 },
  calSelected: { backgroundColor: "#4F46E5" },
  calToday: { backgroundColor: "#4F46E5" },
  calPresent: { backgroundColor: "#DCFCE7" },
  calAbsent: { backgroundColor: "#FEE2E2" },
  calFuture: { opacity: 0.3 },
  calDayText: { fontSize: 13, color: "#374151" },
  calDot: { width: 4, height: 4, borderRadius: 2, position: "absolute", bottom: 3 },

  legend: { flexDirection: "row", justifyContent: "center", gap: 18, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendSwatch: { width: 12, height: 12, borderRadius: 4, borderWidth: 1.5 },
  legendLbl: { fontSize: 11, color: "#64748B", fontWeight: "500" },

  // Selected date detail
  detailDate: { fontSize: 14, fontWeight: "700", color: "#0F172A", textAlign: "center", marginBottom: 20 },
  detailRow: { flexDirection: "row", alignItems: "center" },
  detailBox: { flex: 1, alignItems: "center", gap: 8, paddingVertical: 8 },
  detailSep: { width: 1, height: 80, backgroundColor: "#E2E8F0" },
  detailIcon: { width: 52, height: 52, borderRadius: 17, justifyContent: "center", alignItems: "center" },
  detailLbl: { fontSize: 12, color: "#64748B", fontWeight: "500" },
  detailTime: { fontSize: 20, fontWeight: "800", letterSpacing: -0.5 },
  absentBox: { alignItems: "center", paddingVertical: 12, gap: 6 },
  absentIcon: { width: 60, height: 60, borderRadius: 20, backgroundColor: "#FEE2E2", justifyContent: "center", alignItems: "center", marginBottom: 4 },
  absentTitle: { fontSize: 15, fontWeight: "700", color: "#EF4444" },
  absentSub: { fontSize: 12, color: "#94A3B8" },

  // All-time stats
  allTimeRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  allTimeItem: { width: "47%", backgroundColor: "#F8FAFC", borderRadius: 14, padding: 14, gap: 4 },
  allTimeNum: { fontSize: 24, fontWeight: "800" },
  allTimeLbl: { fontSize: 11, color: "#94A3B8", lineHeight: 15 },
});
