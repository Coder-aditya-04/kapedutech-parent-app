const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export async function sendPushNotification(
  pushToken: string | null,
  title: string,
  body: string
): Promise<void> {
  if (!pushToken?.startsWith("ExponentPushToken[")) return;
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ to: pushToken, title, body, sound: "default", data: { title, body } }),
    });
    const data = await res.json() as { data?: { status: string; message?: string }[] };
    if (data.data?.[0]?.status === "error") {
      console.error("[Notification] Error:", data.data[0].message);
    }
  } catch (err) {
    console.error("[Notification] Fetch failed:", err);
  }
}

// Expo rejects a request with more than 100 messages outright, so a large
// send (absent alerts across all batches, a results upload) is split.
const EXPO_MAX_PER_REQUEST = 100;

export async function sendBatchPushNotifications(
  messages: { to: string; title: string; body: string }[]
): Promise<void> {
  const valid = messages.filter(m => m.to?.startsWith("ExponentPushToken["));
  for (let i = 0; i < valid.length; i += EXPO_MAX_PER_REQUEST) {
    const chunk = valid.slice(i, i + EXPO_MAX_PER_REQUEST);
    try {
      await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(chunk.map(m => ({ ...m, sound: "default", data: { title: m.title, body: m.body } }))),
      });
    } catch (err) {
      console.error("[Notification] Batch failed:", err);
    }
  }
}
