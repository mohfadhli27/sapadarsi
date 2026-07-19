#!/usr/bin/env node
/**
 * Uji validator respons (bukan template output).
 * Jalankan: node scripts/test-interview-context.mjs
 */

import { spawnSync } from "child_process";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, ".tmp", "interview-test-out");

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8", stdio: "pipe" });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || cmd).slice(0, 800));
}

mkdirSync(outDir, { recursive: true });

run(join(root, "node_modules", ".bin", "tsc"), [
  "src/lib/interview-context.ts",
  "src/lib/consultation-interview-rules.ts",
  "--outDir",
  outDir,
  "--module",
  "nodenext",
  "--target",
  "es2022",
  "--moduleResolution",
  "nodenext",
  "--skipLibCheck",
  "--esModuleInterop",
]);

const phaseSrc = readFileSync(join(root, "src/lib/interview-phase.ts"), "utf8")
  .replaceAll("@/src/lib/interview-context", "./interview-context.js")
  .replaceAll("@/src/lib/consultation-interview-rules", "./consultation-interview-rules.js")
  .replaceAll("@/src/lib/clinical-conversation-style", "./clinical-conversation-style.js");
writeFileSync(join(outDir, "interview-phase.ts"), phaseSrc);

const styleSrc = readFileSync(join(root, "src/lib/clinical-conversation-style.ts"), "utf8")
  .replaceAll("@/src/lib/interview-context", "./interview-context.js");
writeFileSync(join(outDir, "clinical-conversation-style.ts"), styleSrc);

run(join(root, "node_modules", ".bin", "tsc"), [
  join(outDir, "clinical-conversation-style.ts"),
  "--outDir",
  outDir,
  "--module",
  "nodenext",
  "--target",
  "es2022",
  "--moduleResolution",
  "nodenext",
  "--skipLibCheck",
  "--esModuleInterop",
]);

run(join(root, "node_modules", ".bin", "tsc"), [
  join(outDir, "interview-phase.ts"),
  "--outDir",
  outDir,
  "--module",
  "nodenext",
  "--target",
  "es2022",
  "--moduleResolution",
  "nodenext",
  "--skipLibCheck",
  "--esModuleInterop",
]);

const validatorSrc = readFileSync(join(root, "src/lib/agent-reply-validator.ts"), "utf8")
  .replaceAll("@/src/lib/interview-context", "./interview-context.js")
  .replaceAll("@/src/lib/interview-phase", "./interview-phase.js")
  .replaceAll("@/src/lib/clinical-conversation-style", "./clinical-conversation-style.js");
writeFileSync(join(outDir, "agent-reply-validator.ts"), validatorSrc);

run(join(root, "node_modules", ".bin", "tsc"), [
  join(outDir, "agent-reply-validator.ts"),
  "--outDir",
  outDir,
  "--module",
  "nodenext",
  "--target",
  "es2022",
  "--moduleResolution",
  "nodenext",
  "--skipLibCheck",
  "--esModuleInterop",
]);

const { getReplyValidationIssue, isGenericTemplateReply } = await import(
  join(outDir, "agent-reply-validator.js")
);
const { resolveConsultationInterviewPhase } = await import(join(outDir, "interview-phase.js"));

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const history = [
  { role: "patient", text: "saya mual dok" },
  {
    role: "doctor",
    text: "Sejak kapan mual atau muntahnya dirasakan, dan seberapa sering?",
  },
];

assert(
  isGenericTemplateReply("Terima kasih sudah menghubungi saya. Bisa dijelaskan lebih detail keluhannya?"),
  "should detect generic"
);

const good =
  "Baik, berarti sejak kemarin sekitar 1-2 kali sehari. Apakah yang keluar muntahan atau mual saja?";
assert(
  !getReplyValidationIssue(good, {
    latestMessage: "sejak kemarin dok dan 1-2 kali dalam sehari dok",
    history,
  }),
  "good reply should pass"
);

assert(
  getReplyValidationIssue("sejak kemarin dok dan 1-2 kali dalam sehari dok", {
    latestMessage: "sejak kemarin dok dan 1-2 kali dalam sehari dok",
    history,
  }) === "echo_patient",
  "echo should fail"
);

assert(
  getReplyValidationIssue(
    "Terima kasih sudah menghubungi saya. Bisa dijelaskan lebih detail keluhannya?",
    { latestMessage: "sejak kemarin", history }
  ) === "generic_template",
  "generic should fail"
);

assert(
  getReplyValidationIssue("hanya itu saja dok keluhanya cukup itu saja", {
    latestMessage: "sudah cukup tiu saja dok",
    history: [
      { role: "patient", text: "hanya itu saja dok keluhanya cukup itu saja" },
      { role: "doctor", text: "Terima kasih sudah menghubungi saya. Bisa dijelaskan lebih detail keluhannya?" },
    ],
  }) === "echo_patient",
  "echo of prior patient message should fail"
);

