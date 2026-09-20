import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  metadataBase: new URL("https://www.studentbenefitcard.com"),

  title: {
    default: "Student Benefit Card | SBC",
    template: "%s | Student Benefit Card",
  },

  description:
    "Student Benefit Card (SBC) gives students access to exclusive offers, discounts and benefits from partner businesses.",

  keywords: [
    "Student Benefit Card",
    "SBC",
    "student discounts",
    "student offers",
    "student benefits",
    "student discounts Nellore",
    "student offers Nellore",
  ],

  applicationName: "Student Benefit Card",

  authors: [
    {
      name: "Student Benefit Card",
    },
  ],

  creator: "Student Benefit Card",
  publisher: "Student Benefit Card",

  alternates: {
    canonical: "https://www.studentbenefitcard.com",
  },

  openGraph: {
    type: "website",
    url: "https://www.studentbenefitcard.com",
    siteName: "Student Benefit Card",
    title: "Student Benefit Card | SBC",
    description:
      "Exclusive offers, discounts and benefits for students from SBC partner businesses.",
    locale: "en_IN",
  },

  twitter: {
    card: "summary",
    title: "Student Benefit Card | SBC",
    description:
      "Exclusive offers, discounts and benefits for students.",
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export default function RootLayout({
  children,
}: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}