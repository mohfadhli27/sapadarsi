import { writeFile } from "fs/promises";
import { dbQuery } from "@/src/lib/db";
import {
  getSessionAppOriginUrl,
} from "@/src/lib/session-app-origin";
import { sendPharmacyOrderTelegram } from "@/src/lib/telegram-service";
import { extractItemsForPharmacyOrder } from "@/src/lib/pharmacy-prescription-extract";
import { savePharmacyReceiptPdf } from "@/src/lib/pharmacy-prescription-upload";
import {
  buildPharmacyReceiptNo,
  generatePharmacyReceiptPdf,
} from "@/src/lib/pharmacy-receipt-pdf";
import { getSessionPrescription } from "@/src/lib/prescription";
import type {
  PharmacyItemAvailability,
  PharmacyOrderItem,
  PharmacyOrderSourceType,
  PharmacyOrderStatus,
  PharmacyPatientDecision,
  PharmacyPrescriptionOrder,
  SavePharmacyOrderItemInput,
} from "@/src/types/pharmacy-order";

type OrderRow = {
  id: number;
  session_id: number;
  patient_id: number;
  source_type: string;
  source_consultation_session_id: number | null;
  prescription_no: string | null;
  pdf_file_name: string | null;
  pdf_file_path: string | null;
  receipt_no: string | null;
  receipt_pdf_path: string | null;
  receipt_pdf_file_name: string | null;
  status: string;
  total_price: string | null;
  patient_note: string | null;
  pharmacist_note: string | null;
  patient_decision: string | null;
  delivery_address: string | null;
  created_at: Date;
  updated_at: Date;
  reviewed_at: Date | null;
  ready_at: Date | null;
  decided_at: Date | null;
  completed_at: Date | null;
  canceled_at: Date | null;
  patient_name?: string | null;
  patient_rm?: string | null;
};

type ItemRow = {
  id: number;
  order_id: number;
  drug_name: string;
  quantity: string | null;
  unit: string | null;
  unit_price: string;
  subtotal: string;
  availability_status: string;
  note: string | null;
};

