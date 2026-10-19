"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Cloud,
  FileText,
  FolderOpen,
  Heart,
  LayoutDashboard,
  Leaf,
  LockKeyhole,
  LogOut,
  Menu,
  Plus,
  Scale,
  Settings2,
  Sprout,
  Upload,
  X,
  ExternalLink,
  Clock3,
  Users,
  PenLine,
  type LucideIcon,
} from "lucide-react";
import { Brand } from "./brand";
import { Plate } from "./plate";
import { tr, type Locale } from "@/lib/locale";
import { menuSchema, documentSchema } from "@/lib/validation";
import type { WorkspaceData, MenuPlan, Meal } from "@/lib/types";

type View =
  "overview" | "menus" | "weight" | "journal" | "library" | "settings";
type Modal = "weight" | "journal" | "import" | "document" | null;
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

export function Dashboard({
  locale: initialLocale,
  mode,
  initialData,
}: {
  locale: Locale;
  mode: "demo" | "private";
  initialData: WorkspaceData;
}) {
  const [locale, setLocale] = useState(initialLocale);
  const [view, setView] = useState<View>("overview");
  const [data, setData] = useState(initialData);
  const [modal, setModal] = useState<Modal>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dayIndex, setDayIndex] = useState(0);
  const [planIndex, setPlanIndex] = useState(0);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [entryDate, setEntryDate] = useState(today);
  const [journalText, setJournalText] = useState("");
  const [mood, setMood] = useState(3);
  const dialog = useRef<HTMLDialogElement>(null);
  const t = (fr: string, en: string) => tr(locale, fr, en);
  const demo = mode === "demo";
  const plan = data.plans[planIndex];
  const day = plan?.days[dayIndex];
  const weights = [...data.weights].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const latestWeight = weights.at(-1);
  const recipes = plan
    ? plan.days.flatMap((d) => [d.lunch, d.dinner]).filter(Boolean).length
    : 0;
  const dateLabel = (
    date: string,
    options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" },
  ) =>
    new Date(`${date}T12:00:00Z`).toLocaleDateString(
      locale === "fr" ? "fr-CA" : "en-CA",
      { ...options, timeZone: "UTC" },
    );
  const number = (n: number) =>
    n.toLocaleString(locale === "fr" ? "fr-CA" : "en-CA", {
      maximumFractionDigits: 1,
    });
  const nav: { id: View; icon: LucideIcon; label: string }[] = [
    {
      id: "overview",
      icon: LayoutDashboard,
      label: t("Vue d’ensemble", "Overview"),
    },
    { id: "menus", icon: CalendarDays, label: t("Mes menus", "My menus") },
    { id: "weight", icon: Scale, label: t("Mon parcours", "My progress") },
    { id: "journal", icon: BookOpen, label: t("Mon journal", "My journal") },
    {
      id: "library",
      icon: FolderOpen,
      label: t("Mes documents", "My documents"),
    },
  ];
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  useEffect(() => {
    if (modal && !dialog.current?.open) dialog.current?.showModal();
    if (!modal && dialog.current?.open) dialog.current?.close();
  }, [modal]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 7000);
    return () => clearTimeout(timer);
  }, [notice]);
  function changeLanguage(value: Locale) {
    setLocale(value);
    window.history.replaceState(
      null,
      "",
      `/${value}/${demo ? "demo" : "dashboard"}`,
    );
  }
  function go(value: View) {
    setView(value);
    setMenuOpen(false);
  }
  function open(value: Modal) {
    setFormError("");
    setEntryDate(today());
    const entry = data.journal.find((e) => e.date === today());
    setJournalText(entry?.text || "");
    setMood(entry?.mood || 3);
    setModal(value);
  }
  async function save(type: string, value: object) {
    setBusy(true);
    setFormError("");
    try {
      if (demo) {
        const record = { ...value, id: crypto.randomUUID() };
        setData((current) => {
          if (type === "weight") {
            const row = record as WorkspaceData["weights"][number];
            return {
              ...current,
              weights: [
                ...current.weights.filter((w) => w.date !== row.date),
                row,
              ],
            };
          }
          if (type === "journal") {
            const row = record as WorkspaceData["journal"][number];
            return {
              ...current,
              journal: [
                row,
                ...current.journal.filter((j) => j.date !== row.date),
              ],
            };
          }
          if (type === "menu")
            return {
              ...current,
              plans: [record as MenuPlan, ...current.plans],
            };
          return {
            ...current,
            documents: [
              record as WorkspaceData["documents"][number],
              ...current.documents,
            ],
          };
        });
      } else {
        const result = await fetch("/api/workspace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, data: value }),
        });
        if (!result.ok) throw new Error("save");
        const refresh = await fetch("/api/workspace", { cache: "no-store" });
        if (!refresh.ok) throw new Error("refresh");
        setData(await refresh.json());
      }
      if (type === "menu") {
        setPlanIndex(0);
        setDayIndex(0);
        setView("menus");
      }
      setModal(null);
      setNotice(
        demo
          ? t(
              "Ajouté à la maquette pour cette visite seulement.",
              "Added to the demo for this visit only.",
            )
          : t(
              "Enregistré dans votre espace privé.",
              "Saved to your private space.",
            ),
      );
    } catch {
      setFormError(
        t(
          "L’enregistrement n’a pas pu être confirmé. Votre saisie est conservée ici; réessayez.",
          "Saving could not be confirmed. Your entry is still here; please try again.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    if (!plan || busy) return;
    setBusy(true);
    try {
      const { exportMenu } = await import("@/lib/pdf");
      await exportMenu(plan, locale, demo);
    } catch {
      setNotice(
        t(
          "L’export n’a pas abouti. Veuillez réessayer.",
          "The export did not complete. Please try again.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  function mealCard(meal: Meal | null, label: string) {
    return (
      <article className={`meal-card ${!meal ? "empty-meal" : ""}`}>
        <div className={`meal-visual ${meal?.kind || ""}`}>
          {meal ? <Plate kind={meal.kind} /> : <Plus size={26} />}
        </div>
        <div className="meal-body">
          <span className="eyebrow">{label}</span>
          <h3>
            {meal
              ? locale === "fr"
                ? meal.title
                : meal.titleEn
              : t("À votre choix", "Your choice")}
          </h3>
          {meal ? (
            <p className="meal-meta">
              <span>
                <Clock3 size={13} />
                {meal.minutes} min
              </span>
              <span>
                <Users size={13} />
                {meal.portions} portions
              </span>
            </p>
          ) : (
            <p className="muted">
              {t("Ce repas reste libre.", "This meal stays open.")}
            </p>
          )}
        </div>
      </article>
    );
  }
  function menuSection(full = false) {
    return (
      <section className="menu-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              {t("BIEN MANGER, SIMPLEMENT", "GOOD FOOD, SIMPLY")}
            </span>
            <h2>
              {full
                ? t("Mes menus de la semaine", "My weekly menus")
                : t(
                    "Cette semaine, à votre rythme.",
                    "This week, at your own pace.",
                  )}
            </h2>
          </div>
          {!full ? (
            <button className="text-button" onClick={() => go("menus")}>
              {t("Tout le menu", "Full menu")}
              <ArrowRight size={15} />
            </button>
          ) : (
            <button className="secondary" onClick={() => open("import")}>
              <Upload size={15} />
              {t("Importer un menu", "Import a menu")}
            </button>
          )}
        </div>
        {plan ? (
          <>
            <div className="week-toolbar">
              <span>
                <CalendarDays size={16} />
                {dateLabel(plan.startDate)} —{" "}
                {dateLabel(plan.days.at(-1)!.date)}
              </span>
              <div className="week-actions">
                {data.plans.length > 1 && (
                  <>
                    <button
                      className="icon-button"
                      disabled={planIndex === data.plans.length - 1}
                      onClick={() => {
                        setPlanIndex(planIndex + 1);
                        setDayIndex(0);
                      }}
                      aria-label={t("Menu précédent", "Previous menu")}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      className="icon-button"
                      disabled={planIndex === 0}
                      onClick={() => {
                        setPlanIndex(planIndex - 1);
                        setDayIndex(0);
                      }}
                      aria-label={t("Menu suivant", "Next menu")}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </>
                )}
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={download}
                >
                  <ArrowDownToLine size={15} />
                  {t("Exporter en PDF", "Export PDF")}
                </button>
              </div>
            </div>
            <div
              className="days"
              aria-label={t("Choisir une journée", "Choose a day")}
            >
              {plan.days.map((d, i) => (
                <button
                  key={d.date}
                  className={i === dayIndex ? "selected" : ""}
                  aria-pressed={i === dayIndex}
                  onClick={() => setDayIndex(i)}
                >
                  <span>
                    {dateLabel(d.date, { weekday: "short" }).replace(".", "")}
                  </span>
                  <strong>{dateLabel(d.date, { day: "numeric" })}</strong>
                  <i className={d.lunch || d.dinner ? "filled" : ""} />
                </button>
              ))}
              <div className="free-day">
                <Leaf size={17} />
                <span>{t("7e jour", "Day 7")}</span>
                <strong>{t("Libre", "Open")}</strong>
              </div>
            </div>
            <div className="meals-grid">
              {mealCard(day?.lunch || null, t("DÎNER", "LUNCH"))}
              {mealCard(day?.dinner || null, t("SOUPER", "DINNER"))}
            </div>
            <p className="gentle-note">
              <Leaf size={13} />
              {t(
                "Deux portions. Les repas non choisis restent libres.",
                "Two portions. Unchosen meals stay open.",
              )}
            </p>
          </>
        ) : (
          <div className="empty-state">
            <CalendarDays />
            <h3>
              {t(
                "Votre prochaine semaine commence ici.",
                "Your next week starts here.",
              )}
            </h3>
            <p>
              {t(
                "Ajoutez votre premier plan de six jours.",
                "Add your first six-day plan.",
              )}
            </p>
            <button className="primary" onClick={() => open("import")}>
              <Plus size={16} />
              {t("Ajouter un menu", "Add a menu")}
            </button>
          </div>
        )}
      </section>
    );
  }
  function chart() {
    if (!weights.length)
      return (
        <p className="chart-empty">
          {t(
            "Votre première mesure sera votre point de départ.",
            "Your first measurement will be your starting point.",
          )}
        </p>
      );
    const unit = latestWeight!.unit;
    const values = weights.map((w) =>
      w.unit === unit
        ? w.value
        : w.unit === "kg"
          ? w.value * 2.2046226218
          : w.value / 2.2046226218,
    );
    const min = Math.min(...values) - 1,
      range = Math.max(...values) - min + 1;
    const points = values.map(
      (v, i) =>
        `${20 + (i / Math.max(1, values.length - 1)) * 300},${95 - ((v - min) / range) * 70}`,
    );
    return (
      <>
        <svg
          className="weight-chart"
          viewBox="0 0 340 115"
          role="img"
          aria-label={t(
            "Évolution des mesures de poids",
            "Weight measurements over time",
          )}
        >
          <path
            d="M20 30H320M20 65H320M20 100H320"
            stroke="#E7E9E0"
            strokeDasharray="3 5"
          />
          <path d={`M${points.join(" L")} L320 106 L20 106Z`} fill="#E9EFE5" />
          <polyline
            points={points.join(" ")}
            fill="none"
            stroke="#526D44"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.split(",")[0]}
              cy={p.split(",")[1]}
              r={i === points.length - 1 ? 4 : 2.5}
              fill="#526D44"
              stroke="white"
              strokeWidth="2"
            />
          ))}
        </svg>
        <div className="chart-labels">
          <span>
            {dateLabel(weights[0].date, { day: "numeric", month: "short" })}
          </span>
          <span>
            {dateLabel(latestWeight!.date, { day: "numeric", month: "short" })}
          </span>
        </div>
      </>
    );
  }
  function weightCard(full = false) {
    return (
      <section className="card weight-card">
        <div className="card-heading">
          <span className="eyebrow">{t("MON PARCOURS", "MY PROGRESS")}</span>
          <Scale size={19} />
        </div>
        <div className="weight-value">
          {latestWeight ? (
            <>
              {number(latestWeight.value)}
              <small>{latestWeight.unit}</small>
            </>
          ) : (
            <span className="no-weight">
              {t("Un nouveau départ", "A fresh start")}
            </span>
          )}
        </div>
        <p className="muted small">
          {latestWeight
            ? t("Dernière mesure", "Latest measurement") +
              " · " +
              dateLabel(latestWeight.date)
            : t(
                "Chaque parcours est différent.",
                "Every journey is different.",
              )}
        </p>
        {chart()}
        <button className="secondary full-width" onClick={() => open("weight")}>
          <Plus size={16} />
          {t("Noter mon poids", "Log my weight")}
        </button>
        {full && weights.length > 0 && (
          <div className="history">
            <h3>{t("Mes mesures", "My measurements")}</h3>
            {[...weights].reverse().map((w) => (
              <div key={w.id}>
                <span>
                  {dateLabel(w.date, {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <strong>
                  {number(w.value)} {w.unit}
                </strong>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }
  return (
    <div className="app-shell">
      {menuOpen && (
        <button
          className="sidebar-overlay"
          aria-label={t("Fermer le menu", "Close menu")}
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <a
          className="brand-link"
          href={`/${locale}/${demo ? "demo" : "dashboard"}`}
        >
          <Brand />
        </a>
        <div className="sidebar-label">{t("MON ESPACE", "MY SPACE")}</div>
        <nav aria-label={t("Navigation principale", "Main navigation")}>
          {nav.map((n) => (
            <button
              key={n.id}
              className={view === n.id ? "active" : ""}
              onClick={() => go(n.id)}
              aria-current={view === n.id ? "page" : undefined}
            >
              <n.icon size={19} strokeWidth={1.6} />
              <span>{n.label}</span>
              {view === n.id && <span className="active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-quote">
            <Sprout size={24} strokeWidth={1.4} />
            <p>
              {t(
                "Pas besoin d’être parfait pour avancer.",
                "You don’t have to be perfect to make progress.",
              )}
            </p>
            <span>{t("UN JOUR À LA FOIS", "ONE DAY AT A TIME")}</span>
          </div>
          <button
            className={
              view === "settings" ? "active sidebar-setting" : "sidebar-setting"
            }
            onClick={() => go("settings")}
          >
            <Settings2 size={18} />
            {t("Préférences", "Preferences")}
          </button>
          <div className="sidebar-user">
            <span className="avatar">{demo ? "D" : "M"}</span>
            <div>
              <strong>
                {demo
                  ? t("Mon espace démo", "My demo space")
                  : t("Mon espace privé", "My private space")}
              </strong>
              <span>
                <LockKeyhole size={10} />
                {demo
                  ? t("Données fictives", "Sample data")
                  : t("Accès personnel", "Personal access")}
              </span>
            </div>
            {demo ? (
              <a
                href={`/${locale}`}
                aria-label={t("Retour à la connexion", "Back to sign-in")}
              >
                <LogOut size={16} />
              </a>
            ) : (
              <form method="post" action="/auth/logout">
                <input type="hidden" name="locale" value={locale} />
                <button
                  className="icon-button"
                  aria-label={t("Se déconnecter", "Sign out")}
                >
                  <LogOut size={16} />
                </button>
              </form>
            )}
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div>
            <button
              className="mobile-menu icon-button"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={t("Ouvrir le menu", "Open menu")}
              aria-expanded={menuOpen}
            >
              <Menu size={22} />
            </button>
            <span className="breadcrumb">
              {t("Mon espace", "My space")}
              <span>/</span>
              <strong>
                {nav.find((n) => n.id === view)?.label ||
                  t("Préférences", "Preferences")}
              </strong>
            </span>
          </div>
          <div className="topbar-right">
            <span className="private-pill">
              <LockKeyhole size={12} />
              {demo
                ? t("Maquette", "Demo")
                : t("Espace privé", "Private space")}
            </span>
            <div
              className="language-switch"
              aria-label={t("Langue", "Language")}
            >
              <button
                aria-pressed={locale === "fr"}
                className={locale === "fr" ? "selected" : ""}
                onClick={() => changeLanguage("fr")}
              >
                FR
              </button>
              <button
                aria-pressed={locale === "en"}
                className={locale === "en" ? "selected" : ""}
                onClick={() => changeLanguage("en")}
              >
                EN
              </button>
            </div>
          </div>
        </header>
        <main id="main-content" className="main-content">
          {demo && (
            <div className="demo-banner">
              <span className="status-dot" />
              <span>
                {t(
                  "Un aperçu de votre futur espace. Les données sont fictives et les saisies ne sont pas conservées.",
                  "A preview of your future space. Data is fictional and entries are not retained.",
                )}
              </span>
            </div>
          )}
          {view === "overview" && (
            <>
              <section className="welcome">
                <div className="welcome-copy">
                  <span className="eyebrow">
                    <span className="mini-line" />
                    {t(
                      "LE DÉBUT DE QUELQUE CHOSE DE BIEN",
                      "THE START OF SOMETHING GOOD",
                    )}
                  </span>
                  <h1>
                    {t("Un jour", "One day")}
                    <br />
                    <em>{t("à la fois.", "at a time.")}</em>
                  </h1>
                  <p>
                    {t(
                      "Des repas que vous aimez. De petits pas qui comptent. Un espace qui vous ressemble.",
                      "Food you love. Small steps that matter. A space that feels like you.",
                    )}
                  </p>
                  <div className="hero-actions">
                    <button className="primary" onClick={() => go("menus")}>
                      {t("Voir mon menu", "See my menu")}
                      <ArrowRight size={16} />
                    </button>
                    <button
                      className="hero-journal"
                      onClick={() => open("journal")}
                    >
                      <PenLine size={16} />
                      {t("Écrire un peu", "Write a little")}
                    </button>
                  </div>
                </div>
                <div className="welcome-art">
                  <span className="art-circle" />
                  <Plate large />
                  <span className="art-caption">
                    <Sprout size={15} />
                    {t("Bien dans mon quotidien.", "Feeling good, every day.")}
                  </span>
                </div>
              </section>
              <div className="quick-stats">
                <button onClick={() => go("menus")}>
                  <span className="stat-icon">
                    <CalendarDays size={21} />
                  </span>
                  <span>
                    <strong>
                      {plan
                        ? t("Ma semaine est prête", "My week is ready")
                        : t("Ma semaine à préparer", "My week to plan")}
                    </strong>
                    <small>
                      {plan
                        ? `6 ${t("jours", "days")} · ${recipes} ${t("repas prévus", "planned meals")}`
                        : t(
                            "Un menu, à votre goût",
                            "A menu that feels like you",
                          )}
                    </small>
                  </span>
                  <ChevronRight size={16} />
                </button>
                <button onClick={() => go("weight")}>
                  <span className="stat-icon warm">
                    <Scale size={21} />
                  </span>
                  <span>
                    <strong>{t("Mon propre rythme", "My own pace")}</strong>
                    <small>
                      {weights.length}{" "}
                      {t(
                        "mesures dans mon parcours",
                        "measurements along the way",
                      )}
                    </small>
                  </span>
                  <ChevronRight size={16} />
                </button>
                <button onClick={() => open("journal")}>
                  <span className="stat-icon lavender">
                    <BookOpen size={21} />
                  </span>
                  <span>
                    <strong>
                      {t("Un moment pour moi", "A moment for me")}
                    </strong>
                    <small>
                      {t(
                        "Quelques lignes, sans pression",
                        "A few lines, no pressure",
                      )}
                    </small>
                  </span>
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="overview-columns">
                <div>
                  {menuSection()}
                  <section className="daily-note">
                    <div className="daily-note-icon">
                      <Heart size={22} strokeWidth={1.4} />
                    </div>
                    <div>
                      <span className="eyebrow">
                        {t("LA PENSÉE DU JOUR", "A THOUGHT FOR TODAY")}
                      </span>
                      <h3>
                        {t(
                          "Et si on remarquait ce qui va bien?",
                          "What if we noticed what’s going well?",
                        )}
                      </h3>
                      <p>
                        {t(
                          "Un repas apprécié, une marche, un moment de calme. Les petites victoires méritent aussi leur place.",
                          "A meal you enjoyed, a walk, a quiet moment. Small wins deserve a place, too.",
                        )}
                      </p>
                    </div>
                    <button
                      className="icon-button"
                      onClick={() => open("journal")}
                      aria-label={t(
                        "Écrire dans mon journal",
                        "Write in my journal",
                      )}
                    >
                      <ArrowRight size={20} />
                    </button>
                  </section>
                </div>
                <div className="right-column">
                  {weightCard()}
                  <section className="card reflection-card">
                    <span className="eyebrow">
                      {t("MON JOURNAL", "MY JOURNAL")}
                    </span>
                    <BookOpen size={25} strokeWidth={1.3} />
                    <h2>
                      {t(
                        "Comment vous sentez-vous aujourd’hui?",
                        "How are you feeling today?",
                      )}
                    </h2>
                    <p>
                      {t(
                        "Prenez un instant pour vous écouter.",
                        "Take a moment to check in with yourself.",
                      )}
                    </p>
                    <button
                      className="text-button"
                      onClick={() => open("journal")}
                    >
                      {t("Ouvrir mon journal", "Open my journal")}
                      <ArrowRight size={16} />
                    </button>
                  </section>
                </div>
              </div>
            </>
          )}
          {view === "menus" && (
            <div className="wide-content">
              {menuSection(true)}
              <div className="info-note">
                <FileText size={20} />
                <p>
                  {t(
                    "Retrouvez vos plans ici et téléchargez-les en PDF au format Lettre. Le septième jour reste à vous.",
                    "Find your plans here and download them as Letter-size PDFs. The seventh day is yours.",
                  )}
                </p>
              </div>
            </div>
          )}
          {view === "weight" && (
            <>
              <div className="page-heading">
                <span className="eyebrow">
                  {t("CHAQUE PARCOURS EST UNIQUE", "EVERY JOURNEY IS UNIQUE")}
                </span>
                <h1>
                  {t("Avancer à mon rythme.", "Progress at my own pace.")}
                </h1>
                <p>
                  {t(
                    "Des repères, sans jugement. Une mesure ne raconte pas toute l’histoire.",
                    "A little perspective, without judgment. One measurement never tells the whole story.",
                  )}
                </p>
              </div>
              <div className="progress-layout">
                {weightCard(true)}
                <div className="card perspective">
                  <Sprout size={40} strokeWidth={1} />
                  <h2>{t("Plus qu’un chiffre.", "More than a number.")}</h2>
                  <p>
                    {t(
                      "Votre énergie, votre sommeil, les moments que vous appréciez : votre journal est aussi là pour les accueillir.",
                      "Your energy, your sleep, the moments you enjoy: your journal has room for all of them.",
                    )}
                  </p>
                  <button className="text-button" onClick={() => go("journal")}>
                    {t("Aller à mon journal", "Go to my journal")}
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
          {view === "journal" && (
            <>
              <div className="page-heading row-heading">
                <div>
                  <span className="eyebrow">
                    {t(
                      "UN PEU DE PLACE POUR SOI",
                      "A LITTLE ROOM FOR YOURSELF",
                    )}
                  </span>
                  <h1>{t("Mon journal de bord.", "My everyday journal.")}</h1>
                  <p>
                    {t(
                      "Les bons jours, les jours ordinaires. Tout a sa place ici.",
                      "The good days, the ordinary days. There’s room for all of it here.",
                    )}
                  </p>
                </div>
                <button className="primary" onClick={() => open("journal")}>
                  <Plus size={16} />
                  {t("Écrire aujourd’hui", "Write today")}
                </button>
              </div>
              {data.journal.length ? (
                <div className="journal-grid">
                  {[...data.journal]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((entry) => (
                      <article className="card journal-entry" key={entry.id}>
                        <span className="eyebrow">
                          {dateLabel(entry.date, {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                          })}
                        </span>
                        <span className="entry-mood">
                          {["☁", "◔", "◑", "◕", "☀"][entry.mood - 1]}
                        </span>
                        <p>{entry.text}</p>
                        <button
                          className="text-button"
                          onClick={() => {
                            setEntryDate(entry.date);
                            setJournalText(entry.text);
                            setMood(entry.mood);
                            setFormError("");
                            setModal("journal");
                          }}
                        >
                          {t("Relire et modifier", "Read and edit")}
                          <PenLine size={14} />
                        </button>
                      </article>
                    ))}
                </div>
              ) : (
                <div className="empty-state journal-empty">
                  <BookOpen size={38} strokeWidth={1.2} />
                  <h2>
                    {t(
                      "Pas besoin de trouver les mots parfaits.",
                      "You don’t need the perfect words.",
                    )}
                  </h2>
                  <p>
                    {t(
                      "Qu’est-ce qui vous a fait du bien aujourd’hui?",
                      "What felt good today?",
                    )}
                  </p>
                  <button className="primary" onClick={() => open("journal")}>
                    {t("Commencer mon journal", "Start my journal")}
                    <PenLine size={16} />
                  </button>
                </div>
              )}
            </>
          )}
          {view === "library" && (
            <>
              <div className="page-heading row-heading">
                <div>
                  <span className="eyebrow">
                    {t("TOUT, AU MÊME ENDROIT", "EVERYTHING, IN ONE PLACE")}
                  </span>
                  <h1>{t("Ma bibliothèque.", "My library.")}</h1>
                  <p>
                    {t(
                      "Vos menus, vos fiches et vos documents de référence.",
                      "Your menus, guides and reference documents.",
                    )}
                  </p>
                </div>
                <button className="primary" onClick={() => open("document")}>
                  <Plus size={16} />
                  {t("Ajouter un lien Drive", "Add a Drive link")}
                </button>
              </div>
              <div className="drive-status">
                <span className="drive-mark">
                  <Cloud size={26} />
                </span>
                <div>
                  <strong>Google Drive</strong>
                  <p>
                    {t(
                      "Liens privés disponibles ici. La synchronisation automatique n’est pas connectée.",
                      "Keep private links here. Automatic sync is not connected.",
                    )}
                  </p>
                </div>
                <span className="tag">
                  {t("Non connecté", "Not connected")}
                </span>
              </div>
              <div className="document-grid">
                {data.plans.map((p, i) => (
                  <button
                    className="document-card"
                    key={p.id}
                    onClick={() => {
                      setPlanIndex(i);
                      setDayIndex(0);
                      go("menus");
                    }}
                  >
                    <span className="document-cover">
                      <Brand />
                      <CalendarDays size={37} strokeWidth={1} />
                      <strong>{t("Mon menu", "My menu")}</strong>
                      <small>{dateLabel(p.startDate)}</small>
                    </span>
                    <span className="document-title">
                      {locale === "fr" ? p.title : p.titleEn}
                    </span>
                    <span className="muted small">
                      {t("Menu · PDF disponible", "Menu · PDF available")}
                    </span>
                  </button>
                ))}
                {data.documents.map((d) => (
                  <a
                    className="document-card"
                    key={d.id}
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="document-cover drive-cover">
                      <Cloud size={37} strokeWidth={1} />
                      <strong>Google Drive</strong>
                      <ExternalLink size={19} />
                    </span>
                    <span className="document-title">{d.title}</span>
                    <span className="muted small">
                      {t("Ouvrir le document", "Open document")}
                    </span>
                  </a>
                ))}
              </div>
              {!data.plans.length && !data.documents.length && (
                <div className="empty-state">
                  <FolderOpen size={32} />
                  <h3>
                    {t(
                      "Vos documents trouveront leur place ici.",
                      "Your documents will find a home here.",
                    )}
                  </h3>
                </div>
              )}
            </>
          )}
          {view === "settings" && (
            <>
              <div className="page-heading">
                <span className="eyebrow">
                  {t("À VOTRE FAÇON", "YOUR WAY")}
                </span>
                <h1>{t("Mes préférences.", "My preferences.")}</h1>
              </div>
              <div className="settings-card card">
                <div>
                  <div>
                    <h3>{t("Langue de l’espace", "Workspace language")}</h3>
                    <p>
                      {t(
                        "L’interface et les exports suivent votre choix.",
                        "The interface and exports follow your choice.",
                      )}
                    </p>
                  </div>
                  <select
                    aria-label={t("Langue de l’espace", "Workspace language")}
                    value={locale}
                    onChange={(e) => changeLanguage(e.target.value as Locale)}
                  >
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                  </select>
                </div>
                <div>
                  <div>
                    <h3>{t("Vos données", "Your data")}</h3>
                    <p>
                      {demo
                        ? t(
                            "Cette maquette utilise des exemples. Vos essais disparaissent lorsque la page est rechargée.",
                            "This demo uses sample data. Your changes disappear when the page reloads.",
                          )
                        : t(
                            "Seul un compte autorisé peut accéder à cet espace. Aucun outil publicitaire n’est intégré.",
                            "Only an authorized account can access this space. No advertising tools are included.",
                          )}
                    </p>
                  </div>
                  <LockKeyhole size={21} />
                </div>
                <div>
                  <div>
                    <h3>Google Drive</h3>
                    <p>
                      {t(
                        "La connexion Drive sera activée séparément. Aucun fichier n’est importé automatiquement.",
                        "Drive will be connected separately. No files are imported automatically.",
                      )}
                    </p>
                  </div>
                  <span className="tag">
                    {t("À connecter", "Not connected")}
                  </span>
                </div>
              </div>
            </>
          )}
          <footer className="app-footer">
            <span>
              <Sprout size={13} />
              {t("Votre parcours. Votre rythme.", "Your journey. Your pace.")}
            </span>
            <span>i am able.</span>
          </footer>
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          <Check size={18} />
          {notice}
          <button
            className="icon-button"
            aria-label={t("Fermer", "Close")}
            onClick={() => setNotice("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      <dialog
        ref={dialog}
        onCancel={(e) => {
          if (busy) e.preventDefault();
          else setModal(null);
        }}
        onClose={() => setModal(null)}
        className="entry-dialog"
        aria-labelledby="dialog-title"
      >
        <div className="dialog-heading">
          <span className="eyebrow">I AM ABLE</span>
          <button
            className="icon-button"
            disabled={busy}
            onClick={() => setModal(null)}
            aria-label={t("Fermer", "Close")}
          >
            <X size={20} />
          </button>
        </div>
        <h2 id="dialog-title">
          {modal === "weight"
            ? t(
                "Un repère pour aujourd’hui.",
                "A little perspective for today.",
              )
            : modal === "journal"
              ? t("Un moment pour vous.", "A moment for you.")
              : modal === "import"
                ? t("Votre prochain menu.", "Your next menu.")
                : t(
                    "Tout garder à portée de main.",
                    "Keep it all close at hand.",
                  )}
        </h2>
        {modal === "weight" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void save("weight", {
                date: String(f.get("date")),
                value: Number(f.get("value")),
                unit: String(f.get("unit")),
              });
            }}
          >
            <p className="muted">
              {t(
                "Une mesure le même jour remplace la précédente.",
                "A measurement on the same day replaces the previous one.",
              )}
            </p>
            <label>
              {t("Date", "Date")}
              <input
                name="date"
                type="date"
                defaultValue={today()}
                required
                max={today()}
              />
            </label>
            <div className="form-row">
              <label>
                {t("Poids", "Weight")}
                <input
                  name="value"
                  type="number"
                  min="1"
                  max="1500"
                  step="0.1"
                  placeholder="0.0"
                  required
                />
              </label>
              <label>
                {t("Unité", "Unit")}
                <select name="unit" defaultValue={latestWeight?.unit || "lb"}>
                  <option value="lb">lb</option>
                  <option value="kg">kg</option>
                </select>
              </label>
            </div>
            <button className="primary full-width" disabled={busy}>
              {t("Enregistrer la mesure", "Save measurement")}
              <Check size={16} />
            </button>
          </form>
        )}
        {modal === "journal" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save("journal", {
                date: entryDate,
                text: journalText,
                mood,
              });
            }}
          >
            <label>
              {t("Date", "Date")}
              <input
                name="date"
                type="date"
                required
                max={today()}
                value={entryDate}
                onChange={(e) => {
                  setEntryDate(e.target.value);
                  const entry = data.journal.find(
                    (j) => j.date === e.target.value,
                  );
                  setJournalText(entry?.text || "");
                  setMood(entry?.mood || 3);
                }}
              />
            </label>
            <fieldset className="mood-field">
              <legend>
                {t("Comment vous sentez-vous?", "How are you feeling?")}
              </legend>
              <div className="mood-options">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    type="button"
                    key={n}
                    aria-label={`${t("Humeur", "Mood")} ${n}/5`}
                    aria-pressed={mood === n}
                    className={mood === n ? "chosen" : ""}
                    onClick={() => setMood(n)}
                  >
                    {["☁", "◔", "◑", "◕", "☀"][n - 1]}
                  </button>
                ))}
              </div>
            </fieldset>
            <label>
              {t("Mes quelques lignes", "A few words")}
              <textarea
                required
                maxLength={20000}
                value={journalText}
                onChange={(e) => setJournalText(e.target.value)}
                placeholder={t(
                  "Aujourd’hui, ce qui m’a fait du bien…",
                  "Today, something that felt good…",
                )}
                rows={6}
              />
            </label>
            <button className="primary full-width" disabled={busy}>
              {t("Enregistrer mon entrée", "Save my entry")}
              <Check size={16} />
            </button>
          </form>
        )}
        {modal === "import" && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const file = new FormData(e.currentTarget).get("menu") as File;
              if (file.size > 60000) {
                setFormError(
                  t(
                    "Le fichier est trop volumineux (60 Ko maximum).",
                    "The file is too large (60 KB maximum).",
                  ),
                );
                return;
              }
              try {
                const parsed = menuSchema.parse(JSON.parse(await file.text()));
                await save("menu", parsed);
              } catch {
                setFormError(
                  t(
                    "Le fichier doit contenir un menu valide de six jours consécutifs, avec les titres français et anglais.",
                    "The file must contain a valid six-day menu with consecutive dates and French and English titles.",
                  ),
                );
              }
            }}
          >
            <p className="muted">
              {t(
                "Importez un fichier de menu préparé pour cet espace. Les repas laissés vides le resteront.",
                "Import a menu file prepared for this space. Empty meals will stay open.",
              )}
            </p>
            <label>
              {t("Fichier de menu (.json)", "Menu file (.json)")}
              <input
                type="file"
                name="menu"
                accept="application/json,.json"
                required
              />
            </label>
            <button className="primary full-width" disabled={busy}>
              <Upload size={16} />
              {t("Ajouter à mes menus", "Add to my menus")}
            </button>
          </form>
        )}
        {modal === "document" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const parsed = documentSchema.safeParse({
                title: f.get("title"),
                url: f.get("url"),
                kind: f.get("kind"),
              });
              if (!parsed.success) {
                setFormError(
                  t(
                    "Utilisez un lien HTTPS de Google Drive ou Google Docs.",
                    "Use an HTTPS link from Google Drive or Google Docs.",
                  ),
                );
                return;
              }
              void save("document", parsed.data);
            }}
          >
            <p className="muted">
              {t(
                "Le document conserve ses permissions Google. Ajouter son lien ne le rend pas public.",
                "The document keeps its Google permissions. Adding a link does not make it public.",
              )}
            </p>
            <label>
              {t("Titre", "Title")}
              <input name="title" required maxLength={160} />
            </label>
            <label>
              {t(
                "Lien Google Drive ou Google Docs",
                "Google Drive or Google Docs link",
              )}
              <input
                name="url"
                type="url"
                required
                placeholder="https://docs.google.com/…"
                maxLength={2048}
              />
            </label>
            <label>
              {t("Catégorie", "Category")}
              <select name="kind">
                <option value="menu">{t("Menu", "Menu")}</option>
                <option value="recipe">{t("Recette", "Recipe")}</option>
                <option value="journal">{t("Journal", "Journal")}</option>
                <option value="other">{t("Autre", "Other")}</option>
              </select>
            </label>
            <button className="primary full-width" disabled={busy}>
              {t("Ajouter le document", "Add document")}
              <Plus size={16} />
            </button>
          </form>
        )}
        {formError && (
          <p className="form-error" role="alert">
            {formError}
          </p>
        )}
        {demo && (
          <p className="dialog-note">
            <CircleHelp size={13} />
            {t(
              "Maquette : aucune donnée n’est sauvegardée.",
              "Demo: no data is saved.",
            )}
          </p>
        )}
      </dialog>
    </div>
  );
}
