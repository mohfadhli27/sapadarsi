"use client";

import { useCallback, useEffect, useState } from "react";
import type { RsiDoctorSlot } from "@/src/lib/rsi-api";
import { DoctorPicker } from "@/src/components/doctor/doctor-picker";
import { Button } from "@/src/components/ui/button";
import { RefreshCw } from "lucide-react";

type Props = {
  sessionId: number;
  patientId: number;
  doctors: RsiDoctorSlot[];
  onSelect: (doctor: RsiDoctorSlot) => void;
  loading?: boolean;
  selectedCode?: string;
  onDoctorsUpdate: (doctors: RsiDoctorSlot[]) => void;
};

export function LiveDoctorPicker({
  sessionId,
  patientId,
  doctors,
  onSelect,
  loading,
  selectedCode,
  onDoctorsUpdate,
}: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [source, setSource] = useState<string>("");

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(
        `/api/doctors/consultations/${sessionId}?patientId=${patientId}&refreshDoctors=1`
      );
      const data = await res.json();
      if (res.ok && data.doctors?.length) {
        onDoctorsUpdate(data.doctors);
        setSource(data.source === "refreshed" ? "Diperbarui" : "");
      }
      setLastSync(new Date());
    } finally {
      setRefreshing(false);
    }
  }, [sessionId, patientId, onDoctorsUpdate]);

  useEffect(() => {
    if (doctors.length === 0) {
      void refresh();
    } else {
      setLastSync(new Date());
    }
    const interval = setInterval(() => void refresh(), 60000);
    return () => clearInterval(interval);
  }, [refresh, doctors.length]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 px-4">
        <div>
          <p className="text-sm font-semibold">Dokter Tersedia Hari Ini</p>
          <p className="text-[11px] text-muted-foreground">
            Direkomendasikan sesuai keluhan · geser untuk lihat lebih banyak
            {lastSync && ` · ${lastSync.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`}
            {source && ` · ${source}`}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={refreshing}
          onClick={() => void refresh()}
          className="shrink-0 gap-1"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>
      <DoctorPicker
        doctors={doctors}
        onSelect={onSelect}
        loading={loading || refreshing}
        selectedCode={selectedCode}
      />
    </div>
  );
}
