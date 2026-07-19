"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/src/lib/utils";
import { PharmacyOrderBoard } from "@/src/components/staff/pharmacy-order-board";
import { NEW_ORDER_FILTER_ID } from "@/src/lib/pharmacy-order-status";
import { PharmacyOrderDetail } from "@/src/components/staff/pharmacy-order-detail";
import { StaffPortalShell } from "@/src/components/staff/staff-portal-shell";
import { useStaffAuth, useStaffFetch } from "@/src/hooks/use-staff-auth";
import type { PharmacyPrescriptionOrder, SavePharmacyOrderItemInput } from "@/src/types/pharmacy-order";

export function PharmacyPortalDashboard() {
  const searchParams = useSearchParams();
  const { authHeaders, sessionToken } = useStaffAuth();
  const staffFetch = useStaffFetch();
  const [orders, setOrders] = useState<PharmacyPrescriptionOrder[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<PharmacyPrescriptionOrder | null>(null);
  const [filter, setFilter] = useState(NEW_ORDER_FILTER_ID);
  const [initialLoading, setInitialLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [parsingPrescription, setParsingPrescription] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const selectedIdRef = useRef<number | null>(null);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const loadOrders = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent && !hasLoadedRef.current) {
      setInitialLoading(true);
    }
    try {
      const res = await staffFetch("/api/staff/pharmacy-orders");
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders);
        if (!selectedIdRef.current && data.orders.length > 0) {
          setSelectedId(data.orders[0].id);
        }
      }
    } finally {
      hasLoadedRef.current = true;
      setInitialLoading(false);
    }
  }, [staffFetch]);

  const loadDetail = useCallback(
    async (orderId: number) => {
      setDetailLoading(true);
      try {
        const res = await staffFetch(`/api/staff/pharmacy-orders/${orderId}`);
        const data = await res.json();
        if (data.success) setSelectedOrder(data.order);
        else setSelectedOrder(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [staffFetch]
  );

  useEffect(() => {
    const orderParam = Number(searchParams.get("order"));
    if (orderParam && Number.isFinite(orderParam)) {
      setSelectedId(orderParam);
      setMobileDetailOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    void loadOrders();
    const interval = setInterval(() => void loadOrders({ silent: true }), 15000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setSelectedOrder(null);
  }, [selectedId, loadDetail]);

  function handleSelectOrder(id: number) {
    setSelectedId(id);
    setMobileDetailOpen(true);
  }

  function handleMobileBack() {
    setMobileDetailOpen(false);
  }

  async function parsePrescription(orderId: number, force = false) {
    setParsingPrescription(true);
    try {
      const res = await staffFetch(`/api/staff/pharmacy-orders/${orderId}/parse-prescription`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message ?? "Gagal membaca resep");
      setSelectedOrder(data.order);
      await loadOrders({ silent: true });
    } finally {
      setParsingPrescription(false);
    }
  }

  async function patchOrder(orderId: number, body: Record<string, unknown>) {
    const res = await staffFetch(`/api/staff/pharmacy-orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message ?? "Gagal");
    await loadOrders({ silent: true });
    await loadDetail(orderId);
  }

  async function postAction(orderId: number, action: "confirm-ready" | "complete") {
    const res = await staffFetch(`/api/staff/pharmacy-orders/${orderId}/${action}`, {
      method: "POST",
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message ?? "Gagal");
    await loadOrders({ silent: true });
    await loadDetail(orderId);
  }

  const detailProps = {
    order: selectedOrder,
    staffToken: sessionToken,
    loading: detailLoading && !selectedOrder,
    parsingPrescription,
    onRefresh: () => {
      void loadOrders({ silent: true });
      if (selectedId) void loadDetail(selectedId);
    },
    onStartReview: async () => {
      if (!selectedId) return;
      setParsingPrescription(true);
      try {
        await patchOrder(selectedId, { action: "start_review" });
      } finally {
        setParsingPrescription(false);
      }
    },
    onReparsePrescription:
      filter === NEW_ORDER_FILTER_ID
        ? () => (selectedId ? parsePrescription(selectedId, true) : Promise.resolve())
        : undefined,
    activeFilter: filter,
    onSavePricing: (items: SavePharmacyOrderItemInput[], note?: string) =>
      selectedId ? patchOrder(selectedId, { items, pharmacistNote: note }) : Promise.resolve(),
    onConfirmReady: () =>
      selectedId ? postAction(selectedId, "confirm-ready") : Promise.resolve(),
    onComplete: () => (selectedId ? postAction(selectedId, "complete") : Promise.resolve()),
    onBack: handleMobileBack,
    showBack: mobileDetailOpen,
  };

  return (
    <StaffPortalShell
      title="Portal Apoteker"
      subtitle="Kelola pesanan resep obat dari pasien"
    >
      <div
        className={cn(
          "overflow-hidden rounded-2xl border border-border bg-background shadow-sm",
          "flex min-h-[calc(100dvh-14rem)] flex-col md:h-[calc(100dvh-8rem)] md:min-h-0 md:flex-row"
        )}
      >
        <div
          className={cn(
            "flex min-h-0 w-full shrink-0 flex-col border-border md:w-80 md:border-r lg:w-96",
            mobileDetailOpen ? "hidden md:flex" : "flex flex-1 md:flex-none md:h-full"
          )}
        >
          <PharmacyOrderBoard
            orders={orders}
            selectedId={selectedId}
            onSelect={handleSelectOrder}
            filter={filter}
            onFilterChange={setFilter}
            loading={initialLoading}
          />
        </div>

        <div
          className={cn(
            "min-w-0 flex-1 flex-col",
            mobileDetailOpen ? "flex min-h-0 flex-1" : "hidden md:flex md:h-full"
          )}
        >
          <PharmacyOrderDetail key={selectedId ?? "empty"} {...detailProps} />
        </div>
      </div>
    </StaffPortalShell>
  );
}
