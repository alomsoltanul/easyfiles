import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppHeader from "@/components/AppHeader";
import GlobalFooter from "@/components/GlobalFooter";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ConvertTools — All-in-One Image, PDF & Video Tools",
  description: "Convert images between HEIC, JPEG, PNG, WebP. Merge, split, compress PDFs. Scan documents with OCR. Download videos. All free, private, and browser-based.",
  keywords: ["image converter", "heic to jpg", "png to webp", "pdf merger", "pdf compressor", "ocr scanner", "video downloader", "image compressor"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body className="min-h-screen bg-slate-50 flex flex-col" suppressHydrationWarning>
        <AppHeader />
        <main className="flex-1">{children}</main>
        <GlobalFooter />
      </body>
    </html>
  );
}
