export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startDoctorSyncScheduler } = await import("@/src/lib/sync-scheduler");
    startDoctorSyncScheduler();
  }
}
