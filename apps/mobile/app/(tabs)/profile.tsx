import { ScrollView, View, TouchableOpacity, Alert, Modal, Pressable, Switch } from "react-native";
import { Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "@/src/context/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme, ACCENT, ACCENT_2, GOOD, BAD, BgBlobs } from "@/src/theme";

type Student = { id: string; name: string; enrollmentNo: string; batch: string };
type Parent = { id: string; name: string; phone: string; students: Student[] };

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

function LangSwitch({ value, onChange }: { value: "en" | "hi"; onChange: (v: "en" | "hi") => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", backgroundColor: t.neutralSoft, borderRadius: 10, padding: 2 }}>
      {([{ id: "en" as const, l: "EN" }, { id: "hi" as const, l: "हिं" }]).map(o => (
        <TouchableOpacity
          key={o.id}
          onPress={() => onChange(o.id)}
          activeOpacity={0.7}
          style={{
            paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8,
            backgroundColor: value === o.id ? t.card : "transparent",
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "700", color: value === o.id ? t.text : t.text3 }}>{o.l}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function SettingRow({ icon, iconBg, iconFg, label, right, onPress, danger }: {
  icon: string; iconBg: string; iconFg: string; label: string;
  right?: React.ReactNode; onPress?: () => void; danger?: boolean;
}) {
  const t = useTheme();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.7 : 1} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12 }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: iconBg, alignItems: "center", justifyContent: "center" }}>
        <MaterialCommunityIcons name={icon as never} size={18} color={iconFg} />
      </View>
      <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: danger ? BAD : t.text }}>{label}</Text>
      {right ?? <MaterialCommunityIcons name="chevron-right" size={18} color={t.text3} />}
    </TouchableOpacity>
  );
}

