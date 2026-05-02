import {
  View, Dimensions, TouchableOpacity, Animated, Easing,
} from "react-native";
import { Text } from "react-native-paper";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useState, useRef, useEffect, useCallback } from "react";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Rect, Path, Ellipse, G } from "react-native-svg";
import { useTheme, ACCENT, ACCENT_2, GOOD, WARN, BgBlobs, GlassCard } from "@/src/theme";

const { width } = Dimensions.get("window");

const SLIDES = [
  {
    eyebrow: "Welcome to KAP Connect",
    title: "Stay in sync with your\nchild's journey",
    body: "Real-time attendance, test results, and progress at KAP Edutech — all in one place.",
    art: "logo" as const,
    color: ACCENT,
  },
  {
    eyebrow: "Step 1 — At the gate",
    title: "Your child scans the QR\nat KAP campus",
    body: "Each student gets a unique QR. One scan at the entrance marks attendance instantly.",
    art: "qr" as const,
    color: ACCENT,
  },
  {
    eyebrow: "Step 2 — Instant ping",
    title: "You get a notification\nat home",
    body: "The moment they punch in, a push lands on your phone — no more 'where are you?' calls.",
    art: "notif" as const,
    color: "#7C3AED",
  },
  {
    eyebrow: "Step 3 — Performance",
    title: "Compare with the\nclass average",
    body: "See how your child scores against the batch — subject by subject, test by test.",
    art: "bars" as const,
    color: GOOD,
  },
  {
    eyebrow: "Built for families",
    title: "Multiple students,\none account",
    body: "Switch between siblings effortlessly. Built for KAPian families.",
    art: "family" as const,
    color: ACCENT_2,
  },
];

// ── SVG Character Figures ────────────────────────────────────────────────────

