import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { PaperProvider, MD3LightTheme, MD3DarkTheme } from "react-native-paper";
import { AuthProvider } from "@/src/context/AuthContext";
import { useEffect } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const lightTheme = {
  ...MD3LightTheme,
  colors: { ...MD3LightTheme.colors, primary: "#1FA8E0", secondary: "#4F46E5" },
};
const darkTheme = {
  ...MD3DarkTheme,
  colors: { ...MD3DarkTheme.colors, primary: "#1FA8E0", secondary: "#4F46E5" },
};

function NotificationListener() {
  useEffect(() => {
    let receivedSub: { remove: () => void } | null = null;
    let responseSub: { remove: () => void } | null = null;

    (async () => {
      try {
        const Notifications = await import("expo-notifications");

        if (require("react-native").Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "KAP Connect",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#1FA8E0",
            showBadge: true,
          });
        }

        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });

        async function saveNotification(title: string, body: string, data: Record<string, unknown>, id: string) {
          try {
            const finalTitle = title || (typeof data?.title === "string" ? data.title : "") || "KAP Edutech";
            const finalBody  = body  || (typeof data?.body  === "string" ? data.body  : "");
            // Skip notifications with no body — these are empty/system notifications
            if (!finalBody.trim()) return;
            const raw = await AsyncStorage.getItem("notifications");
            const existing = raw ? JSON.parse(raw) : [];
            if (existing.some((n: { id: string }) => n.id === id)) return;
            const updated = [
              { id, title: finalTitle, body: finalBody, time: new Date().toISOString(), read: false },
              ...existing,
            ].slice(0, 50);
            await AsyncStorage.setItem("notifications", JSON.stringify(updated));
          } catch {}
        }

        receivedSub = Notifications.addNotificationReceivedListener((notification) => {
          const title = notification.request.content.title ?? "";
          const body = notification.request.content.body ?? "";
          const data = (notification.request.content.data ?? {}) as Record<string, unknown>;
          const id = notification.request.identifier;
          saveNotification(title, body, data, id);
        });

        responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
          const title = response.notification.request.content.title ?? "";
          const body = response.notification.request.content.body ?? "";
          const data = (response.notification.request.content.data ?? {}) as Record<string, unknown>;
          const id = response.notification.request.identifier;
          saveNotification(title, body, data, id);
        });
      } catch (e) {
        console.log("[NotificationListener] skipped:", e);
      }
    })();

    return () => {
      receivedSub?.remove();
      responseSub?.remove();
    };
  }, []);

  return null;
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const paperTheme = scheme === "dark" ? darkTheme : lightTheme;

  return (
    <AuthProvider>
      <PaperProvider theme={paperTheme}>
        <NotificationListener />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="login" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="test-detail" />
          <Stack.Screen name="modal" />
        </Stack>
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      </PaperProvider>
    </AuthProvider>
  );
}
