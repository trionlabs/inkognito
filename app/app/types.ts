export type Step = "select" | "configure" | "upload" | "scan" | "proving" | "done";

export interface CheckDef {
  id: string;
  label: string;
  category: "identity" | "document" | "cross-check";
  requires: ("passport" | "pdf")[];
}

export interface UseCase {
  id: string;
  label: string;
  description: string;
  sources: ("passport" | "pdf")[];
  checks: string[];
  outputDescription: string;
  comingSoon?: boolean;
}

export interface PdfFile {
  name: string;
  size: number;
  serverName: string;
}

export interface ProveResult {
  explorerUrl: string;
  requestId: string;
  identity?: {
    surname?: string;
    given_name?: string;
    nationality?: string;
    dob?: string;
    older_than?: string;
    attestation_id?: number;
  };
}

export interface BlueprintState {
  useCase: UseCase | null;
  pdfUploaded: boolean;
  passportScanned: boolean;
  proofStatus: "idle" | "proving" | "done" | "error";
  networkStatus: string;
}
