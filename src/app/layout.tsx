import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SavedRecommendationsProvider } from "@/lib/saved-recommendations-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Knygų rekomendacijos",
  description: "Tikros skaitytojų rekomendacijos ir priežastys, kodėl verta skaityti.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="lt" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <SavedRecommendationsProvider>{children}</SavedRecommendationsProvider>
      </body>
    </html>
  );
}
