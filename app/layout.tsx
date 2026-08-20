import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Donor Recovery",
  description: "Turn failed donations back into completed ones",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
