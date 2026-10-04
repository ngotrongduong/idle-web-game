import { useEffect, useState } from "react";
import {
  constructionProgress,
  enhanceCapLabel,
  formatDuration,
  oddsLabel,
  remainingBuildMs,
  speedUpItemsNeeded,
  upgradeBlock,
  type BuildingId,
  type BuildingRules,
  type Construction,
  type ForgeLevel,
  type HallLevel,
  type MaterialCost,
  type QualityTier,
} from "./buildings";
import { useLocale } from "./locale";

/** The contract caps `speed_up_construction.items`; the server never uses more than it needs. */
const MAX_SPEED_UP_ITEMS = 1_000;

/**
 * Server time, re-read twice a second. `offsetMs` is server clock minus device clock, so the
 * countdown stays right on a device whose clock is wrong.
 */
function useServerNow(offsetMs: number): number {
  const [localNow, setLocalNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setLocalNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, []);
  return localNow + offsetMs;
}

/** One line for screens other than the Guild tab: what is being built and how long is left. */
export function ConstructionNote(props: { construction: Construction; clockOffsetMs: number }) {
  const { construction } = props;
  const { t, format } = useLocale();
  const remainingMs = remainingBuildMs(construction, useServerNow(props.clockOffsetMs));
  const target = format("buildings.upgradingTo", {
    building: t(`building.${construction.building}`),
    level: construction.targetLevel,
  });
  return (
    <small className="construction-note" data-testid="construction-note">
      {remainingMs > 0
        ? format("buildings.noteRemaining", {
            target,
            time: formatDuration(remainingMs / 1_000),
          })
        : format("buildings.noteFinishing", { target })}
    </small>
  );
}

