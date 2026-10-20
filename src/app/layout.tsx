import type { Metadata } from "next";
import "./globals.css";
import "./studio.css";
export const metadata: Metadata = {
  title: "I am able — Un jour à la fois",
  description:
    "Votre espace personnel pour les menus, le suivi et les petits pas du quotidien.",
  robots: { index: false, follow: false },
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
