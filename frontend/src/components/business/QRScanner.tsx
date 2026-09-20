"use client";

import { useEffect, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";

interface QRScannerProps {
  onScan: (value: string) => Promise<void>;
}

export default function QRScanner({
  onScan,
}: QRScannerProps) {
  const scannerRef =
    useRef<Html5QrcodeScanner | null>(null);

  const scanningRef = useRef(false);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "spc-qr-reader",
      {
        fps: 10,
        qrbox: {
          width: 260,
          height: 260,
        },
        rememberLastUsedCamera: true,
      },
      false
    );

    scanner.render(
      async (decodedText) => {
        if (scanningRef.current) return;

        scanningRef.current = true;

        try {
          await onScan(decodedText);
        } catch (error) {
          console.error(error);
        }
      },
      () => {}
    );

    scannerRef.current = scanner;

    return () => {
      scanner
        .clear()
        .catch(() => {});
    };
  }, [onScan]);

  const restartScanner = async () => {
    scanningRef.current = false;
  };

  return (
    <div className="space-y-4">
      <div
        id="spc-qr-reader"
        className="overflow-hidden rounded-3xl border bg-white shadow-xl"
      />

      <button
        onClick={restartScanner}
        className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700"
      >
        Scan Next Student
      </button>
    </div>
  );
}