import { t } from "@idle/i18n";

const tabs = ["guild", "dungeon", "forge", "tavern", "more"] as const;

export function App() {
  return (
    <main className="shell">
      <header className="hero">
        <span className="eyebrow">M0 FOUNDATION</span>
        <h1>{t("vi", "app.title")}</h1>
        <p>{t("vi", "app.subtitle")}</p>
      </header>

      <section className="card">
        <strong>{t("vi", "foundation.ready")}</strong>
        <p>React + Vite client đã được nối vào monorepo. Gameplay sẽ được thêm ở M1.</p>
      </section>

      <nav className="tabs" aria-label="Điều hướng chính">
        {tabs.map((tab) => (
          <button key={tab} type="button">
            {t("vi", `nav.${tab}`)}
          </button>
        ))}
      </nav>
    </main>
  );
}