function ConstructionPanel(props: {
  construction: Construction;
  clockOffsetMs: number;
  rules: BuildingRules | null;
  speedUpOwned: number;
  speedUpName: string;
  busy: boolean;
  onSpeedUp: (items: number) => void;
}) {
  const { construction, rules, speedUpOwned, busy } = props;
  const { t, format } = useLocale();
  const serverNow = useServerNow(props.clockOffsetMs);
  const remainingMs = remainingBuildMs(construction, serverNow);
  const percent = Math.round(constructionProgress(construction, serverNow) * 100);
  // At zero the app is already asking the server for the finished level.
  const finishing = remainingMs === 0;
  const needed = rules ? speedUpItemsNeeded(remainingMs, rules.speedUpSecondsPerItem) : 0;
  const usable = Math.min(needed, speedUpOwned, MAX_SPEED_UP_ITEMS);
  const useAllLabel =
    speedUpOwned > 0 && speedUpOwned < needed
      ? t("buildings.speedUpAll")
      : t("buildings.speedUpNeeded");

  return (
    <div
      className="construction-panel"
      data-testid="construction-panel"
      data-building={construction.building}
    >
      <strong data-testid="construction-target">
        {format("buildings.upgradingTo", {
          building: t(`building.${construction.building}`),
          level: construction.targetLevel,
        })}
      </strong>
      <div className="construction-time">
        <span>{t("buildings.remaining")}</span>
        <strong data-testid="construction-countdown">
          {finishing ? t("buildings.finishing") : formatDuration(remainingMs / 1_000)}
        </strong>
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-label={t("buildings.progress")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        data-testid="construction-progress"
      >
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
      {rules ? (
        <div className="speed-up">
          <small data-testid="speed-up-owned" data-material-id={rules.speedUpMaterialId}>
            {format("buildings.speedUpOwned", {
              name: props.speedUpName,
              owned: speedUpOwned,
              duration: formatDuration(rules.speedUpSecondsPerItem),
            })}
          </small>
          <div className="speed-up-actions">
            <button
              type="button"
              data-testid="speed-up-one"
              disabled={busy || finishing || speedUpOwned < 1}
              onClick={() => props.onSpeedUp(1)}
            >
              {t("buildings.speedUpOne")}
            </button>
            <button
              type="button"
              data-testid="speed-up-all"
              disabled={busy || finishing || usable < 1}
              onClick={() => props.onSpeedUp(usable)}
            >
              {needed > 0
                ? format("common.withCount", {
                    label: useAllLabel,
                    count: usable > 0 ? usable : needed,
                  })
                : useAllLabel}
            </button>
          </div>
          {speedUpOwned < 1 ? (
            <small className="disabled-reason" data-testid="speed-up-reason">
              {t("buildings.speedUpEmpty")}
            </small>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function UpgradePanel(props: {
  building: BuildingId;
  goldCost: number | null;
  buildSeconds: number | null;
  materials: readonly MaterialCost[];
  gold: number;
  ownedMaterial: (materialId: string) => number;
  materialName: (materialId: string) => string;
  builderBusy: boolean;
  busy: boolean;
  onUpgrade: (building: BuildingId) => void;
}) {
  const { building, goldCost, buildSeconds, materials, gold, ownedMaterial } = props;
  const { t, format, number } = useLocale();
  const block = upgradeBlock({
    goldCost,
    materials,
    gold,
    owned: ownedMaterial,
    builderBusy: props.builderBusy,
  });

  if (goldCost === null || buildSeconds === null) {
    return (
      <p className="disabled-reason" data-testid={`upgrade-${building}-reason`}>
        {t("buildings.blocked.max_level")}
      </p>
    );
  }

  return (
    <>
      <ul className="cost-list" data-testid={`upgrade-${building}-cost`}>
        <li className={gold >= goldCost ? undefined : "unmet"}>
          <span>{t("dungeon.playerGold")}</span>
          <strong>{number(goldCost)}</strong>
        </li>
        {materials.map((entry) => {
          const owned = ownedMaterial(entry.materialId);
          return (
            <li
              className={owned >= entry.qty ? undefined : "unmet"}
              data-material-id={entry.materialId}
              key={entry.materialId}
            >
              <span>{props.materialName(entry.materialId)}</span>
              <strong>{format("common.ratio", { current: owned, max: entry.qty })}</strong>
            </li>
          );
        })}
        <li>
          <span>{t("buildings.buildTime")}</span>
          <strong>{formatDuration(buildSeconds)}</strong>
        </li>
      </ul>
      <button
        className="primary-button"
        type="button"
        data-testid={`upgrade-${building}`}
        disabled={props.busy || block !== null}
        onClick={() => props.onUpgrade(building)}
      >
        {format("buildings.upgradeAction", {
          building: t(`building.${building}`),
          gold: goldCost,
          time: formatDuration(buildSeconds),
        })}
      </button>
      {block ? (
        <small className="disabled-reason" data-testid={`upgrade-${building}-reason`}>
          {t(`buildings.blocked.${block}`)}
        </small>
      ) : null}
    </>
  );
}

export type BuildingsCardProps = {
  gold: number;
  hallLevel: number;
  forgeLevel: number;
  construction: Construction | null;
  clockOffsetMs: number;
  hall: readonly HallLevel[];
  forge: readonly ForgeLevel[];
  rules: BuildingRules | null;
  qualityTiers: readonly QualityTier[];
  ownedMaterial: (materialId: string) => number;
  materialName: (materialId: string) => string;
  busy: boolean;
  onUpgrade: (building: BuildingId) => void;
  onSpeedUp: (items: number) => void;
};

/** Guild tab: the builder's current job, then one card per building with its next upgrade. */
export function BuildingsCard(props: BuildingsCardProps) {
  const { construction, rules, gold, ownedMaterial, materialName, busy } = props;
  const { locale, t, format, formatNodes, number } = useLocale();
  const hallInfo = props.hall.find((entry) => entry.level === props.hallLevel);
  const nextHall = props.hall.find((entry) => entry.level === props.hallLevel + 1);
  const forgeInfo = props.forge.find((entry) => entry.level === props.forgeLevel);
  const nextForge = props.forge.find((entry) => entry.level === props.forgeLevel + 1);
  const nextTeamLevel = props.hall.find(
    (entry) => entry.level > props.hallLevel && entry.teamLimit > (hallInfo?.teamLimit ?? 1),
  );
  const builderBusy = construction !== null;
  const forgeCap = forgeInfo?.maxEnhanceLevel ?? 0;

  return (
    <section className="stack">
      <section className="card builder-card" data-testid="builder-card">
        <div className="builder-heading">
          <span className="section-kicker">{t("buildings.builder")}</span>
          <strong className="player-gold">
            {formatNodes("common.labelValue", {
              label: t("dungeon.playerGold"),
              value: <span data-testid="guild-gold">{number(gold)}</span>,
            })}
          </strong>
        </div>
        {construction ? (
          <ConstructionPanel
            construction={construction}
            clockOffsetMs={props.clockOffsetMs}
            rules={rules}
            speedUpOwned={rules ? ownedMaterial(rules.speedUpMaterialId) : 0}
            speedUpName={rules ? materialName(rules.speedUpMaterialId) : ""}
            busy={busy}
            onSpeedUp={props.onSpeedUp}
          />
        ) : (
          <p data-testid="builder-idle">{t("buildings.builderIdle")}</p>
        )}
      </section>

      <section className="card building-card" data-testid="building-hall">
        <span className="section-kicker">{t("building.hall")}</span>
        <h2>
          {formatNodes("common.level", {
            level: <span data-testid="hall-level">{props.hallLevel}</span>,
          })}
        </h2>
        <ul className="hall-stats">
          <li>
            {formatNodes("common.labelValue", {
              label: t("guild.heroCapacity"),
              value: (
                <strong data-testid="hall-hero-capacity">
                  {number(hallInfo?.heroCapacity ?? 0)}
                </strong>
              ),
            })}
          </li>
          <li>
            {formatNodes("common.labelValue", {
              label: t("guild.teamLimit"),
              value: (
                <strong data-testid="hall-team-limit">{number(hallInfo?.teamLimit ?? 1)}</strong>
              ),
            })}
          </li>
        </ul>
        {nextHall && hallInfo ? (
          <div className="building-next" data-testid="hall-next">
            <span className="section-kicker">
              {format("buildings.nextLevel", { level: nextHall.level })}
            </span>
            <small>
              {format("common.change", {
                label: t("guild.heroCapacity"),
                from: hallInfo.heroCapacity,
                to: nextHall.heroCapacity,
              })}
            </small>
            <small>
              {format("common.change", {
                label: t("guild.teamLimit"),
                from: hallInfo.teamLimit,
                to: nextHall.teamLimit,
              })}
            </small>
          </div>
        ) : null}
        <UpgradePanel
          building="hall"
          goldCost={hallInfo?.upgradeGoldCost ?? null}
          buildSeconds={hallInfo?.buildSeconds ?? null}
          materials={hallInfo?.upgradeMaterials ?? []}
          gold={gold}
          ownedMaterial={ownedMaterial}
          materialName={materialName}
          builderBusy={builderBusy}
          busy={busy}
          onUpgrade={props.onUpgrade}
        />
        {nextTeamLevel ? (
          <small>{format("guild.nextTeamAt", { level: nextTeamLevel.level })}</small>
        ) : null}
      </section>

      <section className="card building-card" data-testid="building-forge">
        <span className="section-kicker">{t("building.forge")}</span>
        <h2>
          {formatNodes("common.level", {
            level: <span data-testid="forge-level">{props.forgeLevel}</span>,
          })}
        </h2>
        <ul className="hall-stats">
          <li>
            {formatNodes("common.labelValue", {
              label: t("forge.enhanceCap"),
              value: (
                <strong data-testid="forge-enhance-cap">{enhanceCapLabel(forgeCap, locale)}</strong>
              ),
            })}
          </li>
          <li>
            {formatNodes("common.labelValue", {
              label: t("forge.craftOdds"),
              value: (
                <strong data-testid="forge-odds">
                  {oddsLabel(props.qualityTiers, forgeInfo?.qualityWeightsBps, locale)}
                </strong>
              ),
            })}
          </li>
        </ul>
        {nextForge ? (
          <div className="building-next" data-testid="forge-next">
            <span className="section-kicker">
              {format("buildings.nextLevel", { level: nextForge.level })}
            </span>
            <small>
              {format("common.change", {
                label: t("forge.enhanceCap"),
                from: enhanceCapLabel(forgeCap, locale),
                to: enhanceCapLabel(nextForge.maxEnhanceLevel, locale),
              })}
            </small>
            <small>
              {format("common.labelValue", {
                label: t("forge.craftOdds"),
                value: oddsLabel(props.qualityTiers, nextForge.qualityWeightsBps, locale),
              })}
            </small>
          </div>
        ) : null}
        <UpgradePanel
          building="forge"
          goldCost={forgeInfo?.upgradeGoldCost ?? null}
          buildSeconds={forgeInfo?.buildSeconds ?? null}
          materials={forgeInfo?.upgradeMaterials ?? []}
          gold={gold}
          ownedMaterial={ownedMaterial}
          materialName={materialName}
          builderBusy={builderBusy}
          busy={busy}
          onUpgrade={props.onUpgrade}
        />
      </section>
    </section>
  );
}
