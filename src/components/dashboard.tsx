"use client";
import { Pagination, usePagination } from "./pagination";
import { NavigationCacheProvider, useShoppingReport, useNavigationCache, useRememberedState } from "./navigation-cache";
import { useSectionScroll } from "./section-scroll";
import { RecipeBook, PrepareBlend } from "./spice-library";
import type { SpiceBlend } from "@/lib/spice-blends";
import { useText } from "./locale-provider";
import { locales, languageNames, languageCodes, htmlLocale } from "@/lib/locale";


import { L, LocaleProvider } from "@/components/locale-provider";
import { tr as regionalTr, intlLocale } from "@/lib/locale";
import { LearningJourney } from "./learning-journal";
import { AppSelect } from "./app-select";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Archive,
  CalendarDays,
  Check,
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
  ShoppingBasket,
  Settings2,
  Sprout,
  X,
  ExternalLink,
  PenLine,
  type LucideIcon,
} from "lucide-react";
import { mealLabel, mealTimes } from "@/lib/planner";
import { RecipeImage } from "./recipes";
import { WeeklyPlanner, RecipeLibrary, RecipeSheet } from "./recipes";
import { Community } from "./community";
import { PlatformAdmin } from "./platform-admin";
import type { PrivateActions, JournalPrompt } from "@/lib/private-types";
import { JournalEditor } from "./journal-editor";
import { UnitSettings } from "./unit-settings";
import { GroceryList } from "./groceries";
import { GrocerSettings } from "./grocer-settings";
import { PendingOrders } from "./pending-orders";
import { JournalMeals } from "./journal-meals";
import { ThawReminders } from "./thaw-reminders";
import { CookMeal } from "./cook-meal";
import { applyShoppingMutation, shoppingState, shoppingNeeds, type ShoppingMutation } from "@/lib/shopping";
import type { ShoppingWorkspace as WorkspaceData } from "@/lib/shopping-types";
import { Pantry } from "./pantry";
import { bodyWeight, monday, addDays } from "@/lib/units";
import type {
  Recipe,
  UnitPreferences,
  MealSlot,
  JournalEntry,
  PantryItem,
  GroceryCheck,
} from "@/lib/types";
import { Brand } from "./brand";
import { tr, type Locale } from "@/lib/locale";
import { documentSchema } from "@/lib/validation";

import { recordInventory } from "@/lib/inventory-history";
import { InventoryHub, InventoryNav, type InventoryView } from "./inventory-hub";

type View =
  | "overview"
  | "recipes"
  | "menus"
  | "inventoryMeals"
  | "inventoryCatalog"
  | "inventoryHistory"
  | "groceries"
  | "orders"
  | "pantry"
  | "weight"
  | "journal"
  | "library"
  | "settings"
  | "program"
  | "circles"
  | "admin";
type Modal = "weight" | "document" | null;
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

