import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SP1 zkPDF + Self zkID",
  description: "Compose zkPDF document proofs with Self Protocol identity proofs in SP1 zkVM",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-white">
        {children}
      </body>
    </html>
  );
}
