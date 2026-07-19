import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/src/lib/admin-api-auth";
import { getLatestSyncRun, listSyncRuns } from "@/src/lib/rsi-doctor-sync";
import { isSyncInProgress, runDoctorSyncSafe } from "@/src/lib/sync-scheduler";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ success: false, message: "Akses ditolak" }, { status: 403 });
  }

  try {
    const [latest, logs] = await Promise.all([getLatestSyncRun(), listSyncRuns(15)]);
    return NextResponse.json({
      success: true,
      latest,
      logs,
      inProgress: isSyncInProgress(),
      autoSyncEnabled: process.env.RSI_SYNC_AUTO === "true",
      syncIntervalMinutes: Number(process.env.RSI_SYNC_INTERVAL_MINUTES ?? 360),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Gagal memuat" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    return NextResponse.json({ success: false, message: "Akses ditolak" }, { status: 403 });
  }

  try {
    const out = await runDoctorSyncSafe({
      triggeredBy: `admin:${admin.username}`,
      staffId: admin.id,
    });

    if (out.skipped) {
      return NextResponse.json(
        { success: false, message: out.reason },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: out.result.success,
      result: out.result,
      message: out.result.success
        ? `${out.result.doctorsSynced} dokter aktif disinkronkan`
        : out.result.errors[0] ?? "Sinkronisasi gagal",
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Gagal sinkron" },
      { status: 500 }
    );
  }
}