function SwitchStudentSheet({ open, onClose, students, currentId, onPick }: {
  open: boolean; onClose: () => void;
  students: Student[]; currentId: string | null;
  onPick: (s: Student) => void;
}) {
  const t = useTheme();
  if (!open) return null;
  return (
    <Modal transparent animationType="slide" visible={open} onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }} onPress={onClose}>
        <Pressable onPress={() => {}} style={{ backgroundColor: t.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 }}>
          {/* Grabber */}
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: t.neutralSoft, alignSelf: "center", marginBottom: 16 }} />
          <Text style={{ fontSize: 18, fontWeight: "800", color: t.text, letterSpacing: -0.3, marginBottom: 16 }}>Switch student</Text>
          <View style={{ gap: 10 }}>
            {students.map(s => {
              const active = s.id === currentId;
              return (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => onPick(s)}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: "row", alignItems: "center", gap: 14, padding: 14,
                    borderRadius: 16,
                    borderWidth: active ? 2 : 1,
                    borderColor: active ? ACCENT : t.cardBorder,
                    backgroundColor: active ? `${ACCENT}14` : t.card,
                  }}
                >
                  <LinearGradient
                    colors={[ACCENT, ACCENT_2]}
                    start={[0, 0]} end={[1, 1]}
                    style={{ width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: "800", color: "white" }}>{initials(s.name)}</Text>
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: "700", color: t.text }}>{s.name}</Text>
                    <Text style={{ fontSize: 12, color: t.text3, marginTop: 1 }}>{s.batch}</Text>
                  </View>
                  {active && (
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: ACCENT, alignItems: "center", justifyContent: "center" }}>
                      <MaterialCommunityIcons name="check" size={16} color="white" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function ProfileScreen() {
  const t = useTheme();
  const { logout, activeStudentId, setActiveStudentId } = useAuth();
  const [parent, setParent] = useState<Parent | null>(null);
  const [lang, setLang] = useState<"en" | "hi">("en");
  const [switchOpen, setSwitchOpen] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("parent").then(raw => {
      if (raw) setParent(JSON.parse(raw));
    });
    AsyncStorage.getItem("lang").then(v => { if (v === "hi" || v === "en") setLang(v); });
  }, []);

  async function handleLangChange(v: "en" | "hi") {
    setLang(v);
    await AsyncStorage.setItem("lang", v);
  }

  async function handlePickStudent(s: Student) {
    await setActiveStudentId(s.id);
    setSwitchOpen(false);
  }

  async function handleLogout() {
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out", style: "destructive", onPress: async () => {
          await AsyncStorage.multiRemove(["auth_token", "parent", "notifications"]);
          logout();
          router.replace("/login");
        },
      },
    ]);
  }

  const student = parent?.students?.find(s => s.id === activeStudentId) ?? parent?.students?.[0];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top"]}>
      <BgBlobs />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ paddingVertical: 16 }}>
          <Text style={{ fontSize: 26, fontWeight: "800", color: t.text, letterSpacing: -0.5 }}>Profile</Text>
        </View>

        {/* Parent hero card */}
        <View style={{ backgroundColor: t.card, borderRadius: 18, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: t.cardBorder, shadowColor: t.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 3, overflow: "hidden" }}>
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 80, backgroundColor: t.accentSoft }} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: ACCENT, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 22, fontWeight: "800", color: "#fff" }}>{parent ? initials(parent.name) : "P"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: t.text3, letterSpacing: 0.8, textTransform: "uppercase" }}>Parent account</Text>
              <Text style={{ fontSize: 20, fontWeight: "800", color: t.text, letterSpacing: -0.3, marginTop: 2 }} numberOfLines={1}>
                {parent?.name ?? "Parent"}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                <MaterialCommunityIcons name="phone" size={12} color={t.text2} />
                <Text style={{ fontSize: 13, color: t.text2 }}>+91 {parent?.phone ?? "—"}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Student section */}
        {student && (
          <>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 4, marginBottom: 10 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: t.text }}>Student</Text>
              {(parent?.students?.length ?? 0) > 1 && (
                <TouchableOpacity onPress={() => setSwitchOpen(true)} activeOpacity={0.7}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: ACCENT }}>Switch student</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => (parent?.students?.length ?? 0) > 1 ? setSwitchOpen(true) : undefined}
              style={{ backgroundColor: t.card, borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: t.cardBorder, shadowColor: t.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                <LinearGradient
                  colors={[ACCENT, ACCENT_2]}
                  start={[0, 0]} end={[1, 1]}
                  style={{ width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" }}
                >
                  <Text style={{ fontSize: 18, fontWeight: "800", color: "#fff" }}>{initials(student.name)}</Text>
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: t.text }}>{student.name}</Text>
                  <Text style={{ fontSize: 12, color: t.text3, marginTop: 1 }}>{student.batch || "—"}</Text>
                  <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
                    <View style={{ backgroundColor: t.neutralSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
                      <Text style={{ fontSize: 11, fontWeight: "600", color: t.text2 }}>Enroll: {student.enrollmentNo}</Text>
                    </View>
                  </View>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={t.text3} />
              </View>
            </TouchableOpacity>
          </>
        )}

        {/* Settings */}
        <View style={{ paddingHorizontal: 4, marginBottom: 10 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: t.text }}>Settings</Text>
        </View>
        <View style={{ backgroundColor: t.card, borderRadius: 18, padding: 6, marginBottom: 10, borderWidth: 1, borderColor: t.cardBorder }}>
          <SettingRow
            icon="translate" iconBg={t.accentSoft} iconFg={ACCENT}
            label="Language"
            right={<LangSwitch value={lang} onChange={handleLangChange} />}
          />
          <View style={{ height: 1, backgroundColor: t.divider, marginHorizontal: 8 }} />
          <SettingRow icon="shield-check-outline" iconBg={`${GOOD}20`} iconFg={GOOD} label="App lock" right={
            <Switch value={false} onValueChange={() => {}} trackColor={{ false: t.neutralSoft, true: `${GOOD}60` }} thumbColor={t.text3} />
          } />
        </View>

        <View style={{ backgroundColor: t.card, borderRadius: 18, padding: 6, marginBottom: 14, borderWidth: 1, borderColor: t.cardBorder }}>
          <SettingRow icon="information-outline" iconBg={t.neutralSoft} iconFg={t.text2} label="About KAP Connect" />
          <View style={{ height: 1, backgroundColor: t.divider, marginHorizontal: 8 }} />
          <SettingRow icon="shield-lock-outline" iconBg={t.neutralSoft} iconFg={t.text2} label="Privacy & data" />
          <View style={{ height: 1, backgroundColor: t.divider, marginHorizontal: 8 }} />
          <SettingRow icon="help-circle-outline" iconBg={t.neutralSoft} iconFg={t.text2} label="Help & support" />
        </View>

        {/* Logout */}
        <TouchableOpacity
          onPress={handleLogout}
          activeOpacity={0.88}
          style={{ backgroundColor: `${BAD}14`, borderRadius: 14, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          <MaterialCommunityIcons name="logout" size={18} color={BAD} />
          <Text style={{ fontSize: 15, fontWeight: "700", color: BAD }}>Log out</Text>
        </TouchableOpacity>

        {/* Footer */}
        <View style={{ alignItems: "center", marginTop: 24, gap: 8 }}>
          <Image
            source={require("@/assets/images/kap_logo_transparent.png")}
            style={{ width: 160, height: 52 }}
            contentFit="contain"
            tintColor={t.dark ? "white" : undefined}
          />
          <Text style={{ fontSize: 11, color: t.text3, fontWeight: "600" }}>v2.4.1 • © 2026 KAP Edutech</Text>
        </View>
      </ScrollView>

      {/* Switch student bottom sheet */}
      <SwitchStudentSheet
        open={switchOpen}
        onClose={() => setSwitchOpen(false)}
        students={parent?.students ?? []}
        currentId={activeStudentId}
        onPick={handlePickStudent}
      />
    </SafeAreaView>
  );
}
