import { NextRequest } from "next/server";
import {
  createConsultationSseStream,
  SSE_HEADERS,
} from "@/src/lib/consultation-sse";
import { requireStaff } from "@/src/lib/staff-api-auth";
import { staffCanAccessSession } from "@/src/lib/staff-session-access";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const staff = await requireStaff(req);
  if (!staff) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { sessionId } = await context.params;
    const sid = Number(sessionId);
    const allowed = await staffCanAccessSession(staff, sid);
    if (!allowed) {
      return new Response("Akses ditolak", { status: 403 });
    }

    const stream = createConsultationSseStream(sid, req);
    return new Response(stream, { headers: SSE_HEADERS });
  } catch (error) {
    return new Response(
      error instanceof Error ? error.message : "Gagal membuka stream",
      { status: 404 }
    );
  }
}