function StudentFigure({ scale = 1, color = ACCENT }: { scale?: number; color?: string }) {
  const w = 120 * scale;
  const h = 180 * scale;
  return (
    <Svg viewBox="0 0 120 180" width={w} height={h}>
      {/* shadow */}
      <Ellipse cx="60" cy="172" rx="32" ry="4" fill="rgba(0,0,0,0.12)" />
      {/* legs */}
      <Rect x="46" y="120" width="11" height="48" rx="5" fill="#1f2937" />
      <Rect x="63" y="120" width="11" height="48" rx="5" fill="#1f2937" />
      {/* shoes */}
      <Ellipse cx="51" cy="170" rx="9" ry="4" fill="#0b1220" />
      <Ellipse cx="69" cy="170" rx="9" ry="4" fill="#0b1220" />
      {/* backpack */}
      <Rect x="22" y="68" width="22" height="48" rx="9" fill={color} opacity="0.85" />
      <Rect x="26" y="80" width="14" height="3" rx="1.5" fill="rgba(255,255,255,0.5)" />
      {/* torso (uniform) */}
      <Path d="M30 70 Q60 56 90 70 L86 122 Q60 130 34 122 Z" fill="#ffffff" stroke="rgba(0,0,0,0.06)" strokeWidth="1" />
      {/* tie */}
      <Path d="M58 70 L62 70 L64 88 L60 96 L56 88 Z" fill={color} />
      {/* arms */}
      <Rect x="28" y="72" width="10" height="38" rx="5" fill="#ffffff" stroke="rgba(0,0,0,0.06)" strokeWidth="1" />
      <Rect x="82" y="72" width="10" height="38" rx="5" fill="#ffffff" stroke="rgba(0,0,0,0.06)" strokeWidth="1" />
      {/* hands */}
      <Circle cx="33" cy="112" r="6" fill="#f4c89a" />
      <Circle cx="87" cy="112" r="6" fill="#f4c89a" />
      {/* head */}
      <Circle cx="60" cy="46" r="20" fill="#f4c89a" />
      {/* hair */}
      <Path d="M40 42 Q42 24 60 22 Q80 24 80 42 Q78 30 60 30 Q44 32 40 42 Z" fill="#1f2937" />
      {/* eyes */}
      <Circle cx="53" cy="46" r="1.4" fill="#1f2937" />
      <Circle cx="67" cy="46" r="1.4" fill="#1f2937" />
      {/* smile */}
      <Path d="M55 53 Q60 56 65 53" stroke="#1f2937" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function ParentFigure({ scale = 1, color = ACCENT_2 }: { scale?: number; color?: string }) {
  const w = 110 * scale;
  const h = 160 * scale;
  return (
    <Svg viewBox="0 0 110 160" width={w} height={h}>
      <Ellipse cx="55" cy="152" rx="28" ry="4" fill="rgba(0,0,0,0.12)" />
      {/* legs */}
      <Rect x="42" y="100" width="10" height="48" rx="5" fill="#374151" />
      <Rect x="58" y="100" width="10" height="48" rx="5" fill="#374151" />
      {/* dress / kurta */}
      <Path d="M28 60 Q55 50 82 60 L78 108 Q55 116 32 108 Z" fill={color} opacity="0.92" />
      {/* arms */}
      <Rect x="24" y="62" width="10" height="36" rx="5" fill={color} opacity="0.92" />
      <Rect x="76" y="62" width="10" height="36" rx="5" fill={color} opacity="0.92" />
      {/* hands */}
      <Circle cx="29" cy="98" r="5" fill="#e8b289" />
      <Circle cx="81" cy="98" r="5" fill="#e8b289" />
      {/* phone */}
      <Rect x="40" y="86" width="30" height="22" rx="4" fill="#0b1220" />
      <Rect x="42" y="88" width="26" height="18" rx="2" fill={ACCENT} opacity="0.9" />
      {/* head */}
      <Circle cx="55" cy="40" r="18" fill="#e8b289" />
      {/* hair (long) */}
      <Path d="M37 38 Q35 18 55 16 Q75 18 73 38 L73 54 Q70 46 55 46 Q40 46 37 54 Z" fill="#3b2a1f" />
      {/* eyes */}
      <Circle cx="49" cy="40" r="1.3" fill="#1f2937" />
      <Circle cx="61" cy="40" r="1.3" fill="#1f2937" />
      {/* smile */}
      <Path d="M51 47 Q55 50 59 47" stroke="#1f2937" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </Svg>
  );
}

// ── Illustrations ─────────────────────────────────────────────────────────────

function ArtLogo() {
  const t = useTheme();
  const pulse1 = useRef(new Animated.Value(1)).current;
  const pulse2 = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse1, { toValue: 1.12, duration: 1400, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      Animated.timing(pulse1, { toValue: 1, duration: 1400, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.delay(700),
      Animated.timing(pulse2, { toValue: 1.12, duration: 1400, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      Animated.timing(pulse2, { toValue: 1, duration: 1400, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
    ])).start();
  }, []);

  return (
    <View style={{ width: 280, height: 220, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{
        position: "absolute", width: 240, height: 240, borderRadius: 120,
        borderWidth: 1.5, borderColor: `rgba(31,168,224,0.2)`, transform: [{ scale: pulse1 }],
      }} />
      <Animated.View style={{
        position: "absolute", width: 170, height: 170, borderRadius: 85,
        borderWidth: 1.5, borderColor: `rgba(31,168,224,0.35)`, transform: [{ scale: pulse2 }],
      }} />
      <View style={{
        width: 120, height: 120, borderRadius: 36,
        backgroundColor: `rgba(31,168,224,0.1)`,
        alignItems: "center", justifyContent: "center",
        shadowColor: ACCENT, shadowOpacity: 0.2, shadowRadius: 24, shadowOffset: { width: 0, height: 8 },
      }}>
        <Image
          source={require("../assets/images/kap_logo_transparent.png")}
          style={{ width: 100, height: 100 }}
          contentFit="contain"
          tintColor={t.dark ? "#FFFFFF" : undefined}
        />
      </View>
    </View>
  );
}

function ArtQR() {
  const scanY = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(scanY, { toValue: 68, duration: 1500, useNativeDriver: false, easing: Easing.inOut(Easing.ease) }),
      Animated.timing(scanY, { toValue: 0, duration: 1500, useNativeDriver: false, easing: Easing.inOut(Easing.ease) }),
    ])).start();
    Animated.spring(checkScale, { toValue: 1, delay: 500, useNativeDriver: true, damping: 7, stiffness: 200 }).start();
  }, []);

  return (
    <View style={{ width: 300, height: 220, alignItems: "center", justifyContent: "flex-end" }}>
      {/* Gate header */}
      <View style={{ position: "absolute", top: 0, left: 12, right: 12, height: 52, borderRadius: 14, backgroundColor: `rgba(31,168,224,0.1)`, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 }}>
        <Text style={{ fontSize: 9, fontWeight: "800", letterSpacing: 1, color: ACCENT }}>KAP CAMPUS · GATE 2</Text>
        <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: GOOD, shadowColor: GOOD, shadowOpacity: 0.8, shadowRadius: 6 }} />
      </View>

      {/* QR Scanner box */}
      <View style={{ position: "absolute", left: "50%", top: 48, marginLeft: -50, width: 100, height: 100, borderRadius: 16, backgroundColor: "#0b1220", padding: 8, overflow: "hidden" }}>
        <Svg viewBox="0 0 50 50" width="100%" height="100%">
          {/* corner squares */}
          <Rect x="4" y="4" width="11" height="11" fill="white" />
          <Rect x="6" y="6" width="7" height="7" fill="#0b1220" />
          <Rect x="8" y="8" width="3" height="3" fill="white" />
          <Rect x="35" y="4" width="11" height="11" fill="white" />
          <Rect x="37" y="6" width="7" height="7" fill="#0b1220" />
          <Rect x="39" y="8" width="3" height="3" fill="white" />
          <Rect x="4" y="35" width="11" height="11" fill="white" />
          <Rect x="6" y="37" width="7" height="7" fill="#0b1220" />
          <Rect x="8" y="39" width="3" height="3" fill="white" />
          {/* data dots */}
          {[[18,6],[22,6],[26,8],[30,4],[20,10],[26,12],[22,16],[18,20],[26,22],[32,18],[36,22],[20,26],[24,28],[30,28],[16,30],[22,32],[28,34],[32,36],[18,38],[24,40],[30,42]].map(([x, y], i) => (
            <Rect key={i} x={x} y={y} width="3" height="3" fill="white" />
          ))}
        </Svg>
        {/* Scan line */}
        <Animated.View style={{
          position: "absolute", left: 8, right: 8, height: 2,
          backgroundColor: ACCENT, top: scanY,
          shadowColor: ACCENT, shadowOpacity: 1, shadowRadius: 6,
        }} />
        {/* Corner brackets */}
        {[
          { top: 4, left: 4, borderTopWidth: 2, borderLeftWidth: 2 },
          { top: 4, right: 4, borderTopWidth: 2, borderRightWidth: 2 },
          { bottom: 4, left: 4, borderBottomWidth: 2, borderLeftWidth: 2 },
          { bottom: 4, right: 4, borderBottomWidth: 2, borderRightWidth: 2 },
        ].map((s, i) => (
          <View key={i} style={[{ position: "absolute", width: 12, height: 12, borderColor: ACCENT }, s as never]} />
        ))}
      </View>

      {/* Check badge */}
      <Animated.View style={{
        position: "absolute", top: 38, right: 88,
        width: 30, height: 30, borderRadius: 15,
        backgroundColor: GOOD, alignItems: "center", justifyContent: "center",
        transform: [{ scale: checkScale }],
        shadowColor: GOOD, shadowOpacity: 0.55, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
      }}>
        <Ionicons name="checkmark" size={16} color="white" />
      </Animated.View>

      {/* Student figure left */}
      <View style={{ position: "absolute", bottom: 0, left: 30 }}>
        <StudentFigure scale={0.82} color={ACCENT} />
      </View>

      {/* Ground line */}
      <View style={{ position: "absolute", bottom: 0, left: 8, right: 8, height: 1.5, backgroundColor: "rgba(31,168,224,0.18)", borderRadius: 1 }} />
    </View>
  );
}

