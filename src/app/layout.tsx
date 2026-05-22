import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Image to WebP Converter — PNG, JPG, HEIC to WebP",
  description: "Convert PNG, JPG, JPEG, and HEIC images to WebP format instantly in your browser. Free, private, and fast bulk image conversion with quality control.",
  keywords: ["webp converter", "png to webp", "jpg to webp", "heic to webp", "image converter", "bulk image conversion"],
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
        {children}
      </body>
    </html>
  );
}
