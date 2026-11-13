import { ScrollView, View, ActivityIndicator, RefreshControl, TouchableOpacity } from "react-native";
import { Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { getStudentFees, istToday, type FeeAccount } from "@/src/api/auth";
import { useTheme, ACCENT, GOOD, BAD } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";

type Student = { id: string; name: string };
type Parent = { students: Student[] };
type Icon = keyof typeof MaterialCommunityIcons.glyphMap;

// Indian grouping (₹1,25,000), whole rupees unless there are paise.
function rupees(n: number) {
  const neg = n < 0;
  const abs = Math.abs(n);
  const [whole, paise] = abs.toFixed(2).split(".");
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  const grouped = rest ? `${rest},${last3}` : last3;
  return `${neg ? "−" : ""}₹${grouped}${paise !== "00" ? "." + paise : ""}`;
}

function fmtDay(d: string) {
  // Built from the parts so the device time zone can't move it a day.
  const [y, m, day] = d.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${day} ${months[m - 1]} ${y}`;
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

function AccountCard({ a, today, showProgram }: { a: FeeAccount; today: string; showProgram: boolean }) {
  const t = useTheme();
  const settled = a.balance <= 0;
  const overdue = !settled && !!a.nextDueDate && a.nextDueDate < today;
  const paidPct = a.totalFee > 0 ? Math.min(100, Math.max(0, (a.paid / a.totalFee) * 100)) : 0;
  const tone = settled ? GOOD : overdue ? BAD : ACCENT;

  return (
    <View style={{ backgroundColor: t.card, borderRadius: 18, borderWidth: 1, borderColor: overdue ? `${BAD}55` : t.cardBorder, marginBottom: 14, overflow: "hidden" }}>
      <View style={{ height: 3, backgroundColor: tone }} />
      <View style={{ padding: 16 }}>
        {showProgram || a.rollNumber ? (
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: t.text, flexShrink: 1 }} numberOfLines={1}>{a.program}</Text>
            {a.rollNumber ? <Text style={{ fontSize: 11, color: t.text3 }}>Roll {a.rollNumber}</Text> : null}
          </View>
        ) : null}

        <Text style={{ fontSize: 10, fontWeight: "700", color: t.text3, letterSpacing: 0.8, textTransform: "uppercase" }}>
          {settled ? "Fees" : "Balance due"}
        </Text>
        <Text style={{ fontSize: 32, fontWeight: "800", color: settled ? GOOD : t.text, letterSpacing: -1, marginTop: 2, fontVariant: ["tabular-nums"] }}>
          {settled ? "Fully paid" : rupees(a.balance)}
        </Text>

        {!settled && a.nextDueDate ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: 8, backgroundColor: overdue ? t.badSoft : t.accentSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
            <MaterialCommunityIcons name={overdue ? "alert-circle-outline" : "calendar-clock"} size={14} color={overdue ? BAD : ACCENT} />
            <Text style={{ fontSize: 12, fontWeight: "700", color: overdue ? BAD : ACCENT }}>
              {overdue ? `Overdue since ${fmtDay(a.nextDueDate)}` : a.nextDueDate === today ? "Due today" : `Next due ${fmtDay(a.nextDueDate)}`}
            </Text>
          </View>
        ) : null}

        <View style={{ height: 8, backgroundColor: t.neutralSoft, borderRadius: 6, overflow: "hidden", marginTop: 16 }}>
          <View style={{ width: `${paidPct}%`, height: 8, borderRadius: 6, backgroundColor: settled ? GOOD : ACCENT }} />
        </View>
        <View style={{ flexDirection: "row", marginTop: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: t.text3, fontWeight: "600" }}>Total fee</Text>
            <Text style={{ fontSize: 15, fontWeight: "700", color: t.text, marginTop: 2, fontVariant: ["tabular-nums"] }}>{rupees(a.totalFee)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: t.text3, fontWeight: "600" }}>Paid so far</Text>
            <Text style={{ fontSize: 15, fontWeight: "700", color: GOOD, marginTop: 2, fontVariant: ["tabular-nums"] }}>{rupees(a.paid)}</Text>
          </View>
        </View>

        <View style={{ height: 1, backgroundColor: t.divider, marginVertical: 14 }} />
        <Text style={{ fontSize: 11, fontWeight: "700", color: t.text3, letterSpacing: 0.8, marginBottom: 4 }}>PAYMENTS</Text>
        {a.payments.length === 0 ? (
          <Text style={{ fontSize: 13, color: t.text3, paddingVertical: 8 }}>No payments recorded yet.</Text>
        ) : (
          a.payments.map((p, i) => {
            const refund = p.amount < 0;
            return (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: t.divider }}>
                <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: refund ? t.warnSoft : t.goodSoft, alignItems: "center", justifyContent: "center" }}>
                  <MaterialCommunityIcons name={refund ? "cash-refund" : "cash-check"} size={17} color={refund ? "#B45309" : GOOD} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: t.text }}>
                    {refund ? "Refund" : p.type || "Payment"}
                  </Text>
                  <Text style={{ fontSize: 11, color: t.text3, marginTop: 1 }} numberOfLines={1}>
                    {[p.date ? fmtDay(p.date) : null, p.mode].filter(Boolean).join(" · ") || "—"}
                  </Text>
                </View>
                <Text style={{ fontSize: 14, fontWeight: "700", color: refund ? "#B45309" : t.text, fontVariant: ["tabular-nums"] }}>
                  {rupees(p.amount)}
                </Text>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

export default function FeesScreen() {
  const t = useTheme();
  const { activeStudentId } = useAuth();
  const [accounts, setAccounts] = useState<FeeAccount[]>([]);
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
      const res = await getStudentFees(student.id, token);
      setAvailable(res.available);
      setAccounts(res.accounts);
    } catch {
      setAvailable(false);
    } finally { setLoading(false); setRefreshing(false); }
  }, [activeStudentId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const today = istToday();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={ACCENT} colors={[ACCENT]} />}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 16 }}>
          <TouchableOpacity
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
            accessibilityLabel="Back"
            style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: t.card, borderWidth: 1, borderColor: t.cardBorder, alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="arrow-back" size={18} color={t.text2} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 26, fontWeight: "800", color: t.text, letterSpacing: -0.5 }}>Fees</Text>
            {studentName ? <Text style={{ fontSize: 13, color: t.text3, marginTop: 2 }}>{studentName}</Text> : null}
          </View>
        </View>

        {loading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 60 }}>
            <ActivityIndicator size="large" color={ACCENT} />
            <Text style={{ color: t.text3, marginTop: 14, fontSize: 14 }}>Loading fees…</Text>
          </View>
        ) : !available ? (
          <EmptyState
            icon="cloud-off-outline"
            title="Fees unavailable right now"
            body="We couldn't reach the fee records. Pull down to try again, or ask the centre office."
          />
        ) : accounts.length === 0 ? (
          <EmptyState
            icon="file-search-outline"
            title="No fee record found"
            body="We couldn't find an admission for this child. Please contact the centre office."
          />
        ) : (
          <>
            {accounts.map(a => <AccountCard key={a.id} a={a} today={today} showProgram={accounts.length > 1 || !!a.program} />)}
            <Text style={{ fontSize: 12, color: t.text3, textAlign: "center", lineHeight: 18, marginTop: 4 }}>
              Figures come from the centre&apos;s fee records. If something looks wrong, please contact the centre office.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