function ArtNotif() {
  const toastY = useRef(new Animated.Value(-20)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.parallel([
        Animated.spring(toastY, { toValue: 0, useNativeDriver: true, damping: 12, stiffness: 160 }),
        Animated.timing(toastOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]),
      Animated.delay(2200),
      Animated.parallel([
        Animated.timing(toastY, { toValue: -16, duration: 220, useNativeDriver: true }),
        Animated.timing(toastOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]),
      Animated.delay(500),
    ])).start();
  }, []);

  return (
    <View style={{ width: 300, height: 220, alignItems: "center", justifyContent: "flex-end" }}>
      {/* Signal arcs */}
      <Svg viewBox="0 0 300 220" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}>
        <Path d="M 80 110 Q 150 55 220 110" stroke={ACCENT} strokeWidth="2" strokeDasharray="4 5" fill="none" opacity="0.5" />
        <Path d="M 80 128 Q 150 82 220 128" stroke={ACCENT} strokeWidth="2" strokeDasharray="3 6" fill="none" opacity="0.3" />
      </Svg>

      {/* Notification toast */}
      <Animated.View style={{
        position: "absolute", top: 14, left: "50%", marginLeft: -102,
        width: 204, transform: [{ translateY: toastY }], opacity: toastOpacity,
      }}>
        <GlassCard intensity={75} style={{ padding: 12, borderRadius: 16 }}>
          <View style={{ flexDirection: "row", gap: 9, alignItems: "center" }}>
            <LinearGradient colors={[ACCENT, ACCENT_2]} start={[0, 0]} end={[1, 1]}
              style={{ width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="checkmark" size={15} color="white" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: "800", letterSpacing: -0.2 }}>Aarav punched IN</Text>
              <Text style={{ fontSize: 10, color: "#7A8499", marginTop: 1 }}>07:42 AM · 12 min early</Text>
            </View>
          </View>
        </GlassCard>
      </Animated.View>

      {/* Student left */}
      <View style={{ position: "absolute", left: 4, bottom: 0 }}>
        <StudentFigure scale={0.6} color={ACCENT} />
      </View>

      {/* Parent right */}
      <View style={{ position: "absolute", right: 8, bottom: 0 }}>
        <ParentFigure scale={0.65} color={ACCENT_2} />
      </View>

      <View style={{ position: "absolute", bottom: 0, left: 8, right: 8, height: 1.5, backgroundColor: "rgba(31,168,224,0.15)", borderRadius: 1 }} />
    </View>
  );
}

