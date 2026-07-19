"use client";

import { useCallback, useEffect, useState } from "react";
import type { RsiDoctorSlot } from "@/src/lib/rsi-api";
import { PractitionerCarousel } from "@/src/components/shared/practitioner-carousel";
import { Button } from "@/src/components/ui/button";
import { RefreshCw } from "lucide-react";

type Props = {
  sessionId: number;
  patientId: number;
  practitioners: RsiDoctorSlot[];
  onSelect: (practitioner: RsiDoctorSlot) => void;
  loading?: boolean;
  selectedCode?: string;
  onPractitionersUpdate: (practitioners: RsiDoctorSlot[]) => void;
};

export function LivePractitionerPicker({
  sessionId,
  patientId,
  practitioners,
  onSelect,
  loading,
  selectedCode,
  onPractitionersUpdate,
}: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(
        `/api/consultations/${sessionId}?patientId=${patientId}&refreshPractitioners=1`
      );
      const data = await res.json();
      if (res.ok && data.practitioners?.length) {
        onPractitionersUpdate(data.practitioners);
      }
      setLastSync(new Date());
    } finally {
      setRefreshing(false);
    }
  }, [sessionId, patientId, onPractitionersUpdate]);

  useEffect(() => {
    if (practitioners.length === 0) {
      void refresh();
    } else {
      setLastSync(new Date());
    }
    const interval = setInterval(() => void refresh(), 60000);
    return () => clearInterval(interval);
  }, [refresh, practitioners.length]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 px-4">
        <div>
          <p className="text-sm font-semibold">Bidan & Perawat Tersedia</p>
          <p className="text-[11px] text-muted-foreground">
            Direkomendasikan sesuai keluhan · perawat dihubungkan ke tim Telegram perawat
            {lastSync &&
              ` · ${lastSync.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`}
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
      <PractitionerCarousel
        title=""
        practitioners={practitioners}
        onSelect={onSelect}
        loading={loading || refreshing}
        selectedCode={selectedCode}
        selectLabel="Pilih"
        variant="bidan"
      />
    </div>
  );
}
