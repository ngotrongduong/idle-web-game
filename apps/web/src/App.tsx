import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type BattleRules } from "@idle/game-core";
import { type PlainKey } from "@idle/i18n";
import { BuildingsCard, ConstructionNote } from "./BuildingsCard";
import { LanguageSwitch } from "./LanguageSwitch";
import {
  applyBuildingState,
  clockOffsetMs as measureClockOffsetMs,
  dismantleDustFor,
  enhanceBlock,
  enhanceCapLabel,
  forgeLevelForEnhance,
  formatBps,
  oddsLabel,
  type BuildingId,
  type BuildingRules,
  type BuildingState,
  type Construction,
  type ForgeLevel,
  type HallLevel,
  type QualityTier,
} from "./buildings";
import { findCatalogName } from "./catalog-names";
import { NoticeError, errorMessageKey, noticeKey } from "./errors";
import { useLocale } from "./locale";
import { verifyDungeonRunReplay } from "./replay";

const tabs = ["guild", "dungeon", "forge", "tavern", "more"] as const;
const teamSlots = [1, 2, 3, 4] as const;
/** Used until the catalog loads; the catalog's order and unlock chain are authoritative. */
const FALLBACK_DUNGEON_IDS = ["bamboo_grove"] as const;
/** How often the finished level is asked for once a build's countdown has run out. */
const CONSTRUCTION_POLL_MS = 2_000;
/** The measured clock offset is off by up to half a round trip; ask just after the deadline. */
const CONSTRUCTION_POLL_GRACE_MS = 250;
/** Building levels are re-read this often while the Guild tab is open (e.g. sped up elsewhere). */
const BUILDINGS_REFRESH_MS = 30_000;

type Tab = (typeof tabs)[number];

type PlayerState = {
  id: string;
  version: number;
  gold: number;
  hallLevel: number;
  forgeLevel: number;
  construction: Construction | null;
  clearedDungeonIds: string[];
};

type BuildingsBody = BuildingState & {
  ok: true;
  serverTime: string;
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
  pendingMaterials: MaterialBalance[];
  completedCycles: number;
  waves: DungeonWaveReplay[];
  cycleSamples: CycleSample[] | null;
};

type CycleSample = {
  gold: number;
  exp: number;
  kills: { normal: number; elite: number; boss: number };
};

/** Expected rewards per idle cycle from the run's sampled cycles (docs/04 §6). */
function expectedPerCycle(run: DungeonRun) {
  const samples = run.cycleSamples;
  if (!samples || samples.length === 0) return null;
  const average = (pick: (sample: CycleSample) => number) =>
    samples.reduce((sum, sample) => sum + pick(sample), 0) / samples.length;
  return {
    gold: Math.round(average((sample) => sample.gold)),
    exp: Math.round(average((sample) => sample.exp)),
    bossWinPercent: Math.round(average((sample) => (sample.kills.boss > 0 ? 100 : 0))),
  };
}

type ApiErrorBody = {
  ok: false;
  code: string;
  message: string;
  currentVersion?: number;
};

type DungeonRewardsClaimedEvent = {
  type: "dungeon_rewards_claimed";
  cycles: number;
  gold: number;
  expPerHero: number;
  materials: MaterialBalance[];
};

type CommandSuccess = {
  ok: true;
  version: number;
  patch: Partial<
    Pick<PlayerState, "gold" | "hallLevel" | "forgeLevel" | "construction" | "clearedDungeonIds">
  >;
  events: Array<{ type: string } | DungeonRewardsClaimedEvent>;
};

/** Errors that mean the client's building levels or timer are out of date. */
const BUILDING_ERROR_CODES = new Set([
  "BUILDER_BUSY",
  "NO_CONSTRUCTION",
  "FORGE_LEVEL_TOO_LOW",
  "MAX_LEVEL",
]);

type CatalogEntry = {
  id: string;
  nameVi: string;
  nameEn: string;
};

type EquipmentSlot = "weapon" | "helmet" | "armor" | "accessory";

type ItemCatalogEntry = CatalogEntry & {
  slot: EquipmentSlot;
  attack: number;
  defense: number;
  sellGold: number;
  recipe: MaterialBalance[];
};

type EquipmentRules = {
  qualityTiers: QualityTier[];
  enhanceBonusBps: number[];
  enhanceGoldCosts: number[];
  enhanceDustCosts: number[];
  forgeDustMaterialId: string;
  enhanceSuccessBps: number[];
  enhancePityStepBps: number;
};

type AutoSellSettings = {
  enabled: boolean;
  maxQualityBps: number;
};

type InventoryItem = {
  id: string;
  itemId: string;
  slot: EquipmentSlot;
  qualityBps: number;
  enhanceLevel: number;
  enhancePityFailures: number;
  locked: boolean;
  equippedHeroId: string | null;
};

type DungeonCatalogEntry = CatalogEntry & {
  recommendedLevel: number;
  unlockAfterDungeonId: string | null;
};

