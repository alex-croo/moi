import { isLocale } from "@/lib/locale";
import { notFound, redirect } from "next/navigation";
import { authorizedClient, configured } from "@/lib/supabase";
import { demoEnabled, trustedOrigin } from "@/lib/security";
import { Login } from "@/components/login";
export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  if (await authorizedClient()) redirect(`/${locale}/dashboard`);
  return (
    <Login
      locale={locale}
      enabled={configured() && Boolean(trustedOrigin())}
      demo={demoEnabled()}
      error={(await searchParams).error}
    />
  );
}
