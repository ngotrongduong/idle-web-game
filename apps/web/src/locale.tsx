import {
  Fragment,
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { templateParts, type Locale, type ParamKey, type ParamNamesOf } from "@idle/i18n";
import { readStoredLocale, storeLocale } from "./locale-storage";
import { createTranslator, type Translator } from "./translator";

type NodeParams<K extends ParamKey> = { [N in ParamNamesOf<K>]: ReactNode };

export type LocaleContextValue = Translator & {
  setLocale(next: Locale): void;
  /**
   * A message with elements in its placeholders, e.g. a number inside a `<span data-testid>`.
   * The word order is the message's, so each language orders its own sentence.
   */
  formatNodes<K extends ParamKey>(key: K, params: NodeParams<K>): ReactNode;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function formatNodes<K extends ParamKey>(locale: Locale, key: K, params: NodeParams<K>): ReactNode {
  const values = params as Readonly<Record<string, ReactNode>>;
  return (
    <>
      {templateParts(locale, key).map((part, index) => {
        if (typeof part === "string") return <Fragment key={index}>{part}</Fragment>;
        if (!(part.param in values)) {
          throw new Error(`Missing parameter "${part.param}" for message "${key}"`);
        }
        return <Fragment key={index}>{values[part.param]}</Fragment>;
      })}
    </>
  );
}

/**
 * Holds the language for the whole app. Changing it re-renders in place: nothing is refetched and
 * no component state is lost, because every string is derived from `locale` at render time.
 */
export function LocaleProvider(props: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => readStoredLocale());

  // Keeps screen readers, hyphenation and spell-checking on the language of the page.
  useLayoutEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    storeLocale(next);
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      ...createTranslator(locale),
      setLocale,
      formatNodes: (key, params) => formatNodes(locale, key, params),
    }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{props.children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocale must be used inside <LocaleProvider>");
  return value;
}