type Catalog = {
  classes: CatalogEntry[];
  dungeons: DungeonCatalogEntry[];
  hall: HallLevel[];
  forge: ForgeLevel[];
  buildings: BuildingRules;
  materials: CatalogEntry[];
  items: ItemCatalogEntry[];
  equipment: EquipmentRules;
};

type GameCommand =
  | { type: "upgrade_building"; building: BuildingId }
  | { type: "speed_up_construction"; items: number }
  | { type: "dismantle_item"; itemInstanceId: string }
  | { type: "refresh_tavern" }
  | { type: "recruit_hero"; offerId: string }
  | { type: "set_team"; slot: number; heroIds: string[] }
  | { type: "start_dungeon"; dungeonId: string; teamSlot: number }
  | { type: "stop_dungeon"; runId: string }
  | { type: "claim_dungeon_rewards"; runId: string }
  | { type: "promote_hero"; heroId: string; targetClassId: string }
  | { type: "equip_item"; itemInstanceId: string; heroId: string }
  | { type: "unequip_item"; itemInstanceId: string }
  | { type: "set_item_locked"; itemInstanceId: string; locked: boolean }
  | { type: "sell_item"; itemInstanceId: string }
  | { type: "craft_item"; itemId: string }
  | { type: "enhance_item"; itemInstanceId: string }
  | { type: "set_auto_sell"; enabled: boolean; maxQualityBps: number };

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

type CatalogListKey = "classes" | "dungeons" | "materials" | "items";

