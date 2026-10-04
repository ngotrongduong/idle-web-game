import { useEffect, useState } from "react";
import { t } from "@idle/i18n";
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
  const remainingMs = remainingBuildMs(construction, useServerNow(props.clockOffsetMs));
  return (
    <small className="construction-note" data-testid="construction-note">
      {t("vi", "buildings.upgrading")}: {t("vi", `building.${construction.building}`)} →{" "}
      {t("vi", "guild.level")} {construction.targetLevel} ·{" "}
      {remainingMs > 0
        ? `${t("vi", "buildings.remaining")} ${formatDuration(remainingMs / 1_000)}`
        : t("vi", "buildings.finishing")}
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
  const serverNow = useServerNow(props.clockOffsetMs);
  const remainingMs = remainingBuildMs(construction, serverNow);
  const percent = Math.round(constructionProgress(construction, serverNow) * 100);
  // At zero the app is already asking the server for the finished level.
  const finishing = remainingMs === 0;
  const needed = rules ? speedUpItemsNeeded(remainingMs, rules.speedUpSecondsPerItem) : 0;
  const usable = Math.min(needed, speedUpOwned, MAX_SPEED_UP_ITEMS);

  return (
    <div
      className="construction-panel"
      data-testid="construction-panel"
      data-building={construction.building}
    >
      <strong data-testid="construction-target">
        {t("vi", "buildings.upgrading")}: {t("vi", `building.${construction.building}`)} →{" "}
        {t("vi", "guild.level")} {construction.targetLevel}
      </strong>
      <div className="construction-time">
        <span>{t("vi", "buildings.remaining")}</span>
        <strong data-testid="construction-countdown">
          {finishing ? t("vi", "buildings.finishing") : formatDuration(remainingMs / 1_000)}
        </strong>
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-label={t("vi", "buildings.progress")}
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
            {props.speedUpName} ×{speedUpOwned} · {t("vi", "buildings.speedUpEach")}{" "}
            {formatDuration(rules.speedUpSecondsPerItem)}
          </small>
          <div className="speed-up-actions">
            <button
              type="button"
              data-testid="speed-up-one"
              disabled={busy || finishing || speedUpOwned < 1}
              onClick={() => props.onSpeedUp(1)}
            >
              {t("vi", "buildings.speedUpOne")}
            </button>
            <button
              type="button"
              data-testid="speed-up-all"
              disabled={busy || finishing || usable < 1}
              onClick={() => props.onSpeedUp(usable)}
            >
              {speedUpOwned > 0 && speedUpOwned < needed
                ? t("vi", "buildings.speedUpAll")
                : t("vi", "buildings.speedUpNeeded")}
              {needed > 0 ? ` (×${usable > 0 ? usable : needed})` : ""}
            </button>
          </div>
          {speedUpOwned < 1 ? (
            <small className="disabled-reason" data-testid="speed-up-reason">
              {t("vi", "buildings.speedUpEmpty")}
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
        {t("vi", "buildings.blocked.max_level")}
      </p>
    );
  }

  return (
    <>
      <ul className="cost-list" data-testid={`upgrade-${building}-cost`}>
        <li className={gold >= goldCost ? undefined : "unmet"}>
          <span>{t("vi", "dungeon.playerGold")}</span>
          <strong>{goldCost}</strong>
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
              <strong>
                {owned}/{entry.qty}
              </strong>
            </li>
          );
        })}
        <li>
          <span>{t("vi", "buildings.buildTime")}</span>
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
        {t("vi", "buildings.upgrade")} {t("vi", `building.${building}`)} ({goldCost}{" "}
        {t("vi", "common.gold")} · {formatDuration(buildSeconds)})
      </button>
      {block ? (
        <small className="disabled-reason" data-testid={`upgrade-${building}-reason`}>
          {t("vi", `buildings.blocked.${block}`)}
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
  const hallInfo = props.hall.find((entry) => entry.level === props.hallLevel);
  const nextHall = props.hall.find((entry) => entry.level === props.hallLevel + 1);
  const forgeInfo = props.forge.find((entry) => entry.level === props.forgeLevel);
  const nextForge = props.forge.find((entry) => entry.level === props.forgeLevel + 1);
  const nextTeamLevel = props.hall.find(
    (entry) => entry.level > props.hallLevel && entry.teamLimit > (hallInfo?.teamLimit ?? 1),
  );
  const builderBusy = construction !== null;

  return (
    <section className="stack">
      <section className="card builder-card" data-testid="builder-card">
        <div className="builder-heading">
          <span className="section-kicker">{t("vi", "buildings.builder")}</span>
          <strong className="player-gold">
            {t("vi", "dungeon.playerGold")}: <span data-testid="guild-gold">{gold}</span>
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
          <p data-testid="builder-idle">{t("vi", "buildings.builderIdle")}</p>
        )}
      </section>

      <section className="card building-card" data-testid="building-hall">
        <span className="section-kicker">{t("vi", "building.hall")}</span>
        <h2>
          {t("vi", "guild.level")} <span data-testid="hall-level">{props.hallLevel}</span>
        </h2>
        <ul className="hall-stats">
          <li>
            {t("vi", "guild.heroCapacity")}:{" "}
            <strong data-testid="hall-hero-capacity">{hallInfo?.heroCapacity ?? 0}</strong>
          </li>
          <li>
            {t("vi", "guild.teamLimit")}:{" "}
            <strong data-testid="hall-team-limit">{hallInfo?.teamLimit ?? 1}</strong>
          </li>
        </ul>
        {nextHall && hallInfo ? (
          <div className="building-next" data-testid="hall-next">
            <span className="section-kicker">
              {t("vi", "buildings.nextLevel")} ({nextHall.level})
            </span>
            <small>
              {t("vi", "guild.heroCapacity")}: {hallInfo.heroCapacity} → {nextHall.heroCapacity}
            </small>
            <small>
              {t("vi", "guild.teamLimit")}: {hallInfo.teamLimit} → {nextHall.teamLimit}
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
          <small>
            {t("vi", "guild.nextTeamAt")} {nextTeamLevel.level}
          </small>
        ) : null}
      </section>

      <section className="card building-card" data-testid="building-forge">
        <span className="section-kicker">{t("vi", "building.forge")}</span>
        <h2>
          {t("vi", "guild.level")} <span data-testid="forge-level">{props.forgeLevel}</span>
        </h2>
        <ul className="hall-stats">
          <li>
            {t("vi", "forge.enhanceCap")}:{" "}
            <strong data-testid="forge-enhance-cap">
              {enhanceCapLabel(forgeInfo?.maxEnhanceLevel ?? 0)}
            </strong>
          </li>
          <li>
            {t("vi", "forge.craftOdds")}:{" "}
            <strong data-testid="forge-odds">
              {oddsLabel(props.qualityTiers, forgeInfo?.qualityWeightsBps)}
            </strong>
          </li>
        </ul>
        {nextForge ? (
          <div className="building-next" data-testid="forge-next">
            <span className="section-kicker">
              {t("vi", "buildings.nextLevel")} ({nextForge.level})
            </span>
            <small>
              {t("vi", "forge.enhanceCap")}: {enhanceCapLabel(forgeInfo?.maxEnhanceLevel ?? 0)} →{" "}
              {enhanceCapLabel(nextForge.maxEnhanceLevel)}
            </small>
            <small>
              {t("vi", "forge.craftOdds")}:{" "}
              {oddsLabel(props.qualityTiers, nextForge.qualityWeightsBps)}
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
