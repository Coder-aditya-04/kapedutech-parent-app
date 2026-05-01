import {
  View, Dimensions, TouchableOpacity, Animated, Easing,
} from "react-native";
import { Text } from "react-native-paper";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useState, useRef, useEffect, useCallback } from "react";
import { LinearGradient } from "expo-linear-gradient";
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

// ── Illustrations ─────────────────────────────────────────────────────────────

function ArtLogo() {
  const t = useTheme();
  const pulse1 = useRef(new Animated.Value(1)).current;
  const pulse2 = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse1, { toValue: 1.1, duration: 1200, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      Animated.timing(pulse1, { toValue: 1, duration: 1200, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.delay(600),
      Animated.timing(pulse2, { toValue: 1.1, duration: 1200, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      Animated.timing(pulse2, { toValue: 1, duration: 1200, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
    ])).start();
  }, []);

  return (
    <View style={{ width: 280, height: 200, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{
        position: "absolute", width: 220, height: 220, borderRadius: 110,
        borderWidth: 1.5, borderColor: `rgba(31,168,224,0.25)`, transform: [{ scale: pulse1 }],
      }} />
      <Animated.View style={{
        position: "absolute", width: 160, height: 160, borderRadius: 80,
        borderWidth: 1.5, borderColor: `rgba(31,168,224,0.4)`, transform: [{ scale: pulse2 }],
      }} />
      <View style={{ width: 100, height: 100, borderRadius: 32, backgroundColor: `rgba(31,168,224,0.12)`, alignItems: "center", justifyContent: "center" }}>
        <Image
          source={require("../assets/images/kap_logo.png")}
          style={{ width: 86, height: 86 }}
          contentFit="contain"
        />
      </View>
    </View>
  );
}

function ArtQR() {
  const t = useTheme();
  const scanY = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(scanY, { toValue: 70, duration: 1600, useNativeDriver: false, easing: Easing.inOut(Easing.ease) }),
      Animated.timing(scanY, { toValue: 0, duration: 1600, useNativeDriver: false, easing: Easing.inOut(Easing.ease) }),
    ])).start();
    Animated.spring(checkScale, { toValue: 1, delay: 400, useNativeDriver: true, damping: 8, stiffness: 180 }).start();
  }, []);

  return (
    <View style={{ width: 300, height: 200, alignItems: "center", justifyContent: "center" }}>
      {/* Gate header */}
      <View style={{ position: "absolute", top: 0, left: 20, right: 20, height: 44, borderRadius: 14, backgroundColor: `rgba(31,168,224,0.12)`, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14 }}>
        <Text style={{ fontSize: 9, fontWeight: "800", letterSpacing: 1, color: ACCENT }}>KAP CAMPUS · GATE 2</Text>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: GOOD }} />
      </View>

      {/* QR Scanner box */}
      <View style={{ width: 100, height: 100, borderRadius: 16, backgroundColor: "#0b1220", padding: 8, overflow: "hidden", position: "absolute", top: 50 }}>
        {/* QR grid pattern */}
        <View style={{ flex: 1 }}>
          {/* Corner squares */}
          {[{ t: 0, l: 0 }, { t: 0, r: 0 }, { b: 0, l: 0 }].map((pos, i) => (
            <View key={i} style={[{ position: "absolute", width: 20, height: 20, backgroundColor: "white", borderRadius: 2 }, pos as never]} />
          ))}
          {/* Dot fill */}
          <View style={{ position: "absolute", top: 3, left: 3, width: 14, height: 14, backgroundColor: "#0b1220", borderRadius: 1 }} />
          <View style={{ position: "absolute", top: 3, right: 3, width: 14, height: 14, backgroundColor: "#0b1220", borderRadius: 1 }} />
          <View style={{ position: "absolute", bottom: 3, left: 3, width: 14, height: 14, backgroundColor: "#0b1220", borderRadius: 1 }} />
          {/* Inner squares */}
          <View style={{ position: "absolute", top: 6, left: 6, width: 8, height: 8, backgroundColor: "white", borderRadius: 1 }} />
          <View style={{ position: "absolute", top: 6, right: 6, width: 8, height: 8, backgroundColor: "white", borderRadius: 1 }} />
          <View style={{ position: "absolute", bottom: 6, left: 6, width: 8, height: 8, backgroundColor: "white", borderRadius: 1 }} />
          {/* Data dots */}
          {[[28, 6], [34, 6], [28, 14], [34, 20], [28, 26], [40, 10], [46, 18], [40, 28]].map(([x, y], i) => (
            <View key={i} style={{ position: "absolute", left: x, top: y, width: 5, height: 5, backgroundColor: "white", borderRadius: 1 }} />
          ))}
        </View>
        {/* Scan line */}
        <Animated.View style={{
          position: "absolute", left: 6, right: 6, height: 2,
          backgroundColor: ACCENT, top: scanY,
          shadowColor: ACCENT, shadowOpacity: 0.8, shadowRadius: 4,
        }} />
        {/* Corner brackets */}
        {[
          { top: 4, left: 4, borderTopWidth: 2, borderLeftWidth: 2 },
          { top: 4, right: 4, borderTopWidth: 2, borderRightWidth: 2 },
          { bottom: 4, left: 4, borderBottomWidth: 2, borderLeftWidth: 2 },
          { bottom: 4, right: 4, borderBottomWidth: 2, borderRightWidth: 2 },
        ].map((style, i) => (
          <View key={i} style={[{ position: "absolute", width: 12, height: 12, borderColor: ACCENT }, style as never]} />
        ))}
      </View>

      {/* Check badge */}
      <Animated.View style={{
        position: "absolute", top: 42, right: 70,
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: GOOD, alignItems: "center", justifyContent: "center",
        transform: [{ scale: checkScale }],
        shadowColor: GOOD, shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
      }}>
        <MaterialCommunityIcons name="check" size={14} color="white" />
      </Animated.View>

      {/* Student figure */}
      <View style={{ position: "absolute", bottom: 0, left: 60, alignItems: "center" }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `rgba(31,168,224,0.18)`, alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name="account-school" size={26} color={ACCENT} />
        </View>
        <View style={{ width: 20, height: 32, backgroundColor: "rgba(31,168,224,0.2)", borderRadius: 6, marginTop: 2 }} />
        <View style={{ flexDirection: "row", gap: 4, marginTop: 1 }}>
          <View style={{ width: 8, height: 16, backgroundColor: "rgba(15,23,42,0.5)", borderRadius: 4 }} />
          <View style={{ width: 8, height: 16, backgroundColor: "rgba(15,23,42,0.5)", borderRadius: 4 }} />
        </View>
      </View>

      {/* Ground line */}
      <View style={{ position: "absolute", bottom: 0, left: 8, right: 8, height: 1.5, backgroundColor: "rgba(31,168,224,0.2)", borderRadius: 1 }} />
    </View>
  );
}