export function App() {
  const { locale, t, format, plural, formatNodes, number, time, name, list } = useLocale();
  const [activeTab, setActiveTab] = useState<Tab>("tavern");
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [tavern, setTavern] = useState<TavernState | null>(null);
  const [heroes, setHeroes] = useState<Hero[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [runs, setRuns] = useState<DungeonRun[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [autoSell, setAutoSell] = useState<AutoSellSettings>({
    enabled: false,
    maxQualityBps: 10_000,
  });
  const [equipTargets, setEquipTargets] = useState<Record<string, string>>({});
  const [promotion, setPromotion] = useState<PromotionState>({
    materials: [],
    heroes: [],
  });
  const [teamDrafts, setTeamDrafts] = useState<Record<number, string[]>>({});
  const [selectedDungeons, setSelectedDungeons] = useState<Record<number, string>>({
    1: FALLBACK_DUNGEON_IDS[0],
    2: FALLBACK_DUNGEON_IDS[0],
    3: FALLBACK_DUNGEON_IDS[0],
    4: FALLBACK_DUNGEON_IDS[0],
  });
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [lastClaim, setLastClaim] = useState<DungeonRewardsClaimedEvent | null>(null);
  const [busy, setBusy] = useState(false);
  /** The notice as a message key, so it is shown in whatever language is selected right now. */
  const [error, setError] = useState<PlainKey | null>(null);
  const [now, setNow] = useState(() => Date.now());
  /** Server clock minus device clock; build countdowns run on the server clock. */
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const clockOffsetRef = useRef(0);
  const buildingsRequestRef = useRef(0);

  /**
   * Re-reads the building levels (a finished construction arrives already applied) and re-measures
   * the clock offset. Only the newest request may write, so a slow answer cannot undo a later one.
   */
  const refreshBuildings = useCallback(async () => {
    buildingsRequestRef.current += 1;
    const requestId = buildingsRequestRef.current;
    const sentAt = Date.now();
    const response = await fetch("/api/v1/buildings", { credentials: "include" });
    if (!response.ok) throw new NoticeError("app.loadError");
    const body = await readJson<BuildingsBody>(response);
    if (requestId !== buildingsRequestRef.current) return;

    // The server stamped its time somewhere between sending and receiving; take the middle.
    const offset = measureClockOffsetMs(body.serverTime, (sentAt + Date.now()) / 2);
    clockOffsetRef.current = offset;
    setClockOffsetMs(offset);
    setPlayer((current) => (current ? applyBuildingState(current, body) : current));
  }, []);

  const loadCollections = useCallback(async () => {
    const [
      tavernResponse,
      heroesResponse,
      teamsResponse,
      runsResponse,
      promotionResponse,
      inventoryResponse,
      inventorySettingsResponse,
    ] = await Promise.all([
      fetch("/api/v1/tavern", { credentials: "include" }),
      fetch("/api/v1/heroes", { credentials: "include" }),
      fetch("/api/v1/teams", { credentials: "include" }),
      fetch("/api/v1/dungeon-runs", { credentials: "include" }),
      fetch("/api/v1/promotion", { credentials: "include" }),
      fetch("/api/v1/inventory", { credentials: "include" }),
      fetch("/api/v1/inventory-settings", { credentials: "include" }),
      // Commands do not report a build that finished in the meantime; this does.
      refreshBuildings(),
    ]);

    if (
      !tavernResponse.ok ||
      !heroesResponse.ok ||
      !teamsResponse.ok ||
      !runsResponse.ok ||
      !promotionResponse.ok ||
      !inventoryResponse.ok ||
      !inventorySettingsResponse.ok
    ) {
      throw new NoticeError("app.loadError");
    }

    const tavernBody = await readJson<{ ok: true; tavern: TavernState }>(tavernResponse);
    const heroesBody = await readJson<{ ok: true; heroes: Hero[] }>(heroesResponse);
    const teamsBody = await readJson<{ ok: true; teams: Team[] }>(teamsResponse);
    const runsBody = await readJson<{ ok: true; runs: DungeonRun[] }>(runsResponse);
    const promotionBody = await readJson<{ ok: true } & PromotionState>(promotionResponse);
    const inventoryBody = await readJson<{ ok: true; items: InventoryItem[] }>(inventoryResponse);
    const inventorySettingsBody = await readJson<{
      ok: true;
      autoSell: AutoSellSettings;
    }>(inventorySettingsResponse);

    setTavern(tavernBody.tavern);
    setHeroes(heroesBody.heroes);
    setTeams(teamsBody.teams);
    setRuns(runsBody.runs);
    setInventoryItems(inventoryBody.items);
    setAutoSell(inventorySettingsBody.autoSell);
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
  }, [refreshBuildings]);

  const loadDungeonProgress = useCallback(async () => {
    const [heroesResponse, runsResponse] = await Promise.all([
      fetch("/api/v1/heroes", { credentials: "include" }),
      fetch("/api/v1/dungeon-runs", { credentials: "include" }),
    ]);

    if (!heroesResponse.ok || !runsResponse.ok) {
      throw new NoticeError("app.loadError");
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
          throw new NoticeError("app.connectError");
        }
        setPlayer(await readJson<PlayerState>(stateResponse));
      }

      const catalogResponse = await fetch("/api/v1/catalog");
      if (catalogResponse.ok) {
        setCatalog(await readJson<{ ok: true } & Catalog>(catalogResponse));
      }

      await loadCollections();
    } catch (reason) {
      setError(noticeKey(reason));
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
        setError(noticeKey(reason));
      });
    };

    refresh();
    const timer = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(timer);
  }, [activeTab, loadDungeonProgress, player]);

  const playerId = player?.id ?? null;
  useEffect(() => {
    if (activeTab !== "guild" || !playerId) return;

    const refresh = () => {
      void refreshBuildings().catch((reason) => {
        setError(noticeKey(reason));
      });
    };

    refresh();
    const timer = window.setInterval(refresh, BUILDINGS_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [activeTab, playerId, refreshBuildings]);

  // The server applies a finished build lazily and no command pushes it, so when the countdown
  // runs out the client asks until the construction is gone. Everything that depends on the
  // levels (hero capacity, team limit, enhancement cap, craft odds) is derived from the player
  // state, so the open screen updates without a reload.
  const constructionCompletesAt = player?.construction?.completesAt ?? null;
  useEffect(() => {
    if (!constructionCompletesAt) return;

    let cancelled = false;
    let timer = 0;
    const completesAtMs = Date.parse(constructionCompletesAt);
    const schedule = (minimumDelayMs: number) => {
      // Re-read the offset every time: the first measurement may arrive after this effect starts.
      const remainingMs = completesAtMs - (Date.now() + clockOffsetRef.current);
      timer = window.setTimeout(
        poll,
        Math.max(minimumDelayMs, remainingMs + CONSTRUCTION_POLL_GRACE_MS),
      );
    };
    const poll = () => {
      void refreshBuildings()
        // A failed poll is simply retried; commands report real connection problems.
        .catch(() => undefined)
        .then(() => {
          if (!cancelled) schedule(CONSTRUCTION_POLL_MS);
        });
    };

    schedule(0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [constructionCompletesAt, refreshBuildings]);

  const hallInfo = catalog?.hall.find((entry) => entry.level === player?.hallLevel);
  const heroCapacity = hallInfo?.heroCapacity ?? 0;
  const teamLimit = hallInfo?.teamLimit ?? 1;
  const forgeInfo = catalog?.forge.find((entry) => entry.level === player?.forgeLevel);
  const forgeEnhanceCap = forgeInfo?.maxEnhanceLevel ?? 0;
  /** A catalog name in the selected language; never the internal id, which players must not see. */
  const catalogName = (kind: CatalogListKey, id: string) =>
    findCatalogName(catalog?.[kind], id, locale) ?? t("common.unknown");
  const rarityLabel = (rarity: TavernOffer["rarity"]) => t(`rarity.${rarity}`);
  const ownedMaterial = (materialId: string) =>
    promotion.materials.find((entry) => entry.materialId === materialId)?.qty ?? 0;
  const materialName = (materialId: string) => catalogName("materials", materialId);
  const materialQty = (entry: MaterialBalance) =>
    format("common.itemQty", { name: materialName(entry.materialId), qty: entry.qty });
  const heroSummary = (hero: Hero, tier?: number) =>
    tier === undefined
      ? format("hero.summary", {
          rarity: rarityLabel(hero.rarity),
          level: hero.level,
          exp: hero.exp,
        })
      : format("hero.summaryTier", {
          rarity: rarityLabel(hero.rarity),
          tier,
          level: hero.level,
          exp: hero.exp,
        });
  const claimSummary = (claim: DungeonRewardsClaimedEvent) =>
    format("dungeon.claimNotice", {
      rewards: list([
        plural("dungeon.cycles", claim.cycles),
        format("reward.gold", { gold: claim.gold }),
        format("reward.expPerHero", { exp: claim.expPerHero }),
        ...claim.materials.map(materialQty),
      ]),
    });
  const dustMaterialId = catalog?.equipment.forgeDustMaterialId ?? "";
  const dustBalance = dustMaterialId ? ownedMaterial(dustMaterialId) : 0;
  const activeRunCount = runs.filter((run) => run.status === "active").length;
  const dungeonChoices = catalog?.dungeons ?? [];
  const isDungeonUnlocked = (dungeon: DungeonCatalogEntry) =>
    dungeon.unlockAfterDungeonId === null ||
    Boolean(player?.clearedDungeonIds.includes(dungeon.unlockAfterDungeonId));
  const nextRefreshTime = tavern ? new Date(tavern.nextFreeRefreshAt).getTime() : 0;
  const canRefresh = Boolean(player && tavern && nextRefreshTime <= now);

  const nextRefreshLabel = useMemo(() => {
    if (!tavern || canRefresh) return t("tavern.refreshReady");
    return time(new Date(tavern.nextFreeRefreshAt));
  }, [canRefresh, tavern, t, time]);

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
          } else if (BUILDING_ERROR_CODES.has(body.code)) {
            // The screen was drawn from stale levels or a stale timer: show what the server has.
            await refreshBuildings().catch(() => undefined);
            // A speed-up sent just as the build finished is not a failure the player caused.
            if (body.code === "NO_CONSTRUCTION") return;
          }
          // The server's `message` is English text for logs; the player reads the code's message.
          throw new NoticeError(errorMessageKey(body.code));
        }

        const body = await readJson<CommandSuccess>(response);
        const claimEvent = body.events.find(
          (event): event is DungeonRewardsClaimedEvent => event.type === "dungeon_rewards_claimed",
        );
        if (claimEvent) setLastClaim(claimEvent);
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
        setError(noticeKey(reason));
      } finally {
        setBusy(false);
      }
    },
    [bootstrap, loadCollections, player, refreshBuildings],
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
        <div className="hero-top">
          <span className="eyebrow">{t("app.eyebrow")}</span>
          <LanguageSwitch />
        </div>
        <h1>{t("app.title")}</h1>
        <p>{t("app.subtitleM1")}</p>
      </header>

      {error ? (
        <section className="notice notice-error" role="alert">
          {t(error)}
        </section>
      ) : null}

      {activeTab === "tavern" ? (
        <>
          <section className="card tavern-header">
            <div>
              <span className="section-kicker">{t("tavern.title")}</span>
              <strong>
                {format("tavern.heroCount", { count: heroes.length, capacity: heroCapacity })}
              </strong>
            </div>
            <button
              className="primary-button"
              type="button"
              disabled={!canRefresh || busy}
              onClick={() => void sendCommand({ type: "refresh_tavern" })}
            >
              {busy ? t("common.working") : t("tavern.refresh")}
            </button>
          </section>

          <section className="card status-grid">
            <div>
              <span>{t("tavern.nextRefresh")}</span>
              <strong>{nextRefreshLabel}</strong>
            </div>
            <div>
              <span>{t("tavern.rarePity")}</span>
              <strong>
                {format("common.ratio", { current: tavern?.refreshesSinceRarePlus ?? 0, max: 40 })}
              </strong>
            </div>
            <div>
              <span>{t("tavern.legendaryPity")}</span>
              <strong>
                {format("common.ratio", {
                  current: tavern?.refreshesSinceLegendary ?? 0,
                  max: 200,
                })}
              </strong>
            </div>
          </section>

          <section className="stack" aria-label={t("tavern.offers")}>
            {tavern?.offers.length ? (
              tavern.offers.map((offer) => (
                <article className={`offer-card rarity-${offer.rarity}`} key={offer.id}>
                  <div>
                    <span className="rarity">{rarityLabel(offer.rarity)}</span>
                    <strong>{catalogName("classes", offer.classId)}</strong>
                    <small>{t("tavern.levelOne")}</small>
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
                    {t("tavern.recruit")}
                  </button>
                </article>
              ))
            ) : (
              <section className="card empty-state">
                <strong>{t("tavern.noOffers")}</strong>
                <p>{t("tavern.noOffersHint")}</p>
              </section>
            )}
          </section>

          <section className="card roster">
            <div className="roster-heading">
              <span className="section-kicker">{t("tavern.roster")}</span>
              <span className="seal-summary">
                {format("promotion.sealSummary", {
                  tier1: ownedMaterial("promotion_seal_t1"),
                  tier2: ownedMaterial("promotion_seal_t2"),
                })}
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
                          {catalogName("classes", promotionState?.currentClassId ?? hero.classId)}
                        </strong>
                        <small>{heroSummary(hero, promotionState?.currentTier)}</small>
                        {promotionState?.targets.length && rule ? (
                          <small>
                            {format("promotion.requirement", {
                              gold: rule.goldCost,
                              qty: rule.sealQty,
                              material: materialName(rule.sealMaterialId),
                            })}
                          </small>
                        ) : null}
                        {promotionState?.busy ? (
                          <small>{t("promotion.busy")}</small>
                        ) : promotionState &&
                          !promotionState.atLevelCap &&
                          promotionState.targets.length ? (
                          <small>
                            {format("promotion.needCap", { level: promotionState.levelCap })}
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
                              {format("promotion.promoteTo", { name: name(target) })}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p>{t("tavern.emptyRoster")}</p>
            )}
          </section>

          <section className="card inventory">
            <span className="section-kicker">{t("inventory.title")}</span>
            {promotion.materials.some((entry) => entry.qty > 0) ? (
              <ul className="inventory-list">
                {promotion.materials
                  .filter((entry) => entry.qty > 0)
                  .map((entry) => (
                    <li key={entry.materialId} data-material-id={entry.materialId}>
                      <span>{materialName(entry.materialId)}</span>
                      <strong>{format("common.quantity", { qty: entry.qty })}</strong>
                    </li>
                  ))}
              </ul>
            ) : (
              <p>{t("inventory.empty")}</p>
            )}
          </section>
        </>
      ) : activeTab === "dungeon" ? (
        <section className="stack dungeon-stack">
          <section className="card">
            <span className="section-kicker">{t("dungeon.title")}</span>
            <h2>{t("dungeon.subtitle")}</h2>
            <p>{t("dungeon.help")}</p>
            <strong className="player-gold">
              {format("common.labelValue", {
                label: t("dungeon.playerGold"),
                value: number(player?.gold ?? 0),
              })}
            </strong>
            {lastClaim ? (
              <p className="claim-notice" role="status">
                {claimSummary(lastClaim)}
              </p>
            ) : null}
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
                    <span className="section-kicker">{format("dungeon.teamTitle", { slot })}</span>
                    <strong>
                      {format("dungeon.memberCount", { count: selectedHeroIds.length, max: 4 })}
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
                      ? t("dungeon.saved")
                      : t("dungeon.saveTeam")}
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
                            <strong>{catalogName("classes", hero.classId)}</strong>
                            <small>{heroSummary(hero)}</small>
                          </span>
                        </label>
                      );
                    })
                  ) : (
                    <p>{t("dungeon.needHeroes")}</p>
                  )}
                </div>

                <div className="dungeon-controls">
                  <select
                    aria-label={format("dungeon.selectFor", { slot })}
                    disabled={busy || Boolean(activeRun)}
                    value={selectedDungeons[slot]}
                    onChange={(event) =>
                      setSelectedDungeons((current) => ({
                        ...current,
                        [slot]: event.target.value,
                      }))
                    }
                  >
                    {dungeonChoices.length
                      ? dungeonChoices.map((dungeon) => (
                          <option
                            key={dungeon.id}
                            value={dungeon.id}
                            disabled={!isDungeonUnlocked(dungeon)}
                          >
                            {isDungeonUnlocked(dungeon)
                              ? name(dungeon)
                              : format("dungeon.optionLocked", { name: name(dungeon) })}
                          </option>
                        ))
                      : FALLBACK_DUNGEON_IDS.map((dungeonId) => (
                          <option key={dungeonId} value={dungeonId}>
                            {t("common.loading")}
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
                      {t("dungeon.stop")}
                    </button>
                  ) : (
                    <button
                      className="primary-button"
                      type="button"
                      title={activeRunCount >= teamLimit ? t("dungeon.teamLimitHint") : undefined}
                      disabled={busy || selectedHeroIds.length === 0 || activeRunCount >= teamLimit}
                      onClick={() =>
                        void sendCommand({
                          type: "start_dungeon",
                          dungeonId: selectedDungeons[slot] ?? FALLBACK_DUNGEON_IDS[0],
                          teamSlot: slot,
                        })
                      }
                    >
                      {t("dungeon.start")}
                    </button>
                  )}
                </div>

                {latestRun ? (
                  <section className="run-panel">
                    <div className="run-summary">
                      <strong>{catalogName("dungeons", latestRun.dungeonId)}</strong>
                      <span className={`run-status status-${latestRun.status}`}>
                        {t(`run.status.${latestRun.status}`)}
                      </span>
                    </div>
                    <small>
                      {format("dungeon.runMeta", {
                        seed: String(latestRun.seed),
                        waves: plural("dungeon.waves", latestRun.waves.length),
                      })}
                    </small>
                    <span
                      className={
                        replayVerification?.ok
                          ? "replay-badge replay-ok"
                          : "replay-badge replay-mismatch"
                      }
                    >
                      {replayVerification?.ok
                        ? t("dungeon.replayVerified")
                        : t("dungeon.replayMismatch")}
                    </span>

                    <div className="idle-rewards">
                      <div>
                        <span className="section-kicker">{t("dungeon.idleRewards")}</span>
                        <strong>{plural("dungeon.cycles", latestRun.pendingCycles)}</strong>
                        <small>
                          {list([
                            format("reward.gold", { gold: latestRun.pendingGold }),
                            format("reward.expPerHero", { exp: latestRun.pendingExpPerHero }),
                          ])}
                        </small>
                        {latestRun.pendingMaterials.length ? (
                          <small className="pending-loot">
                            {format("common.labelValue", {
                              label: t("dungeon.pendingLoot"),
                              value: list(latestRun.pendingMaterials.map(materialQty)),
                            })}
                          </small>
                        ) : null}
                        {(() => {
                          const expected = expectedPerCycle(latestRun);
                          return expected ? (
                            <small className="expected-rewards">
                              {format("dungeon.expectedPerCycle", {
                                rewards: list([
                                  format("reward.gold", { gold: expected.gold }),
                                  format("reward.exp", { exp: expected.exp }),
                                  format("reward.bossWin", { percent: expected.bossWinPercent }),
                                ]),
                              })}
                            </small>
                          ) : null;
                        })()}
                        <small>
                          {format("dungeon.completedCycles", { count: latestRun.completedCycles })}
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
                        {t("dungeon.claim")}
                      </button>
                    </div>

                    <div className="wave-grid">
                      {latestRun.waves.map((wave) => {
                        const replayWave = replayVerification?.waves.find(
                          (entry) => entry.wave === wave.wave,
                        );

                        return (
                          <div className="wave-card" key={wave.wave}>
                            <span>{format("dungeon.waveTitle", { wave: wave.wave })}</span>
                            <strong>{t(`wave.result.${wave.result}`)}</strong>
                            <small>
                              {format("dungeon.waveMeta", {
                                turns: plural("dungeon.turns", wave.turns),
                                hash: wave.hash,
                              })}
                            </small>
                            <small>
                              {replayWave?.matches
                                ? t("dungeon.hashMatch")
                                : t("dungeon.hashMismatch")}
                            </small>
                            <small>
                              {list([
                                format("reward.gold", { gold: wave.rewardGold }),
                                format("reward.exp", { exp: wave.rewardExp }),
                              ])}
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
      ) : activeTab === "forge" ? (
        <section className="stack forge-stack">
          <section className="card">
            <span className="section-kicker">{t("equipment.title")}</span>
            <h2>{t("equipment.subtitle")}</h2>
            <p>{t("equipment.help")}</p>
            <ul className="hall-stats forge-summary" data-testid="forge-summary">
              <li>
                {formatNodes("common.labelValue", {
                  label: t("building.forge"),
                  value: (
                    <strong>
                      {formatNodes("common.level", {
                        level: <span data-testid="forge-tab-level">{player?.forgeLevel ?? 1}</span>,
                      })}
                    </strong>
                  ),
                })}
              </li>
              <li>
                {formatNodes("common.labelValue", {
                  label: t("forge.enhanceCap"),
                  value: (
                    <strong data-testid="forge-tab-enhance-cap">
                      {enhanceCapLabel(forgeEnhanceCap, locale)}
                    </strong>
                  ),
                })}
              </li>
              {dustMaterialId ? (
                <li data-material-id={dustMaterialId}>
                  {formatNodes("common.labelValue", {
                    label: materialName(dustMaterialId),
                    value: (
                      <strong data-testid="forge-dust-balance">
                        {format("common.quantity", { qty: dustBalance })}
                      </strong>
                    ),
                  })}
                </li>
              ) : null}
              <li>
                {formatNodes("common.labelValue", {
                  label: t("dungeon.playerGold"),
                  value: <strong data-testid="forge-gold">{number(player?.gold ?? 0)}</strong>,
                })}
              </li>
            </ul>
            {player?.construction?.building === "forge" ? (
              <ConstructionNote construction={player.construction} clockOffsetMs={clockOffsetMs} />
            ) : null}
          </section>

          <section className="card auto-sell-card">
            <div className="auto-sell-heading">
              <div>
                <span className="section-kicker">{t("autosell.title")}</span>
                <strong>{t("autosell.subtitle")}</strong>
              </div>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={autoSell.enabled}
                  disabled={busy}
                  onChange={(event) =>
                    void sendCommand({
                      type: "set_auto_sell",
                      enabled: event.target.checked,
                      maxQualityBps: autoSell.maxQualityBps,
                    })
                  }
                />
                <span>{autoSell.enabled ? t("autosell.on") : t("autosell.off")}</span>
              </label>
            </div>
            <label className="auto-sell-threshold">
              <span>{t("autosell.threshold")}</span>
              <select
                aria-label={t("autosell.threshold")}
                value={autoSell.maxQualityBps}
                disabled={busy}
                onChange={(event) =>
                  void sendCommand({
                    type: "set_auto_sell",
                    enabled: autoSell.enabled,
                    maxQualityBps: Number(event.target.value),
                  })
                }
              >
                {catalog?.equipment.qualityTiers.map((tier) => (
                  <option key={tier.id} value={tier.multiplierBps}>
                    {format("autosell.option", {
                      name: name(tier),
                      percent: formatBps(tier.multiplierBps, locale),
                    })}
                  </option>
                ))}
              </select>
            </label>
            <small>{t("autosell.help")}</small>
          </section>

          <section className="card">
            <span className="section-kicker">{t("craft.title")}</span>
            <div className="craft-grid">
              {catalog?.items.map((spec) => {
                const canCraft = spec.recipe.every(
                  (ingredient) =>
                    (promotion.materials.find((entry) => entry.materialId === ingredient.materialId)
                      ?.qty ?? 0) >= ingredient.qty,
                );
                return (
                  <div className="craft-row" data-item-id={spec.id} key={spec.id}>
                    <span>
                      <strong>{name(spec)}</strong>
                      <small>{list(spec.recipe.map(materialQty))}</small>
                    </span>
                    <button
                      type="button"
                      disabled={busy || !canCraft}
                      onClick={() =>
                        void sendCommand({
                          type: "craft_item",
                          itemId: spec.id,
                        })
                      }
                    >
                      {t("craft.craft")}
                    </button>
                  </div>
                );
              })}
            </div>
            {catalog ? (
              <small data-testid="craft-odds">
                {format("forge.craftOddsAtLevel", {
                  level: player?.forgeLevel ?? 1,
                  odds: oddsLabel(
                    catalog.equipment.qualityTiers,
                    forgeInfo?.qualityWeightsBps,
                    locale,
                  ),
                })}
              </small>
            ) : null}
          </section>

          {inventoryItems.length ? (
            inventoryItems.map((item) => {
              const spec = catalog?.items.find((entry) => entry.id === item.itemId);
              const equippedHero = heroes.find((hero) => hero.id === item.equippedHeroId);
              const defaultTarget = equipTargets[item.id] ?? heroes[0]?.id ?? "";
              const sellValue = spec ? Math.floor((spec.sellGold * item.qualityBps) / 10_000) : 0;
              const enhanceBonusBps = catalog?.equipment.enhanceBonusBps[item.enhanceLevel] ?? 0;
              const effectiveAttack = spec
                ? Math.floor(
                    (spec.attack * item.qualityBps * (10_000 + enhanceBonusBps)) / 100_000_000,
                  )
                : 0;
              const effectiveDefense = spec
                ? Math.floor(
                    (spec.defense * item.qualityBps * (10_000 + enhanceBonusBps)) / 100_000_000,
                  )
                : 0;
              const nextEnhanceCost = catalog?.equipment.enhanceGoldCosts[item.enhanceLevel];
              const nextEnhanceDust = catalog?.equipment.enhanceDustCosts[item.enhanceLevel];
              const maxEnhanceLevel = catalog?.equipment.enhanceGoldCosts.length ?? 0;
              const enhanceBlocked = enhanceBlock({
                enhanceLevel: item.enhanceLevel,
                maxEnhanceLevel,
                forgeCap: forgeEnhanceCap,
                goldCost: nextEnhanceCost,
                dustCost: nextEnhanceDust,
                gold: player?.gold ?? 0,
                dust: dustBalance,
              });
              const forgeLevelNeeded = forgeLevelForEnhance(
                catalog?.forge ?? [],
                item.enhanceLevel,
              );
              const dismantleDust = dismantleDustFor(
                item.qualityBps,
                catalog?.equipment.qualityTiers ?? [],
              );
              const itemName = catalogName("items", item.itemId);
              const cannotDestroy = item.locked || Boolean(item.equippedHeroId);
              const baseSuccess = catalog?.equipment.enhanceSuccessBps[item.enhanceLevel];
              const currentSuccess =
                baseSuccess === undefined
                  ? undefined
                  : Math.min(
                      10_000,
                      baseSuccess +
                        item.enhancePityFailures * (catalog?.equipment.enhancePityStepBps ?? 0),
                    );

              return (
                <article
                  className="card equipment-card"
                  data-item-id={item.itemId}
                  data-instance-id={item.id}
                  key={item.id}
                >
                  <div className="equipment-heading">
                    <div>
                      <span className="equipment-slot">{t(`slot.${item.slot}`)}</span>
                      <strong>{itemName}</strong>
                      <small>
                        {format("equipment.stats", {
                          attack: effectiveAttack,
                          defense: effectiveDefense,
                          quality: formatBps(item.qualityBps, locale),
                          enhance: item.enhanceLevel,
                        })}
                      </small>
                    </div>
                    <button
                      type="button"
                      className={item.locked ? "lock-button locked" : "lock-button"}
                      disabled={busy}
                      onClick={() =>
                        void sendCommand({
                          type: "set_item_locked",
                          itemInstanceId: item.id,
                          locked: !item.locked,
                        })
                      }
                    >
                      {item.locked ? t("equipment.unlock") : t("equipment.lock")}
                    </button>
                  </div>

                  {equippedHero ? (
                    <div className="equipment-equipped">
                      <span>
                        {formatNodes("common.labelValue", {
                          label: t("equipment.equippedBy"),
                          value: <strong>{catalogName("classes", equippedHero.classId)}</strong>,
                        })}
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void sendCommand({
                            type: "unequip_item",
                            itemInstanceId: item.id,
                          })
                        }
                      >
                        {t("equipment.unequip")}
                      </button>
                    </div>
                  ) : heroes.length ? (
                    <div className="equipment-actions">
                      <select
                        aria-label={format("equipment.selectHeroFor", { item: itemName })}
                        value={defaultTarget}
                        onChange={(event) =>
                          setEquipTargets((current) => ({
                            ...current,
                            [item.id]: event.target.value,
                          }))
                        }
                      >
                        {heroes.map((hero) => (
                          <option key={hero.id} value={hero.id}>
                            {format("hero.option", {
                              name: catalogName("classes", hero.classId),
                              level: hero.level,
                            })}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={busy || !defaultTarget}
                        onClick={() =>
                          void sendCommand({
                            type: "equip_item",
                            itemInstanceId: item.id,
                            heroId: defaultTarget,
                          })
                        }
                      >
                        {t("equipment.equip")}
                      </button>
                    </div>
                  ) : (
                    <small>{t("equipment.needHero")}</small>
                  )}

                  <div className="enhance-actions">
                    <span>
                      <span data-testid="enhance-cost">
                        {enhanceBlocked !== "max_level" &&
                        nextEnhanceCost !== undefined &&
                        currentSuccess !== undefined
                          ? format("enhance.nextCost", {
                              gold: nextEnhanceCost,
                              dust: nextEnhanceDust ?? 0,
                              material: materialName(dustMaterialId),
                              chance: formatBps(currentSuccess, locale),
                            })
                          : format("enhance.max", { level: maxEnhanceLevel })}
                      </span>
                      {enhanceBlocked && enhanceBlocked !== "max_level" ? (
                        <small className="disabled-reason" data-testid="enhance-reason">
                          {enhanceBlocked === "forge"
                            ? forgeLevelNeeded === null
                              ? t("enhance.blocked.forgeUnknown")
                              : format("enhance.blocked.forge", { level: forgeLevelNeeded })
                            : enhanceBlocked === "dust"
                              ? format("enhance.blocked.dust", {
                                  material: materialName(dustMaterialId),
                                  owned: dustBalance,
                                  needed: nextEnhanceDust ?? 0,
                                })
                              : t("enhance.blocked.gold")}
                        </small>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      data-testid="enhance-item"
                      disabled={busy || enhanceBlocked !== null}
                      onClick={() =>
                        void sendCommand({
                          type: "enhance_item",
                          itemInstanceId: item.id,
                        })
                      }
                    >
                      {t("enhance.action")}
                    </button>
                  </div>

                  <div className="equipment-footer">
                    <span>{format("equipment.sellValue", { gold: sellValue })}</span>
                    <div className="equipment-footer-actions">
                      <button
                        type="button"
                        className="danger-button"
                        data-testid="dismantle-item"
                        disabled={busy || cannotDestroy}
                        onClick={() =>
                          void sendCommand({
                            type: "dismantle_item",
                            itemInstanceId: item.id,
                          })
                        }
                      >
                        {format("equipment.dismantle", {
                          dust: dismantleDust,
                          material: materialName(dustMaterialId),
                        })}
                      </button>
                      <button
                        type="button"
                        className="danger-button"
                        data-testid="sell-item"
                        disabled={busy || cannotDestroy}
                        onClick={() =>
                          void sendCommand({
                            type: "sell_item",
                            itemInstanceId: item.id,
                          })
                        }
                      >
                        {t("equipment.sell")}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          ) : (
            <section className="card empty-state">
              <strong>{t("equipment.empty")}</strong>
              <p>{t("equipment.emptyHint")}</p>
            </section>
          )}
        </section>
      ) : activeTab === "guild" ? (
        player && catalog ? (
          <BuildingsCard
            gold={player.gold}
            hallLevel={player.hallLevel}
            forgeLevel={player.forgeLevel}
            construction={player.construction}
            clockOffsetMs={clockOffsetMs}
            hall={catalog.hall}
            forge={catalog.forge}
            rules={catalog.buildings}
            qualityTiers={catalog.equipment.qualityTiers}
            ownedMaterial={ownedMaterial}
            materialName={materialName}
            busy={busy}
            onUpgrade={(building) => void sendCommand({ type: "upgrade_building", building })}
            onSpeedUp={(items) => void sendCommand({ type: "speed_up_construction", items })}
          />
        ) : (
          <section className="card empty-state">
            <strong>{t("common.working")}</strong>
          </section>
        )
      ) : (
        <section className="card empty-state">
          <strong>{t(`nav.${activeTab}`)}</strong>
          <p>{t("app.nextMilestone")}</p>
        </section>
      )}

      <nav className="tabs" aria-label={t("nav.main")}>
        {tabs.map((tab) => (
          <button
            className={tab === activeTab ? "active" : ""}
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
          >
            {t(`nav.${tab}`)}
          </button>
        ))}
      </nav>
    </main>
  );
}
