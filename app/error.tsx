"use client";

import { ErrorFallback } from "@/app/components/ErrorFallback";

export default function RootError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <ErrorFallback
      error={error}
      retry={retry}
      background="#3F3A36"
      title="Something went wrong"
      message="This page hit an unexpected error. Try again, or head back to the homepage."
    />
  );
}
