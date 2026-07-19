"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/src/lib/utils";
import {
  PharmacyOrderStatusBadge,
  STATUS_LABEL,
} from "@/src/components/staff/pharmacy-order-status-badge";
import type { PharmacyOrderStatus, PharmacyPrescriptionOrder } from "@/src/types/pharmacy-order";

const STATUS_FILTERS: { id: string; label: string; statuses?: PharmacyOrderStatus[] }[] = [
  { id: "all", label: "Semua" },
  {
    id: "new",
    label: "Baru",
    statuses: ["prescription_uploaded", "waiting_pharmacist_review"],
  },
  { id: "processing", label: "Diproses", statuses: ["preparing_medicine"] },
  {
    id: "waiting",
    label: "Menunggu Pasien",
    statuses: ["medicine_ready_waiting_patient_decision"],
  },
  { id: "delivery", label: "Antar", statuses: ["delivery_requested"] },
  { id: "pickup", label: "Ambil", statuses: ["pickup_selected"] },
  { id: "canceled", label: "Batal", statuses: ["canceled_by_patient"] },
  { id: "done", label: "Selesai", statuses: ["completed"] },
];

function formatTime(iso: string) {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatIdr(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function sourceLabel(order: PharmacyPrescriptionOrder) {
  if (order.sourceType === "darsi_prescription") return "Resep digital DARSI";
  return "Upload PDF";
}

type Props = {
  orders: PharmacyPrescriptionOrder[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  filter: string;
  onFilterChange: (filter: string) => void;
  loading?: boolean;
};

function filterOrders(orders: PharmacyPrescriptionOrder[], filter: string) {
  const cfg = STATUS_FILTERS.find((f) => f.id === filter);
  if (!cfg || cfg.id === "all" || !cfg.statuses) return orders;
  return orders.filter((o) => cfg.statuses!.includes(o.status));
}

export function PharmacyOrderBoard({
  orders,
  selectedId,
  onSelect,
  filter,
  onFilterChange,
  loading,
}: Props) {
  const filtered = filterOrders(orders, filter);

  const statusCounts = STATUS_FILTERS.reduce<Record<string, number>>((acc, f) => {
    acc[f.id] = filterOrders(orders, f.id).length;
    return acc;
  }, {});

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-3 md:p-4">
        <p className="text-sm font-semibold md:text-base">Pesanan Resep</p>
        <p className="text-xs text-muted-foreground">
          {filtered.length} order
          {filter !== "all" ? ` · filter: ${STATUS_FILTERS.find((f) => f.id === filter)?.label}` : ""}
        </p>

        <div className="mt-3 -mx-1 overflow-x-auto pb-1">
          <div className="flex w-max min-w-full gap-2 px-1">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onFilterChange(f.id)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  filter === f.id
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {f.label}
                {statusCounts[f.id] > 0 ? ` (${statusCounts[f.id]})` : ""}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && orders.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Memuat data resep...</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Belum ada resep masuk untuk status ini.
          </p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-muted/80 text-xs text-muted-foreground backdrop-blur">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 font-medium">Pasien</th>
                    <th className="px-3 py-2 font-medium">Sumber</th>
                    <th className="px-3 py-2 font-medium">Masuk</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((order) => (
                    <tr
                      key={order.id}
                      className={cn(
                        "cursor-pointer border-b border-border transition-colors hover:bg-muted/40",
                        selectedId === order.id && "bg-blue-50 dark:bg-blue-950/30"
                      )}
                      onClick={() => onSelect(order.id)}
                    >
                      <td className="px-3 py-3">
                        <p className="font-medium">
                          {order.patientName ?? `Pasien #${order.patientId}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {order.patientRm ? `RM ${order.patientRm}` : ""} #{order.id}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-xs">{sourceLabel(order)}</td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {formatTime(order.createdAt)}
                      </td>
                      <td className="px-3 py-3">
                        <PharmacyOrderStatusBadge status={order.status} />
                      </td>
                      <td className="px-3 py-3 text-xs font-medium">
                        {order.totalPrice != null && order.totalPrice > 0
                          ? formatIdr(order.totalPrice)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-2 p-3 md:hidden">
              {filtered.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => onSelect(order.id)}
                  className={cn(
                    "w-full rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-colors active:bg-muted/50",
                    selectedId === order.id && "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-semibold">
                        {order.patientName ?? `Pasien #${order.patientId}`}
                      </p>
                      <PharmacyOrderStatusBadge status={order.status} className="mt-2" size="md" />
                    </div>
                    <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
                  </div>

                  <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                    <p>{formatTime(order.createdAt)}</p>
                    <p>{sourceLabel(order)}</p>
                    {order.totalPrice != null && order.totalPrice > 0 && (
                      <p className="font-semibold text-foreground">{formatIdr(order.totalPrice)}</p>
                    )}
                  </div>

                  <p className="mt-3 text-xs font-medium text-blue-700 dark:text-blue-300">
                    Lihat detail
                  </p>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function usePharmacyOrderBoardFilter() {
  const [filter, setFilter] = useState("new");
  return { filter, setFilter };
}

export function filterOrdersClientSide(orders: PharmacyPrescriptionOrder[], filter: string) {
  return filterOrders(orders, filter);
}

export { STATUS_LABEL, STATUS_FILTERS };
