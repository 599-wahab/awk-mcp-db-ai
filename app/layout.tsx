import "./globals.css";
import { Inter } from "next/font/google";
import { ReactNode } from "react";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "AWKT-LD | Universal Database AI Assistant",
  description: "Connect to any database and analyze your data with AI-powered insights",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" className={inter.className}>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#4f46e5" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}