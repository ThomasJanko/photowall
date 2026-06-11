import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { EventThemeProvider } from "@/components/EventThemeProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mur de souvenirs",
  description: "Partage tes photos de la soirée en direct !",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <EventThemeProvider>{children}</EventThemeProvider>
      </body>
    </html>
  );
}
