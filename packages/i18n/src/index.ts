export type Locale = "vi" | "en";

const messages = {
  vi: {
    "app.title": "Project Guildhall",
    "app.subtitle": "Idle guild-management RPG — nền móng kỹ thuật đang hoạt động.",
    "foundation.ready": "M0.1 đã sẵn sàng",
    "nav.guild": "Hội Quán",
    "nav.dungeon": "Đội & Hầm",
    "nav.forge": "Rèn",
    "nav.tavern": "Tuyển Mộ",
    "nav.more": "Thêm",
  },
  en: {
    "app.title": "Project Guildhall",
    "app.subtitle": "Idle guild-management RPG — technical foundation is running.",
    "foundation.ready": "M0.1 is ready",
    "nav.guild": "Guildhall",
    "nav.dungeon": "Teams & Dungeons",
    "nav.forge": "Forge",
    "nav.tavern": "Tavern",
    "nav.more": "More",
  },
} as const;

type MessageKey = keyof (typeof messages)["vi"];

export function t(locale: Locale, key: MessageKey): string {
  return messages[locale][key];
}
