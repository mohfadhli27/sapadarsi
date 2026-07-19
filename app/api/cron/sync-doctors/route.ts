import { NextRequest, NextResponse } from "next/server";
import { runDoctorSyncSafe } from "@/src/lib/sync-scheduler";

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const header = req.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
  const querySecret = req.nextUrl.searchParams.get("secret");

  if (!secret || (bearer !== secret && querySecret !== secret)) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const out = await runDoctorSyncSafe({ triggeredBy: "cron" });
    if (out.skipped) {
      return NextResponse.json({ success: false, message: out.reason }, { status: 409 });
    }
    return NextResponse.json({ success: out.result.success, result: out.result });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Gagal" },
      { status: 500 }
    );
  }
}
