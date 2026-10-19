import { notFound, redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { authorizedClient } from "@/lib/supabase";
import { loadWorkspace } from "@/lib/workspace";
export default async function PrivateDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (locale !== "fr" && locale !== "en") notFound();
  const auth = await authorizedClient();
  if (!auth) redirect(`/${locale}`);
  const data = await loadWorkspace(auth.db);
  return <Dashboard locale={locale} mode="private" initialData={data} />;
}
