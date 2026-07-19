import { NextRequest } from "next/server";
import {
  createConsultationSseStream,
  SSE_HEADERS,
} from "@/src/lib/consultation-sse";
import { getDoctorSessionByToken } from "@/src/lib/doctor-consultation-service";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const session = await getDoctorSessionByToken(token);
    const stream = createConsultationSseStream(session.row.id, req);
    return new Response(stream, { headers: SSE_HEADERS });
  } catch (error) {
    return new Response(
      error instanceof Error ? error.message : "Sesi tidak ditemukan",
      { status: 404 }
    );
  }
}
