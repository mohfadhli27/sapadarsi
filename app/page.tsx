import { Suspense } from "react";
import { DarsiHome } from "@/src/components/chat/darsi-home";
import { LoadingSpinner } from "@/src/components/shared/loading-spinner";

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center">
          <LoadingSpinner />
        </div>
      }
    >
      <DarsiHome />
    </Suspense>
  );
}
