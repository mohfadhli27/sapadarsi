import type { PharmacyOrderStatus, PharmacyPrescriptionOrder } from "@/src/types/pharmacy-order";

export const NEW_ORDER_FILTER_ID = "new";

export const NEW_ORDER_STATUSES: PharmacyOrderStatus[] = [
  "prescription_uploaded",
  "waiting_pharmacist_review",
];

export function isNewPharmacyOrder(order: Pick<PharmacyPrescriptionOrder, "status">): boolean {
  return NEW_ORDER_STATUSES.includes(order.status);
}
