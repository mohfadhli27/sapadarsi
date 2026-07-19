"use client";

import { useCallback, useEffect, useState } from "react";
import type { PharmacyPrescriptionOrder } from "@/src/types/pharmacy-order";

export function usePharmacyOrders(patientId?: number, sessionId?: number | null) {
  const [orders, setOrders] = useState<PharmacyPrescriptionOrder[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!patientId || !sessionId) {
      setOrders([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/pharmacy/sessions/${sessionId}/prescription-orders?patientId=${patientId}`
      );
      const data = await res.json();
      if (data.success) setOrders(data.orders);
    } finally {
      setLoading(false);
    }
  }, [patientId, sessionId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const pendingDecision = orders.find(
    (o) => o.status === "medicine_ready_waiting_patient_decision"
  );

  return { orders, pendingDecision, loading, refresh };
}

export async function uploadPharmacyPrescriptionPdf(input: {
  sessionId: number;
  patientId: number;
  file: File;
}) {
  const form = new FormData();
  form.append("patientId", String(input.patientId));
  form.append("file", input.file);

  const res = await fetch(
    `/api/pharmacy/sessions/${input.sessionId}/prescription-orders`,
    { method: "POST", body: form }
  );
  const data = await res.json();
  if (!data.success) throw new Error(data.message ?? "Upload gagal");
  return data.order as PharmacyPrescriptionOrder;
}
