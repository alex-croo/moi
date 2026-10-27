"use client";
import { useRememberedState } from "./navigation-cache";
import { Pagination, usePagination } from "./pagination";
import { useNavigationCache } from "./navigation-cache";
import { useText } from "./locale-provider";

import { tr as regionalTr, intlLocale } from "@/lib/locale";
import { AppSelect } from "./app-select";
import { useEffect, useState } from "react";
import { Heart, Users, Plus } from "lucide-react";
import type { Locale } from "@/lib/locale";
type Circle = { id: string; name: string; created_by: string };
type CommunityData = {
  circles: Circle[];
  members: { circle_id: string; user_id: string; alias: string }[];
  invitations: {
    id: string;
    circle_id: string;
    email: string;
    circle_name: string;
    inviter_alias: string;
    expires_at: string;
  }[];
  events: {
    id: string;
    circle_id: string;
    user_id: string;
    kind: string;
    created_at: string;
  }[];
};
const phrases: Record<string, [string, string]> = {
  encourage: [
    "Je vous encourage, un jour à la fois.",
    "Cheering you on, one day at a time.",
  ],
  small_step: [
    "Aujourd’hui, j’ai fait un petit pas pour moi.",
    "Today, I took a small step for myself.",
  ],
  return: ["Je reprends à mon rythme.", "I’m returning at my own pace."],
  milestone_7: [
    "J’ai terminé mon premier jalon : observer.",
    "I completed my first milestone: noticing.",
  ],
  milestone_14: [
    "J’ai terminé mon deuxième jalon : simplifier.",
    "I completed my second milestone: simplifying.",
  ],
  milestone_21: [
    "J’ai terminé mon troisième jalon : ajuster.",
    "I completed my third milestone: adapting.",
  ],
  milestone_31: [
    "J’ai terminé les 31 journées de mon programme.",
    "I completed all 31 days of my program.",
  ],
};
export function Community({
  locale,
  userId,
}: {
  locale: Locale;
  userId: string;
}) {
  const t = useText(locale);
  const [data, setData] = useState<CommunityData | null>(null),
    [selected, setSelected] = useRememberedState("circles:selected", ""),
    [name, setName] = useState(""),
    [alias, setAlias] = useState(""),
    [email, setEmail] = useState(""),
    [kind, setKind] = useState("encourage"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirmShare, setConfirmShare] = useState(false);
  const cache=useNavigationCache();
  async function load() {
    setData(await cache.read("community", async () => { const r=await fetch("/api/community",{cache:"no-store"}); if(!r.ok)throw Error(); return r.json(); }));
  }
  useEffect(() => {
    void load().catch(() =>
      setError(
        t("Impossible de charger vos cercles.", "Unable to load circles."),
      ),
    );
  }, []);
  async function run(
    action: string,
    cid: string | null = null,
    target = "",
    label = "",
  ) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, cid, target, label }),
      });
      if (!r.ok) throw Error();
      const result = await r.json();
      cache.invalidate("community");
      await load();
      if (action === "create" || action === "accept") setSelected(result.id);
      if (action === "invite") setEmail("");
      if (action === "create") setName("");
      setConfirmShare(false);
    } catch {
      setError(
        t(
          "L’opération n’a pas abouti. Les invitations sont réservées aux comptes actifs de la plateforme et expirent après 7 jours.",
          "The operation did not complete. Invitations are for active platform accounts and expire after 7 days.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  const circle =
    data?.circles.find((c) => c.id === selected) || data?.circles[0];
  const owner = circle?.created_by === userId;
  const incoming =
    data?.invitations.filter(
      (i) =>
        !data.circles.some((c) => c.id === i.circle_id) &&
        new Date(i.expires_at) > new Date(),
    ) || [];
  const incomingPage=usePagination(incoming,"circle-incoming","",!!data), circlesPage=usePagination(data?.circles||[],"circles","",!!data), eventsPage=usePagination(data?.events.filter(e=>e.circle_id===circle?.id)||[],"circle-events",circle?.id,!!data), membersPage=usePagination(data?.members.filter(m=>m.circle_id===circle?.id)||[],"circle-members",circle?.id,!!data), invitesPage=usePagination(data?.invitations.filter(i=>i.circle_id===circle?.id)||[],"circle-invites",circle?.id,!!data);
  return (
    <section className="community-page">
      <div className="page-heading community-heading">
        <div>
        <span className="eyebrow">
          {t("AVANCER, ENSEMBLE", "MOVING FORWARD, TOGETHER")}
        </span>
        <h1>{t("Mes cercles.", "My circles.")}</h1>
        <p>
          {t(
            "Un petit groupe de proches, une place pour s’encourager.",
            "A small group of people you trust, a place for encouragement.",
          )}
        </p>
        </div>
        <img src="/brand/together.webp" alt="" width={1024} height={688} />
      </div>
      <aside className="privacy-note">
        <Heart size={20} />
        <p>
          {t(
            "Votre journal, votre poids et vos repas restent dans votre espace personnel. Seul le message choisi ci-dessous est partagé. Les messages des cercles sont visibles aux membres et sont stockés séparément; ils ne sont pas chiffrés avec votre clé personnelle.",
            "Your journal, weight and meals stay in your personal space. Only the message chosen below is shared. Circle messages are visible to members and stored separately; they are not encrypted with your personal key.",
          )}
        </p>
      </aside>
      {error && <p role="alert">{t(error)}</p>}
      {!!incoming.length && (
        <section className="card">
          <h2>{t("Une place vous attend", "You’re invited")}</h2>
          <label>
            {t("Votre prénom ou pseudonyme", "Your name or nickname")}
            <input
              value={alias}
              maxLength={50}
              onChange={(e) => setAlias(e.target.value)}
            />
          </label>
          <Pagination pagination={incomingPage}/>{incomingPage.items.map((i) => (
            <div className="member-row" key={i.id}>
              <span>
                <strong>{i.circle_name}</strong> ·{" "}
                {t("Invitation de", "Invited by")} {i.inviter_alias}
              </span>
              <div className="action-row">
                <button
                  className="primary"
                  disabled={busy || !alias.trim()}
                  onClick={() => void run("accept", i.id, "", alias)}
                >
                  {t("Rejoindre", "Join")}
                </button>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => void run("decline", i.id)}
                >
                  {t("Décliner", "Decline")}
                </button>
              </div>
            </div>
          ))}
        </section>
      )}
      <div className="community-grid">
        <section className="card">
          <h2>
            <Plus size={20} />
            {t("Créer mon cercle", "Create my circle")}
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run("create", null, name, alias);
            }}
          >
            <label>
              {t("Nom du cercle", "Circle name")}
              <input
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("Nos petits pas", "Our small steps")}
              />
            </label>
            <label>
              {t("Votre prénom ou pseudonyme", "Your name or nickname")}
              <input
                required
                maxLength={50}
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
              />
            </label>
            <button className="primary" disabled={busy}>
              {t("Créer ce cercle", "Create circle")}
            </button>
          </form>
        </section>
        <section className="card">
          <h2>
            <Users size={20} />
            {t("Mes proches", "My people")}
          </h2>
          {!data ? (
            <p>{t("Chargement…", "Loading…")}</p>
          ) : !data.circles.length ? (
            <p>
              {t(
                "Votre premier cercle commence avec une invitation. Famille, amis : choisissez les personnes avec qui vous vous sentez bien.",
                "Your first circle starts with an invitation. Family, friends: choose people you feel comfortable with.",
              )}
            </p>
          ) : (
            <div className="circle-tabs">
              <Pagination pagination={circlesPage}/>{circlesPage.items.map((c) => (
                <button
                  key={c.id}
                  className={circle?.id === c.id ? "primary" : "secondary"}
                  onClick={() => {
                    setSelected(c.id);
                    setConfirmShare(false);
                  }}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
      {circle && data && (
        <>
          <section className="card circle-feed">
            <div className="section-title">
              <h2>{circle.name}</h2>
              <span className="tag">
                {data.members.filter((m) => m.circle_id === circle.id).length} /
                20
              </span>
            </div>
            <label>
              {t("Un mot à partager", "Something to share")}
              <AppSelect
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value);
                  setConfirmShare(false);
                }}
              >
                {Object.entries(phrases).map(([key, words]) => (
                  <option key={key} value={key}>
                    {t(...words)}
                  </option>
                ))}
              </AppSelect>
            </label>
            {confirmShare ? (
              <div className="share-confirm">
                <p>
                  {t(
                    "Ce message sera visible dans",
                    "This message will be visible in",
                  )}{" "}
                  <strong>{circle.name}</strong> :
                </p>
                <blockquote>{t(...phrases[kind])}</blockquote>
                <div className="action-row">
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => void run("post", circle.id, kind)}
                  >
                    {t("Partager avec ce cercle", "Share with this circle")}
                  </button>
                  <button
                    className="text-button"
                    onClick={() => setConfirmShare(false)}
                  >
                    {t("Annuler", "Cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="secondary"
                onClick={() => setConfirmShare(true)}
              >
                {t("Prévisualiser mon partage", "Preview my message")}
              </button>
            )}
            <div className="encouragements">
              {data.events.filter((e) => e.circle_id === circle.id).length ===
                0 && (
                <p className="muted">
                  {t(
                    "Les premiers encouragements trouveront leur place ici.",
                    "The first words of encouragement will appear here.",
                  )}
                </p>
              )}
              <Pagination pagination={eventsPage}/>{eventsPage.items.map((e) => (
                  <article key={e.id}>
                    <Heart size={19} />
                    <div>
                      <strong>
                        {data.members.find(
                          (m) =>
                            m.circle_id === circle.id &&
                            m.user_id === e.user_id,
                        )?.alias || t("Un membre", "A member")}
                      </strong>
                      <p>{phrases[e.kind] ? t(...phrases[e.kind]) : ""}</p>
                      <time>
                        {new Date(e.created_at).toLocaleString(intlLocale(locale))}
                      </time>
                    </div>
                  </article>
                ))}
            </div>
          </section>
          <section className="card">
            <h2>{t("Les membres du cercle", "Circle members")}</h2>
            <Pagination pagination={membersPage}/>{membersPage.items.map((m) => (
                <div className="member-row" key={m.user_id}>
                  <span>
                    {m.alias}
                    {m.user_id === userId ? ` · ${t("vous", "you")}` : ""}
                  </span>
                  {owner && m.user_id !== userId && (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            t(
                              "Retirer cette personne et ses messages de ce cercle?",
                              "Remove this person and their messages from the circle?",
                            ),
                          )
                        )
                          void run("remove", circle.id, m.user_id);
                      }}
                    >
                      {t("Retirer", "Remove")}
                    </button>
                  )}
                </div>
              ))}
            {owner && (
              <>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run("invite", circle.id, email);
                  }}
                >
                  <label>
                    {t(
                      "Inviter un membre de la plateforme par son adresse Google",
                      "Invite a platform member by Google email",
                    )}
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </label>
                  <button className="secondary" disabled={busy}>
                    {t(
                      "Proposer de rejoindre ce cercle",
                      "Invite to this circle",
                    )}
                  </button>
                </form>
                <Pagination pagination={invitesPage}/>{invitesPage.items.map((i) => (
                    <div className="member-row" key={i.id}>
                      <span>
                        {i.email} ·{" "}
                        {new Date(i.expires_at) < new Date()
                          ? t("Expirée", "Expired")
                          : t("En attente", "Pending")}
                      </span>
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => void run("cancel", circle.id, i.id)}
                      >
                        {t("Annuler", "Cancel")}
                      </button>
                    </div>
                  ))}
              </>
            )}
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    owner
                      ? t(
                          "Fermer ce cercle et supprimer ses messages et invitations?",
                          "Close this circle and delete its messages and invitations?",
                        )
                      : t(
                          "Quitter ce cercle et retirer vos messages? Les membres peuvent avoir conservé une copie.",
                          "Leave this circle and remove your messages? Members may have kept a copy.",
                        ),
                  )
                )
                  void run(owner ? "close" : "leave", circle.id);
              }}
            >
              {owner
                ? t("Fermer ce cercle", "Close circle")
                : t("Quitter ce cercle", "Leave circle")}
            </button>
          </section>
        </>
      )}
    </section>
  );
}
