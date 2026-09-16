import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WellPath | Personal health plan",
  description: "A clear, personalised path to healthier habits."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
