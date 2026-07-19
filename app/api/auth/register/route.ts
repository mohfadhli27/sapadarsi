import { NextRequest, NextResponse } from "next/server";
import { registerSchema } from "@/src/lib/validators";
import { registerPatient } from "@/src/lib/patient-register";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.errors[0]?.message ?? "Data tidak valid";
      return NextResponse.json(
        { success: false, message: firstError },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const patient = await registerPatient({
      name: data.name,
      nickname: data.nickname || undefined,
      nik: data.nik || undefined,
      sex: data.sex,
      birthDate: data.birthDate,
      address: data.address,
      phone: data.phone,
      whatsapp: data.whatsapp,
      email: data.email,
      username: data.username,
      password: data.password,
    });

    return NextResponse.json({
      success: true,
      message: `Registrasi berhasil. No. RM Anda: ${patient.noRm}`,
      user: {
        id: String(patient.patientId),
        patientId: patient.patientId,
        name: patient.name,
        medicalRecordNumber: patient.noRm,
        email: patient.email,
        username: patient.username,
      },
    });
  } catch (error) {
    console.error("[auth/register]", error);
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan server";
    const status =
      message.includes("sudah") || message.includes("digunakan") ? 409 : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
}
