import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { localeOf } from "@/lib/locale";
export default async function Home(){redirect(`/${localeOf((await cookies()).get("tredmeal-language")?.value||"fr")}`);}
