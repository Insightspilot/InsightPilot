
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AntdProvider from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "InsightPilot",
  description: "AI-powered BI tool for data insights",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full">
        <AntdProvider>
          <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>{children}</div>
            <footer
              style={{
                textAlign: "center",
                padding: "16px 32px",
                background: "#fafafa",
                borderTop: "1px solid #f0f0f0",
                color: "#999",
                fontSize: 13,
              }}
            >
              InsightPilot &copy; {new Date().getFullYear()}. All rights reserved.
            </footer>
          </div>
        </AntdProvider>
      </body>
    </html>
  );
}
