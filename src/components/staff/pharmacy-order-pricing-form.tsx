"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import type {
  PharmacyItemAvailability,
  PharmacyOrderItem,
  SavePharmacyOrderItemInput,
} from "@/src/types/pharmacy-order";

const AVAILABILITY_OPTIONS: { value: PharmacyItemAvailability; label: string }[] = [
  { value: "available", label: "Tersedia" },
  { value: "partial", label: "Sebagian" },
  { value: "unavailable", label: "Tidak tersedia" },
  { value: "substitute_suggested", label: "Substitusi" },
];

type Row = SavePharmacyOrderItemInput & { key: string };

function toRows(items?: PharmacyOrderItem[]): Row[] {
  if (!items?.length) {
    return [{ key: "1", drugName: "", quantity: "1", unit: "strip", unitPrice: 0 }];
  }
  return items.map((item, i) => ({
    key: String(item.id ?? i),
    drugName: item.drugName,
    quantity: item.quantity ?? "1",
    unit: item.unit ?? "",
    unitPrice: item.unitPrice,
    availabilityStatus: item.availabilityStatus,
    note: item.note ?? undefined,
  }));
}

function formatIdr(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

type Props = {
  initialItems?: PharmacyOrderItem[];
  pharmacistNote?: string | null;
  disabled?: boolean;
  onSave: (items: SavePharmacyOrderItemInput[], pharmacistNote?: string) => Promise<void>;
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-xs font-medium text-muted-foreground">{children}</label>;
}

export function PharmacyOrderPricingForm({
  initialItems,
  pharmacistNote: initialNote,
  disabled,
  onSave,
}: Props) {
  const [rows, setRows] = useState<Row[]>(() => toRows(initialItems));
  const [note, setNote] = useState(initialNote ?? "");
  const [saving, setSaving] = useState(false);

  const total = useMemo(() => {
    return rows.reduce((sum, row) => {
      const qty = Number(row.quantity) || 0;
      return sum + qty * (row.unitPrice || 0);
    }, 0);
  }, [rows]);

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { key: String(Date.now()), drugName: "", quantity: "1", unit: "strip", unitPrice: 0 },
    ]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    const items = rows.filter((r) => r.drugName.trim()).map(({ key: _k, ...rest }) => rest);
    if (!items.length) return;
    setSaving(true);
    try {
      await onSave(items, note.trim() || undefined);
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm md:px-2 md:py-1.5 md:text-xs";

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {rows.map((row, index) => {
          const qty = Number(row.quantity) || 0;
          const subtotal = qty * (row.unitPrice || 0);

          return (
            <div
              key={row.key}
              className="rounded-xl border border-border bg-muted/20 p-4 md:p-3"
            >
              <div className="mb-3 flex items-center justify-between gap-2 md:hidden">
                <p className="text-sm font-semibold">Obat #{index + 1}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1 text-destructive"
                  disabled={disabled || rows.length <= 1}
                  onClick={() => removeRow(index)}
                >
                  <Trash2 className="h-4 w-4" />
                  Hapus
                </Button>
              </div>

              {/* Mobile: vertical stacked fields */}
              <div className="space-y-3 md:hidden">
                <div>
                  <FieldLabel>Nama obat</FieldLabel>
                  <input
                    className={inputClass}
                    placeholder="Contoh: Paracetamol 500 mg"
                    value={row.drugName}
                    disabled={disabled}
                    onChange={(e) => updateRow(index, { drugName: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Jumlah</FieldLabel>
                    <input
                      className={inputClass}
                      placeholder="1"
                      value={row.quantity ?? ""}
                      disabled={disabled}
                      onChange={(e) => updateRow(index, { quantity: e.target.value })}
                    />
                  </div>
                  <div>
                    <FieldLabel>Satuan</FieldLabel>
                    <input
                      className={inputClass}
                      placeholder="strip"
                      value={row.unit ?? ""}
                      disabled={disabled}
                      onChange={(e) => updateRow(index, { unit: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <FieldLabel>Harga satuan (Rp)</FieldLabel>
                  <input
                    type="number"
                    min={0}
                    className={inputClass}
                    placeholder="0"
                    value={row.unitPrice || ""}
                    disabled={disabled}
                    onChange={(e) => updateRow(index, { unitPrice: Number(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <FieldLabel>Status ketersediaan</FieldLabel>
                  <select
                    className={inputClass}
                    value={row.availabilityStatus ?? "available"}
                    disabled={disabled}
                    onChange={(e) =>
                      updateRow(index, {
                        availabilityStatus: e.target.value as PharmacyItemAvailability,
                      })
                    }
                  >
                    {AVAILABILITY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <FieldLabel>Catatan item</FieldLabel>
                  <input
                    className={inputClass}
                    placeholder="Opsional"
                    value={row.note ?? ""}
                    disabled={disabled}
                    onChange={(e) => updateRow(index, { note: e.target.value })}
                  />
                </div>
                <p className="text-sm font-medium">
                  Subtotal: <span className="text-blue-700 dark:text-blue-300">{formatIdr(subtotal)}</span>
                </p>
              </div>

              {/* Desktop: compact grid */}
              <div className="hidden gap-2 md:grid md:grid-cols-12">
                <div className="md:col-span-4">
                  <FieldLabel>Nama obat</FieldLabel>
                  <input
                    className={inputClass}
                    placeholder="Nama obat"
                    value={row.drugName}
                    disabled={disabled}
                    onChange={(e) => updateRow(index, { drugName: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <FieldLabel>Jumlah</FieldLabel>
                  <input
                    className={inputClass}
                    placeholder="Jumlah"
                    value={row.quantity ?? ""}
                    disabled={disabled}
                    onChange={(e) => updateRow(index, { quantity: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <FieldLabel>Satuan</FieldLabel>
                  <input
                    className={inputClass}
                    placeholder="Satuan"
                    value={row.unit ?? ""}
                    disabled={disabled}
                    onChange={(e) => updateRow(index, { unit: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <FieldLabel>Harga satuan</FieldLabel>
                  <input
                    type="number"
                    min={0}
                    className={inputClass}
                    placeholder="Harga"
                    value={row.unitPrice || ""}
                    disabled={disabled}
                    onChange={(e) => updateRow(index, { unitPrice: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="md:col-span-1">
                  <FieldLabel>Status</FieldLabel>
                  <select
                    className={`${inputClass} text-[10px]`}
                    value={row.availabilityStatus ?? "available"}
                    disabled={disabled}
                    onChange={(e) =>
                      updateRow(index, {
                        availabilityStatus: e.target.value as PharmacyItemAvailability,
                      })
                    }
                  >
                    {AVAILABILITY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end md:col-span-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10"
                    disabled={disabled || rows.length <= 1}
                    onClick={() => removeRow(index)}
                    title="Hapus obat"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="md:col-span-12">
                  <FieldLabel>Catatan item</FieldLabel>
                  <input
                    className={inputClass}
                    placeholder="Catatan item"
                    value={row.note ?? ""}
                    disabled={disabled}
                    onChange={(e) => updateRow(index, { note: e.target.value })}
                  />
                </div>
              </div>
            </div>
          );
        })}

        <Button
          type="button"
          variant="outline"
          className="h-11 w-full gap-2 md:h-9 md:w-auto"
          disabled={disabled}
          onClick={addRow}
        >
          <Plus className="h-4 w-4" />
          Tambah obat
        </Button>
      </div>

      <div>
        <FieldLabel>Catatan apoteker</FieldLabel>
        <textarea
          className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
          rows={3}
          value={note}
          disabled={disabled}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Catatan untuk pasien (opsional)"
        />
      </div>

      <div className="flex flex-col gap-1 rounded-xl bg-blue-50 px-4 py-4 dark:bg-blue-950/30 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm font-medium">Total estimasi</span>
        <span className="text-xl font-bold text-blue-700 dark:text-blue-300">
          {formatIdr(total)}
        </span>
      </div>

      <Button
        type="button"
        className="h-11 w-full"
        disabled={disabled || saving}
        onClick={() => void handleSave()}
      >
        {saving ? "Menyimpan..." : "Simpan harga"}
      </Button>
    </div>
  );
}
