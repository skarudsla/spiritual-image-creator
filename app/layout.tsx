import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spiritual Image Creator",
  description: "Create beautiful spiritual and biblical images with AI",
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
