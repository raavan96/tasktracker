import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./glass.css";
import "./charcoal.css";
import { cookies } from 'next/headers';
import ThemeProvider from '@/components/ThemeProvider';
import AppFooter from '@/components/AppFooter';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TaskTracker — Team workspace",
  description: "Delegate tasks, track progress, and keep your team’s updates in one place.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const theme = (await cookies()).get('tasktracker-theme')?.value === 'dark' ? 'dark' : 'light';
  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><ThemeProvider initialTheme={theme}>{children}<AppFooter /></ThemeProvider></body>
    </html>
  );
}
