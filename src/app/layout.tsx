import type { Metadata } from "next";
import "./globals.css";
import "./studio.css";
import "./learning.css";
export const metadata: Metadata = {
  title: "Tred’meal — Un jour à la fois",
  description:
    "Votre espace personnel pour les menus, le suivi et les petits pas du quotidien.",
  robots: { index: false, follow: false },
  applicationName: "Tred’meal",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/brand/tredmeal/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/tredmeal/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: { url: "/brand/tredmeal/apple-touch-icon.png", sizes: "180x180" },
  },
};
export const dynamic = "force-dynamic";
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