function DashboardBody({
  locale: initialLocale,
  mode,
  initialData,
  privateActions,
  onLanguageChange,
}: {
  locale: Locale;
  onLanguageChange: (locale: Locale) => void;
  mode: "demo" | "private";
  initialData: WorkspaceData;
  privateActions?: PrivateActions;
}) {
  const navigationCache=useNavigationCache();
  const [journalPrompt, setJournalPrompt] = useState<JournalPrompt | null>(
    null,
  );
  const [journalNavigation, setJournalNavigation] = useState<{ id: number; date?: string }>({ id: 0 });
  const [locale, setLocale] = useState(initialLocale);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [pantryEditId, setPantryEditId] = useState<string | undefined>();
  const [preparingBlend, setPreparingBlend] = useState<{blend:SpiceBlend;volumeMl:number}|null>(null);
  const [cooking, setCooking] = useState<MealSlot | null>(null);
  const [view, setView] = useRememberedState<View>("section", "overview");
  const sectionScroll = useSectionScroll(view);
  const [selectedWeek, setSelectedWeek] = useRememberedState("menus:week", monday(today()));
  useEffect(() => { if (view === "admin" && !privateActions?.admin) setView("overview"); }, [view, privateActions?.admin]);
  const [data, setData] = useState(initialData);
  const latestData = useRef(data); latestData.current = data;
  // Conflict recovery can refresh the parent without completing a mutation.
  // Keep the open cooking preview in sync with that authoritative snapshot.
  useEffect(() => { latestData.current = initialData; setData(initialData); }, [initialData]);
  const [modal, setModal] = useState<Modal>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const t = useText(locale);
  const demo = mode === "demo";
  const weights = useMemo(() => [...data.weights].sort((a, b) => a.date.localeCompare(b.date)), [data.weights]);
  const weightPage = usePagination([...weights].reverse(), "weights");
  const documentPage = usePagination(data.documents, "documents");
  const menuReport = useShoppingReport(data, selectedWeek, addDays(selectedWeek, 6), false, view === "menus");
  const latestWeight = weights.at(-1);
  const weekStart = monday(today());
  const recipes = data.slots.filter(
    (s) => s.date >= weekStart && s.date <= addDays(weekStart, 6),
  ).length;
  const dateLabel = (
    date: string,
    options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" },
  ) =>
    new Date(`${date}T12:00:00Z`).toLocaleDateString(
      intlLocale(locale),
      { ...options, timeZone: "UTC" },
    );
  const number = (n: number) =>
    n.toLocaleString(intlLocale(locale), {
      maximumFractionDigits: 1,
    });
  const nav: { id: View; icon: LucideIcon; label: string }[] = [
    {
      id: "overview",
      icon: LayoutDashboard,
      label: t("Vue d’ensemble", "Overview"),
    },
    { id: "menus", icon: CalendarDays, label: t("Mes menus", "My menus") },
    { id: "recipes", icon: BookOpen, label: t("Mes recettes", "My recipes") },
    {
      id: "groceries",
      icon: ShoppingBasket,
      label: t("Liste d’épicerie", "Grocery list"),
    },
    { id: "pantry", icon: Archive, label: t("Mes réserves", "My pantry") },
    { id: "orders", icon: ShoppingBasket, label: t("Mes commandes", "My orders") },
    { id: "weight", icon: Scale, label: t("Mon parcours", "My progress") },
    { id: "journal", icon: BookOpen, label: t("Mon journal", "My journal") },
    {
      id: "library",
      icon: FolderOpen,
      label: t("Mes documents", "My documents"),
    },
  ];
  if (privateActions) {
    nav.splice(1, 0, {
      id: "program",
      icon: Sprout,
      label: t("Mon programme", "My program"),
    });
    nav.push({
      id: "circles",
      icon: Heart,
      label: t("Mes cercles", "My circles"),
    });
    if (privateActions.admin)
      nav.push({
        id: "admin",
        icon: Settings2,
        label: t("Administration", "Administration"),
      });
  }
  const navOrder: View[] = ["overview", "program", "journal", "menus", "recipes", "groceries", "pantry", "orders", "weight", "library", "circles", "admin"];
  nav.sort((a,b) => navOrder.indexOf(a.id) - navOrder.indexOf(b.id));
  useEffect(() => {
    document.documentElement.lang = htmlLocale(locale);
    document.title = `Tred’meal — ${regionalTr(locale, "Un jour à la fois", "One day at a time")}`;
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
    onLanguageChange(value);
    document.cookie = `tredmeal-language=${value};path=/;max-age=31536000;SameSite=Lax;Secure`;
    window.history.replaceState(
      null,
      "",
      `/${value}/${demo ? "demo" : "dashboard"}`,
    );
  }
  function go(value: View, journalDate?: string) {
    sectionScroll.remember(value);
    setPantryEditId(undefined);
    if (value === "journal") setJournalNavigation(current => ({ id: current.id + 1, date: journalDate }));
    setView(value);
    setMenuOpen(false);
  }
  function open(value: Modal | "journal") {
    if (value === "journal") {
      go("journal", today());
      return;
    }
    setFormError("");
    setModal(value);
  }
  async function save(type: string, value: object) {
    setBusy(true);
    setFormError("");
    try {
      if (privateActions) {
        setData(await privateActions.mutate(type, value));
      } else if (demo) {
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
  async function mutate(
    type:
      | "slot"
      | "preferences"
      | "journal"
      | "groceryCheck"
      | "pantry"
      | "shopping"
      | "pantryDelete",
    value: object,
  ): Promise<WorkspaceData> {
    let next: WorkspaceData;
    if (privateActions) {
      next = await privateActions.mutate(type, value);
    } else if (demo) {
      next = { ...data };
      if (type === "shopping") next = applyShoppingMutation(latestData.current, value, latestData.current);
      if (type === "groceryCheck") {
        const check = value as GroceryCheck;
        next.groceryChecks = [
          ...data.groceryChecks.filter(
            (c) =>
              c.week !== check.week || c.ingredientId !== check.ingredientId,
          ),
          check,
        ];
      }
      if (type === "pantry") {
        const item = value as PantryItem;
        next.pantry = [...data.pantry.filter((p) => p.id !== item.id), item];
      }
      if (type === "pantryDelete")
        next.pantry = data.pantry.filter(
          (p) => p.id !== (value as { id: string }).id,
        );
      if (type === "preferences") next.preferences = value as UnitPreferences;
      if (type === "slot") {
        const slot = value as MealSlot;
        next.slots = data.slots.filter(
          (s) => s.date !== slot.date || s.slot !== slot.slot,
        );
        if (slot.recipeId) next.slots.push(slot);
      }
      if (type === "journal") {
        const row = value as JournalEntry & { expectedRevision: number };
        next.journal = [
          {
            ...row,
            id:
              data.journal.find((e) => e.date === row.date)?.id ||
              crypto.randomUUID(),
            revision: row.expectedRevision + 1,
          },
          ...data.journal.filter((e) => e.date !== row.date),
        ];
      }
    } else {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, data: value }),
      });
      if (!response.ok)
        throw new Error(response.status === 409 ? "conflict" : "save");
      const refresh = await fetch("/api/workspace", { cache: "no-store" });
      if (!refresh.ok) throw new Error("refresh");
      next = await refresh.json();
    }
    if (demo && ["pantry", "pantryDelete", "slot"].includes(type)) next = recordInventory(data, next, type);
    navigationCache.invalidate("learning:");
    latestData.current = next;
    setData(next);
    return next;
  }
  function menuSection(full = false) {
    return (
      <WeeklyPlanner
        key={full ? "full" : "overview"}
        full={full}
        week={selectedWeek}
        onWeekChange={setSelectedWeek}
        onGroceries={() => go("groceries")}
        recipes={data.recipes}
        ingredients={data.ingredients}
        slots={data.slots}
        units={data.preferences}
        locale={locale}
        onOpen={setSelectedRecipe}
        cooked={shoppingState(data).cooked}
        availability={menuReport?.availability || {}}
        onCook={setCooking}
        onUndoCook={async id => { await mutate("shopping", { action: "undoCook", id }); }}
        onSave={async (value) => {
          await mutate("slot", value);
        }}
      />
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
    const unit = data.preferences.bodyMass;
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
            stroke="#e7e2e7"
            strokeDasharray="3 5"
          />
          <path d={`M${points.join(" L")} L320 106 L20 106Z`} fill="#f6e8f0" />
          <polyline
            points={points.join(" ")}
            fill="none"
            stroke="#c8006d"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.split(",")[0]}
              cy={p.split(",")[1]}
              r={i === points.length - 1 ? 4 : 2.5}
              fill="#c8006d"
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
              {number(
                bodyWeight(
                  latestWeight.value,
                  latestWeight.unit,
                  data.preferences.bodyMass,
                ),
              )}
              <small>{data.preferences.bodyMass}</small>
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
            <Pagination pagination={weightPage}/>{weightPage.items.map((w) => (
              <div key={w.id}>
                <span>
                  {dateLabel(w.date, {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <strong>
                  {number(
                    bodyWeight(w.value, w.unit, data.preferences.bodyMass),
                  )}{" "}
                  {data.preferences.bodyMass}
                </strong>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }
  return (
    <div className="app-shell elan-app" data-view={view}>
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

        <nav aria-label={t("Navigation principale", "Main navigation")}>
          {nav.map((n) => (
            <div key={n.id} className="nav-item">
            {["overview","menus","weight","admin"].includes(n.id) && <div className="sidebar-label">{n.id === "overview" ? t("MON QUOTIDIEN", "MY EVERYDAY") : n.id === "menus" ? t("À TABLE", "AT THE TABLE") : n.id === "weight" ? t("POUR MOI", "FOR ME") : t("GÉRER", "MANAGE")}</div>}
            <button
              key={n.id}
              className={view === n.id ? "active" : ""}
              onClick={() => go(n.id)}
              aria-current={view === n.id ? "page" : undefined}
            >
              <n.icon size={19} strokeWidth={1.6} />
              <span>{n.label}</span>
              {view === n.id && <span className="active-dot" />}
            </button></div>
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
                {nav.find((n) => n.id === view)?.label || (view === "inventoryMeals" ? t("Mes repas prévus", "My planned meals") : view === "inventoryCatalog" ? t("Aliments et formats", "Foods and formats") : view === "inventoryHistory" ? t("Mes mouvements", "My stock activity") : t("Préférences", "Preferences"))}
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
              {locales.map(language => <button key={language} aria-pressed={locale===language} className={locale===language?"selected":""} title={languageNames[language]} onClick={()=>changeLanguage(language)}>{languageCodes[language]}</button>)}
            </div>
          </div>
        </header>
        <main ref={sectionScroll.content} id="main-content" className="main-content">
          {view !== "journal" && <ThawReminders data={data} locale={locale} all={view === "pantry"} onSave={async m => { await mutate("shopping", m); }}/>}
          {privateActions && view === "program" && (
            <LearningJourney entries={data.journal} onOpen={date => go("journal", date)} />
          )}
          {privateActions && view === "circles" && (
            <Community locale={locale} userId={privateActions.userId} />
          )}
          {privateActions?.admin && view === "admin" && (
            <PlatformAdmin locale={locale} />
          )}
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
              <div className="page-heading home-greeting"><div><span className="eyebrow">{dateLabel(today(), { weekday: "long", day: "numeric", month: "long" })}</span><h1>{t("Bonjour, vous.", "Hello, you.")}</h1><p>{t("On fait de la place à ce qui vous fait du bien?", "A little room for what feels good?")}</p></div><button className="secondary" onClick={() => open("journal")}><PenLine size={16}/>{t("Ma journée", "My day")}</button></div>
              <div className="home-hero-grid"><section className="welcome">
                <div className="welcome-copy">
                  <span className="eyebrow">
                    <span className="mini-line" />
                    {t(
                      "LE DÉBUT DE QUELQUE CHOSE DE BIEN",
                      "THE START OF SOMETHING GOOD",
                    )}
                  </span>
                  <h1>
                    {t("Du plaisir", "A little joy")}
                    <br />
                    <em>{t("dans vos journées.", "in every day.")}</em>
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
                  <img src="/brand/elan/welcome.jpg" alt="" width={1024} height={688} />
                </div>
              </section><aside className="home-program-card"><Sprout size={28}/><span className="eyebrow">{t("VOTRE PETIT PAS DU JOUR", "YOUR SMALL STEP TODAY")}</span><h2>{t("Un moment pour avancer.", "A moment to move forward.")}</h2><p>{t("Une lecture qui fait réfléchir. Quelques mots pour vous. Et la suite, à votre rythme.", "A thought-provoking reading. A few words for yourself. And the next step, at your pace.")}</p><button className="primary" onClick={() => privateActions ? go("program") : open("journal")}>{t("Ouvrir ma journée", "Open my day")}<ArrowRight size={16}/></button></aside></div>
              <div className="quick-stats">
                <button onClick={() => go("menus")}>
                  <span className="stat-icon">
                    <CalendarDays size={21} />
                  </span>
                  <span>
                    <strong>
                      {recipes > 0
                        ? t("Ma semaine prend forme", "My week is taking shape")
                        : t("Ma semaine à préparer", "My week to plan")}
                    </strong>
                    <small>
                      {recipes > 0
                        ? `7 ${t("jours", "days")} · ${recipes} ${t("repas prévus", "planned meals")}`
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
                  <section className="home-meals"><header><div><span className="eyebrow">{t("À TABLE AUJOURD’HUI", "ON TODAY’S MENU")}</span><h2>{t("De quoi se régaler.", "Something to enjoy.")}</h2></div><button className="text-button" onClick={() => go("menus")}>{t("Tout mon menu", "My full menu")}<ArrowRight size={15}/></button></header><div className="home-meal-grid">
                    {data.slots.filter(slot => slot.date === today()).sort((a,b) => mealTimes.indexOf(a.slot) - mealTimes.indexOf(b.slot)).map(slot => { const recipe = data.recipes.find(r => r.id === slot.recipeId); return recipe && <button className="home-meal" key={slot.slot} onClick={() => setSelectedRecipe(recipe)}><RecipeImage recipe={recipe}/><span><small>{mealLabel(slot.slot,locale)}</small><strong>{t(recipe.title, recipe.titleEn)}</strong><small>{recipe.minutes} <L text={" min · "} />{recipe.servings} <L text={" portions"} /></small></span></button>; })}
                    {!data.slots.some(slot => slot.date === today()) && <button className="home-meal-empty" onClick={() => go("menus")}><CalendarDays size={28}/><strong>{t("Qu’est-ce qui vous ferait plaisir?", "What would you enjoy?")}</strong><span>{t("Choisissez vos repas pour aujourd’hui.", "Choose your meals for today.")}</span><span className="primary">{t("Composer mon menu", "Plan my menu")}<Plus size={15}/></span></button>}
                  </div></section>
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
            </div>
          )}
          {(["groceries", "pantry", "inventoryMeals", "orders", "inventoryCatalog", "inventoryHistory"] as string[]).includes(view) && <InventoryNav view={view as InventoryView} locale={locale} onNavigate={go}/>}
          {(view === "inventoryMeals" || view === "inventoryCatalog" || view === "inventoryHistory") && <InventoryHub view={view} data={data} locale={locale} onSave={async m => { await mutate("shopping", m); }} onCook={setCooking} onPlan={() => go("menus")} onPantry={id => {go("pantry");setPantryEditId(id);}}/>}
          {view === "groceries" && (
            <GroceryList
              data={data}
              locale={locale}
              week={selectedWeek}
              onPlan={() => go("inventoryMeals")}
              onOpen={setSelectedRecipe}
              onSave={async (value: ShoppingMutation) => { await mutate("shopping", value); }}
              onSettings={() => go("settings")}
              onPantry={id => { go("pantry"); setPantryEditId(id); }}
              onPantrySave={async item => { await mutate("pantry", item); }}
            />
          )}
          {view === "orders" && <><div className="page-heading"><span className="eyebrow">{t("BIENTÔT À LA MAISON", "COMING HOME SOON")}</span><h1>{t("Mes commandes.", "My orders.")}</h1><p>{t("Vos prochaines livraisons et cueillettes, en un coup d’œil.", "Your upcoming deliveries and pickups, at a glance.")}</p></div><PendingOrders data={data} locale={locale} showEmpty onSave={async value => { await mutate("shopping", value); }}/><button className="secondary" onClick={() => go("groceries")}>{t("Préparer mes achats", "Plan my groceries")}<ArrowRight size={16}/></button></>}
          {view === "pantry" && (
            <Pantry
              key={pantryEditId || "pantry"}
              initialItemId={pantryEditId}
              workspace={data}
              onMeals={() => go("inventoryMeals")}
              deliveries={<PendingOrders data={data} locale={locale} showEmpty onSave={async value => { await mutate("shopping", value); }}/>}
              items={data.pantry}
              ingredients={data.ingredients}
              units={data.preferences}
              locale={locale}
              onSave={async (item) => {
                await mutate("pantry", item);
              }}
              onDelete={async (id) => {
                await mutate("pantryDelete", { id });
              }}
              onGroceries={() => go("groceries")}
            />
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
          <div hidden={view !== "journal"}>
            <JournalEditor
              entries={data.journal}
              guided={!!privateActions}
              renderMeals={date => <><ThawReminders widget data={data} locale={locale} onSave={async m => { await mutate("shopping", m); }}/><JournalMeals widget key={date} data={data} date={date} locale={locale} onCook={setCooking} onUndo={async id => { await mutate("shopping", { action: "undoCook", id }); }} onOpen={setSelectedRecipe} onPlan={() => { setSelectedWeek(monday(date)); go("menus"); }}/></>}
              ownerId={privateActions?.userId || "demo"}
              recoveryKey={privateActions?.journalKey || null}
              syncBridge={privateActions?.journalSync}
              navigation={journalNavigation}
              active={view === "journal"}
              prompt={journalPrompt}
              onProgram={privateActions ? () => go("program") : undefined}
              encrypted={privateActions?.protection === "enhanced"}
              locale={locale}
              onSave={async (value) => {
                const result = await mutate("journal", value);
                return result.journal.find((e) => e.date === value.date)!;
              }}
            />
          </div>
          {view === "recipes" && (
            <>
              <div className="page-heading">
                <span className="eyebrow">
                  {t("AU FIL DES SEMAINES", "OVER THE WEEKS")}
                </span>
                <h1>{t("Mon livre de recettes.", "My recipe book.")}</h1>
                <p>
                  {t(
                    "Des plats choisis ensemble, à retrouver et à cuisiner à votre rythme.",
                    "Meals chosen together, ready to enjoy at your own pace.",
                  )}
                </p>
              </div>
              <RecipeBook data={data} locale={locale} onOpen={setSelectedRecipe} onBlend={(blend,volumeMl=100)=>setPreparingBlend({blend,volumeMl})}/>
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
                  <strong><L text="Google Drive" /></strong>
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
              <Pagination pagination={documentPage}/><div className="document-grid">
                {documentPage.items.map((d) => (
                  <a
                    className="document-card"
                    key={d.id}
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="document-cover drive-cover">
                      <Cloud size={37} strokeWidth={1} />
                      <strong><L text="Google Drive" /></strong>
                      <ExternalLink size={19} />
                    </span>
                    <span className="document-title">{d.title}</span>
                    <span className="muted small">
                      {t("Ouvrir le document", "Open document")}
                    </span>
                  </a>
                ))}
              </div>
              {!data.documents.length && (
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
              {privateActions?.privacyPanel(locale)}
              <GrocerSettings grocers={shoppingState(data).grocers} locale={locale} onSave={async grocers => { await mutate("shopping", { action: "grocers", grocers }); }} />
              <div className="settings-card card">
                <div>
                  <div>
                    <h3>{t("Langue de l’espace", "Workspace language")}</h3>
                    <p>
                      {t(
                        "L’interface suit votre choix.",
                        "The interface follows your choice.",
                      )}
                    </p>
                  </div>
                  <AppSelect
                    aria-label={t("Langue de l’espace", "Workspace language")}
                    value={locale}
                    onChange={(e) => changeLanguage(e.target.value as Locale)}
                  >
                    {locales.map(language=><option key={language} value={language}>{languageNames[language]}</option>)}
                  </AppSelect>
                </div>
                <UnitSettings
                  units={data.preferences}
                  locale={locale}
                  onSave={async (units) => {
                    await mutate("preferences", units);
                  }}
                />
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
                    <h3><L text="Google Drive" /></h3>
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
            <Brand />
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
      {cooking && <CookMeal meal={cooking} data={data} locale={locale} onClose={() => setCooking(null)} onSave={async m => { await mutate("shopping", m); }} />}
      {selectedRecipe && (
        <RecipeSheet
          key={selectedRecipe.id}
          recipe={selectedRecipe}
          ingredients={data.ingredients}
          units={data.preferences}
          locale={locale}
          onPrepare={(blend,volumeMl)=>setPreparingBlend({blend,volumeMl})}
          onClose={() => setSelectedRecipe(null)}
        />
      )}
      {preparingBlend&&<PrepareBlend blend={preparingBlend.blend} initialVolume={preparingBlend.volumeMl} data={data} locale={locale} onClose={()=>setPreparingBlend(null)} onSave={async value=>{await mutate("shopping",value);}}/>}
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
          <span className="eyebrow">TRED’MEAL</span>
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
            : t("Tout garder à portée de main.", "Keep it all close at hand.")}
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
                <AppSelect
                  name="unit"
                  aria-label={t("Unité", "Unit")}
                  defaultValue={data.preferences.bodyMass}
                >
                  <option value="lb">lb</option>
                  <option value="kg">kg</option>
                </AppSelect>
              </label>
            </div>
            <button className="primary full-width" disabled={busy}>
              {t("Enregistrer la mesure", "Save measurement")}
              <Check size={16} />
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
              <AppSelect name="kind">
                <option value="menu">{t("Menu", "Menu")}</option>
                <option value="recipe">{t("Recette", "Recipe")}</option>
                <option value="journal">{t("Journal", "Journal")}</option>
                <option value="other">{t("Autre", "Other")}</option>
              </AppSelect>
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

export function Dashboard(props: Omit<React.ComponentProps<typeof DashboardBody>, "onLanguageChange">) {
 const [locale,setLocale]=useState(props.locale);
 return <NavigationCacheProvider key={props.privateActions?.userId || props.mode} ownerId={props.privateActions?.userId}><LocaleProvider locale={locale} enabled={props.mode==="private"} catalog={props.initialData}><DashboardBody {...props} locale={locale} onLanguageChange={setLocale}/></LocaleProvider></NavigationCacheProvider>;
}
