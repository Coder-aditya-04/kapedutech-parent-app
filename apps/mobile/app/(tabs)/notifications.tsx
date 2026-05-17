"use client";
import { ScrollView, View, TouchableOpacity } from "react-native";
import { Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { useTheme, ACCENT, ACCENT_2, GOOD } from "@/src/theme";
import { getStudentAttendance, type AttendanceRecord } from "@/src/api/auth";
import { useAuth } from "@/src/context/AuthContext";

type StoredNotification = { id: string; title: string; body: string; time: string; read: boolean };

function fmtRel(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  return { date, time };
}

type NotifKind = "punch_in" | "punch_out" | "result" | "general";

function classifyNotif(n: StoredNotification): NotifKind {
  const b = (n.body + n.title).toLowerCase();
  if (b.includes("punch in") || b.includes("punched in") || b.includes("check in") || b.includes("checked in"))
    return "punch_in";
  if (b.includes("punch out") || b.includes("punched out") || b.includes("check out") || b.includes("checked out"))
    return "punch_out";
  if (b.includes("result") || b.includes("test") || b.includes("score") || b.includes("rank"))
    return "result";
  return "general";
}

function NotifIcon({ kind, read }: { kind: NotifKind; read: boolean }) {
  const t = useTheme();
  const opacity = read ? 0.55 : 1;
  if (kind === "punch_in") return (
    <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: `${GOOD}18`, alignItems: "center", justifyContent: "center", opacity }}>
      <MaterialCommunityIcons name="arrow-up-bold" size={22} color={GOOD} />
    </View>
  );
  if (kind === "punch_out") return (
    <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: `${ACCENT}18`, alignItems: "center", justifyContent: "center", opacity }}>
      <MaterialCommunityIcons name="arrow-down-bold" size={22} color={ACCENT} />
    </View>
  );
  if (kind === "result") return (
    <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: `${ACCENT_2}18`, alignItems: "center", justifyContent: "center", opacity }}>
      <MaterialCommunityIcons name="chart-bar" size={20} color={ACCENT_2} />
    </View>
  );
  return (
    <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: t.neutralSoft, alignItems: "center", justifyContent: "center", opacity }}>
      <MaterialCommunityIcons name="bell-outline" size={20} color={t.text3} />
    </View>
  );
}

