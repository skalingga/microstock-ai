import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// One grotesk family for posters and forms alike; the opsz axis keeps small text readable (DESIGN.md).
const bricolage = Bricolage_Grotesque({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
  axes: ["opsz"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "MicroStock Vector AI", template: "%s · MicroStock Vector AI" },
  description: "Buat aset vektor SVG siap upload ke Adobe Stock dari satu tema.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // next-themes sets the class before hydration, so the server and client class lists differ on purpose.
    <html lang="id" suppressHydrationWarning className={`${bricolage.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
