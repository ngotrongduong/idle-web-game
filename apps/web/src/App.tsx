import { useCallback, useEffect, useMemo, useState } from "react";
import { type BattleRules } from "@idle/game-core";
import { t } from "@idle/i18n";
import { verifyDungeonRunReplay } from "./replay";

const tabs = ["guild", "dungeon", "forge", "tavern", "more"] as const;
const teamSlots = [1, 2, 3, 4] as const;
const dungeonOptions = ["bamboo_grove", "misty_riverbank", "sunken_shrine", "ember_ridge"] as const;

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
  potential?: {
    hp: number;
    attack: number;
    defense: number;
    speed: number;
  };
};

type MaterialBalance = {
  materialId: string;
  qty: number;
};

type HeroPromotionState = {
  heroId: string;
  currentClassId: string;
  currentClassNameVi: string;
  currentTier: number;
  levelCap: number;
  atLevelCap: boolean;
  busy: boolean;
  targets: Array<{
    classId: string;
    nameVi: string;
    nameEn: string;
    tier: number;
  }>;
  rule: {
    goldCost: number;
    sealMaterialId: string;
    sealQty: number;
  } | null;
};

type PromotionState = {
  materials: MaterialBalance[];
  heroes: HeroPromotionState[];
};

type Team = {
  slot: number;
  heroIds: string[];
};

type BattleUnitSnapshot = {
  id: string;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
};

type DungeonWaveReplay = {
  wave: number;
  seed: number;
  result: "win" | "lose" | "draw";
  turns: number;
  hash: string;
  allies: BattleUnitSnapshot[];
  enemies: BattleUnitSnapshot[];
  rewardGold: number;
  rewardExp: number;
};

