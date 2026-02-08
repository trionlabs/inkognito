import { CheckDef } from "../types";

export const checkDefinitions: CheckDef[] = [
  {
    id: "identity-proof",
    label: "Verify identity proof (Groth16)",
    category: "identity",
    requires: ["passport"],
  },
  {
    id: "age-check",
    label: "Age verification (18+)",
    category: "identity",
    requires: ["passport"],
  },
  {
    id: "nationality-check",
    label: "Nationality check",
    category: "identity",
    requires: ["passport"],
  },
  {
    id: "ofac-check",
    label: "OFAC sanctions check",
    category: "identity",
    requires: ["passport"],
  },
  {
    id: "pdf-signature",
    label: "PDF signature verification",
    category: "document",
    requires: ["pdf"],
  },
  {
    id: "surname-match",
    label: "Surname match (ID \u2194 PDF)",
    category: "cross-check",
    requires: ["passport", "pdf"],
  },
];
