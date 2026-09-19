import { Public_Sans, JetBrains_Mono } from "next/font/google";

import AppShell from "../components/AppShell/AppShell";
import "./globals.css";

const publicSans = Public_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "SmartWaste AI · Waste Monitoring Command Centre",
  description:
    "AI-powered roadside waste detection, reporting and cleanup coordination.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${publicSans.variable} ${jetbrainsMono.variable}`}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
