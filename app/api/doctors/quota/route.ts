import { NextRequest, NextResponse } from "next/server";
import { listDoctorsForUnit } from "@/src/lib/doctor-consultation-service";
import type { RsiUnitType } from "@/src/lib/rsi-api";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const unitId = String(body.unitId ?? "");
    const unitName = body.unitName ? String(body.unitName) : undefined;
    const unitType = (body.unitType ?? "reguler") as RsiUnitType;
    const tanggal = body.tanggal ? String(body.tanggal) : undefined;

    if (!unitId && !unitName) {
      return NextResponse.json(
        { success: false, message: "unitId atau unitName wajib diisi" },
        { status: 400 }
      );
    }

    const { doctors, source } = await listDoctorsForUnit({
      unitId: unitId || "unknown",
      unitName,
      unitType,
      tanggal,
    });
    return NextResponse.json({ success: true, doctors, source });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Gagal memuat dokter" },
      { status: 500 }
    );
  }
}