function Badge({ kind }: { kind: NotifKind }) {
  if (kind === "punch_in") return (
    <View style={{ backgroundColor: `${GOOD}18`, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text style={{ fontSize: 11, fontWeight: "700", color: GOOD }}>In</Text>
    </View>
  );
  if (kind === "punch_out") return (
    <View style={{ backgroundColor: `${ACCENT}18`, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text style={{ fontSize: 11, fontWeight: "700", color: ACCENT }}>Out</Text>
    </View>
  );
  return null;
}

function attendanceToNotif(r: AttendanceRecord, studentName: string): StoredNotification {
  const isIn = r.type === "PUNCH_IN";
  const timeStr = new Date(r.markedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  return {
    id: `att-${r.id}`,
    title: isIn ? "Punch In" : "Punch Out",
    body: `${studentName} ${isIn ? "checked in" : "checked out"} at ${timeStr}`,
    time: r.markedAt,
    read: true,
  };
}

export default function NotificationsScreen() {
  const t = useTheme();
  const { activeStudentId } = useAuth();
  const [items, setItems] = useState<StoredNotification[]>([]);
  const [filter, setFilter] = useState<"all" | "attendance" | "results">("all");

  const load = useCallback(async () => {
    try {
      const [raw, parentRaw, token] = await Promise.all([
        AsyncStorage.getItem("notifications"),
        AsyncStorage.getItem("parent"),
        AsyncStorage.getItem("auth_token"),
      ]);

      const stored: StoredNotification[] = raw ? JSON.parse(raw) : [];

      let attendanceNotifs: StoredNotification[] = [];
      if (parentRaw && token) {
        const parent = JSON.parse(parentRaw);
        const student = (activeStudentId ? parent.students?.find((s: { id: string }) => s.id === activeStudentId) : null) ?? parent.students?.[0];
        if (student) {
          const records = await getStudentAttendance(student.id, token);
          const storedIds = new Set(stored.map((n) => n.id));
          attendanceNotifs = records
            .slice(0, 40)
            .map((r) => attendanceToNotif(r, student.name))
            .filter((n) => !storedIds.has(n.id));
        }
      }

      const merged = [...stored, ...attendanceNotifs].sort(
        (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
      );
      setItems(merged);
    } catch {}
  }, [activeStudentId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function markAllRead() {
    const updated = items.map(n => ({ ...n, read: true }));
    setItems(updated);
    // Only persist push notifications — attendance records (att-*) are always re-fetched from API
    const toPersist = updated.filter(n => !n.id.startsWith("att-")).slice(0, 50);
    await AsyncStorage.setItem("notifications", JSON.stringify(toPersist));
  }

  const filtered = items.filter(n => {
    if (!n.body?.trim()) return false; // hide empty/system notifications
    if (filter === "all") return true;
    const kind = classifyNotif(n);
    if (filter === "attendance") return kind === "punch_in" || kind === "punch_out";
    if (filter === "results") return kind === "result";
    return true;
  });

  const unread = filtered.filter(n => !n.read);
  const read = filtered.filter(n => n.read);

  function renderItem(n: StoredNotification, i: number, arr: StoredNotification[]) {
    const kind = classifyNotif(n);
    const { date, time } = fmtDateTime(n.time);
    const isLast = i === arr.length - 1;
    return (
      <View key={n.id}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 4 }}>
          <NotifIcon kind={kind} read={n.read} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <Text
                style={{ fontSize: 13, fontWeight: n.read ? "500" : "700", color: n.read ? t.text2 : t.text, flex: 1 }}
                numberOfLines={1}
              >
                {n.title || "KAP Edutech"}
              </Text>
              {!n.read && <View style={{ width: 7, height: 7, borderRadius: 99, backgroundColor: ACCENT, flexShrink: 0 }} />}
            </View>
            <Text style={{ fontSize: 12, color: t.text3, marginTop: 2 }} numberOfLines={2}>{n.body}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: "600", color: t.text3 }}>{date}</Text>
                <Text style={{ fontSize: 11, color: t.text3 }}>·</Text>
                <Text style={{ fontSize: 11, fontWeight: "600", color: t.text3 }}>{time}</Text>
                <Text style={{ fontSize: 11, color: t.text3 }}>·</Text>
                <Text style={{ fontSize: 11, color: t.text3 }}>{fmtRel(n.time)}</Text>
              </View>
              <Badge kind={kind} />
            </View>
          </View>
        </View>
        {!isLast && <View style={{ height: 1, backgroundColor: t.divider }} />}
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 16 }}>
          <View>
            <Text style={{ fontSize: 26, fontWeight: "800", color: t.text, letterSpacing: -0.5 }}>Alerts</Text>
            <Text style={{ fontSize: 13, color: t.text3, marginTop: 2 }}>
              {unread.length > 0 ? `${unread.length} unread` : "All caught up"}
            </Text>
          </View>
          {unread.length > 0 && (
            <TouchableOpacity
              onPress={markAllRead}
              style={{ backgroundColor: t.card, borderRadius: 12, borderWidth: 1, borderColor: t.cardBorder, paddingHorizontal: 14, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <MaterialCommunityIcons name="check-all" size={15} color={ACCENT} />
              <Text style={{ fontSize: 12, fontWeight: "700", color: ACCENT }}>Mark read</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filter tabs */}
        <View style={{ flexDirection: "row", backgroundColor: t.neutralSoft, borderRadius: 14, padding: 4, gap: 4, marginBottom: 16 }}>
          {(["all", "attendance", "results"] as const).map(f => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              style={{ flex: 1, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: filter === f ? t.card : "transparent" }}
            >
              <Text style={{ fontSize: 12, fontWeight: "600", color: filter === f ? t.text : t.text3, textTransform: "capitalize" }}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {filtered.length === 0 ? (
          <View style={{ backgroundColor: t.card, borderRadius: 20, padding: 40, alignItems: "center", borderWidth: 1, borderColor: t.cardBorder, marginTop: 8 }}>
            <MaterialCommunityIcons name="bell-sleep-outline" size={44} color={t.text3} />
            <Text style={{ fontSize: 16, fontWeight: "700", color: t.text, marginTop: 14 }}>No alerts yet</Text>
            <Text style={{ fontSize: 13, color: t.text3, marginTop: 4, textAlign: "center" }}>
              Punch in/out notifications{"\n"}will appear here
            </Text>
          </View>
        ) : (
          <>
            {unread.length > 0 && (
              <View style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 10, fontWeight: "700", color: t.text3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>New</Text>
                <View style={{ backgroundColor: t.card, borderRadius: 18, paddingHorizontal: 12, borderWidth: 1, borderColor: t.cardBorder, shadowColor: t.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 2 }}>
                  {unread.map((n, i) => renderItem(n, i, unread))}
                </View>
              </View>
            )}

            {read.length > 0 && (
              <View>
                <Text style={{ fontSize: 10, fontWeight: "700", color: t.text3, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Earlier</Text>
                <View style={{ backgroundColor: t.card, borderRadius: 18, paddingHorizontal: 12, borderWidth: 1, borderColor: t.cardBorder }}>
                  {read.map((n, i) => renderItem(n, i, read))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
