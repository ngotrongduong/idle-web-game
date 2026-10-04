import { LOCALES, t as translate } from "@idle/i18n";
import { useLocale } from "./locale";

/**
 * Two-way language switch for the app header. Each option is written in its own language, whatever
 * the current one is, so a player who cannot read the page can still find theirs.
 */
export function LanguageSwitch() {
  const { locale, setLocale, t } = useLocale();

  return (
    <div
      className="locale-switch"
      role="group"
      aria-label={t("locale.label")}
      data-testid="locale-switch"
    >
      {LOCALES.map((option) => (
        <button
          key={option}
          type="button"
          lang={option}
          className={option === locale ? "active" : ""}
          aria-pressed={option === locale}
          data-testid={`locale-${option}`}
          onClick={() => setLocale(option)}
        >
          {translate(option, `locale.option.${option}`)}
        </button>
      ))}
    </div>
  );
}
