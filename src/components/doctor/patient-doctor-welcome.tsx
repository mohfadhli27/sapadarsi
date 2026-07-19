"use client";

import { MessageCircle, Plus, Stethoscope, UserRound } from "lucide-react";
import { Button } from "@/src/components/ui/button";

type Props = {
  onNewConsultation: () => void;
};

const steps = [
  {
    icon: MessageCircle,
    title: "Ceritakan keluhan",
    desc: "Jelaskan gejala atau pertanyaan kesehatan Anda.",
  },
  {
    icon: Stethoscope,
    title: "Pilih dokter",
    desc: "Sistem merekomendasikan dokter sesuai poli.",
  },
  {
    icon: UserRound,
    title: "Konsultasi live",
    desc: "Konsultasi langsung dengan dokter yang Anda pilih.",
  },
];

export function PatientDoctorWelcome({ onNewConsultation }: Props) {
  return (
    <div className="chat-scrollbar flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-gradient-to-b from-muted/20 to-background">
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-4 py-8 lg:px-8 lg:py-12">
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary lg:h-20 lg:w-20">
            <Stethoscope className="h-8 w-8 lg:h-10 lg:w-10" />
          </div>
          <h2 className="mt-5 text-2xl font-bold tracking-tight lg:text-3xl">
            Konsultasi Dokter RSI
          </h2>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground lg:text-base">
            Pilih dokter dari daftar di samping kiri untuk melanjutkan riwayat, atau mulai
            konsultasi baru untuk menjelaskan keluhan Anda.
          </p>
          <Button
            type="button"
            className="mt-6 h-11 gap-2 rounded-xl px-6 lg:hidden"
            onClick={onNewConsultation}
          >
            <Plus className="h-4 w-4" />
            Mulai konsultasi baru
          </Button>
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-3 lg:mt-12 lg:gap-4">
          {steps.map((step, i) => (
            <div
              key={step.title}
              className="rounded-2xl border bg-card/80 p-4 text-left shadow-sm backdrop-blur-sm lg:p-5"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {i + 1}
                </span>
                <step.icon className="h-5 w-5 text-primary/70" />
              </div>
              <p className="mt-3 text-sm font-semibold">{step.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.desc}</p>
            </div>
          ))}
        </div>

        <p className="mt-8 hidden text-sm text-muted-foreground lg:block">
          Gunakan tombol <strong className="text-foreground">Konsultasi baru</strong> di sidebar
          kiri, atau pilih nama dokter untuk membuka riwayat percakapan.
        </p>
      </div>
    </div>
  );
}
