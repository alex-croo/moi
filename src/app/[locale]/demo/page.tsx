import { notFound } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { demoData } from "@/lib/demo";
import { demoEnabled } from "@/lib/security";
export default async function Demo({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!demoEnabled() || (locale !== "fr" && locale !== "en")) notFound();
  return <Dashboard locale={locale} mode="demo" initialData={demoData} />;
}
