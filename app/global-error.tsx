"use client";

import "./globals.css";
import { ErrorFallback } from "@/app/components/ErrorFallback";
import { dmSans } from "@/app/fonts";

// Catches what app/error.tsx cannot: an exception in app/layout.tsx itself, such
// as a malformed content/updates entry. It replaces the root layout, so it
// renders its own <html> and <body> and brings the global styles and font.
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body className={`${dmSans.className} antialiased`}>
        <title>Something went wrong · Artrium Space</title>
        <ErrorFallback
          error={error}
          retry={retry}
          background="#3F3A36"
          title="Something went wrong"
          message="Artrium Space hit an unexpected error. Try again, or head back to the homepage."
        />
      </body>
    </html>
  );
}
