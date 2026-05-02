import { ScrollView, View, TouchableOpacity, ActivityIndicator, RefreshControl, Animated } from "react-native";
import { Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState, useCallback, useRef } from "react";
import { useFocusEffect, router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { getStudentResults, type TestResult } from "@/src/api/auth";
import { useTheme, ACCENT, ACCENT_2, GOOD, BAD, WARN, BgBlobs, GlassCard as BlurGlass } from "@/src/theme";
import { setSelectedResult } from "@/src/selectedResult";
import { useAuth } from "@/src/context/AuthContext";

type Student = { id: string; name: string; enrollmentNo: string; batch: string };
type Parent = { id: string; name: string; phone: string; students: Student[] };

function GlassCard({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <BlurGlass intensity={52} style={{ padding: 18, marginBottom: 12, ...(style as object ?? {}) }}>
      {children}
    </BlurGlass>
  );
}

// Animated single bar
function AnimBar({ pct, delay, variant }: { pct: number; delay: number; variant: "student" | "class" }) {
  const t = useTheme();
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(anim, { toValue: pct, duration: 700, useNativeDriver: false }).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [pct, delay]);
  const width = anim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] });
  return (
    <View style={{ flex: 1, height: 9, backgroundColor: t.neutralSoft, borderRadius: 6, overflow: "hidden" }}>
      {variant === "student" ? (
        <Animated.View style={{ width, height: 9, borderRadius: 6 }}>
          <LinearGradient colors={[ACCENT, ACCENT_2]} start={[0, 0]} end={[1, 0]} style={{ flex: 1 }} />
        </Animated.View>
      ) : (
        <Animated.View style={{ width, height: 9, borderRadius: 6, backgroundColor: "rgba(148,163,184,0.55)" }} />
      )}
    </View>
  );
}

// Legend row
function CompareLegend() {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <LinearGradient colors={[ACCENT, ACCENT_2]} start={[0, 0]} end={[1, 0]}
          style={{ width: 14, height: 8, borderRadius: 3 }} />
        <Text style={{ fontSize: 11, fontWeight: "600", color: t.text2 }}>Student</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ width: 14, height: 8, borderRadius: 3, backgroundColor: "rgba(148,163,184,0.55)" }} />
        <Text style={{ fontSize: 11, fontWeight: "600", color: t.text2 }}>Class avg</Text>
      </View>
    </View>
  );
}

