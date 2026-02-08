"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Step, UseCase, BlueprintState, CheckDef } from "../types";
import { useCases } from "../data/use-cases";

interface NavState {
  step: Step;
  useCaseId: string | null;
  pdfUploaded: boolean;
  passportScanned: boolean;
  proofStatus: BlueprintState["proofStatus"];
}

const VALID_STEPS: Step[] = ["select", "configure", "upload", "scan", "proving", "done"];

function findUseCase(id: string | null): UseCase | null {
  if (!id) return null;
  return useCases.find((uc) => uc.id === id) ?? null;
}

function readHash(): Step {
  if (typeof window === "undefined") return "select";
  const h = window.location.hash.slice(1);
  return VALID_STEPS.includes(h as Step) ? (h as Step) : "select";
}

/** Merge our NavState with Next.js internal history state (__NA, __PRIVATE_NEXTJS_INTERNALS_TREE)
 *  so that Next.js's popstate handler doesn't call window.location.reload(). */
function historyPush(state: NavState, hash: string) {
  window.history.pushState({ ...window.history.state, ...state }, "", hash);
}
function historyReplace(state: NavState, hash: string) {
  window.history.replaceState({ ...window.history.state, ...state }, "", hash);
}

export function useStepNavigation() {
  const [step, setStep] = useState<Step>("select");
  const [useCase, setUseCase] = useState<UseCase | null>(null);
  const [pdfUploaded, setPdfUploaded] = useState(false);
  const [passportScanned, setPassportScanned] = useState(false);
  const [proofStatus, setProofStatus] = useState<BlueprintState["proofStatus"]>("idle");

  const useCaseRef = useRef<UseCase | null>(null);
  const initialized = useRef(false);

  // Effect 1 — One-time init: restore state from hash + history.state
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const existingState = window.history.state as NavState | null;
    const hashStep = readHash();

    if (existingState?.step && VALID_STEPS.includes(existingState.step) && hashStep !== "select") {
      setStep(existingState.step);
      setPdfUploaded(existingState.pdfUploaded);
      setPassportScanned(existingState.passportScanned);
      setProofStatus(existingState.proofStatus);
      const resolved = findUseCase(existingState.useCaseId);
      setUseCase(resolved);
      useCaseRef.current = resolved;
    } else {
      historyReplace(
        { step: "select", useCaseId: null, pdfUploaded: false, passportScanned: false, proofStatus: "idle" },
        "#select"
      );
    }
  }, []);

  // Effect 2 — Popstate listener: always re-registers after StrictMode remount
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const s = e.state as NavState | null;
      if (!s || !s.step) {
        setStep("select");
        setUseCase(null);
        useCaseRef.current = null;
        setPdfUploaded(false);
        setPassportScanned(false);
        setProofStatus("idle");
        return;
      }

      setStep(s.step);
      setPdfUploaded(s.pdfUploaded);
      setPassportScanned(s.passportScanned);
      setProofStatus(s.proofStatus);

      const resolved = (s.useCaseId === "custom" && useCaseRef.current?.id === "custom" && useCaseRef.current.sources.length > 0)
        ? useCaseRef.current
        : findUseCase(s.useCaseId);
      setUseCase(resolved);
      useCaseRef.current = resolved;
    };

    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const push = useCallback((state: NavState) => {
    setStep(state.step);
    historyPush(state, `#${state.step}`);
  }, []);

  const selectUseCase = useCallback(
    (uc: UseCase) => {
      setUseCase(uc);
      useCaseRef.current = uc;
      if (uc.id === "custom") {
        push({ step: "configure", useCaseId: uc.id, pdfUploaded: false, passportScanned: false, proofStatus: "idle" });
        return;
      }
      const nextStep: Step = uc.sources.includes("pdf") ? "upload" : uc.sources.includes("passport") ? "scan" : "upload";
      push({ step: nextStep, useCaseId: uc.id, pdfUploaded: false, passportScanned: false, proofStatus: "idle" });
    },
    [push]
  );

  const nextStepFromUpload = useCallback(() => {
    if (!useCase) return;
    setPdfUploaded(true);
    const nextStep: Step = useCase.sources.includes("passport") ? "scan" : "proving";
    push({ step: nextStep, useCaseId: useCase.id, pdfUploaded: true, passportScanned, proofStatus });
  }, [useCase, passportScanned, proofStatus, push]);

  const configureCustom = useCallback(
    (checks: CheckDef[]) => {
      const sources = Array.from(
        new Set(checks.flatMap((c) => c.requires))
      ) as ("passport" | "pdf")[];
      const configured: UseCase = {
        id: "custom",
        label: "Custom Verification",
        description: "Custom verification flow",
        sources,
        checks: checks.map((c) => c.label),
        outputDescription: "Custom proof: " + checks.map((c) => c.label).join(", "),
      };
      setUseCase(configured);
      useCaseRef.current = configured;
      const nextStep: Step = sources.includes("pdf") ? "upload" : sources.includes("passport") ? "scan" : "upload";
      push({ step: nextStep, useCaseId: "custom", pdfUploaded: false, passportScanned: false, proofStatus: "idle" });
    },
    [push]
  );

  const goToProving = useCallback(() => {
    setProofStatus("proving");
    push({ step: "proving", useCaseId: useCaseRef.current?.id ?? null, pdfUploaded, passportScanned, proofStatus: "proving" });
  }, [pdfUploaded, passportScanned, push]);

  const goToDone = useCallback((success: boolean) => {
    const status = success ? "done" as const : "error" as const;
    setProofStatus(status);
    push({ step: "done", useCaseId: useCaseRef.current?.id ?? null, pdfUploaded, passportScanned, proofStatus: status });
  }, [pdfUploaded, passportScanned, push]);

  const reset = useCallback(() => {
    setStep("select");
    setUseCase(null);
    useCaseRef.current = null;
    setPdfUploaded(false);
    setPassportScanned(false);
    setProofStatus("idle");
    historyReplace(
      { step: "select", useCaseId: null, pdfUploaded: false, passportScanned: false, proofStatus: "idle" },
      "#select"
    );
  }, []);

  const blueprint: BlueprintState = {
    useCase,
    pdfUploaded,
    passportScanned,
    proofStatus,
    networkStatus: "pending",
  };

  return {
    step,
    useCase,
    blueprint,
    selectUseCase,
    configureCustom,
    nextStepFromUpload,
    goToProving,
    goToDone,
    setProofStatus,
    setPassportScanned,
    setPdfUploaded,
    reset,
  };
}
