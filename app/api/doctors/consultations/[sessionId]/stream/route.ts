import { NextRequest } from "next/server";
import {
  createConsultationSseStream,
  SSE_HEADERS,
} from "@/src/lib/consultation-sse";
import { getDoctorSession } from "@/src/lib/doctor-consultation-service";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    const patientId = Number(req.nextUrl.searchParams.get("patientId"));
    const sid = Number(sessionId);

    if (!patientId) {
      return new Response("patientId wajib", { status: 400 });
    }

    await getDoctorSession(sid, patientId);

    const stream = createConsultationSseStream(sid, req);
    return new Response(stream, { headers: SSE_HEADERS });
  } catch (error) {
    return new Response(
      error instanceof Error ? error.message : "Gagal membuka stream",
      { status: 404 }
    );
  }
}
