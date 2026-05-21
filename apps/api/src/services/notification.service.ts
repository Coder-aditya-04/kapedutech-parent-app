const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export async function sendPushNotification(
  pushToken: string | null,
  title: string,
  body: string
): Promise<void> {
  if (!pushToken) {
    console.log(`[Notification] No push token — skipping.`);
    return;
  }
  if (!pushToken.startsWith("ExponentPushToken[")) {
    console.warn(`[Notification] Invalid token format: ${pushToken}`);
    return;
  }
  const payload = { to: pushToken, title, body, sound: "default", data: { title, body } };
  console.log(`[Notification] Sending: "${title}" → ${pushToken}`);
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json() as { data?: { status: string; message?: string }[] };
    const ticket = data.data?.[0];
    if (ticket?.status === "error") {
      console.error(`[Notification] Delivery error: ${ticket.message}`);
    } else {
      console.log(`[Notification] Sent OK: "${title}"`);
    }
  } catch (err) {
    console.error(`[Notification] Fetch failed:`, err);
  }
}

// Send up to 100 notifications in one Expo batch request
export async function sendBatchPushNotifications(
  messages: { to: string; title: string; body: string }[]
): Promise<void> {
  const valid = messages.filter(m => m.to?.startsWith("ExponentPushToken["));
  if (!valid.length) return;
  console.log(`[Notification] Batch sending ${valid.length} notifications`);
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(valid.map(m => ({ ...m, sound: "default", data: { title: m.title, body: m.body } }))),
    });
    const data = await res.json();
    console.log(`[Notification] Batch response:`, JSON.stringify(data));
  } catch (err) {
    console.error(`[Notification] Batch send failed:`, err);
  }
}
