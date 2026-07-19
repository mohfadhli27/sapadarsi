import { writeFile } from "fs/promises";
import { generatePharmacyReceiptPdf } from "../src/lib/pharmacy-receipt-pdf.ts";

const pdf = await generatePharmacyReceiptPdf({
  receiptNo: "RES-2026-00099",
  orderId: 99,
  prescriptionNo: "RX-TEST",
  patientName: "Test Pasien",
  patientRm: "RM001",
  patientDecision: "pickup",
  deliveryAddress: null,
  items: [
    {
      id: 1,
      orderId: 99,
      drugName: "Paracetamol 500mg",
      quantity: "1",
      unit: "strip",
      unitPrice: 15000,
      subtotal: 15000,
      availabilityStatus: "available",
      note: null,
    },
  ],
  totalPrice: 15000,
  pharmacistNote: null,
  issuedAt: new Date(),
});

await writeFile("/tmp/test-resi-logo.pdf", pdf);
console.log("PDF generated:", pdf.length, "bytes -> /tmp/test-resi-logo.pdf");
