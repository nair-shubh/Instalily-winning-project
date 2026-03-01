import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TopJourney — AI Inventory Intelligence",
  description:
    "Real-time, offline-first inventory monitoring powered by computer vision and on-device AI.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
