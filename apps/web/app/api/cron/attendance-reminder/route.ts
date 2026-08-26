import { NextRequest } from "next/server";
import { sendAbsentAlerts } from "@/app/api/admin/notifications/absent-alert/route";

// Called by Vercel Cron at 10 AM IST (04:30 UTC) every weekday
export async function GET(request: NextRequest) {
  const secret = request.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sendAbsentAlerts();
    console.log("[cron-attendance-reminder]", result);
    return Response.json({ success: true, ...result });
  } catch (e) {
    console.error("[cron-attendance-reminder]", e);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
