import type { PrescriptionMedication } from "@/src/types/prescription";

export function emptyMedication(): PrescriptionMedication {
  return {
    name: "",
    strength: "",
    dosage: "1 tablet",
    frequency: "3x sehari",
    route: "Oral",
    duration: "5 hari",
    quantity: "",
    notes: "",
  };
}
