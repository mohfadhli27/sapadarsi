import { NextRequest, NextResponse } from "next/server";
import { getRsiUnits, type RsiUnitType } from "@/src/lib/rsi-api";

export async function GET(req: NextRequest) {
  try {
    const type = (req.nextUrl.searchParams.get("type") ?? "reguler") as RsiUnitType;
    const units = await getRsiUnits(type === "eksekutif" ? "eksekutif" : "reguler");
    return NextResponse.json({ success: true, units });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Gagal memuat poli" },
      { status: 500 }
    );
  }
}
