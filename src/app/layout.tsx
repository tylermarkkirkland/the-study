import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import MotionProvider from "@/components/MotionProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_TITLE = "The Study";
const SITE_DESCRIPTION =
  "An exploratory portfolio prototype — a personal desk you can sit down at.";

// Absolute base for the social-share image URLs. Since the home page is
// statically prerendered, the og:image URL is baked at build time and must be
// the real production origin (otherwise share cards point at localhost).
// Vercel provides this automatically; set NEXT_PUBLIC_SITE_URL to override for
// a custom domain or non-Vercel host.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  // The opengraph-image.tsx / twitter-image.tsx routes supply the card image and
  // its dimensions automatically; these objects add the title/description/type.
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full">
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