function ArtNotif() {
  const t = useTheme();
  const toastScale = useRef(new Animated.Value(0)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.parallel([
        Animated.spring(toastScale, { toValue: 1, useNativeDriver: true, damping: 10, stiffness: 160 }),
        Animated.timing(toastOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      Animated.delay(2000),
      Animated.parallel([
        Animated.timing(toastScale, { toValue: 0.8, duration: 200, useNativeDriver: true }),
        Animated.timing(toastOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]),
      Animated.delay(600),
    ])).start();
  }, []);

  return (
    <View style={{ width: 300, height: 200, alignItems: "center", justifyContent: "center" }}>
      {/* Signal arcs */}
      {[60, 90, 120].map((size, i) => (
        <View key={i} style={{
          position: "absolute", top: 20,
          width: size, height: size / 2,
          borderTopWidth: 1.5, borderColor: `rgba(31,168,224,${0.15 + i * 0.1})`,
          borderRadius: size / 2, borderBottomWidth: 0, borderLeftWidth: 0, borderRightWidth: 0,
        }} />
      ))}

      {/* Notification toast */}
      <Animated.View style={{
        position: "absolute", top: 16, left: "50%", marginLeft: -100, width: 200,
        borderRadius: 14, overflow: "hidden",
        transform: [{ scale: toastScale }], opacity: toastOpacity,
      }}>
        <GlassCard intensity={70} style={{ padding: 10, borderRadius: 14 }}>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <LinearGradient colors={[ACCENT, ACCENT_2]} start={[0, 0]} end={[1, 1]} style={{ width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center" }}>
              <MaterialCommunityIcons name="check" size={14} color="white" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: "800", color: t.text, letterSpacing: -0.2 }}>Punched IN</Text>
              <Text style={{ fontSize: 10, color: t.text2, marginTop: 1 }}>07:42 AM · 12 min early</Text>
            </View>
          </View>
        </GlassCard>
      </Animated.View>

      {/* Student left */}
      <View style={{ position: "absolute", left: 20, bottom: 0, alignItems: "center" }}>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: `rgba(31,168,224,0.18)`, alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name="account-school" size={22} color={ACCENT} />
        </View>
        <View style={{ width: 18, height: 26, backgroundColor: "rgba(31,168,224,0.2)", borderRadius: 5, marginTop: 2 }} />
      </View>

      {/* Parent right */}
      <View style={{ position: "absolute", right: 20, bottom: 0, alignItems: "center" }}>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: `rgba(79,70,229,0.18)`, alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name="account" size={22} color={ACCENT_2} />
        </View>
        <View style={{ width: 18, height: 26, backgroundColor: "rgba(79,70,229,0.2)", borderRadius: 5, marginTop: 2 }} />
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
      Animated.timing(v, { toValue: 1, duration: 700, delay: 200 + i * 100, useNativeDriver: false, easing: Easing.out(Easing.cubic) })
    )).start();
  }, []);

  return (
    <View style={{ width: 280, height: 200, alignItems: "center", justifyContent: "center" }}>
      <GlassCard intensity={60} style={{ width: 240, padding: 16, borderRadius: 18 }}>
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
    { i: "AS", colors: [ACCENT, ACCENT_2] as [string, string], offset: 0, rotate: "-4deg" },
    { i: "PS", colors: [WARN, "#EF4444"] as [string, string], offset: -18, rotate: "0deg" },
    { i: "RS", colors: ["#10B981", GOOD] as [string, string], offset: 18, rotate: "4deg" },
  ];

  const scales = students.map(() => useRef(new Animated.Value(0)).current);
  useEffect(() => {
    Animated.stagger(100, scales.map((s) =>
      Animated.spring(s, { toValue: 1, useNativeDriver: true, damping: 10, stiffness: 180 })
    )).start();
  }, []);

  return (
    <View style={{ width: 280, height: 200, alignItems: "center", justifyContent: "center" }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        {students.map((s, i) => (
          <Animated.View key={i} style={{
            marginLeft: i === 0 ? 0 : -20,
            zIndex: i === 1 ? 3 : i,
            transform: [{ scale: scales[i] }, { rotate: s.rotate }, { translateY: i === 1 ? -10 : 0 }],
          }}>
            <View style={{ width: 68, height: 68, borderRadius: 20, padding: 3, backgroundColor: t.card, borderWidth: 1, borderColor: t.cardBorder }}>
              <LinearGradient colors={s.colors} start={[0, 0]} end={[1, 1]} style={{ flex: 1, borderRadius: 16, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 18, fontWeight: "800", color: "white" }}>{s.i}</Text>
              </LinearGradient>
            </View>
          </Animated.View>
        ))}
      </View>
      <View style={{ alignItems: "center" }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: `rgba(79,70,229,0.18)`, alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name="account" size={28} color={ACCENT_2} />
        </View>
        <View style={{ width: 22, height: 30, backgroundColor: `rgba(79,70,229,0.2)`, borderRadius: 6, marginTop: 2 }} />
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
      Animated.timing(fadeAnim, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -16, duration: 140, useNativeDriver: true }),
    ]).start(() => {
      setIdx(nextIdx);
      slideAnim.setValue(16);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
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
          source={require("../assets/images/kap_logo.png")}
          style={{ width: 100, height: 30 }}
          contentFit="contain"
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

        {/* Dots */}
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginBottom: 18 }}>
          {SLIDES.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => i !== idx && goTo(i)} activeOpacity={0.7}>
              <View style={{
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
            style={{ height: 54, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, shadowColor: slide.color, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } }}
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