function formatIdr(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function mapOrder(row: OrderRow, items?: PharmacyOrderItem[]): PharmacyPrescriptionOrder {
  return {
    id: row.id,
    sessionId: row.session_id,
    patientId: row.patient_id,
    sourceType: row.source_type as PharmacyOrderSourceType,
    sourceConsultationSessionId: row.source_consultation_session_id,
    prescriptionNo: row.prescription_no,
    pdfFileName: row.pdf_file_name,
    hasPdf: Boolean(row.pdf_file_path),
    receiptNo: row.receipt_no,
    hasReceiptPdf: Boolean(row.receipt_pdf_path),
    status: row.status as PharmacyOrderStatus,
    totalPrice: row.total_price != null ? Number(row.total_price) : null,
    patientNote: row.patient_note,
    pharmacistNote: row.pharmacist_note,
    patientDecision: row.patient_decision as PharmacyPatientDecision | null,
    deliveryAddress: row.delivery_address,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    reviewedAt: row.reviewed_at?.toISOString() ?? null,
    readyAt: row.ready_at?.toISOString() ?? null,
    decidedAt: row.decided_at?.toISOString() ?? null,
    completedAt: row.completed_at?.toISOString() ?? null,
    canceledAt: row.canceled_at?.toISOString() ?? null,
    patientName: row.patient_name ?? null,
    patientRm: row.patient_rm ?? null,
    items,
  };
}

function mapItem(row: ItemRow): PharmacyOrderItem {
  return {
    id: row.id,
    orderId: row.order_id,
    drugName: row.drug_name,
    quantity: row.quantity,
    unit: row.unit,
    unitPrice: Number(row.unit_price),
    subtotal: Number(row.subtotal),
    availabilityStatus: row.availability_status as PharmacyItemAvailability,
    note: row.note,
  };
}

export async function assertPharmacySessionForPatient(sessionId: number, patientId: number) {
  const { rows } = await dbQuery<{ id: number; session_type: string; patient_id: number }>(
    `SELECT id, session_type, patient_id FROM chat_sessions WHERE id = $1 LIMIT 1`,
    [sessionId]
  );
  const session = rows[0];
  if (!session) throw new Error("Sesi tidak ditemukan");
  if (session.patient_id !== patientId) throw new Error("Sesi bukan milik pasien ini");
  if (session.session_type !== "pharmacist_consultation") {
    throw new Error("Sesi bukan konsultasi apoteker");
  }
  return session;
}

export async function insertPharmacyOrderEvent(input: {
  orderId: number;
  actorType: "patient" | "pharmacist" | "system";
  actorName?: string | null;
  eventType: string;
  oldStatus?: string | null;
  newStatus?: string | null;
  payload?: Record<string, unknown> | null;
}) {
  await dbQuery(
    `INSERT INTO pasienkonsul.pharmacy_prescription_order_events
       (order_id, actor_type, actor_name, event_type, old_status, new_status, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [
      input.orderId,
      input.actorType,
      input.actorName ?? null,
      input.eventType,
      input.oldStatus ?? null,
      input.newStatus ?? null,
      input.payload ? JSON.stringify(input.payload) : null,
    ]
  );
}

export async function insertOrderMessageToChat(input: {
  sessionId: number;
  message: string;
  senderType?: "system" | "ai";
  toolResults?: Record<string, unknown>;
}) {
  await dbQuery(
    `INSERT INTO chat_messages (session_id, sender_type, message_text, tool_results)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [
      input.sessionId,
      input.senderType ?? "system",
      input.message,
      input.toolResults ? JSON.stringify(input.toolResults) : null,
    ]
  );
  await dbQuery(`UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [
    input.sessionId,
  ]);
}

async function touchOrder(orderId: number, extra?: Partial<Record<string, unknown>>) {
  const sets = ["updated_at = CURRENT_TIMESTAMP"];
  const params: unknown[] = [orderId];
  let idx = 2;
  for (const [key, value] of Object.entries(extra ?? {})) {
    sets.push(`${key} = $${idx}`);
    params.push(value);
    idx += 1;
  }
  await dbQuery(
    `UPDATE pasienkonsul.pharmacy_prescription_orders SET ${sets.join(", ")} WHERE id = $1`,
    params
  );
}

async function transitionOrderStatus(input: {
  orderId: number;
  sessionId: number;
  oldStatus: PharmacyOrderStatus;
  newStatus: PharmacyOrderStatus;
  actorType: "patient" | "pharmacist" | "system";
  actorName?: string | null;
  eventType: string;
  chatMessage?: string;
  extra?: Partial<Record<string, unknown>>;
  payload?: Record<string, unknown>;
}) {
  await touchOrder(input.orderId, { status: input.newStatus, ...input.extra });
  await insertPharmacyOrderEvent({
    orderId: input.orderId,
    actorType: input.actorType,
    actorName: input.actorName,
    eventType: input.eventType,
    oldStatus: input.oldStatus,
    newStatus: input.newStatus,
    payload: input.payload,
  });
  if (input.chatMessage) {
    await insertOrderMessageToChat({ sessionId: input.sessionId, message: input.chatMessage });
  }
}

async function loadOrderItems(orderId: number) {
  const { rows } = await dbQuery<ItemRow>(
    `SELECT * FROM pasienkonsul.pharmacy_prescription_order_items WHERE order_id = $1 ORDER BY id`,
    [orderId]
  );
  return rows.map(mapItem);
}

export async function getPharmacyPrescriptionOrderDetail(
  orderId: number,
  withItems = true,
  opts?: { autoImport?: boolean }
) {
  const { rows } = await dbQuery<OrderRow>(
    `SELECT o.*, p.nama AS patient_name, p.no_rm AS patient_rm
     FROM pasienkonsul.pharmacy_prescription_orders o
     LEFT JOIN pasienkonsul.b_ms_pasien p ON p.id = o.patient_id
     WHERE o.id = $1 LIMIT 1`,
    [orderId]
  );
  const row = rows[0];
  if (!row) return null;

  let items = withItems ? await loadOrderItems(orderId) : undefined;

  if (opts?.autoImport && withItems) {
    const canImport =
      row.status === "waiting_pharmacist_review" ||
      row.status === "prescription_uploaded";
    if (canImport && (!items || items.length === 0)) {
      try {
        await importPrescriptionItemsToOrder(orderId);
        items = await loadOrderItems(orderId);
      } catch {
        /* apoteker bisa isi manual */
      }
    }
  }

  return mapOrder(row, items);
}

async function insertOrderItemRows(orderId: number, items: SavePharmacyOrderItemInput[]) {
  for (const item of items) {
    if (!item.drugName.trim()) continue;
    const qty = Number(item.quantity) || 1;
    const unitPrice = item.unitPrice ?? 0;
    const subtotal = qty * unitPrice;
    await dbQuery(
      `INSERT INTO pasienkonsul.pharmacy_prescription_order_items
         (order_id, drug_name, quantity, unit, unit_price, subtotal, availability_status, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        orderId,
        item.drugName.trim(),
        item.quantity ?? null,
        item.unit ?? null,
        unitPrice,
        subtotal,
        item.availabilityStatus ?? "available",
        item.note ?? null,
      ]
    );
  }
}

