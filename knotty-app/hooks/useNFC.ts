"use client";
import { useState, useCallback, useRef } from "react";

export type NFCResult = { type: "text"; value: string } | { type: "uid"; value: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NDEFReaderInstance = any;

export function useNFC() {
  const [scanning, setScanning] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const readerRef = useRef<NDEFReaderInstance>(null);
  const stopFnRef = useRef<(() => void) | null>(null);

  const isSupported = typeof window !== "undefined" && "NDEFReader" in window;

  /** One-shot scan — resolves when first tag is tapped */
  const scan = useCallback((): Promise<NFCResult | null> => {
    return new Promise(async (resolve) => {
      if (!isSupported) {
        setError("Web NFC requires Chrome on Android. Use manual card entry instead.");
        resolve(null);
        return;
      }
      try {
        setScanning(true);
        setError(null);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const NDEFReader = (window as any).NDEFReader;
        const reader = new NDEFReader();
        readerRef.current = reader;
        await reader.scan();

        reader.onreading = (event: { message: { records: Array<{ recordType: string; encoding?: string; data: ArrayBuffer }> }; serialNumber: string }) => {
          setScanning(false);
          for (const record of event.message.records) {
            if (record.recordType === "text") {
              const decoder = new TextDecoder(record.encoding || "utf-8");
              resolve({ type: "text", value: decoder.decode(record.data) });
              return;
            }
          }
          resolve({ type: "uid", value: event.serialNumber.toUpperCase().replace(/:/g, "") });
        };

        reader.onerror = () => {
          setScanning(false);
          setError("NFC read error — try again");
          resolve(null);
        };
      } catch (e: unknown) {
        setScanning(false);
        const msg = e instanceof Error ? e.message : "NFC error";
        setError(msg.includes("permission") ? "NFC permission denied — enable in browser settings" : msg);
        resolve(null);
      }
    });
  }, [isSupported]);

  /** Continuous listen mode — fires onTap for every card tap until stopListen() */
  const startListen = useCallback(async (onTap: (result: NFCResult) => void): Promise<boolean> => {
    if (!isSupported) {
      setError("Web NFC requires Chrome on Android.");
      return false;
    }
    try {
      setError(null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const NDEFReader = (window as any).NDEFReader;
      const reader = new NDEFReader();
      readerRef.current = reader;

      await reader.scan();
      setListening(true);

      // Debounce: ignore taps within 2.5 s of each other to prevent double-fire
      let lastTapAt = 0;

      reader.onreading = (event: { message: { records: Array<{ recordType: string; encoding?: string; data: ArrayBuffer }> }; serialNumber: string }) => {
        const now = Date.now();
        if (now - lastTapAt < 2500) return;
        lastTapAt = now;

        for (const record of event.message.records) {
          if (record.recordType === "text") {
            const decoder = new TextDecoder(record.encoding || "utf-8");
            onTap({ type: "text", value: decoder.decode(record.data) });
            return;
          }
        }
        onTap({ type: "uid", value: event.serialNumber.toUpperCase().replace(/:/g, "") });
      };

      reader.onerror = () => {
        setError("NFC read error");
      };

      stopFnRef.current = () => {
        // Null out handlers so the reader can't fire callbacks even if still scanning
        if (readerRef.current) {
          readerRef.current.onreading = null;
          readerRef.current.onerror = null;
        }
        readerRef.current = null;
        setListening(false);
      };

      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "NFC error";
      setError(msg.includes("permission") ? "NFC permission denied — enable in browser settings" : msg);
      setListening(false);
      return false;
    }
  }, [isSupported]);

  const stopListen = useCallback(() => {
    if (stopFnRef.current) { stopFnRef.current(); stopFnRef.current = null; }
    setListening(false);
  }, []);

  const stop = useCallback(() => {
    stopListen();
    setScanning(false);
    readerRef.current = null;
  }, [stopListen]);

  return { scan, startListen, stopListen, stop, scanning, listening, error, isSupported };
}
