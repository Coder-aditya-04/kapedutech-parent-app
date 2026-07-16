import { ScrollView, View, TouchableOpacity, Animated } from "react-native";
import { Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme, ACCENT, ACCENT_2, GOOD, BAD, WARN, BgBlobs, GlassCard as BlurGlass } from "@/src/theme";
import { getSelectedResult } from "@/src/selectedResult";
import { realPct } from "@/src/api/auth";

function AnimBar({ pct, delay, variant }: { pct: number; delay: number; variant: "student" | "class" }) {
  const t = useTheme();
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(anim, { toValue: pct, duration: 800, useNativeDriver: false }).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [pct, delay]);
  const width = anim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] });
  return (
    <View style={{ flex: 1, height: 10, backgroundColor: t.neutralSoft, borderRadius: 6, overflow: "hidden" }}>
      {variant === "student" ? (
        <Animated.View style={{ width, height: 10, borderRadius: 6 }}>
          <LinearGradient colors={[ACCENT, ACCENT_2]} start={[0, 0]} end={[1, 0]} style={{ flex: 1 }} />
        </Animated.View>
      ) : (
        <Animated.View style={{ width, height: 10, borderRadius: 6, backgroundColor: "rgba(148,163,184,0.55)" }} />
      )}
    </View>
  );
}

