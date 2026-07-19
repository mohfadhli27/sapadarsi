"use client";

import { useParams } from "next/navigation";
import { StaffMonitorPanel } from "@/src/components/staff/staff-monitor-panel";
import { Logo } from "@/src/components/shared/logo";

export default function DoctorMonitorPage() {
  const params = useParams();
  const token = params.token as string;

  if (!token) {
    return <p className="p-6 text-destructive">Token monitor tidak valid</p>;
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#f8faf9] dark:bg-background">
      <header className="shrink-0 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1600px] items-center gap-3 px-4 py-3 lg:px-6">
          <Logo size="sm" />
          <div>
            <p className="text-sm font-semibold">Monitor Konsultasi</p>
            <p className="text-xs text-muted-foreground">
              Akses via link — tanpa login
            </p>
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-4 py-4 lg:px-6 lg:py-5">
        <StaffMonitorPanel
          sessionId={0}
          bypassToken={token}
        />
      </main>
    </div>
  );
}
