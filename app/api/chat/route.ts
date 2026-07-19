import { NextRequest, NextResponse } from "next/server";
import { streamPharmacyChat } from "@/src/lib/pharmacy-nemotron-agent";

type ChatBody = {
  messages?: Array<{ id?: string; role: string; content: string }>;
  conversationId?: string;
  sessionId?: number;
  patient?: {
    patientId?: number;
    name?: string;
    noRm?: string;
  };
};

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role") || "dokter";

  try {
    const body = (await req.json()) as ChatBody;
    const messages = body.messages ?? [];
    const userMessage = messages[messages.length - 1]?.content || "";

    if (role === "apoteker") {
      const patientId = body.patient?.patientId;
      const sessionId = body.sessionId;
      if (!patientId || !sessionId) {
        return NextResponse.json(
          { success: false, message: "Login dan sessionId diperlukan" },
          { status: 401 }
        );
      }

      return streamPharmacyChat({
        sessionId,
        patientId,
        patientName: body.patient?.name,
        message: userMessage,
      });
    }

    const roleLabel =
      role === "dokter" ? "Dokter" : role === "bidan" ? "Bidan" : "Apoteker";

    const mockChunks = [
      `{"type":"status","message":"Menganalisis keluhan Anda..."}\n`,
      `{"type":"text-delta","text":"Halo, terima kasih telah menghubungi layanan DARSI. "}\n`,
      `{"type":"text-delta","text":"Saya adalah asisten AI ${roleLabel} yang akan membantu menganalisis keluhan Anda.\\n\\n"}\n`,
      `{"type":"text-delta","text":"Berdasarkan keluhan yang Anda sampaikan: \\"${userMessage}\\"\\n\\n"}\n`,
      `{"type":"text-delta","text":"**Penting:** Ini merupakan analisis awal berbasis AI dan bukan diagnosis medis. "}\n`,
      `{"type":"text-delta","text":"Silakan konsultasikan lebih lanjut dengan tenaga medis untuk penanganan yang tepat."}\n`,
    ];

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for (const chunk of mockChunks) {
          controller.enqueue(encoder.encode(chunk));
          await new Promise((r) => setTimeout(r, 200));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan pada chat";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