export default function TestDetailScreen() {
  const t = useTheme();
  const result = getSelectedResult();

  if (!result) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
        <BgBlobs />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 12 }}>
          <MaterialCommunityIcons name="alert-circle-outline" size={40} color={t.text3} />
          <Text style={{ fontSize: 15, color: t.text2 }}>Result not found.</Text>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8}
            style={{ backgroundColor: t.accentSoft, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 }}>
            <Text style={{ color: ACCENT, fontWeight: "700" }}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const pct = realPct(result);
  const pctColor = pct >= 70 ? GOOD : pct >= 50 ? WARN : BAD;
  const rankColor = !result.rank ? t.text3 : result.rank === 1 ? WARN : result.rank <= 3 ? ACCENT_2 : result.rank <= 10 ? GOOD : t.text3;
  const subjects = Object.entries(result.scores);
  const hasAvg = !!result.classAvgScores && Object.keys(result.classAvgScores).length > 0;

  const classTotal = hasAvg
    ? subjects.reduce((sum, [subj]) => sum + (result.classAvgScores![subj] ?? 0), 0)
    : null;
  const totalMax = subjects.reduce((sum, [subj]) => {
    return sum + (result.subjectMaxes?.[subj] ?? 100);
  }, 0);

  const statsItems = [
    { label: "Total", value: `${result.total}/${totalMax}`, icon: "sigma" as const, color: ACCENT, bg: t.accentSoft },
    ...(result.rank ? [{ label: "Rank", value: `#${result.rank}`, icon: "trophy" as const, color: WARN, bg: t.warnSoft }] : []),
    ...(result.totalInBatch ? [{ label: "Classmates", value: String(result.totalInBatch), icon: "account-group" as const, color: ACCENT_2, bg: t.accent2Soft }] : []),
    ...(result.percentile !== null ? [{ label: "Percentile", value: `${result.percentile}th`, icon: "chart-bell-curve" as const, color: GOOD, bg: t.goodSoft }] : []),
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      <BgBlobs />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <View style={{ paddingVertical: 12 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.8}
            style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: t.card, borderWidth: 1, borderColor: t.cardBorder, alignItems: "center", justifyContent: "center" }}
          >
            <MaterialCommunityIcons name="arrow-left" size={20} color={t.text2} />
          </TouchableOpacity>
        </View>

        {/* Hero card */}
        <BlurGlass intensity={55} style={{ padding: 0, overflow: "hidden", marginBottom: 14 }}>
          <LinearGradient
            colors={[`${pctColor}22`, `${pctColor}06`]}
            start={[0, 0]} end={[1, 1]}
            style={{ padding: 20 }}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", color: t.text3, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6 }}>Test breakdown</Text>
            <Text style={{ fontSize: 22, fontWeight: "800", color: t.text, letterSpacing: -0.5, marginBottom: 4 }}>{result.testName}</Text>
            <Text style={{ fontSize: 13, color: t.text2, marginBottom: 20 }}>
              {new Date(result.testDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
            </Text>

            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
              <Text style={{ fontSize: 72, fontWeight: "900", color: pctColor, lineHeight: 76, letterSpacing: -3 }}>
                {pct.toFixed(1)}
              </Text>
              <View style={{ paddingBottom: 10 }}>
                <Text style={{ fontSize: 28, fontWeight: "800", color: pctColor, opacity: 0.7 }}>%</Text>
                {result.rank && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4, backgroundColor: `${rankColor}18`, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <MaterialCommunityIcons name="trophy" size={12} color={rankColor} />
                    <Text style={{ fontSize: 12, fontWeight: "800", color: rankColor }}>Rank #{result.rank}</Text>
                  </View>
                )}
              </View>
            </View>
          </LinearGradient>
        </BlurGlass>

        {/* Stats strip */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          {statsItems.map(s => (
            <BlurGlass key={s.label} intensity={50} style={{ flex: 1, minWidth: 80, padding: 12, alignItems: "center" }}>
              <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: s.bg, alignItems: "center", justifyContent: "center", marginBottom: 5 }}>
                <MaterialCommunityIcons name={s.icon} size={14} color={s.color} />
              </View>
              <Text style={{ fontSize: 15, fontWeight: "800", color: t.text, letterSpacing: -0.3 }}>{s.value}</Text>
              <Text style={{ fontSize: 10, color: t.text3, fontWeight: "600", marginTop: 1, textTransform: "uppercase", letterSpacing: 0.4 }}>{s.label}</Text>
            </BlurGlass>
          ))}
        </View>

        {/* Subject breakdown */}
        <BlurGlass intensity={52} style={{ padding: 16, marginBottom: 14 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: "800", color: t.text }}>Subject breakdown</Text>
            {hasAvg && (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <LinearGradient colors={[ACCENT, ACCENT_2]} start={[0, 0]} end={[1, 0]} style={{ width: 14, height: 7, borderRadius: 3 }} />
                  <Text style={{ fontSize: 10, fontWeight: "600", color: t.text3 }}>You</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <View style={{ width: 14, height: 7, borderRadius: 3, backgroundColor: "rgba(148,163,184,0.55)" }} />
                  <Text style={{ fontSize: 10, fontWeight: "600", color: t.text3 }}>Class avg</Text>
                </View>
              </View>
            )}
          </View>

          <View style={{ gap: 20 }}>
            {subjects.map(([subj, score], i) => {
              const max = result.subjectMaxes?.[subj] ?? 100;
              const studentPct = Math.min(100, Math.round((score / max) * 100));
              const avg = result.classAvgScores?.[subj] ?? 0;
              const avgPct = Math.min(100, Math.round((avg / max) * 100));
              const lead = score - avg;
              const leadColor = lead >= 0 ? GOOD : BAD;

              return (
                <View key={subj}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: t.text }}>{subj}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      {hasAvg && (
                        <Text style={{ fontSize: 12, fontWeight: "700", color: leadColor }}>
                          {lead >= 0 ? "+" : ""}{Math.round(lead)} pts
                        </Text>
                      )}
                      <Text style={{ fontSize: 14, fontWeight: "800", color: t.text }}>
                        {score}<Text style={{ fontSize: 11, fontWeight: "600", color: t.text3 }}>/{max}</Text>
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <Text style={{ fontSize: 10, fontWeight: "600", color: ACCENT, width: 24 }}>You</Text>
                    <AnimBar pct={studentPct} delay={i * 100 + 150} variant="student" />
                    <Text style={{ fontSize: 11, fontWeight: "700", color: ACCENT, width: 34, textAlign: "right" }}>{studentPct}%</Text>
                  </View>

                  {hasAvg && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={{ fontSize: 10, fontWeight: "600", color: t.text3, width: 24 }}>Cls</Text>
                      <AnimBar pct={avgPct} delay={i * 100 + 280} variant="class" />
                      <Text style={{ fontSize: 11, fontWeight: "700", color: t.text3, width: 34, textAlign: "right" }}>{avgPct}%</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* Overall total comparison */}
          {hasAvg && classTotal !== null && (
            <>
              <View style={{ height: 1, backgroundColor: t.divider, marginVertical: 16 }} />
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: t.text }}>Overall total</Text>
                <View style={{ flexDirection: "row", gap: 14 }}>
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ fontSize: 11, color: t.text3, fontWeight: "600" }}>You</Text>
                    <Text style={{ fontSize: 18, fontWeight: "800", color: ACCENT }}>{result.total}</Text>
                  </View>
                  <View style={{ width: 1, backgroundColor: t.divider }} />
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ fontSize: 11, color: t.text3, fontWeight: "600" }}>Class avg</Text>
                    <Text style={{ fontSize: 18, fontWeight: "800", color: t.text2 }}>{classTotal.toFixed(1)}</Text>
                  </View>
                  <View style={{ width: 1, backgroundColor: t.divider }} />
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ fontSize: 11, color: t.text3, fontWeight: "600" }}>Max</Text>
                    <Text style={{ fontSize: 18, fontWeight: "800", color: t.text3 }}>{totalMax}</Text>
                  </View>
                </View>
              </View>
            </>
          )}
        </BlurGlass>

        {/* Per-subject lead summary */}
        {hasAvg && (
          <BlurGlass intensity={52} style={{ padding: 16, marginBottom: 14 }}>
            <Text style={{ fontSize: 14, fontWeight: "800", color: t.text, marginBottom: 12 }}>Where you stand</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {subjects.map(([subj, score]) => {
                const avg = result.classAvgScores![subj] ?? 0;
                const lead = score - avg;
                const isPos = lead >= 0;
                return (
                  <View key={subj} style={{ flex: 1, minWidth: 80, alignItems: "center", paddingVertical: 12, borderRadius: 14, backgroundColor: isPos ? t.goodSoft : t.badSoft }}>
                    <Text style={{ fontSize: 10, color: t.text3, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 }} numberOfLines={1}>{subj}</Text>
                    <Text style={{ fontSize: 22, fontWeight: "900", color: isPos ? GOOD : BAD, marginTop: 4, letterSpacing: -0.5 }}>
                      {isPos ? "+" : ""}{Math.round(lead)}
                    </Text>
                    <Text style={{ fontSize: 10, fontWeight: "700", color: isPos ? GOOD : BAD }}>
                      {isPos ? "above avg" : "below avg"}
                    </Text>
                  </View>
                );
              })}
            </View>
          </BlurGlass>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
