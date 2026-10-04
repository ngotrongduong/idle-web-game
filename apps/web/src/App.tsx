import { useCallback, useEffect, useMemo, useState } from "react";
import { t } from "@idle/i18n";

const tabs = ["guild", "dungeon", "forge", "tavern", "more"] as const;
type Tab = (typeof tabs)[number];

type PlayerState = {
  id: string;
  version: number;
  gold: number;
  hallLevel: number;
};

type TavernOffer = {
  id: string;
  classId: string;
  rarity: "common" | "elite" | "rare" | "legendary";
};

type TavernState = {
  refreshesSinceRarePlus: number;
  refreshesSinceLegendary: number;
  nextFreeRefreshAt: string;
  offers: TavernOffer[];
};

type Hero = {
  id: string;
  classId: string;
  rarity: TavernOffer["rarity"];
  level: number;
  exp: number;
};

type ApiErrorBody = {
  ok: false;
  code: string;
  message: string;
  currentVersion?: number;
};

type CommandSuccess = {
  ok: true;
  version: number;
  patch: Partial<Pick<PlayerState, "gold" | "hallLevel">>;
};

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function rarityLabel(rarity: TavernOffer["rarity"]): string {
  return t("vi", `rarity.${rarity}`);
}

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>("tavern");
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [tavern, setTavern] = useState<TavernState | null>(null);
  const [heroes, setHeroes] = useState<Hero[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const loadCollections = useCallback(async () => {
    const [tavernResponse, heroesResponse] = await Promise.all([
      fetch("/api/v1/tavern", { credentials: "include" }),
      fetch("/api/v1/heroes", { credentials: "include" }),
    ]);

    if (!tavernResponse.ok || !heroesResponse.ok) {
      throw new Error(t("vi", "tavern.loadError"));
    }

    const tavernBody = await readJson<{ ok: true; tavern: TavernState }>(
      tavernResponse,
    );
    const heroesBody = await readJson<{ ok: true; heroes: Hero[] }>(
      heroesResponse,
    );

    setTavern(tavernBody.tavern);
    setHeroes(heroesBody.heroes);
  }, []);

  const bootstrap = useCallback(async () => {
    setBusy(true);
    setError(null);

    try {
      let stateResponse = await fetch("/api/v1/state", {
        credentials: "include",
      });

      if (stateResponse.status === 401) {
        stateResponse = await fetch("/api/v1/auth/guest", {
          method: "POST",
          credentials: "include",
        });
        const guest = await readJson<{ ok: true; state: PlayerState }>(
          stateResponse,
        );
        setPlayer(guest.state);
      } else {
        if (!stateResponse.ok) {
          throw new Error(t("vi", "app.connectError"));
        }
        setPlayer(await readJson<PlayerState>(stateResponse));
      }

      await loadCollections();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }, [loadCollections]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const heroCapacity = player ? 3 + player.hallLevel : 0;
  const nextRefreshTime = tavern
    ? new Date(tavern.nextFreeRefreshAt).getTime()
    : 0;
  const canRefresh = Boolean(player && tavern && nextRefreshTime <= now);

  const nextRefreshLabel = useMemo(() => {
    if (!tavern || canRefresh) return t("vi", "tavern.refreshReady");
    return new Date(tavern.nextFreeRefreshAt).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [canRefresh, tavern]);

  const sendCommand = useCallback(
    async (command: { type: "refresh_tavern" } | { type: "recruit_hero"; offerId: string }) => {
      if (!player) return;

      setBusy(true);
      setError(null);

      try {
        const response = await fetch("/api/v1/cmd", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            cmdId: crypto.randomUUID(),
            expectVersion: player.version,
            command,
          }),
        });

        if (!response.ok) {
          const body = await readJson<ApiErrorBody>(response);
          if (body.code === "VERSION_CONFLICT") {
            await bootstrap();
          }
          throw new Error(body.message);
        }

        const body = await readJson<CommandSuccess>(response);
        setPlayer((current) =>
          current
            ? {
                ...current,
                ...body.patch,
                version: body.version,
              }
            : current,
        );
        await loadCollections();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason));
      } finally {
        setBusy(false);
      }
    },
    [bootstrap, loadCollections, player],
  );

  return (
    <main className="shell">
      <header className="hero">
        <span className="eyebrow">M1 CORE LOOP</span>
        <h1>{t("vi", "app.title")}</h1>
        <p>{t("vi", "app.subtitleM1")}</p>
      </header>

      {error ? (
        <section className="notice notice-error" role="alert">
          {error}
        </section>
      ) : null}

      {activeTab === "tavern" ? (
        <>
          <section className="card tavern-header">
            <div>
              <span className="section-kicker">{t("vi", "tavern.title")}</span>
              <strong>
                {t("vi", "tavern.heroes")} {heroes.length}/{heroCapacity}
              </strong>
            </div>
            <button
              className="primary-button"
              type="button"
              disabled={!canRefresh || busy}
              onClick={() => void sendCommand({ type: "refresh_tavern" })}
            >
              {busy ? t("vi", "common.working") : t("vi", "tavern.refresh")}
            </button>
          </section>

          <section className="card status-grid">
            <div>
              <span>{t("vi", "tavern.nextRefresh")}</span>
              <strong>{nextRefreshLabel}</strong>
            </div>
            <div>
              <span>{t("vi", "tavern.rarePity")}</span>
              <strong>{tavern?.refreshesSinceRarePlus ?? 0}/40</strong>
            </div>
            <div>
              <span>{t("vi", "tavern.legendaryPity")}</span>
              <strong>{tavern?.refreshesSinceLegendary ?? 0}/200</strong>
            </div>
          </section>

          <section className="stack" aria-label={t("vi", "tavern.offers")}>
            {tavern?.offers.length ? (
              tavern.offers.map((offer) => (
                <article className={`offer-card rarity-${offer.rarity}`} key={offer.id}>
                  <div>
                    <span className="rarity">{rarityLabel(offer.rarity)}</span>
                    <strong>{offer.classId.replaceAll("_", " ")}</strong>
                    <small>{t("vi", "tavern.levelOne")}</small>
                  </div>
                  <button
                    type="button"
                    disabled={busy || heroes.length >= heroCapacity}
                    onClick={() =>
                      void sendCommand({
                        type: "recruit_hero",
                        offerId: offer.id,
                      })
                    }
                  >
                    {t("vi", "tavern.recruit")}
                  </button>
                </article>
              ))
            ) : (
              <section className="card empty-state">
                <strong>{t("vi", "tavern.noOffers")}</strong>
                <p>{t("vi", "tavern.noOffersHint")}</p>
              </section>
            )}
          </section>

          <section className="card roster">
            <span className="section-kicker">{t("vi", "tavern.roster")}</span>
            {heroes.length ? (
              <ul>
                {heroes.map((hero) => (
                  <li key={hero.id}>
                    <span>
                      <strong>{hero.classId.replaceAll("_", " ")}</strong>
                      <small>
                        {rarityLabel(hero.rarity)} · Lv.{hero.level}
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>{t("vi", "tavern.emptyRoster")}</p>
            )}
          </section>
        </>
      ) : (
        <section className="card empty-state">
          <strong>{t("vi", `nav.${activeTab}`)}</strong>
          <p>{t("vi", "app.nextMilestone")}</p>
        </section>
      )}

      <nav className="tabs" aria-label={t("vi", "nav.main")}>
        {tabs.map((tab) => (
          <button
            className={tab === activeTab ? "active" : ""}
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
          >
            {t("vi", `nav.${tab}`)}
          </button>
        ))}
      </nav>
    </main>
  );
}
