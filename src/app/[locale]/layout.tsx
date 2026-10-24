import {LocaleProvider} from "@/components/locale-provider";
import type { Metadata } from "next";
import { localeOf, tr } from "@/lib/locale";
export async function generateMetadata({params}:{params:Promise<{locale:string}>}):Promise<Metadata>{const locale=localeOf((await params).locale);return {title:`Tred’meal — ${tr(locale,"Un jour à la fois","One day at a time")}`,description:tr(locale,"Votre espace personnel pour les menus, le suivi et les petits pas du quotidien.","Your personal space for meals, progress and everyday steps.")};}
export default async function LanguageLayout({children,params}:{children:React.ReactNode;params:Promise<{locale:string}>}){return <LocaleProvider locale={localeOf((await params).locale)}>{children}</LocaleProvider>;}