function ArtBars() {
  const t = useTheme();
  const bars = [
    { subj: "Physics", score: 82, avg: 64 },
    { subj: "Chemistry", score: 88, avg: 61 },
    { subj: "Maths", score: 71, avg: 58 },
  ];
  const animVals = bars.map(() => useRef(new Animated.Value(0)).current);

  useEffect(() => {
    Animated.stagger(120, animVals.map((v, i) =>
      Animated.timing(v, { toValue: 1, duration: 800, delay: 150 + i * 100, useNativeDriver: false, easing: Easing.out(Easing.cubic) })
    )).start();
  }, []);

  return (
    <View style={{ width: 300, height: 220, alignItems: "center", justifyContent: "center" }}>
      {/* Student peeking behind chart (right) */}
      <View style={{ position: "absolute", right: 0, bottom: 0 }}>
        <StudentFigure scale={0.68} color={GOOD} />
      </View>

      {/* Chart card */}
      <GlassCard intensity={62} style={{ width: 210, padding: 16, borderRadius: 18, position: "absolute", left: 12 }}>
        <Text style={{ fontSize: 9, fontWeight: "700", color: ACCENT, letterSpacing: 0.8, textTransform: "uppercase" }}>Mock Test #14</Text>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 4, marginBottom: 12 }}>
          <Text style={{ fontSize: 22, fontWeight: "800", color: t.text, letterSpacing: -0.5 }}>82%</Text>
          <Text style={{ fontSize: 11, fontWeight: "700", color: GOOD }}>+18 vs avg</Text>
        </View>
        {bars.map(({ subj, score, avg }, i) => (
          <View key={subj} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: t.text2 }}>{subj}</Text>
              <Text style={{ fontSize: 10, fontWeight: "700", color: t.text }}>{score}%</Text>
            </View>
            <View style={{ height: 7, borderRadius: 4, backgroundColor: t.neutralSoft, overflow: "hidden" }}>
              <Animated.View style={{ height: "100%", borderRadius: 4, width: animVals[i].interpolate({ inputRange: [0, 1], outputRange: ["0%", `${score}%`] }) }}>
                <LinearGradient colors={[ACCENT, ACCENT_2]} start={[0, 0]} end={[1, 0]} style={{ flex: 1 }} />
              </Animated.View>
            </View>
            <View style={{ height: 7, borderRadius: 4, backgroundColor: t.neutralSoft, marginTop: 3, overflow: "hidden" }}>
              <Animated.View style={{ height: "100%", borderRadius: 4, backgroundColor: "rgba(148,163,184,0.5)", width: animVals[i].interpolate({ inputRange: [0, 1], outputRange: ["0%", `${avg}%`] }) }} />
            </View>
          </View>
        ))}
      </GlassCard>
    </View>
  );
}

function ArtFamily() {
  const t = useTheme();
  const students = [
    { i: "AS", colors: [ACCENT, ACCENT_2] as [string, string], rotate: "-4deg" },
    { i: "PS", colors: [WARN, "#EF4444"] as [string, string], rotate: "0deg" },
    { i: "RS", colors: ["#10B981", GOOD] as [string, string], rotate: "4deg" },
  ];
  const scales = students.map(() => useRef(new Animated.Value(0)).current);
  useEffect(() => {
    Animated.stagger(110, scales.map(s =>
      Animated.spring(s, { toValue: 1, useNativeDriver: true, damping: 9, stiffness: 190 })
    )).start();
  }, []);

  return (
    <View style={{ width: 300, height: 220, alignItems: "center", justifyContent: "center" }}>
      {/* Student initials cards */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 16, marginTop: -20 }}>
        {students.map((s, i) => (
          <Animated.View key={i} style={{
            marginLeft: i === 0 ? 0 : -20,
            zIndex: i === 1 ? 3 : i,
            transform: [{ scale: scales[i] }, { rotate: s.rotate }, { translateY: i === 1 ? -12 : 0 }],
          }}>
            <View style={{ width: 70, height: 70, borderRadius: 22, padding: 3, backgroundColor: t.card, borderWidth: 1, borderColor: t.cardBorder }}>
              <LinearGradient colors={s.colors} start={[0, 0]} end={[1, 1]} style={{ flex: 1, borderRadius: 18, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 18, fontWeight: "800", color: "white" }}>{s.i}</Text>
              </LinearGradient>
            </View>
          </Animated.View>
        ))}
      </View>

      {/* Parent figure below */}
      <View style={{ alignItems: "center" }}>
        <ParentFigure scale={0.72} color={ACCENT_2} />
      </View>
    </View>
  );
}

