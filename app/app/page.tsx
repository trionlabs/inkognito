"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  SelfAppBuilder,
  type SelfApp,
} from "@selfxyz/qrcode";
import { PdfFile, ProveResult, UseCase } from "./types";
import { useStepNavigation } from "./hooks/useStepNavigation";
import Header from "./components/Header";
import ProofBlueprint from "./components/ProofBlueprint";
import UseCaseList from "./components/UseCaseList";
import UploadStep from "./components/UploadStep";
import ScanStep from "./components/ScanStep";
import ProvingStep from "./components/ProvingStep";
import DoneStep from "./components/DoneStep";
import ConfigureStep from "./components/ConfigureStep";

export default function Home() {
  const nav = useStepNavigation();
  const [selfApp, setSelfApp] = useState<SelfApp | null>(null);
  const [pdfFile, setPdfFile] = useState<PdfFile | null>(null);
  const [provingStatus, setProvingStatus] = useState("");
  const [proveResult, setProveResult] = useState<ProveResult | null>(null);
  const [proveError, setProveError] = useState<string | null>(null);
  const [networkStatus, setNetworkStatus] = useState("pending");
  const [hoveredUseCase, setHoveredUseCase] = useState<UseCase | null>(null);
  const scanTriggeredRef = useRef(false);
  const prevStepRef = useRef(nav.step);

  useEffect(() => {
    try {
      const app = new SelfAppBuilder({
        appName: "inkognito",
        scope: "sp1-zkpdf-selfid",
        endpoint:
          process.env.NEXT_PUBLIC_SELF_ENDPOINT ||
          "http://localhost:3000/api/verify",
        logoBase64: "https://i.postimg.cc/mrmVf9hm/self.png",
        userId: "0x0000000000000000000000000000000000000000",
        userIdType: "hex",
        endpointType: "staging_https",
        devMode: true,
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

  // Poll network status
  useEffect(() => {
    if (!proveResult?.requestId) return;
    setNetworkStatus("pending");

    const poll = async () => {
      try {
        const res = await fetch(`/api/proof-status?requestId=${encodeURIComponent(proveResult.requestId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status) setNetworkStatus(data.status);
        }
      } catch {
        // ignore polling errors
      }
    };

    poll();
    const interval = setInterval(poll, 15_000);
    return () => clearInterval(interval);
  }, [proveResult?.requestId]);

  const handleGenerateProof = useCallback(async () => {
    nav.goToProving();
    setProveError(null);
    setProvingStatus("Finding latest proof...");

    try {
      const latestRes = await fetch("/api/latest-proof");
      const latestData = await latestRes.json();
      if (!latestRes.ok) throw new Error(latestData.error || "No proof found");

      setProvingStatus("Converting proof & submitting to Succinct network...");

      const proveRes = await fetch("/api/prove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proofFile: latestData.filename,
          ...(pdfFile && { pdfFile: pdfFile.serverName }),
        }),
      });

      const proveData = await proveRes.json();
      if (!proveRes.ok) throw new Error(proveData.error || "Proving failed");

      setProveResult(proveData);
      nav.goToDone(true);
    } catch (err) {
      setProveError(err instanceof Error ? err.message : "Proving failed");
      nav.goToDone(false);
    }
  }, [nav, pdfFile]);

  const handleScanSuccess = useCallback(() => {
    if (scanTriggeredRef.current) return;
    scanTriggeredRef.current = true;
    nav.setPassportScanned(true);
    handleGenerateProof();
  }, [nav, handleGenerateProof]);

  // Poll /api/latest-proof during scan step to detect when Self app completes verification
  useEffect(() => {
    if (nav.step !== "scan") {
      scanTriggeredRef.current = false;
      return;
    }
    let initialFile: string | null = null;
    let initialized = false;

    const poll = async () => {
      try {
        const res = await fetch("/api/latest-proof");
        if (!res.ok) return;
        const { filename } = await res.json();
        if (!initialized) {
          initialFile = filename;
          initialized = true;
          return;
        }
        if (filename !== initialFile && !scanTriggeredRef.current) {
          scanTriggeredRef.current = true;
          handleScanSuccess();
        }
      } catch {
        // ignore polling errors
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [nav.step, handleScanSuccess]);

  // Sync page-level state when nav.step changes via browser back/forward
  useEffect(() => {
    if (prevStepRef.current === nav.step) return;
    prevStepRef.current = nav.step;

    switch (nav.step) {
      case "select":
        setPdfFile(null);
        setProveResult(null);
        setProveError(null);
        setProvingStatus("");
        setNetworkStatus("pending");
        scanTriggeredRef.current = false;
        break;
      case "scan":
        scanTriggeredRef.current = false;
        break;
      case "proving":
        if (!provingStatus) {
          setProvingStatus("Generating proof...");
        }
        break;
      case "done":
        if (!proveResult && !proveError) {
          nav.reset();
        }
        break;
    }
  }, [nav.step, nav, provingStatus, proveResult, proveError]);

  const handleReset = useCallback(() => {
    nav.reset();
    setPdfFile(null);
    setProveResult(null);
    setProveError(null);
    setProvingStatus("");
    setNetworkStatus("pending");
  }, [nav]);

  const blueprintWithNetwork = {
    ...nav.blueprint,
    networkStatus,
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header onLogoClick={handleReset} />

      <main className="flex-1 w-full px-10 xl:px-20 py-10">
        <div className="flex gap-0">
          {/* Left column */}
          <div className="flex-1 min-w-0">
            {/* Breadcrumb navigator */}
            {nav.step !== "select" && nav.useCase && (() => {
              const stepNameMap: Record<string, string> = {
                configure: "configure",
                upload: "upload",
                scan: "scan",
                proving: "prove",
                done: "results",
              };
              const flowSteps: string[] = [
                ...(nav.useCase.id === "custom" ? ["configure"] : []),
                ...(nav.useCase.sources.includes("pdf") ? ["upload"] : []),
                ...(nav.useCase.sources.includes("passport") ? ["scan"] : []),
                "proving",
                "done",
              ];
              const currentIdx = flowSteps.indexOf(nav.step);
              return (
                <nav className="font-mono text-[14px] uppercase tracking-wide mb-8 animate-fadeInUp">
                  <span className="text-ink-muted">{nav.useCase.label}</span>
                  <span className="text-ink-muted mx-2">/</span>
                  {flowSteps.map((s, i) => {
                    const isActive = nav.step === s;
                    const isPast = i < currentIdx;
                    return (
                      <span key={s}>
                        {isActive && <span className="text-ink-bright mr-0.5">&gt; </span>}
                        <span className={
                          isActive ? "text-ink-bright" : isPast ? "text-ink-bright" : "text-ink-muted"
                        }>
                          {stepNameMap[s]}
                        </span>
                        {i < flowSteps.length - 1 && (
                          <span className="text-ink-muted mx-2">&mdash;</span>
                        )}
                      </span>
                    );
                  })}
                </nav>
              );
            })()}
            {nav.step === "select" && (
              <UseCaseList
                onSelect={nav.selectUseCase}
                onHover={setHoveredUseCase}
                onHoverEnd={() => setHoveredUseCase(null)}
              />
            )}

            {nav.step === "configure" && (
              <ConfigureStep
                onContinue={(checks) => nav.configureCustom(checks)}
                onBack={handleReset}
              />
            )}

            {nav.step === "upload" && nav.useCase && (
              <UploadStep
                useCase={nav.useCase}
                pdfFile={pdfFile}
                onUploaded={(file) => {
                  setPdfFile(file);
                  nav.setPdfUploaded(true);
                }}
                onContinue={nav.useCase.sources.includes("passport")
                  ? () => nav.nextStepFromUpload()
                  : handleGenerateProof
                }
              />
            )}

            {nav.step === "scan" && (
              <ScanStep
                selfApp={selfApp}
                pdfFile={pdfFile}
                onSuccess={handleScanSuccess}
                onBack={handleReset}
              />
            )}

            {nav.step === "proving" && (
              <ProvingStep status={provingStatus} />
            )}

            {nav.step === "done" && (
              <DoneStep
                success={!!proveResult}
                proveError={proveError}
                proveResult={proveResult}
                networkStatus={networkStatus}
                useCase={nav.useCase}
                onReset={handleReset}
              />
            )}
          </div>

          {/* Column spacer */}
          <div className="hidden lg:block shrink-0 w-16" />

          {/* Right column - Proof Blueprint */}
          <ProofBlueprint
            state={blueprintWithNetwork}
            networkStatus={networkStatus}
            hoveredUseCase={hoveredUseCase}
          />
        </div>
      </main>
    </div>
  );
}
