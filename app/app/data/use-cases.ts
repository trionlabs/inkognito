import { UseCase } from "../types";

export const useCases: UseCase[] = [
  {
    id: "age-verification",
    label: "Age Verification",
    description: "Prove you are over 18 without revealing your identity or any personal details.",
    sources: ["passport"],
    checks: ["Passport validity", "Date of birth extraction", "Age threshold (18+)"],
    outputDescription: "Boolean proof: subject is over 18",
  },
  {
    id: "kyc-compliance",
    label: "KYC Compliance",
    description: "Meet regulatory KYC requirements without exposing raw personal data.",
    sources: ["passport"],
    checks: [
      "Passport validity",
      "Identity extraction",
      "Nationality verification",
      "Age threshold (18+)",
    ],
    outputDescription: "Compliance attestation with selective disclosure",
  },
  {
    id: "document-verification",
    label: "Document Verification",
    description: "Verify a PDF document's digital signature is authentic and unmodified.",
    sources: ["pdf"],
    checks: ["PDF signature extraction", "Certificate chain validation", "Document integrity"],
    outputDescription: "Boolean proof: document signature is valid",
  },
  {
    id: "document-ownership",
    label: "Document Ownership",
    description: "Prove the passport holder is the signer of a specific document.",
    sources: ["passport", "pdf"],
    checks: [
      "Passport identity extraction",
      "PDF signature extraction",
      "Name cross-reference",
      "Identity-to-signer binding",
    ],
    outputDescription: "Boolean proof: passport holder signed the document",
  },
  {
    id: "legal-document",
    label: "Legal Document",
    description: "Full verification: age, identity, nationality, and document authenticity in one proof.",
    sources: ["passport", "pdf"],
    checks: [
      "Passport identity extraction",
      "PDF signature validation",
      "Name cross-reference",
      "DOB cross-check",
      "Nationality verification",
      "Age threshold (18+)",
    ],
    outputDescription: "Composite proof: identity + document + compliance",
  },
  {
    id: "custom",
    label: "Custom Verification",
    description: "Build your own verification flow with custom checks and disclosure rules.",
    sources: [],
    checks: [],
    outputDescription: "Custom proof configuration",
  },
];
