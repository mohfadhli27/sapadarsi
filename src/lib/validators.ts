import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password minimal 8 karakter")
  .max(72, "Password maksimal 72 karakter");

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email atau username wajib diisi")
    .max(100, "Email atau username maksimal 100 karakter"),
  password: z.string().min(1, "Password wajib diisi"),
});

export const registerSchema = z
  .object({
    name: z
      .string()
      .min(2, "Nama minimal 2 karakter")
      .max(75, "Nama maksimal 75 karakter"),
    nickname: z
      .string()
      .max(30, "Nama panggilan maksimal 30 karakter")
      .optional()
      .or(z.literal("")),
    nik: z
      .string()
      .optional()
      .or(z.literal(""))
      .refine((v) => !v || /^\d{16}$/.test(v), "NIK harus 16 digit angka"),
    sex: z.enum(["L", "P"], { message: "Pilih jenis kelamin" }),
    birthDate: z.string().min(1, "Tanggal lahir wajib diisi"),
    address: z
      .string()
      .min(5, "Alamat minimal 5 karakter")
      .max(50, "Alamat maksimal 50 karakter"),
    phone: z
      .string()
      .min(10, "Nomor HP minimal 10 digit")
      .max(15, "Nomor HP maksimal 15 digit")
      .regex(/^[0-9+]+$/, "Nomor HP hanya boleh angka"),
    whatsapp: z
      .string()
      .min(10, "WhatsApp minimal 10 digit")
      .max(15, "WhatsApp maksimal 15 digit")
      .regex(/^[0-9+]+$/, "WhatsApp hanya boleh angka"),
    email: z.string().email("Format email tidak valid"),
    username: z
      .string()
      .min(3, "Username minimal 3 karakter")
      .max(50, "Username maksimal 50 karakter")
      .regex(
        /^[a-zA-Z0-9_]+$/,
        "Username hanya huruf, angka, dan underscore"
      ),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Konfirmasi password wajib diisi"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Konfirmasi password tidak cocok",
    path: ["confirmPassword"],
  });

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
