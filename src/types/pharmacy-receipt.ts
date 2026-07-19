export type PharmacyReceiptMeta = {
  orderId: number;
  receiptNo: string;
  decision: "delivery" | "pickup";
  totalPrice: number | null;
  fileName: string;
};
