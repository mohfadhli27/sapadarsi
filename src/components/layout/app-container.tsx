import { cn } from "@/src/lib/utils";

/** Lebar konten konsisten: full-width section + konten terpusat (navbar/footer style). */
export const APP_CONTAINER =
  "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 xl:max-w-[1400px]";

type AppContainerProps = {
  children: React.ReactNode;
  className?: string;
};

export function AppContainer({ children, className }: AppContainerProps) {
  return <div className={cn(APP_CONTAINER, className)}>{children}</div>;
}