/** Baca PDF / resep DARSI dan isi daftar obat order (harga tetap 0 — diisi apoteker). */
export async function importPrescriptionItemsToOrder(
  orderId: number,
  opts?: { force?: boolean; actorName?: string }
) {
  const { rows } = await dbQuery<OrderRow>(
    `SELECT * FROM pasienkonsul.pharmacy_prescription_orders WHERE id = $1 LIMIT 1`,
    [orderId]
  );
  const row = rows[0];
  if (!row) throw new Error("Order tidak ditemukan");

  const existing = await loadOrderItems(orderId);
  if (!opts?.force && existing.length > 0) {
    return { imported: false, itemCount: existing.length, items: existing };
  }

  const extracted = await extractItemsForPharmacyOrder({
    sourceType: row.source_type,
    sourceConsultationSessionId: row.source_consultation_session_id,
    pdfFilePath: row.pdf_file_path,
  });

  if (extracted.length === 0) {
    throw new Error(
      "Tidak dapat membaca item obat dari resep. Pastikan PDF berisi teks (bukan scan gambar), atau isi manual."
    );
  }

  await dbQuery(`DELETE FROM pasienkonsul.pharmacy_prescription_order_items WHERE order_id = $1`, [
    orderId,
  ]);
  await insertOrderItemRows(orderId, extracted);

  await insertPharmacyOrderEvent({
    orderId,
    actorType: "system",
    actorName: opts?.actorName ?? null,
    eventType: "prescription_items_imported",
    payload: { itemCount: extracted.length, sourceType: row.source_type },
  });

  const items = await loadOrderItems(orderId);
  return { imported: true, itemCount: items.length, items };
}

export async function listPharmacyPrescriptionOrdersForPatient(
  patientId: number,
  sessionId?: number
) {
  const params: unknown[] = [patientId];
  let sql = `SELECT o.* FROM pasienkonsul.pharmacy_prescription_orders o
             WHERE o.patient_id = $1`;
  if (sessionId) {
    params.push(sessionId);
    sql += ` AND o.session_id = $2`;
  }
  sql += ` ORDER BY o.created_at DESC LIMIT 50`;
  const { rows } = await dbQuery<OrderRow>(sql, params);
  return rows.map((r) => mapOrder(r));
}

export async function listPharmacyPrescriptionOrdersForStaff(status?: string) {
  const params: unknown[] = [];
  let sql = `SELECT o.*, p.nama AS patient_name, p.no_rm AS patient_rm
             FROM pasienkonsul.pharmacy_prescription_orders o
             LEFT JOIN pasienkonsul.b_ms_pasien p ON p.id = o.patient_id`;
  if (status && status !== "all") {
    params.push(status);
    sql += ` WHERE o.status = $1`;
  }
  sql += ` ORDER BY o.updated_at DESC LIMIT 200`;
  const { rows } = await dbQuery<OrderRow>(sql, params);
  return rows.map((r) => mapOrder(r));
}

