"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body className="flex min-h-screen items-center justify-center bg-[#121212] text-white">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="text-zinc-400 text-sm">The error has been reported automatically.</p>
          <button
            onClick={reset}
            className="px-4 py-2 bg-indigo-600 rounded-lg text-sm hover:bg-indigo-700 transition"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
