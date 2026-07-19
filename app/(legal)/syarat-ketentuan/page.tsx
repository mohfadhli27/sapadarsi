import type { Metadata } from "next";
import Link from "next/link";
import { getBrand } from "@/src/config/brand";
import { LegalList, LegalNote, LegalSection, LegalShell } from "@/src/components/legal/legal-shell";

const brand = getBrand();

export const metadata: Metadata = {
  title: `Syarat & Ketentuan — ${brand.name}`,
  description: `Syarat penggunaan layanan ${brand.name}.`,
};

export default function SyaratKetentuanPage() {
  return (
    <LegalShell title="Syarat & Ketentuan">
      <p className="legal-prose mb-1">
        Ketentuan penggunaan layanan {brand.fullName} untuk pasien dan tenaga kesehatan yang
        terdaftar.
      </p>

      <LegalSection title="Layanan">
        <p>
          {brand.fullName} menyediakan konsultasi digital melalui dokter, bidan, dan apotek untuk
          triase awal dan pendampingan kesehatan. Layanan bersifat pendampingan — bukan diagnosis
          final atau pengganti pemeriksaan langsung di fasilitas kesehatan.
        </p>
      </LegalSection>

      <LegalSection title="Pendaftaran akun">
        <p className="font-medium text-foreground">Pasien</p>
        <p>
          Daftar melalui menu <strong>Daftar</strong> dengan data yang benar. Anda bertanggung jawab
          menjaga kerahasiaan akun.
        </p>
        <p className="font-medium text-foreground">Tenaga kesehatan</p>
        <LegalNote>
          Tidak ada pendaftaran publik untuk bidan, dokter, apoteker, atau admin. Akun dibuat
          administrator rumah sakit. Tenaga kesehatan yang belum punya akun harus menghubungi
          IT/koordinator {brand.name} — jangan memakai formulir pasien.
        </LegalNote>
      </LegalSection>

      <LegalSection title="Penggunaan yang diperbolehkan">
        <LegalList
          items={[
            "Konsultasi dokter, bidan, dan apotek sesuai layanan tersedia",
            "Mengunduh resep atau ringkasan konsultasi untuk keperluan pribadi",
            "Login sesuai peran akun (pasien atau staff)",
          ]}
        />
      </LegalSection>

      <LegalSection title="Larangan">
        <LegalList
          items={[
            "Menyalahgunakan layanan atau mengirim konten melanggar hukum",
            "Membagikan akun login kepada orang lain",
            "Mendaftar sebagai pasien jika Anda bukan pasien",
            "Mengakses data pasien lain tanpa wewenang",
          ]}
        />
      </LegalSection>

      <LegalSection title="Konten medis & AI">
        <p>
          Jawaban awal dapat melibatkan asisten AI. Keputusan klinis tetap tanggung jawab tenaga
          kesehatan berwenang. Segera ke IGD atau fasilitas kesehatan jika gejala memburuk.
        </p>
      </LegalSection>

      <LegalSection title="Penghapusan akun">
        <p>
          Pasien dapat menghapus akun login di halaman{" "}
          <Link href="/hapus-akun" className="font-medium text-foreground underline-offset-2 hover:underline">
            Hapus Akun
          </Link>
          . Staff menghubungi administrator untuk menonaktifkan akun.
        </p>
      </LegalSection>

      <LegalSection title="Perubahan layanan">
        <p>
          Kami dapat melakukan pemeliharaan atau penyesuaian fitur. Pemberitahuan diberikan melalui
          saluran resmi jika memungkinkan.
        </p>
        <p className="text-sm">
          Lihat juga{" "}
          <Link href="/kebijakan-privasi" className="font-medium text-foreground underline-offset-2 hover:underline">
            Kebijakan Privasi
          </Link>
        </p>
      </LegalSection>
    </LegalShell>
  );
}
