"use client";

import React, { useState, useEffect } from "react";
import {
  SelfQRcodeWrapper,
  SelfAppBuilder,
  type SelfApp,
} from "@selfxyz/qrcode";

export default function Home() {
  const [selfApp, setSelfApp] = useState<SelfApp | null>(null);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  useEffect(() => {
    try {
      const app = new SelfAppBuilder({
        appName: "SP1 zkPDF + Self ID",
        scope: "sp1-zkpdf-selfid",
        endpoint: process.env.NEXT_PUBLIC_SELF_ENDPOINT || "http://localhost:3000/api/verify",
        logoBase64: "https://i.postimg.cc/mrmVf9hm/self.png",
        userId: "0x0000000000000000000000000000000000000000",
        userIdType: "hex",
        endpointType: "staging_https",
        version: 2,
        disclosures: {
          nationality: true,
          name: true,
          date_of_birth: true,
          expiry_date: true,
          minimumAge: 18,
        },
      }).build();

      setSelfApp(app);
    } catch (error) {
      console.error("[ERROR]: Failed to initialize Self app:", error);
    }
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-md w-full space-y-8 text-center">
        <h1 className="text-3xl font-bold">SP1 zkPDF + Self ID</h1>
        <p className="text-gray-400">
          Scan with the Self app to generate a Groth16 identity proof
        </p>

        <div className="flex justify-center">
          {selfApp ? (
            <SelfQRcodeWrapper
              selfApp={selfApp}
              onSuccess={() => {
                setStatus("success");
                console.log("[INFO]: Verification successful, proof captured");
              }}
              onError={(data) => {
                setStatus("error");
                console.error("[ERROR]: Verification error:", data);
              }}
              size={300}
              darkMode={true}
            />
          ) : (
            <div className="w-[300px] h-[300px] bg-gray-800 rounded-lg flex items-center justify-center">
              <p className="text-gray-500">Loading QR Code...</p>
            </div>
          )}
        </div>

        {status === "success" && (
          <div className="p-4 bg-green-900/50 border border-green-700 rounded-lg">
            <p className="text-green-400 font-medium">Proof captured successfully</p>
          </div>
        )}

        {status === "error" && (
          <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg">
            <p className="text-red-400 font-medium">Verification failed</p>
          </div>
        )}

        <div className="text-xs text-gray-600 space-y-1">
          <p>Endpoint: {process.env.NEXT_PUBLIC_SELF_ENDPOINT || "http://localhost:3000/api/verify"}</p>
        </div>
      </div>
    </main>
  );
}
