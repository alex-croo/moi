"use client";
import { useEffect } from "react";
import { ArrowRight, LockKeyhole, Sprout } from "lucide-react";
import { Brand } from "./brand";
import { Plate } from "./plate";
import { tr, type Locale } from "@/lib/locale";
export function Login({
  locale,
  enabled,
  demo,
  error,
}: {
  locale: Locale;
  enabled: boolean;
  demo: boolean;
  error?: string;
}) {
  const t = (fr: string, en: string) => tr(locale, fr, en);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return (
    <main className="login-layout">
      <section className="login-story">
        <Brand />
        <div className="login-story-content">
          <span className="eyebrow">
            {t("DE LA PLACE POUR VOUS", "A LITTLE ROOM FOR YOU")}
          </span>
          <h1>
            {t("Les petits pas", "Small steps")}
            <br />
            <em>{t("font leur chemin.", "go a long way.")}</em>
          </h1>
          <p>
            {t(
              "Bien manger. Prendre du recul. Avancer à votre rythme.",
              "Eat well. Take a breath. Move at your own pace.",
            )}
          </p>
          <Plate large />
          <div className="story-note">
            <Sprout size={18} />
            {t(
              "Un jour à la fois. Et c’est déjà beaucoup.",
              "One day at a time. And that’s already a lot.",
            )}
          </div>
        </div>
        <span className="login-copyright">
          I AM ABLE ·{" "}
          {t("VOTRE PARCOURS, VOTRE RYTHME", "YOUR JOURNEY, YOUR PACE")}
        </span>
      </section>
      <section className="login-form-area">
        <div className="login-language">
          <a href="/fr" aria-current={locale === "fr" ? "page" : undefined}>
            FR
          </a>
          <span>/</span>
          <a href="/en" aria-current={locale === "en" ? "page" : undefined}>
            EN
          </a>
        </div>
        <div className="login-box">
          <span className="lock-circle">
            <LockKeyhole size={22} />
          </span>
          <span className="eyebrow">
            {t("VOTRE ESPACE PERSONNEL", "YOUR PERSONAL SPACE")}
          </span>
          <h2>{t("Bienvenue chez vous.", "Welcome to your space.")}</h2>
          <p>
            {t(
              "Vos menus, vos réflexions et vos progrès. Tout simplement, au même endroit.",
              "Your menus, reflections and progress. Simply, all in one place.",
            )}
          </p>
          <form action="/auth/google" method="post">
            <input type="hidden" name="locale" value={locale} />
            <button className="google-button" disabled={!enabled}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fill="#4285F4"
                  d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4.3h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.6Z"
                />
                <path
                  fill="#34A853"
                  d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1a6 6 0 0 1-5.6-4.2H3.1v2.6A10 10 0 0 0 12 22Z"
                />
                <path
                  fill="#FBBC05"
                  d="M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3.1a10 10 0 0 0 0 9l3.3-2.6Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.9c1.5 0 2.8.5 3.9 1.5l2.8-2.8A9.5 9.5 0 0 0 12 2a10 10 0 0 0-8.9 5.5l3.3 2.6A6 6 0 0 1 12 5.9Z"
                />
              </svg>
              {t("Continuer avec Google", "Continue with Google")}
              <ArrowRight size={17} />
            </button>
          </form>
          {!enabled && (
            <p className="setup-message">
              {t(
                "La connexion sera disponible une fois votre espace privé activé.",
                "Sign-in will be available once your private space is activated.",
              )}
            </p>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error === "access"
                ? t(
                    "Ce compte n’a pas accès à cet espace.",
                    "This account does not have access to this space.",
                  )
                : t(
                    "La connexion n’a pas abouti. Veuillez réessayer.",
                    "Sign-in did not complete. Please try again.",
                  )}
            </p>
          )}
          <div className="login-privacy">
            <LockKeyhole size={14} />
            <span>
              {t(
                "Accès sur invitation. Vos données restent personnelles.",
                "Invitation only. Your data stays personal.",
              )}
            </span>
          </div>
          {demo && (
            <a href={`/${locale}/demo`} className="demo-link">
              {t("Explorer la maquette", "Explore the demo")}
              <ArrowRight size={16} />
            </a>
          )}
        </div>
        <p className="login-bottom">
          {t(
            "Un espace pour prendre soin de votre quotidien.",
            "A space to care for your everyday life.",
          )}
        </p>
      </section>
    </main>
  );
}
