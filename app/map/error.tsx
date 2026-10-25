"use client";

import { ErrorFallback } from "@/app/components/ErrorFallback";

export default function MapError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <ErrorFallback
      error={error}
      retry={retry}
      background="#1a1814"
      title="The map could not load"
      message="Something went wrong while placing the pins. Try again, or head back to the homepage."
    />
  );
}
