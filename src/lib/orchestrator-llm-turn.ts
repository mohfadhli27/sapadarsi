/**
 * Jalankan orchestrator LLM dengan validasi + retry (bukan template if/else).
 */

import {
  chatCompletions,
  resolveActiveOrchestratorProfile,
} from "@/src/lib/nemotron-orchestrator";
import {
  analyzeInterviewFacts,
  formatKnownFactsSummary,
} from "@/src/lib/interview-context";
import {
  buildLlmCorrectionPrompt,
  getReplyValidationIssue,
  type ReplyValidationContext,
} from "@/src/lib/agent-reply-validator";

const DEFAULT_MAX_ATTEMPTS = Number(process.env.CONSULTATION_LLM_MAX_ATTEMPTS || "2");

export async function runValidatedOrchestratorTurn<T>(input: {
  validationCtx: ReplyValidationContext;
  system: string;
  buildUser: (correctionSuffix: string) => string;
  extractReply: (raw: string) => T;
  getReplyText: (result: T) => string;
  maxAttempts?: number;
  /** Hindari fallback Ollama kecil di tengah turn — konsisten pakai profil utama. */
  primaryOnly?: boolean;
}): Promise<{ result: T; model: string; profileId: string; attempts: number }> {
  const maxAttempts = Math.max(1, input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
  const factsSummary = formatKnownFactsSummary(analyzeInterviewFacts(input.validationCtx));
  const lockedProfile = resolveActiveOrchestratorProfile();

  let lastReply = "";
  let lastIssue = getReplyValidationIssue("", input.validationCtx) ?? "empty";
  let lastMeta = { model: "", profileId: "" };

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const correction =
      attempt === 0 ? "" : buildLlmCorrectionPrompt(lastIssue, lastReply, factsSummary);

    const nemotron = await chatCompletions({
      system: input.system,
      user: input.buildUser(correction),
      jsonMode: true,
      profile: lockedProfile,
    });

    lastMeta = { model: nemotron.model, profileId: nemotron.profileId };
    const result = input.extractReply(nemotron.content);
    const replyText = input.getReplyText(result).trim();
    lastReply = replyText;

    const issue = getReplyValidationIssue(replyText, input.validationCtx);
    if (!issue) {
      return {
        result,
        model: nemotron.model,
        profileId: nemotron.profileId,
        attempts: attempt + 1,
      };
    }

    lastIssue = issue;
    console.warn(
      `[orchestrator] respons LLM ditolak (${issue}), retry ${attempt + 1}/${maxAttempts}`
    );
  }

  throw new Error(
    `Orchestrator respons tidak valid setelah ${maxAttempts} percobaan (${lastIssue})`
  );
}
