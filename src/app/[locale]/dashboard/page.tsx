import { isLocale } from "@/lib/locale";
import { notFound, redirect } from "next/navigation";
import { PrivateWorkspace } from "@/components/private-workspace";
import { authorizedClient } from "@/lib/supabase";

export default async function PrivateDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const auth = await authorizedClient();
  if (!auth) redirect(`/${locale}`);
  const { data: admin } = await auth.db.rpc("current_user_admin");
  return (
    <PrivateWorkspace
      key={auth.user.id}
      locale={locale}
      userId={auth.user.id}
      admin={admin === true}
    />
  );
}