export async function createUploadedPrescriptionOrder(input: {
  sessionId: number;
  patientId: number;
  pdfMeta?: {
    displayName: string;
    storedPath: string;
    mimeType: string;
    sizeBytes: number;
  };
  patientNote?: string;
}) {
  await assertPharmacySessionForPatient(input.sessionId, input.patientId);

  const { rows } = await dbQuery<OrderRow>(
    `INSERT INTO pasienkonsul.pharmacy_prescription_orders
       (session_id, patient_id, source_type, pdf_file_name, pdf_file_path, pdf_mime_type, pdf_size_bytes,
        status, patient_note)
     VALUES ($1, $2, 'uploaded_pdf', $3, $4, $5, $6, 'waiting_pharmacist_review', $7)
     RETURNING *`,
    [
      input.sessionId,
      input.patientId,
      input.pdfMeta?.displayName ?? null,
      input.pdfMeta?.storedPath ?? null,
      input.pdfMeta?.mimeType ?? null,
      input.pdfMeta?.sizeBytes ?? null,
      input.patientNote ?? null,
    ]
  );
  const order = rows[0];
  const chatMsg =
    "Resep Anda sudah diterima dan sedang diperiksa oleh apoteker. Kami akan memberi tahu setelah obat siap.";

  await insertPharmacyOrderEvent({
    orderId: order.id,
    actorType: "patient",
    eventType: "prescription_uploaded",
    newStatus: "waiting_pharmacist_review",
    payload: { sourceType: "uploaded_pdf" },
  });
  await insertOrderMessageToChat({ sessionId: input.sessionId, message: chatMsg });

  void notifyPharmacyOrderCreated({
    orderId: order.id,
    patientId: input.patientId,
  });

  return mapOrder(order);
}

export async function createDarsiPrescriptionOrder(input: {
  pharmacySessionId: number;
  patientId: number;
  sourceConsultationSessionId: number;
}) {
  await assertPharmacySessionForPatient(input.pharmacySessionId, input.patientId);

  const prescription = await getSessionPrescription(input.sourceConsultationSessionId);
  if (!prescription) throw new Error("Resep digital tidak ditemukan");

  const access = await dbQuery<{ patient_id: number }>(
    `SELECT patient_id FROM chat_sessions WHERE id = $1 LIMIT 1`,
    [input.sourceConsultationSessionId]
  );
  if (access.rows[0]?.patient_id !== input.patientId) {
    throw new Error("Resep bukan milik pasien ini");
  }

  const { rows } = await dbQuery<OrderRow>(
    `INSERT INTO pasienkonsul.pharmacy_prescription_orders
       (session_id, patient_id, source_type, source_consultation_session_id, prescription_no, status)
     VALUES ($1, $2, 'darsi_prescription', $3, $4, 'waiting_pharmacist_review')
     RETURNING *`,
    [
      input.pharmacySessionId,
      input.patientId,
      input.sourceConsultationSessionId,
      prescription.prescriptionNo,
    ]
  );
  const order = rows[0];

  for (const med of prescription.medications) {
    if (!med.name?.trim()) continue;
    await dbQuery(
      `INSERT INTO pasienkonsul.pharmacy_prescription_order_items
         (order_id, drug_name, quantity, unit, unit_price, subtotal, availability_status, note)
       VALUES ($1, $2, $3, $4, 0, 0, 'available', $5)`,
      [
        order.id,
        med.name.trim(),
        med.quantity ?? med.dosage ?? null,
        med.route ?? null,
        [med.frequency, med.duration, med.notes].filter(Boolean).join(" · ") || null,
      ]
    );
  }

  const chatMsg =
    "Resep digital Anda sudah dikirim ke apoteker untuk diproses. Apoteker akan memeriksa dan menyiapkan obat.";

  await insertPharmacyOrderEvent({
    orderId: order.id,
    actorType: "patient",
    eventType: "darsi_prescription_sent",
    newStatus: "waiting_pharmacist_review",
    payload: {
      sourceConsultationSessionId: input.sourceConsultationSessionId,
      prescriptionNo: prescription.prescriptionNo,
    },
  });
  await insertOrderMessageToChat({ sessionId: input.pharmacySessionId, message: chatMsg });

  const items = await loadOrderItems(order.id);

  void notifyPharmacyOrderCreated({
    orderId: order.id,
    patientId: input.patientId,
    prescriptionNo: prescription.prescriptionNo,
    sourceConsultationSessionId: input.sourceConsultationSessionId,
  });

  return mapOrder(order, items);
}

