"use client";

import { useCallback, useState } from "react";
import { Truck, Store, XCircle } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import type { PharmacyPrescriptionOrder } from "@/src/types/pharmacy-order";

type Props = {
  order: PharmacyPrescriptionOrder;
  patientId: number;
  sessionId: number;
  onDecisionComplete: () => void;
};

export function PharmacyOrderDecisionCard({
  order,
  patientId,
  sessionId,
  onDecisionComplete,
}: Props) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState(order.deliveryAddress ?? "");
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalLabel =
    order.totalPrice != null
      ? new Intl.NumberFormat("id-ID", {
          style: "currency",
          currency: "IDR",
          maximumFractionDigits: 0,
        }).format(order.totalPrice)
      : null;

  const submitDecision = useCallback(
    async (decision: "delivery" | "pickup" | "cancel", address?: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/pharmacy/sessions/${sessionId}/prescription-orders/${order.id}/decision`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ patientId, decision, deliveryAddress: address }),
          }
        );
        const data = await res.json();
        if (!data.success) throw new Error(data.message ?? "Gagal");
        onDecisionComplete();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal menyimpan pilihan");
      } finally {
        setLoading(false);
      }
    },
    [order.id, patientId, sessionId, onDecisionComplete]
  );

  async function handleDelivery() {
    if (!deliveryAddress.trim()) {
      setShowAddressForm(true);
      setError("Alamat pengantaran wajib diisi");
      return;
    }
    await submitDecision("delivery", deliveryAddress.trim());
  }

  return (
    <div className="mx-4 my-3 overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-background shadow-sm dark:border-blue-900 dark:from-blue-950/30">
      <div className="border-b border-blue-100 px-4 py-3 dark:border-blue-900">
        <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
          Obat sudah siap — pilih pengambilan
        </p>
        {totalLabel && (
          <p className="text-xs text-muted-foreground">Total: {totalLabel}</p>
        )}
      </div>

      <div className="space-y-2 p-4">
        {(order.items ?? []).slice(0, 5).map((item) => (
          <p key={item.id} className="text-xs text-muted-foreground">
            • {item.drugName}
            {item.quantity ? ` (${item.quantity}${item.unit ? ` ${item.unit}` : ""})` : ""}
          </p>
        ))}

        {showAddressForm && (
          <textarea
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            rows={3}
            placeholder="Alamat lengkap pengantaran"
            value={deliveryAddress}
            onChange={(e) => setDeliveryAddress(e.target.value)}
          />
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}

        {!confirmCancel ? (
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              className="h-10 w-full justify-start gap-2"
              disabled={loading}
              onClick={() => void handleDelivery()}
            >
              <Truck className="h-4 w-4" />
              Antar ke alamat saya
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full justify-start gap-2"
              disabled={loading}
              onClick={() => void submitDecision("pickup")}
            >
              <Store className="h-4 w-4" />
              Saya ambil sendiri di apotek
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-10 w-full justify-start gap-2 text-destructive hover:text-destructive"
              disabled={loading}
              onClick={() => setConfirmCancel(true)}
            >
              <XCircle className="h-4 w-4" />
              Batalkan pesanan
            </Button>
          </div>
        ) : (
          <div className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-sm">Yakin batalkan pesanan obat ini?</p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={loading}
                onClick={() => void submitDecision("cancel")}
              >
                Ya, batalkan
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => setConfirmCancel(false)}
              >
                Kembali
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
