import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CounterOS",
  description: "Competitor intelligence agent for founders"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="min-w-[320px] bg-[#c5ccd3]">
      <body className="min-h-screen bg-[#c5ccd3] font-sans text-[#16151b] antialiased">{children}</body>
    </html>
  );
}