async function notifyPharmacyOrderCreated(input: {
  orderId: number;
  patientId: number;
  prescriptionNo?: string | null;
  sourceConsultationSessionId?: number | null;
}) {
  const patientResult = await dbQuery<{ nama: string | null; no_rm: string | null }>(
    `select nama, no_rm from pasienkonsul.b_ms_pasien where id = $1 limit 1`,
    [input.patientId]
  );
  const patient = patientResult.rows[0];
  const sourceOriginUrl = input.sourceConsultationSessionId
    ? await getSessionAppOriginUrl(input.sourceConsultationSessionId)
    : null;

  void sendPharmacyOrderTelegram({
    orderId: input.orderId,
    patientName: patient?.nama ?? "-",
    patientRm: patient?.no_rm ?? "-",
    prescriptionNo: input.prescriptionNo,
    sourceOriginUrl,
  }).catch((err) => console.warn("[pharmacy] Telegram order notify gagal", err));
}

export async function startPharmacyOrderReview(orderId: number, pharmacistName?: string) {
  const order = await getPharmacyPrescriptionOrderDetail(orderId);
  if (!order) throw new Error("Order tidak ditemukan");
  if (
    order.status !== "waiting_pharmacist_review" &&
    order.status !== "prescription_uploaded"
  ) {
    throw new Error("Order tidak dapat diproses");
  }

  await importPrescriptionItemsToOrder(orderId, { force: true, actorName: pharmacistName });

  await transitionOrderStatus({
    orderId,
    sessionId: order.sessionId,
    oldStatus: order.status,
    newStatus: "preparing_medicine",
    actorType: "pharmacist",
    actorName: pharmacistName,
    eventType: "review_started",
    extra: { reviewed_at: new Date() },
    chatMessage: "Apoteker sedang menyiapkan obat sesuai resep Anda.",
  });

  return getPharmacyPrescriptionOrderDetail(orderId);
}

export async function updatePharmacyOrderPricing(input: {
  orderId: number;
  pharmacistNote?: string;
  items: SavePharmacyOrderItemInput[];
}) {
  const order = await getPharmacyPrescriptionOrderDetail(input.orderId);
  if (!order) throw new Error("Order tidak ditemukan");

  await dbQuery(`DELETE FROM pasienkonsul.pharmacy_prescription_order_items WHERE order_id = $1`, [
    input.orderId,
  ]);

  let total = 0;
  for (const item of input.items) {
    const qty = Number(item.quantity) || 1;
    const subtotal = qty * item.unitPrice;
    total += subtotal;
  }
  await insertOrderItemRows(input.orderId, input.items);

  await touchOrder(input.orderId, {
    total_price: total,
    pharmacist_note: input.pharmacistNote ?? order.pharmacistNote,
  });

  await insertPharmacyOrderEvent({
    orderId: input.orderId,
    actorType: "pharmacist",
    eventType: "pricing_updated",
    payload: { totalPrice: total, itemCount: input.items.length },
  });

  return getPharmacyPrescriptionOrderDetail(input.orderId);
}