function SlideArt({ art }: { art: typeof SLIDES[0]["art"] }) {
  if (art === "logo") return <ArtLogo />;
  if (art === "qr") return <ArtQR />;
  if (art === "notif") return <ArtNotif />;
  if (art === "bars") return <ArtBars />;
  return <ArtFamily />;
}

// ── Main screen ─────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const t = useTheme();
  const [idx, setIdx] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const slide = SLIDES[idx];

  async function finish() {
    await AsyncStorage.setItem("onboarding_done", "true");
    router.replace("/login");
  }

  const goTo = useCallback((nextIdx: number) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 130, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -18, duration: 130, useNativeDriver: true }),
    ]).start(() => {
      setIdx(nextIdx);
      slideAnim.setValue(18);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  }, []);

  function handleNext() {
    if (idx < SLIDES.length - 1) goTo(idx + 1);
    else finish();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <BgBlobs />

      {/* Top row: logo + skip */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4, zIndex: 2 }}>
        <Image
          source={require("../assets/images/kap_logo_transparent.png")}
          style={{ width: 110, height: 32 }}
          contentFit="contain"
          tintColor={t.dark ? "#FFFFFF" : undefined}
        />
        {idx < SLIDES.length - 1 && (
          <TouchableOpacity onPress={finish} hitSlop={{ top: 12, bottom: 12, left: 20, right: 20 }}>
            <Text style={{ fontSize: 13, color: t.text2, fontWeight: "600" }}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Art area */}
      <Animated.View style={{ flex: 1, alignItems: "center", justifyContent: "center", opacity: fadeAnim, transform: [{ translateY: slideAnim }], zIndex: 2 }}>
        <SlideArt art={slide.art} />
      </Animated.View>

      {/* Text + nav */}
      <View style={{ paddingHorizontal: 24, paddingBottom: 32, zIndex: 2 }}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <Text style={{ fontSize: 10, fontWeight: "800", color: slide.color, letterSpacing: 0.9, textTransform: "uppercase", textAlign: "center", marginBottom: 8 }}>
            {slide.eyebrow}
          </Text>
          <Text style={{ fontSize: 26, fontWeight: "800", color: t.text, letterSpacing: -0.5, lineHeight: 32, textAlign: "center", marginBottom: 10 }}>
            {slide.title}
          </Text>
          <Text style={{ fontSize: 14, color: t.text2, lineHeight: 22, textAlign: "center", marginBottom: 24 }}>
            {slide.body}
          </Text>
        </Animated.View>

        {/* Progress dots */}
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginBottom: 18 }}>
          {SLIDES.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => i !== idx && goTo(i)} activeOpacity={0.7}>
              <Animated.View style={{
                height: 6, borderRadius: 3,
                width: i === idx ? 22 : 6,
                backgroundColor: i === idx ? slide.color : t.neutralSoft,
              }} />
            </TouchableOpacity>
          ))}
        </View>

        {/* CTA button */}
        <TouchableOpacity onPress={handleNext} activeOpacity={0.88}>
          <LinearGradient
            colors={[slide.color, slide.color === ACCENT ? ACCENT_2 : slide.color]}
            start={[0, 0]} end={[1, 0]}
            style={{ height: 54, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, shadowColor: slide.color, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } }}
          >
            <Text style={{ color: "white", fontSize: 16, fontWeight: "700", letterSpacing: 0.1 }}>
              {idx === SLIDES.length - 1 ? "Get started" : "Next"}
            </Text>
            <Ionicons name={idx === SLIDES.length - 1 ? "checkmark" : "arrow-forward"} size={18} color="white" />
          </LinearGradient>
        </TouchableOpacity>

        {idx < SLIDES.length - 1 && (
          <Text style={{ textAlign: "center", marginTop: 10, fontSize: 12, color: t.text3 }}>
            {idx + 1} of {SLIDES.length}
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}