type DungeonRun = {
  id: string;
  dungeonId: string;
  teamSlot: number;
  seed: number;
  battleRules: BattleRules;
  status: "active" | "stopped";
  startedAt: string;
  stoppedAt: string | null;
  lastAccruedAt: string;
  pendingCycles: number;
  pendingGold: number;
  pendingExpPerHero: number;
  completedCycles: number;
  waves: DungeonWaveReplay[];
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

type GameCommand =
  | { type: "refresh_tavern" }
  | { type: "recruit_hero"; offerId: string }
  | { type: "set_team"; slot: number; heroIds: string[] }
  | { type: "start_dungeon"; dungeonId: string; teamSlot: number }
  | { type: "stop_dungeon"; runId: string }
  | { type: "claim_dungeon_rewards"; runId: string }
  | { type: "promote_hero"; heroId: string; targetClassId: string };

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function rarityLabel(rarity: TavernOffer["rarity"]): string {
  return t("vi", `rarity.${rarity}`);
}

function humanizeId(value: string): string {
  return value.replaceAll("_", " ");
}

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>("tavern");
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [tavern, setTavern] = useState<TavernState | null>(null);
  const [heroes, setHeroes] = useState<Hero[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [runs, setRuns] = useState<DungeonRun[]>([]);
  const [promotion, setPromotion] = useState<PromotionState>({
    materials: [],
    heroes: [],
  });
  const [teamDrafts, setTeamDrafts] = useState<Record<number, string[]>>({});
  const [selectedDungeons, setSelectedDungeons] = useState<Record<number, string>>({
    1: dungeonOptions[0],
    2: dungeonOptions[0],
    3: dungeonOptions[0],
    4: dungeonOptions[0],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const loadCollections = useCallback(async () => {
    const [tavernResponse, heroesResponse, teamsResponse, runsResponse, promotionResponse] =
      await Promise.all([
        fetch("/api/v1/tavern", { credentials: "include" }),
        fetch("/api/v1/heroes", { credentials: "include" }),
        fetch("/api/v1/teams", { credentials: "include" }),
        fetch("/api/v1/dungeon-runs", { credentials: "include" }),
        fetch("/api/v1/promotion", { credentials: "include" }),
      ]);

    if (
      !tavernResponse.ok ||
      !heroesResponse.ok ||
      !teamsResponse.ok ||
      !runsResponse.ok ||
      !promotionResponse.ok
    ) {
      throw new Error(t("vi", "app.loadError"));
    }

    const tavernBody = await readJson<{ ok: true; tavern: TavernState }>(tavernResponse);
    const heroesBody = await readJson<{ ok: true; heroes: Hero[] }>(heroesResponse);
    const teamsBody = await readJson<{ ok: true; teams: Team[] }>(teamsResponse);
    const runsBody = await readJson<{ ok: true; runs: DungeonRun[] }>(runsResponse);
    const promotionBody = await readJson<{ ok: true } & PromotionState>(promotionResponse);

    setTavern(tavernBody.tavern);
    setHeroes(heroesBody.heroes);
    setTeams(teamsBody.teams);
    setRuns(runsBody.runs);
    setPromotion({
      materials: promotionBody.materials,
      heroes: promotionBody.heroes,
    });
    setTeamDrafts(
      Object.fromEntries(
        teamSlots.map((slot) => [
          slot,
          [...(teamsBody.teams.find((team) => team.slot === slot)?.heroIds ?? [])],
        ]),
      ),
    );
  }, []);

  const loadDungeonProgress = useCallback(async () => {
    const [heroesResponse, runsResponse] = await Promise.all([
      fetch("/api/v1/heroes", { credentials: "include" }),
      fetch("/api/v1/dungeon-runs", { credentials: "include" }),
    ]);

    if (!heroesResponse.ok || !runsResponse.ok) {
      throw new Error(t("vi", "app.loadError"));
    }

    const heroesBody = await readJson<{ ok: true; heroes: Hero[] }>(heroesResponse);
    const runsBody = await readJson<{ ok: true; runs: DungeonRun[] }>(runsResponse);
    setHeroes(heroesBody.heroes);
    setRuns(runsBody.runs);
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
        const guest = await readJson<{ ok: true; state: PlayerState }>(stateResponse);
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

  useEffect(() => {
    if (activeTab !== "dungeon" || !player) return;

    const refresh = () => {
      void loadDungeonProgress().catch((reason) => {
        setError(reason instanceof Error ? reason.message : String(reason));
      });
    };

    refresh();
    const timer = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(timer);
  }, [activeTab, loadDungeonProgress, player]);

  const heroCapacity = player ? 3 + player.hallLevel : 0;
  const nextRefreshTime = tavern ? new Date(tavern.nextFreeRefreshAt).getTime() : 0;
  const canRefresh = Boolean(player && tavern && nextRefreshTime <= now);

  const nextRefreshLabel = useMemo(() => {
    if (!tavern || canRefresh) return t("vi", "tavern.refreshReady");
    return new Date(tavern.nextFreeRefreshAt).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [canRefresh, tavern]);

  const sendCommand = useCallback(
    async (command: GameCommand) => {
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

  const toggleHeroForTeam = useCallback((slot: number, heroId: string) => {
    setTeamDrafts((current) => {
      const selected = current[slot] ?? [];
      if (selected.includes(heroId)) {
        return {
          ...current,
          [slot]: selected.filter((id) => id !== heroId),
        };
      }
      if (selected.length >= 4) return current;
      return {
        ...current,
        [slot]: [...selected, heroId],
      };
    });
  }, []);

  const assignedElsewhere = useCallback(
    (slot: number, heroId: string) =>
      teamSlots.some(
        (otherSlot) => otherSlot !== slot && (teamDrafts[otherSlot] ?? []).includes(heroId),
      ),
    [teamDrafts],
  );

  const latestRunForSlot = useCallback(
    (slot: number) =>
      [...runs]
        .filter((run) => run.teamSlot === slot)
        .sort(
          (left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime(),
        )[0],
    [runs],
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
                    <strong>{humanizeId(offer.classId)}</strong>
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
            <div className="roster-heading">
              <span className="section-kicker">{t("vi", "tavern.roster")}</span>
              <span className="seal-summary">
                {t("vi", "promotion.seals")}: I ×
                {promotion.materials.find((entry) => entry.materialId === "promotion_seal_t1")
                  ?.qty ?? 0}
                {" · "}II ×
                {promotion.materials.find((entry) => entry.materialId === "promotion_seal_t2")
                  ?.qty ?? 0}
              </span>
            </div>
            {heroes.length ? (
              <ul>
                {heroes.map((hero) => {
                  const promotionState = promotion.heroes.find((entry) => entry.heroId === hero.id);
                  const rule = promotionState?.rule;
                  const sealBalance = rule
                    ? (promotion.materials.find((entry) => entry.materialId === rule.sealMaterialId)
                        ?.qty ?? 0)
                    : 0;
                  const canAfford = Boolean(
                    player && rule && player.gold >= rule.goldCost && sealBalance >= rule.sealQty,
                  );
                  const canPromote = Boolean(
                    promotionState?.atLevelCap && !promotionState.busy && rule && canAfford,
                  );

                  return (
                    <li className="hero-roster-item" key={hero.id}>
                      <span>
                        <strong>
                          {promotionState?.currentClassNameVi ?? humanizeId(hero.classId)}
                        </strong>
                        <small>
                          {rarityLabel(hero.rarity)} · T{promotionState?.currentTier ?? "?"} · Lv.
                          {hero.level} · EXP {hero.exp}
                        </small>
                        {promotionState?.targets.length && rule ? (
                          <small>
                            {t("vi", "promotion.requirement")}: {rule.goldCost} gold ·{" "}
                            {rule.sealQty} {humanizeId(rule.sealMaterialId)}
                          </small>
                        ) : null}
                        {promotionState?.busy ? (
                          <small>{t("vi", "promotion.busy")}</small>
                        ) : promotionState &&
                          !promotionState.atLevelCap &&
                          promotionState.targets.length ? (
                          <small>
                            {t("vi", "promotion.needCap")} Lv.{promotionState.levelCap}
                          </small>
                        ) : null}
                      </span>

                      {promotionState?.targets.length ? (
                        <div className="promotion-actions">
                          {promotionState.targets.map((target) => (
                            <button
                              type="button"
                              key={target.classId}
                              disabled={busy || !canPromote}
                              onClick={() =>
                                void sendCommand({
                                  type: "promote_hero",
                                  heroId: hero.id,
                                  targetClassId: target.classId,
                                })
                              }
                            >
                              {t("vi", "promotion.promote")} → {target.nameVi}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p>{t("vi", "tavern.emptyRoster")}</p>
            )}
          </section>
        </>
      ) : activeTab === "dungeon" ? (
        <section className="stack dungeon-stack">
          <section className="card">
            <span className="section-kicker">{t("vi", "dungeon.title")}</span>
            <h2>{t("vi", "dungeon.subtitle")}</h2>
            <p>{t("vi", "dungeon.help")}</p>
            <strong className="player-gold">
              {t("vi", "dungeon.playerGold")}: {player?.gold ?? 0}
            </strong>
          </section>

          {teamSlots.map((slot) => {
            const selectedHeroIds = teamDrafts[slot] ?? [];
            const savedTeam = teams.find((team) => team.slot === slot);
            const latestRun = latestRunForSlot(slot);
            const activeRun = latestRun?.status === "active" ? latestRun : undefined;
            const replayVerification = latestRun ? verifyDungeonRunReplay(latestRun) : undefined;

            return (
              <article className="card team-card" key={slot}>
                <div className="team-heading">
                  <div>
                    <span className="section-kicker">
                      {t("vi", "dungeon.team")} {slot}
                    </span>
                    <strong>
                      {selectedHeroIds.length}/4 {t("vi", "dungeon.members")}
                    </strong>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void sendCommand({
                        type: "set_team",
                        slot,
                        heroIds: selectedHeroIds,
                      })
                    }
                  >
                    {savedTeam?.heroIds.join("|") === selectedHeroIds.join("|")
                      ? t("vi", "dungeon.saved")
                      : t("vi", "dungeon.saveTeam")}
                  </button>
                </div>

                <div className="hero-picker">
                  {heroes.length ? (
                    heroes.map((hero) => {
                      const checked = selectedHeroIds.includes(hero.id);
                      const unavailable = assignedElsewhere(slot, hero.id);

                      return (
                        <label
                          className={unavailable && !checked ? "disabled-choice" : ""}
                          key={hero.id}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={busy || (unavailable && !checked)}
                            onChange={() => toggleHeroForTeam(slot, hero.id)}
                          />
                          <span>
                            <strong>{humanizeId(hero.classId)}</strong>
                            <small>
                              {rarityLabel(hero.rarity)} · Lv.{hero.level} · EXP {hero.exp}
                            </small>
                          </span>
                        </label>
                      );
                    })
                  ) : (
                    <p>{t("vi", "dungeon.needHeroes")}</p>
                  )}
                </div>

                <div className="dungeon-controls">
                  <select
                    aria-label={`${t("vi", "dungeon.select")} ${slot}`}
                    disabled={busy || Boolean(activeRun)}
                    value={selectedDungeons[slot]}
                    onChange={(event) =>
                      setSelectedDungeons((current) => ({
                        ...current,
                        [slot]: event.target.value,
                      }))
                    }
                  >
                    {dungeonOptions.map((dungeonId) => (
                      <option key={dungeonId} value={dungeonId}>
                        {humanizeId(dungeonId)}
                      </option>
                    ))}
                  </select>

                  {activeRun ? (
                    <button
                      className="danger-button"
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void sendCommand({
                          type: "stop_dungeon",
                          runId: activeRun.id,
                        })
                      }
                    >
                      {t("vi", "dungeon.stop")}
                    </button>
                  ) : (
                    <button
                      className="primary-button"
                      type="button"
                      disabled={busy || selectedHeroIds.length === 0}
                      onClick={() =>
                        void sendCommand({
                          type: "start_dungeon",
                          dungeonId: selectedDungeons[slot] ?? dungeonOptions[0],
                          teamSlot: slot,
                        })
                      }
                    >
                      {t("vi", "dungeon.start")}
                    </button>
                  )}
                </div>

                {latestRun ? (
                  <section className="run-panel">
                    <div className="run-summary">
                      <strong>{humanizeId(latestRun.dungeonId)}</strong>
                      <span className={`run-status status-${latestRun.status}`}>
                        {latestRun.status}
                      </span>
                    </div>
                    <small>
                      seed {latestRun.seed} · {latestRun.waves.length} {t("vi", "dungeon.waves")}
                    </small>
                    <span
                      className={
                        replayVerification?.ok
                          ? "replay-badge replay-ok"
                          : "replay-badge replay-mismatch"
                      }
                    >
                      {replayVerification?.ok
                        ? t("vi", "dungeon.replayVerified")
                        : t("vi", "dungeon.replayMismatch")}
                    </span>

                    <div className="idle-rewards">
                      <div>
                        <span className="section-kicker">{t("vi", "dungeon.idleRewards")}</span>
                        <strong>
                          {latestRun.pendingCycles} {t("vi", "dungeon.cycles")}
                        </strong>
                        <small>
                          +{latestRun.pendingGold} gold · +{latestRun.pendingExpPerHero} EXP/
                          {t("vi", "dungeon.hero")}
                        </small>
                        <small>
                          {t("vi", "dungeon.completedCycles")}: {latestRun.completedCycles}
                        </small>
                      </div>
                      <button
                        className="claim-button"
                        type="button"
                        disabled={busy || latestRun.pendingCycles === 0}
                        onClick={() =>
                          void sendCommand({
                            type: "claim_dungeon_rewards",
                            runId: latestRun.id,
                          })
                        }
                      >
                        {t("vi", "dungeon.claim")}
                      </button>
                    </div>

                    <div className="wave-grid">
                      {latestRun.waves.map((wave) => {
                        const replayWave = replayVerification?.waves.find(
                          (entry) => entry.wave === wave.wave,
                        );

                        return (
                          <div className="wave-card" key={wave.wave}>
                            <span>
                              {t("vi", "dungeon.wave")} {wave.wave}
                            </span>
                            <strong>{wave.result}</strong>
                            <small>
                              {wave.turns} turns · {wave.hash}
                            </small>
                            <small>
                              {replayWave?.matches
                                ? t("vi", "dungeon.hashMatch")
                                : t("vi", "dungeon.hashMismatch")}
                            </small>
                            <small>
                              +{wave.rewardGold} gold · +{wave.rewardExp} EXP
                            </small>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ) : null}
              </article>
            );
          })}
        </section>
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
