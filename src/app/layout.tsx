import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "giftd",
  description: "Find their gift.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f2ff" },
    { media: "(prefers-color-scheme: dark)", color: "#120e24" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${manrope.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <div aria-hidden="true" className="orb orb-1" />
        <div aria-hidden="true" className="orb orb-2" />
        <div aria-hidden="true" className="orb orb-3" />
        {children}
      </body>
    </html>
  );
}
