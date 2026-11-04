"use client";
import { useState, useEffect } from "react";

export function useMobileDevice(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    const phone =
      /iphone|ipod|android.*mobile|windows phone|blackberry/.test(ua) &&
      !ua.includes("ipad") &&
      !/android(?!.*mobile)/.test(ua);
    setIsMobile(phone);
  }, []);
  return isMobile;
}