export async function confirmMedicineReady(orderId: number, pharmacistName?: string) {
  const order = await getPharmacyPrescriptionOrderDetail(orderId);
  if (!order) throw new Error("Order tidak ditemukan");
  if (order.status !== "preparing_medicine" && order.status !== "waiting_pharmacist_review") {
    throw new Error("Order belum siap dikonfirmasi");
  }

  const items = order.items ?? [];
  const total = order.totalPrice ?? items.reduce((s, i) => s + i.subtotal, 0);
  if (items.length === 0) throw new Error("Daftar obat belum diisi");
  if (total <= 0) throw new Error("Total harga belum diisi");

  const chatMsg = [
    `Resep Anda sudah diperiksa oleh apoteker. Obat sudah disiapkan dengan total harga ${formatIdr(total)}.`,
    "",
    "Silakan pilih salah satu opsi:",
    "1. Antar ke alamat saya",
    "2. Saya ambil sendiri di apotek",
    "3. Batalkan pesanan",
  ].join("\n");

  await transitionOrderStatus({
    orderId,
    sessionId: order.sessionId,
    oldStatus: order.status,
    newStatus: "medicine_ready_waiting_patient_decision",
    actorType: "pharmacist",
    actorName: pharmacistName,
    eventType: "medicine_ready",
    extra: { ready_at: new Date(), total_price: total },
    chatMessage: chatMsg,
    payload: { totalPrice: total },
  });

  return getPharmacyPrescriptionOrderDetail(orderId);
}

export async function getPatientAddress(patientId: number) {
  const { rows } = await dbQuery<{ alamat: string | null }>(
    `SELECT alamat FROM pasienkonsul.b_ms_pasien WHERE id = $1 LIMIT 1`,
    [patientId]
  );
  return rows[0]?.alamat?.trim() || null;
}

async function buildAndSavePharmacyReceipt(
  order: PharmacyPrescriptionOrder,
  decision: "delivery" | "pickup",
  opts?: { existingPath?: string | null; receiptNo?: string | null; issuedAt?: Date }
) {
  const items = order.items ?? [];
  const total = order.totalPrice ?? items.reduce((s, i) => s + i.subtotal, 0);
  if (items.length === 0 || total <= 0) return null;

  let diagnosis: string | null = null;
  if (order.sourceConsultationSessionId) {
    const prescription = await getSessionPrescription(order.sourceConsultationSessionId);
    diagnosis = prescription?.diagnosis ?? null;
  }

  const receiptNo = opts?.receiptNo ?? buildPharmacyReceiptNo(order.id);
  const issuedAt = opts?.issuedAt ?? new Date();
  const pdfBytes = await generatePharmacyReceiptPdf({
    receiptNo,
    orderId: order.id,
    prescriptionNo: order.prescriptionNo,
    patientName: order.patientName ?? "Pasien",
    patientRm: order.patientRm ?? "-",
    patientDecision: decision,
    deliveryAddress: order.deliveryAddress,
    items,
    totalPrice: total,
    pharmacistNote: order.pharmacistNote,
    issuedAt,
    diagnosis,
  });

  if (opts?.existingPath) {
    await writeFile(opts.existingPath, Buffer.from(pdfBytes));
    return {
      receiptNo,
      storedPath: opts.existingPath,
      displayName: `${receiptNo}.pdf`,
    };
  }

  const saved = await savePharmacyReceiptPdf({
    buffer: Buffer.from(pdfBytes),
    patientId: order.patientId,
    orderId: order.id,
    receiptNo,
  });

  return {
    receiptNo,
    storedPath: saved.storedPath,
    displayName: saved.displayName,
  };
}

