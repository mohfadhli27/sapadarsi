"use client";

import {
  ArrowLeft,
  ExternalLink,
  FileSearch,
  PackageCheck,
  Play,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { PharmacyOrderPricingForm } from "@/src/components/staff/pharmacy-order-pricing-form";
import { PharmacyOrderStatusBadge } from "@/src/components/staff/pharmacy-order-status-badge";
import { isNewPharmacyOrder, NEW_ORDER_FILTER_ID } from "@/src/lib/pharmacy-order-status";
import type { PharmacyPrescriptionOrder, SavePharmacyOrderItemInput } from "@/src/types/pharmacy-order";

function formatIdr(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function SectionCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-border bg-card p-4 shadow-sm ${className ?? ""}`}>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

type Props = {
  order: PharmacyPrescriptionOrder | null;
  staffToken: string | null;
  loading?: boolean;
  parsingPrescription?: boolean;
  onRefresh: () => void;
  onStartReview: () => Promise<void>;
  onReparsePrescription?: () => Promise<void>;
  onSavePricing: (items: SavePharmacyOrderItemInput[], note?: string) => Promise<void>;
  onConfirmReady: () => Promise<void>;
  onComplete: () => Promise<void>;
  activeFilter?: string;
  onBack?: () => void;
  showBack?: boolean;
};

export function PharmacyOrderDetail({
  order,
  staffToken,
  loading,
  parsingPrescription,
  onRefresh,
  onStartReview,
  onReparsePrescription,
  onSavePricing,
  onConfirmReady,
  onComplete,
  activeFilter,
  onBack,
  showBack,
}: Props) {
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Memuat detail...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <p className="max-w-xs text-sm text-muted-foreground">
          {showBack
            ? "Data order tidak ditemukan."
            : "Pilih pesanan resep dari daftar untuk melihat detail."}
        </p>
      </div>
    );
  }

  const canEdit =
    order.status === "waiting_pharmacist_review" ||
    order.status === "preparing_medicine" ||
    order.status === "prescription_uploaded";

  const pdfUrl =
    order.hasPdf && staffToken
      ? `/api/staff/pharmacy-orders/${order.id}/file?token=${encodeURIComponent(staffToken)}`
      : null;

  const canReparsePrescription =
    activeFilter === NEW_ORDER_FILTER_ID &&
    isNewPharmacyOrder(order) &&
    (order.hasPdf || order.sourceType === "darsi_prescription");

  const sourceLabel =
    order.sourceType === "darsi_prescription" ? "Resep digital DARSI" : "Upload PDF resep";

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="border-b border-border p-4 md:p-5">
        {showBack && onBack && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 mb-3 gap-1 md:hidden"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke daftar
          </Button>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold md:text-xl">
              {order.patientName ?? `Pasien #${order.patientId}`}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Order #{order.id}
              {order.patientRm ? ` · RM ${order.patientRm}` : ""}
            </p>
          </div>
          <PharmacyOrderStatusBadge status={order.status} size="md" />
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 md:p-5">
        <SectionCard title="Informasi Pasien">
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Nama</dt>
              <dd className="font-medium">{order.patientName ?? `#${order.patientId}`}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">No. RM</dt>
              <dd className="font-medium">{order.patientRm ?? "—"}</dd>
            </div>
          </dl>
        </SectionCard>

        <SectionCard title="Detail Resep">
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Sumber resep</dt>
              <dd className="font-medium">{sourceLabel}</dd>
            </div>
            {order.prescriptionNo && (
              <div>
                <dt className="text-xs text-muted-foreground">No. resep</dt>
                <dd className="font-medium">{order.prescriptionNo}</dd>
              </div>
            )}
            {order.sourceConsultationSessionId && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground">Konsultasi DARSI</dt>
                <dd className="font-medium">#{order.sourceConsultationSessionId}</dd>
              </div>
            )}
          </dl>
        </SectionCard>

        <SectionCard title="File Resep">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {(order.status === "waiting_pharmacist_review" ||
              order.status === "prescription_uploaded") && (
              <Button
                type="button"
                className="h-11 w-full gap-2 sm:w-auto"
                onClick={() => void onStartReview()}
              >
                <Play className="h-4 w-4" />
                Mulai proses & baca resep
              </Button>
            )}
            {onReparsePrescription && canReparsePrescription && (
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full gap-2 sm:w-auto"
                onClick={() => void onReparsePrescription()}
              >
                <FileSearch className="h-4 w-4" />
                Baca ulang resep
              </Button>
            )}
            {pdfUrl && (
              <Button type="button" variant="outline" className="h-11 w-full gap-2 sm:w-auto" asChild>
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Lihat PDF resep
                </a>
              </Button>
            )}
            {!pdfUrl && order.sourceType === "darsi_prescription" && (
              <p className="text-sm text-muted-foreground">
                Resep digital — daftar obat diisi dari data konsultasi DARSI.
              </p>
            )}
          </div>
        </SectionCard>

        {parsingPrescription && (
          <p className="animate-pulse rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40">
            Membaca resep PDF dan mengisi daftar obat...
          </p>
        )}

        {(order.items?.length ?? 0) > 0 && canEdit && !parsingPrescription && (
          <p className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
            Daftar obat diisi otomatis dari resep. Periksa, sesuaikan jika perlu, lalu isi harga
            satuan.
          </p>
        )}

        <SectionCard title={canEdit ? "Daftar Obat & Harga" : "Daftar Obat"}>
          {canEdit ? (
            <PharmacyOrderPricingForm
              key={order.id}
              initialItems={order.items}
              pharmacistNote={order.pharmacistNote}
              onSave={onSavePricing}
            />
          ) : (
            <div className="space-y-3">
              {(order.items ?? []).map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-border bg-muted/20 p-3 text-sm"
                >
                  <p className="font-semibold">{item.drugName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Jumlah: {item.quantity ?? "—"} {item.unit ?? ""} · {item.availabilityStatus}
                  </p>
                  {item.note && (
                    <p className="mt-1 text-xs text-muted-foreground">Catatan: {item.note}</p>
                  )}
                  <p className="mt-2 font-medium">{formatIdr(item.subtotal)}</p>
                </div>
              ))}
              {order.pharmacistNote && (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Catatan apoteker: </span>
                  {order.pharmacistNote}
                </p>
              )}
            </div>
          )}
        </SectionCard>

        {order.totalPrice != null && order.totalPrice > 0 && !canEdit && (
          <SectionCard title="Total Harga">
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {formatIdr(order.totalPrice)}
            </p>
          </SectionCard>
        )}

        {order.deliveryAddress && (
          <SectionCard title="Alamat Pengantaran">
            <p className="text-sm leading-relaxed">{order.deliveryAddress}</p>
          </SectionCard>
        )}

        {order.patientDecision && (
          <SectionCard title="Keputusan Pasien">
            <p className="text-sm font-medium capitalize">{order.patientDecision}</p>
          </SectionCard>
        )}
      </div>

      <div className="space-y-2 border-t border-border bg-background p-4 md:p-5">
        {canEdit && order.totalPrice != null && order.totalPrice > 0 && (
          <p className="text-center text-sm font-semibold md:text-left">
            Total saat ini: {formatIdr(order.totalPrice)}
          </p>
        )}

        {canEdit && (
          <Button
            type="button"
            className="h-11 w-full gap-2 bg-emerald-700 hover:bg-emerald-800"
            onClick={() => void onConfirmReady()}
          >
            <PackageCheck className="h-4 w-4" />
            Konfirmasi obat siap
          </Button>
        )}

        {(order.status === "delivery_requested" || order.status === "pickup_selected") && (
          <Button type="button" className="h-11 w-full" onClick={() => void onComplete()}>
            Tandai selesai
          </Button>
        )}

        <Button
          type="button"
          variant="outline"
          className="h-10 w-full gap-2"
          onClick={onRefresh}
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>
    </div>
  );
}