assert(
  resolveConsultationInterviewPhase({
    latestMessage: "sudah dok hanya itu",
    history: [
      { role: "patient", text: "overthinking dan kurang tidur" },
      { role: "doctor", text: "Apakah ada faktor lain?" },
    ],
  }) === "closing",
  "sudah hanya itu should be closing"
);

assert(
  resolveConsultationInterviewPhase({
    latestMessage: "tidak ada dok",
    history: [
      { role: "patient", text: "overthinking" },
      { role: "doctor", text: "Apakah ada riwayat serupa?" },
      { role: "patient", text: "kurang tidur" },
      { role: "doctor", text: "Faktor lain?" },
    ],
  }) === "assessment",
  "tidak ada after several questions should be assessment"
);

const repeatHistory = [
  { role: "patient", text: "overthinking dan kurang tidur dok" },
  { role: "doctor", text: "Apakah ada faktor lain selain overthinking dan kurang tidur?" },
  { role: "patient", text: "sudah dok hanya itu" },
];

assert(
  getReplyValidationIssue(
    "Baik Ibu Siti. Apakah ada riwayat penyakit serupa sebelumnya?",
    { latestMessage: "sudah dok hanya itu", history: repeatHistory }
  ) === "question_after_closing",
  "question after closing should fail"
);

assert(
  getReplyValidationIssue(
    "Baik. Selain kurang tidur, apakah ada stres emosional?",
    {
      latestMessage: "tidak ada dok",
      history: [
        ...repeatHistory,
        { role: "doctor", text: "Apakah ada riwayat serupa?" },
      ],
    }
  ) === "repeat_topic",
  "repeat stress/sleep topic should fail"
);

assert(
  resolveConsultationInterviewPhase({
    latestMessage: "belum pernah mengalami ini sebelumnya",
    history: [
      { role: "patient", text: "hamil 4 minggu nyeri punggung berat" },
      { role: "midwife", text: "Apakah pernah nyeri punggung sebelum kehamilan?" },
    ],
  }) === "gathering",
  "belum pernah should stay gathering not assessment"
);

assert(
  resolveConsultationInterviewPhase({
    latestMessage: "apakah makanan juga ngaruh bu bidan?",
    history: [
      { role: "patient", text: "hamil 4 minggu nyeri punggung" },
      { role: "midwife", text: "Apakah pernah nyeri sebelum kehamilan?" },
      { role: "patient", text: "belum pernah" },
      { role: "midwife", text: "Kemungkinan terkait perubahan hormon dan postur." },
    ],
  }) === "follow_up",
  "patient question should be follow_up"
);

const { isVagueClinicalReply } = await import(join(outDir, "clinical-conversation-style.js"));
assert(
  isVagueClinicalReply(
    "Baik Ibu, terima kasih informasinya. Keluhan perlu diperhatikan. Istirahat cukup dan minum air putih."
  ),
  "generic vague reply should fail"
);
assert(
  !isVagueClinicalReply(
    "Baik Ibu, mengingat nyeri punggung berat di usia kehamilan 4 minggu, sering terkait perubahan postur — seberapa sering nyerinya muncul?"
  ),
  "specific reply should pass vague check"
);

const { buildNextInterviewReply } = await import(join(outDir, "interview-context.js"));
const rebahanReply = buildNextInterviewReply({
  latestMessage: "saya malah banyak rebahan bu bidan selama kehamilan 4 bulan ini",
  initialComplaint: "hamil 4 minggu nyeri punggung berat",
  history: [
    { role: "patient", text: "hamil 4 minggu nyeri punggung berat" },
    { role: "midwife", text: "Apakah pernah nyeri sebelum kehamilan?" },
    { role: "patient", text: "belum pernah" },
    { role: "midwife", text: "Seberapa berat nyeri punggungnya?" },
  ],
});
assert(!rebahanReply.includes("saya malah banyak rebahan"), "ack must not echo patient verbatim");
assert(/beristirahat|berbaring/i.test(rebahanReply), "ack should summarize rebahan");
assert(rebahanReply.includes("?"), "should include follow-up question");

assert(
  getReplyValidationIssue(
    "Baik, berarti sudah saya malah banyak rebahan bu bidan selama kehamilan 4 bulan ini. Seberapa berat nyeri punggungnya?",
    {
      latestMessage: "saya malah banyak rebahan bu bidan selama kehamilan 4 bulan ini",
      history: [{ role: "patient", text: "saya malah banyak rebahan bu bidan selama kehamilan 4 bulan ini" }],
    }
  ) === "echo_patient",
  "substring echo should fail validation"
);

console.log("OK — fase wawancara + validator siap");