async function issuePharmacyReceipt(order: PharmacyPrescriptionOrder, decision: "delivery" | "pickup") {
  const saved = await buildAndSavePharmacyReceipt(order, decision);
  if (!saved) return null;

  await touchOrder(order.id, {
    receipt_no: saved.receiptNo,
    receipt_pdf_path: saved.storedPath,
    receipt_pdf_file_name: saved.displayName,
  });

  const decisionText =
    decision === "delivery"
      ? "Pengantaran ke alamat Anda telah dikonfirmasi."
      : "Pengambilan langsung di apotek telah dikonfirmasi.";

  const total = order.totalPrice ?? (order.items ?? []).reduce((s, i) => s + i.subtotal, 0);

  await insertOrderMessageToChat({
    sessionId: order.sessionId,
    message: `${decisionText} Berikut resi pemesanan obat (PDF) sesuai resep Anda:`,
    toolResults: {
      pharmacyReceipt: {
        orderId: order.id,
        receiptNo: saved.receiptNo,
        decision,
        totalPrice: total,
        fileName: saved.displayName,
      },
    },
  });

  await insertPharmacyOrderEvent({
    orderId: order.id,
    actorType: "system",
    eventType: "receipt_issued",
    payload: { receiptNo: saved.receiptNo, decision, totalPrice: total },
  });

  return { receiptNo: saved.receiptNo, storedPath: saved.storedPath };
}

export async function submitPatientDecision(input: {
  orderId: number;
  patientId: number;
  decision: PharmacyPatientDecision;
  deliveryAddress?: string;
}) {
  const order = await getPharmacyPrescriptionOrderDetail(input.orderId);
  if (!order) throw new Error("Order tidak ditemukan");
  if (order.patientId !== input.patientId) throw new Error("Order bukan milik pasien ini");
  if (order.status !== "medicine_ready_waiting_patient_decision") {
    throw new Error("Order tidak menunggu keputusan pasien");
  }

  if (input.decision === "delivery") {
    const address = input.deliveryAddress?.trim() || (await getPatientAddress(input.patientId));
    if (!address) throw new Error("Alamat pengantaran wajib diisi");

    await transitionOrderStatus({
      orderId: input.orderId,
      sessionId: order.sessionId,
      oldStatus: order.status,
      newStatus: "delivery_requested",
      actorType: "patient",
      eventType: "patient_decision_delivery",
      extra: {
        patient_decision: "delivery",
        delivery_address: address,
        decided_at: new Date(),
      },
      chatMessage: "Baik, obat akan diproses untuk pengantaran ke alamat Anda.",
      payload: { deliveryAddress: address },
    });

    const updated = await getPharmacyPrescriptionOrderDetail(input.orderId);
    if (updated) {
      await issuePharmacyReceipt({ ...updated, deliveryAddress: address }, "delivery");
    }
  } else if (input.decision === "pickup") {
    await transitionOrderStatus({
      orderId: input.orderId,
      sessionId: order.sessionId,
      oldStatus: order.status,
      newStatus: "pickup_selected",
      actorType: "patient",
      eventType: "patient_decision_pickup",
      extra: { patient_decision: "pickup", decided_at: new Date() },
      chatMessage:
        "Baik, obat dapat diambil langsung di apotek. Silakan tunjukkan resi PDF di bawah kepada petugas apotek.",
    });

    const updated = await getPharmacyPrescriptionOrderDetail(input.orderId);
    if (updated) {
      await issuePharmacyReceipt(updated, "pickup");
    }
  } else {
    await cancelPharmacyOrder({
      orderId: input.orderId,
      patientId: input.patientId,
      reason: "patient_cancel",
    });
    return getPharmacyPrescriptionOrderDetail(input.orderId);
  }

  return getPharmacyPrescriptionOrderDetail(input.orderId);
}

export async function cancelPharmacyOrder(input: {
  orderId: number;
  patientId?: number;
  reason?: string;
}) {
  const order = await getPharmacyPrescriptionOrderDetail(input.orderId);
  if (!order) throw new Error("Order tidak ditemukan");
  if (input.patientId != null && order.patientId !== input.patientId) {
    throw new Error("Order bukan milik pasien ini");
  }

  await transitionOrderStatus({
    orderId: input.orderId,
    sessionId: order.sessionId,
    oldStatus: order.status,
    newStatus: "canceled_by_patient",
    actorType: input.patientId ? "patient" : "pharmacist",
    eventType: input.reason ?? "order_canceled",
    extra: { canceled_at: new Date(), patient_decision: "cancel" },
    chatMessage: "Pesanan obat Anda telah dibatalkan.",
  });

  return getPharmacyPrescriptionOrderDetail(input.orderId);
}

