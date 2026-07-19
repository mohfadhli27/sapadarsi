import { redirect } from "next/navigation";

/** Halaman dashboard lama — arahkan ke landing utama. */
export default function DashboardPage() {
  redirect("/");
}
