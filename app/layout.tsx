import type { Metadata, Viewport } from "next";
import { Quicksand } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";

const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "OpenFinances",
  description: "Controlá tus finanzas personales",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-196.png", sizes: "196x196", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const cookieStore = await cookies();
  const theme = cookieStore.get("theme")?.value === "light" ? "light" : "dark";

  return (
    <html
      lang="es"
      data-theme={theme}
      className={`${quicksand.variable} h-full antialiased`}
    >
      <body className="min-h-dvh flex flex-col">
        <div className="bg-base-gradient" aria-hidden="true" />
        <div className="bg-glow-tl" aria-hidden="true" />
        <div className="bg-glow-br" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
