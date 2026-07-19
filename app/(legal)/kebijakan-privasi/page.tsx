import type { Metadata } from "next";
import Link from "next/link";
import { getBrand } from "@/src/config/brand";
import { LegalList, LegalNote, LegalSection, LegalShell } from "@/src/components/legal/legal-shell";

const brand = getBrand();
const updated = "30 Juni 2026";

export const metadata: Metadata = {
  title: `Kebijakan Privasi — ${brand.name}`,
  description: `Kebijakan privasi aplikasi dan layanan ${brand.name}.`,
};

export default function KebijakanPrivasiPage() {
  return (
    <LegalShell title="Kebijakan Privasi" updated={updated}>
      <p className="legal-prose mb-1">
        Dokumen ini menjelaskan bagaimana {brand.fullName} mengumpulkan, menggunakan, dan
        melindungi data Anda di situs dan aplikasi mobile yang terhubung ke{" "}
        <a
          href={brand.publicUrl}
          className="font-medium text-foreground underline decoration-primary/40 underline-offset-[3px] hover:decoration-primary"
        >
          {brand.publicUrl.replace(/^https?:\/\//, "")}
        </a>
        .
      </p>

      <LegalSection title="Pengendali data">
        <p>
          Layanan dikembangkan oleh kolaborasi RSI A. Yani Surabaya, Universitas Nahdlatul Ulama
          Surabaya, dan {brand.orgFullName}. Pertanyaan privasi dapat disampaikan melalui kontak
          resmi rumah sakit atau administrator {brand.name}.
        </p>
      </LegalSection>

      <LegalSection title="Jenis akun">
        <LegalList
          items={[
            "Akun pasien — dapat dibuat sendiri melalui formulir pendaftaran.",
            "Akun tenaga kesehatan (bidan, dokter, apoteker, admin) — tidak bisa didaftarkan publik; dibuat oleh administrator institusi.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Data yang dikumpulkan">
        <p className="font-medium text-foreground">Saat pendaftaran pasien</p>
        <LegalList
          items={[
            "Nama, NIK (opsional), jenis kelamin, tanggal lahir, alamat",
            "Nomor telepon, WhatsApp, email",
            "Username dan password (disimpan sebagai hash)",
            "Nomor rekam medis yang dibuat otomatis",
          ]}
        />
        <p className="font-medium text-foreground">Saat menggunakan layanan</p>
        <LegalList
          items={[
            "Isi chat konsultasi dan riwayat percakapan",
            "Ringkasan klinis, resep, dan dokumen unduhan",
            "Log teknis untuk keamanan sistem",
          ]}
        />
        <p className="font-medium text-foreground">Di aplikasi Android</p>
        <LegalList
          items={[
            "Notifikasi untuk tenaga kesehatan (jika login sebagai staff)",
            "Penyimpanan file PDF unduhan di perangkat",
            "Data sesi login lokal agar tetap masuk",
          ]}
        />
      </LegalSection>

      <LegalSection title="Tujuan penggunaan">
        <LegalList
          items={[
            "Menyediakan konsultasi digital dokter, bidan, dan apotek",
            "Mengelola akun pasien dan rekam medis terkait",
            "Menghubungkan pasien dengan tenaga kesehatan berwenang",
            "Menerbitkan dokumen klinis yang Anda unduh",
            "Keamanan dan peningkatan layanan",
          ]}
        />
      </LegalSection>

      <LegalSection title="Data kesehatan">
        <LegalNote>
          Informasi dari chat dan konsultasi <strong>bukan pengganti pemeriksaan fisik</strong> oleh
          tenaga medis. Data kesehatan hanya diakses pihak yang berwenang sesuai peran.
        </LegalNote>
      </LegalSection>

      <LegalSection title="Pihak ketiga">
        <p>
          Kami tidak menjual data pribadi. Data diproses di infrastruktur institusi dan hanya
          dibagikan jika diwajibkan hukum atau untuk keperluan medis yang sah.
        </p>
      </LegalSection>

      <LegalSection title="Keamanan">
        <p>
          Data disimpan di server institusi dengan akses terbatas. Kami menggunakan hash password,
          HTTPS, dan kontrol akses berbasis peran. Mohon jaga kerahasiaan password Anda.
        </p>
      </LegalSection>

      <LegalSection title="Hak Anda">
        <LegalList
          items={[
            "Mengakses dan memperbarui profil melalui menu Profil",
            "Menarik persetujuan dengan berhenti menggunakan layanan",
          ]}
        />
        <p>
          Untuk menonaktifkan login pasien, buka menu{" "}
          <Link href="/profil" className="font-medium text-foreground underline-offset-2 hover:underline">
            Profil
          </Link>{" "}
          atau{" "}
          <Link href="/hapus-akun" className="font-medium text-foreground underline-offset-2 hover:underline">
            halaman Hapus Akun
          </Link>
          .
        </p>
        <p>
          Penghapusan akun menonaktifkan akses login. Riwayat di rekam medis rumah sakit dapat
          tetap disimpan sesuai peraturan yang berlaku.
        </p>
      </LegalSection>

      <LegalSection title="Anak-anak">
        <p>
          Layanan ditujukan untuk pasien yang didaftarkan sendiri atau oleh wali sah. Hubungi
          administrator jika Anda yakin data anak dikumpulkan tanpa izin.
        </p>
      </LegalSection>

      <LegalSection title="Perubahan & kontak">
        <p>
          Kebijakan dapat diperbarui; versi terbaru selalu dipublikasikan di halaman ini. Untuk
          pertanyaan privasi, gunakan saluran resmi RSI A. Yani atau administrator {brand.name}.
        </p>
        <p className="text-sm">
          Lihat juga{" "}
          <Link href="/syarat-ketentuan" className="font-medium text-foreground underline-offset-2 hover:underline">
            Syarat & Ketentuan
          </Link>
        </p>
      </LegalSection>
    </LegalShell>
  );
}
