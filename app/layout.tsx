// app/layout.tsx
import "./globals.css";
import { Inter } from "next/font/google";
import { ReactNode } from "react";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "AWKT-LD | AI Database Assistant",
  description: "Connect any database and chat with your data in Urdu or English",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <head>
        <meta name="theme-color" content="#4f46e5" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}