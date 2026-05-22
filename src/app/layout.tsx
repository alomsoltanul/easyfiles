import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppHeader from "@/components/AppHeader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ConvertTools — Image Converter & Video Downloader",
  description: "Convert PNG, JPG, HEIC images to WebP and download videos from YouTube, Facebook, Instagram, and X. Free, private, and secure.",
  keywords: ["webp converter", "png to webp", "jpg to webp", "heic to webp", "video downloader", "youtube downloader", "mp3 converter"],
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
      <body className="min-h-screen bg-slate-50" suppressHydrationWarning>
        <AppHeader />
        {children}
      </body>
    </html>
  );
}
