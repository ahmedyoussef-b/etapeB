import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";
import { cn } from "@/lib/utils";
import { InitializationProvider } from "@/components/providers/initialization-provider";
import { InitializationGuard } from "@/components/initialization/initialization-guard";
import { SetupGuard } from "@/components/setup/setup-guard";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "NexaFlow - Automate workflows without the chaos",
  description: "NexaFlow connects your tools, orchestrates your pipelines, and gives your team superpowers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={cn("font-sans antialiased h-full", inter.variable)}>
      <body className="min-h-screen h-full bg-background text-foreground">
        <Providers>
          <InitializationProvider>
            <InitializationGuard>
              <SetupGuard>
                {children}
              </SetupGuard>
            </InitializationGuard>
          </InitializationProvider>
        </Providers>
      </body>
    </html>
  );
}