// Two-bar comparison per subject
function CompareBars({ result }: { result: TestResult }) {
  const t = useTheme();
  const subjects = Object.entries(result.scores);
  if (!subjects.length) return null;
  const hasAvg = !!result.classAvgScores && Object.keys(result.classAvgScores).length > 0;

  return (
    <View style={{ gap: 14 }}>
      {subjects.map(([subj, score], i) => {
        const max = result.subjectMaxes?.[subj] ?? 100;
        const studentPct = Math.min(100, Math.round((score / max) * 100));
        const avg = result.classAvgScores?.[subj] ?? 0;
        const avgPct = Math.min(100, Math.round((avg / max) * 100));
        const lead = score - avg;
        const leadColor = lead >= 0 ? GOOD : BAD;

        return (
          <View key={subj}>
            {/* Subject name + score + lead */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: t.text }}>{subj}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {hasAvg && (
                  <Text style={{ fontSize: 11, fontWeight: "700", color: leadColor }}>
                    {lead >= 0 ? "+" : ""}{Math.round(lead)}
                  </Text>
                )}
                <Text style={{ fontSize: 12, fontWeight: "800", color: t.text }}>
                  {score}<Text style={{ fontSize: 10, color: t.text3 }}>/{max}</Text>
                </Text>
              </View>
            </View>
            {/* Student bar */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 52 }}>
                <Text style={{ fontSize: 10, fontWeight: "600", color: ACCENT }}>You</Text>
              </View>
              <AnimBar pct={studentPct} delay={i * 80 + 100} variant="student" />
              <Text style={{ fontSize: 10, fontWeight: "700", color: ACCENT, width: 30, textAlign: "right" }}>{studentPct}%</Text>
            </View>
            {/* Class avg bar */}
            {hasAvg && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                <View style={{ width: 52 }}>
                  <Text style={{ fontSize: 10, fontWeight: "600", color: t.text3 }}>Class</Text>
                </View>
                <AnimBar pct={avgPct} delay={i * 80 + 180} variant="class" />
                <Text style={{ fontSize: 10, fontWeight: "700", color: t.text3, width: 30, textAlign: "right" }}>{avgPct}%</Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

function ResultCard({ result, expanded, onToggle, onViewDetail }: { result: TestResult; expanded: boolean; onToggle: () => void; onViewDetail: () => void }) {
  const t = useTheme();
  const pctColor = result.percentage >= 70 ? GOOD : result.percentage >= 50 ? WARN : BAD;
  const rankColor = !result.rank ? t.text3 : result.rank === 1 ? WARN : result.rank <= 3 ? ACCENT_2 : result.rank <= 10 ? GOOD : t.text3;

  return (
    <TouchableOpacity onPress={onToggle} activeOpacity={0.88}>
      <GlassCard style={{ padding: 0, overflow: "hidden" }}>
        <View style={{ padding: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: t.text }}>{result.testName}</Text>
              <Text style={{ fontSize: 12, color: t.text3, marginTop: 2 }}>
                {new Date(result.testDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                {result.totalInBatch ? ` • ${result.totalInBatch} students` : ""}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 24, fontWeight: "800", color: pctColor, letterSpacing: -0.5 }}>
                {result.percentage.toFixed(1)}<Text style={{ fontSize: 13, color: t.text3 }}>%</Text>
              </Text>
              <Text style={{ fontSize: 11, color: t.text3, marginTop: 1 }}>{result.total} marks</Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            {result.rank && (
              <View style={{ backgroundColor: `${rankColor}18`, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 4 }}>
                <MaterialCommunityIcons name="medal" size={12} color={rankColor} />
                <Text style={{ fontSize: 11, fontWeight: "700", color: rankColor }}>Rank #{result.rank}</Text>
              </View>
            )}
            {result.percentile !== null && (
              <View style={{ backgroundColor: t.goodSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: GOOD }}>{result.percentile}th percentile</Text>
              </View>
            )}
            {!expanded && (
              <View style={{ backgroundColor: t.neutralSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: "600", color: t.text3 }}>Tap to compare ▾</Text>
              </View>
            )}
          </View>
        </View>

        {expanded && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: t.divider, paddingTop: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: t.text2, textTransform: "uppercase", letterSpacing: 0.6 }}>
                Subject vs class average
              </Text>
              {result.classAvgScores && <CompareLegend />}
            </View>
            <CompareBars result={result} />

            {/* Per-subject lead summary */}
            {result.classAvgScores && Object.keys(result.classAvgScores).length > 0 && (
              <>
                <View style={{ height: 1, backgroundColor: t.divider, marginVertical: 14 }} />
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {Object.entries(result.scores).map(([subj, score]) => {
                    const avg = result.classAvgScores![subj] ?? 0;
                    const lead = score - avg;
                    const isPos = lead >= 0;
                    return (
                      <View key={subj} style={{ flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12, backgroundColor: isPos ? t.goodSoft : t.badSoft }}>
                        <Text style={{ fontSize: 10, color: t.text3, fontWeight: "600" }} numberOfLines={1}>{subj}</Text>
                        <Text style={{ fontSize: 18, fontWeight: "800", color: isPos ? GOOD : BAD, marginTop: 2 }}>
                          {isPos ? "+" : ""}{Math.round(lead)}
                        </Text>
                        <Text style={{ fontSize: 9, fontWeight: "700", color: isPos ? GOOD : BAD }}>
                          {isPos ? "above avg" : "below avg"}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </>
            )}

            {/* View full detail */}
            <View style={{ height: 1, backgroundColor: t.divider, marginTop: 14, marginBottom: 12 }} />
            <TouchableOpacity
              onPress={onViewDetail}
              activeOpacity={0.8}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: t.accentSoft, borderRadius: 12, paddingVertical: 11 }}
            >
              <MaterialCommunityIcons name="chart-box" size={15} color={ACCENT} />
              <Text style={{ fontSize: 13, fontWeight: "700", color: ACCENT }}>View full detail</Text>
              <MaterialCommunityIcons name="chevron-right" size={15} color={ACCENT} />
            </TouchableOpacity>
          </View>
        )}
      </GlassCard>
    </TouchableOpacity>
  );
}

export default function ResultsScreen() {
  const t = useTheme();
  const { activeStudentId } = useAuth();
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState("");
  const [studentBatch, setStudentBatch] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [parentStr, tokenStr] = await Promise.all([
        AsyncStorage.getItem("parent"),
        AsyncStorage.getItem("auth_token"),
      ]);
      if (!parentStr || !tokenStr) return;
      const parent: Parent = JSON.parse(parentStr);
      const student = (activeStudentId ? parent.students?.find(s => s.id === activeStudentId) : null) ?? parent.students?.[0];
      if (!student) return;
      setStudentName(student.name || "Student");
      setStudentBatch(student.batch || "");
      const data = await getStudentResults(student.id, tokenStr);
      setResults(data);
      if (data.length > 0) setExpandedId(data[0].id);
    } finally { setLoading(false); setRefreshing(false); }
  }, [activeStudentId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const avgPct = results.length > 0
    ? (results.reduce((a, r) => a + r.percentage, 0) / results.length).toFixed(1)
    : "0";
  const bestRank = results.length > 0 ? Math.min(...results.map(r => r.rank ?? 999)) : null;
  const latest = results[0];

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
        <BgBlobs />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      <BgBlobs />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, paddingTop: 4 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={ACCENT} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ paddingVertical: 16 }}>
          <Text style={{ fontSize: 26, fontWeight: "800", color: t.text, letterSpacing: -0.5 }}>Results</Text>
          <Text style={{ fontSize: 13, color: t.text3, marginTop: 2 }}>{studentName}{studentBatch ? ` • ${studentBatch}` : ""}</Text>
        </View>

        {results.length === 0 ? (
          <GlassCard style={{ alignItems: "center", paddingVertical: 48 }}>
            <MaterialCommunityIcons name="chart-bar" size={48} color={t.text3} />
            <Text style={{ fontSize: 16, fontWeight: "700", color: t.text, marginTop: 12 }}>No results yet</Text>
            <Text style={{ fontSize: 13, color: t.text3, marginTop: 4, textAlign: "center" }}>
              Test results will appear here once uploaded by admin
            </Text>
          </GlassCard>
        ) : (
          <>
            {/* Summary strip */}
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
              {[
                { label: "Tests", value: String(results.length), icon: "chart-bar" as const, color: ACCENT, bg: t.accentSoft },
                { label: "Average", value: `${avgPct}%`, icon: "star-four-points" as const, color: ACCENT_2, bg: t.accent2Soft },
                { label: "Best rank", value: bestRank && bestRank < 999 ? `#${bestRank}` : "—", icon: "trophy" as const, color: WARN, bg: t.warnSoft },
              ].map(s => (
                <BlurGlass key={s.label} intensity={50} style={{ flex: 1, padding: 12, alignItems: "center" }}>
                  <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: s.bg, alignItems: "center", justifyContent: "center", marginBottom: 6 }}>
                    <MaterialCommunityIcons name={s.icon} size={16} color={s.color} />
                  </View>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: t.text, letterSpacing: -0.3 }}>{s.value}</Text>
                  <Text style={{ fontSize: 10, color: t.text3, fontWeight: "600", marginTop: 2, textTransform: "uppercase", letterSpacing: 0.4 }}>{s.label}</Text>
                </BlurGlass>
              ))}
            </View>

            {/* Hero: latest test with full comparison */}
            {latest && (
              <GlassCard style={{ position: "relative", overflow: "hidden", marginBottom: 20 }}>
                <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
                  <LinearGradient colors={[ACCENT, ACCENT_2]} start={[0, 0]} end={[1, 0]} style={{ flex: 1 }} />
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4, marginBottom: 4 }}>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: ACCENT, letterSpacing: 0.8, textTransform: "uppercase" }}>Latest performance</Text>
                  {latest.percentile !== null && (
                    <View style={{ backgroundColor: t.goodSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: GOOD }}>{latest.percentile}th percentile</Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: 18, fontWeight: "800", color: t.text, letterSpacing: -0.3 }}>{latest.testName}</Text>
                <Text style={{ fontSize: 12, color: t.text3, marginBottom: 12 }}>
                  {new Date(latest.testDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  {latest.rank ? ` • Rank #${latest.rank}` : ""}
                  {latest.totalInBatch ? ` of ${latest.totalInBatch}` : ""}
                </Text>
                {latest.classAvgScores && (
                  <View style={{ marginBottom: 12 }}>
                    <CompareLegend />
                  </View>
                )}
                <CompareBars result={latest} />
              </GlassCard>
            )}

            {/* All tests */}
            <View style={{ paddingHorizontal: 4, marginBottom: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: t.text }}>All tests</Text>
            </View>

            {results.map(r => (
              <ResultCard
                key={r.id}
                result={r}
                expanded={expandedId === r.id}
                onToggle={() => setExpandedId(expandedId === r.id ? null : r.id)}
                onViewDetail={() => { setSelectedResult(r); router.push("/test-detail" as never); }}
              />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