export async function completePharmacyOrder(orderId: number, pharmacistName?: string) {
  const order = await getPharmacyPrescriptionOrderDetail(orderId);
  if (!order) throw new Error("Order tidak ditemukan");
  if (order.status !== "delivery_requested" && order.status !== "pickup_selected") {
    throw new Error("Order belum siap diselesaikan");
  }

  await transitionOrderStatus({
    orderId,
    sessionId: order.sessionId,
    oldStatus: order.status,
    newStatus: "completed",
    actorType: "pharmacist",
    actorName: pharmacistName,
    eventType: "order_completed",
    extra: { completed_at: new Date() },
    chatMessage: "Pesanan obat Anda telah selesai. Terima kasih.",
  });

  return getPharmacyPrescriptionOrderDetail(orderId);
}

export async function getOrderPdfPath(orderId: number) {
  const { rows } = await dbQuery<{ pdf_file_path: string | null; patient_id: number }>(
    `SELECT pdf_file_path, patient_id FROM pasienkonsul.pharmacy_prescription_orders WHERE id = $1`,
    [orderId]
  );
  return rows[0] ?? null;
}

export async function ensurePharmacyReceiptPdf(orderId: number, patientId: number) {
  const order = await getPharmacyPrescriptionOrderDetail(orderId);
  if (!order || order.patientId !== patientId) return null;

  const decision = order.patientDecision;
  if (decision !== "delivery" && decision !== "pickup") return null;
  if (!["delivery_requested", "pickup_selected", "completed"].includes(order.status)) {
    return null;
  }

  const existing = await dbQuery<{
    receipt_pdf_path: string | null;
    receipt_pdf_file_name: string | null;
    receipt_no: string | null;
  }>(
    `SELECT receipt_pdf_path, receipt_pdf_file_name, receipt_no
     FROM pasienkonsul.pharmacy_prescription_orders WHERE id = $1`,
    [orderId]
  );
  const row = existing.rows[0];

  const saved = await buildAndSavePharmacyReceipt(order, decision, {
    existingPath: row?.receipt_pdf_path,
    receiptNo: row?.receipt_no ?? order.receiptNo,
    issuedAt: order.decidedAt ? new Date(order.decidedAt) : new Date(),
  });
  if (!saved) return null;

  if (!row?.receipt_pdf_path) {
    await touchOrder(orderId, {
      receipt_no: saved.receiptNo,
      receipt_pdf_path: saved.storedPath,
      receipt_pdf_file_name: saved.displayName,
    });
  }

  return {
    receipt_pdf_path: saved.storedPath,
    receipt_pdf_file_name: saved.displayName,
    patient_id: patientId,
  };
}

export async function getOrderReceiptPdfPath(orderId: number, patientId?: number) {
  const { rows } = await dbQuery<{
    receipt_pdf_path: string | null;
    receipt_pdf_file_name: string | null;
    patient_id: number;
  }>(
    `SELECT receipt_pdf_path, receipt_pdf_file_name, patient_id
     FROM pasienkonsul.pharmacy_prescription_orders WHERE id = $1`,
    [orderId]
  );
  const row = rows[0];
  if (!row?.receipt_pdf_path) return null;
  if (patientId != null && row.patient_id !== patientId) return null;
  return row;
}

export async function getActiveDecisionOrderForSession(sessionId: number, patientId: number) {
  const { rows } = await dbQuery<OrderRow>(
    `SELECT * FROM pasienkonsul.pharmacy_prescription_orders
     WHERE session_id = $1 AND patient_id = $2
       AND status = 'medicine_ready_waiting_patient_decision'
     ORDER BY updated_at DESC LIMIT 1`,
    [sessionId, patientId]
  );
  return rows[0] ? mapOrder(rows[0], await loadOrderItems(rows[0].id)) : null;
}
