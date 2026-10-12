import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { FREE_TOOL_COUNT, TOOL_COUNT } from "@/lib/tools";
import { getSiteUrl } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: `ConvertTools — ${FREE_TOOL_COUNT} Free Image, PDF, JSON & Video Tools`,
  description: `Convert HEIC, JPEG, PNG and WebP. Merge, split, sign and compress PDFs. Format and convert JSON. Download video. ${FREE_TOOL_COUNT} tools run free in your browser with no account — ${TOOL_COUNT} in total.`,
  keywords: ["image converter", "heic to jpg", "png to webp", "pdf merger", "pdf compressor", "pdf to word", "json formatter", "ocr scanner", "video downloader", "image compressor"],
};

/**
 * Document shell only — no navigation.
 *
 * The public site's header and footer live in app/(site)/layout.tsx, and the
 * admin console brings its own chrome in app/(admin)/layout.tsx. Keeping this
 * layout empty is what lets the console render as a self-contained dashboard
 * instead of a page inside the marketing site.
 */
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
        {children}
      </body>
    </html>
  );
}
