import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { Noto_Sans_JP } from "next/font/google";
import ParticleBackground from "@/components/ParticleBackground";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-outfit",
});

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sans-jp",
});

export const metadata: Metadata = {
  title: "Career AI - AIキャリア診断",
  description: "AIがあなたのキャリアプランを提案します",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${notoSansJP.variable} ${outfit.variable} font-body antialiased`}
      >
        <ParticleBackground />
        {children}
      </body>
    </html>
  );
}
