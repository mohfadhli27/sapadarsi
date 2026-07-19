import { syncDoctorsFromRsi } from "@/src/lib/rsi-doctor-sync";

let syncInProgress = false;
let schedulerStarted = false;

export function isSyncInProgress() {
  return syncInProgress;
}

export async function runDoctorSyncSafe(input?: {
  triggeredBy?: string;
  staffId?: number;
}) {
  if (syncInProgress) {
    return { skipped: true as const, reason: "Sync sedang berjalan" };
  }
  syncInProgress = true;
  try {
    const result = await syncDoctorsFromRsi(input);
    return { skipped: false as const, result };
  } finally {
    syncInProgress = false;
  }
}

export function startDoctorSyncScheduler() {
  if (schedulerStarted) return;
  if (process.env.RSI_SYNC_AUTO !== "true") return;

  schedulerStarted = true;
  const minutes = Number(process.env.RSI_SYNC_INTERVAL_MINUTES ?? 360);
  const intervalMs = Math.max(15, minutes) * 60 * 1000;

  const tick = () => {
    void runDoctorSyncSafe({ triggeredBy: "scheduler" }).then((out) => {
      if (!out.skipped && out.result.success) {
        console.log(
          `[RSI sync] ${out.result.doctorsSynced} dokter aktif (${out.result.durationMs}ms)`
        );
      } else if (!out.skipped && !out.result.success) {
        console.warn("[RSI sync] gagal:", out.result.errors.join("; "));
      }
    });
  };

  const bootDelayMs = Number(process.env.RSI_SYNC_BOOT_DELAY_MS ?? 120_000);
  setTimeout(tick, bootDelayMs);
  setInterval(tick, intervalMs);
  console.log(
    `[RSI sync] scheduler aktif — interval ${minutes} menit, boot delay ${bootDelayMs / 1000}s`
  );
}
