import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Playfair_Display } from "next/font/google";
import "./globals.css";

const ibmMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-mono",
});

const ibmSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-sans",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
});

export const metadata: Metadata = {
  title: "inkognito",
  description: "Zero-knowledge identity and document verification",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${ibmSans.variable} ${ibmMono.variable} ${playfair.variable}`}>
      <body className="min-h-screen font-sans">
        <div className="ripple-bg" aria-hidden="true" />
        <div className="film-grain" aria-hidden="true" />
        <div className="relative z-2">
          {children}
        </div>
      </body>
    </html>
  );
}
