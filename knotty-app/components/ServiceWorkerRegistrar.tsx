"use client";
import { useEffect } from "react";

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      if (document.readyState === "complete") {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      } else {
        window.addEventListener("load", () => {
          navigator.serviceWorker.register("/sw.js").catch(() => {});
        });
      }
    }
  }, []);
  return null;
}
