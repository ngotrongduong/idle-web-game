import { isPlainKey, type PlainKey } from "@idle/i18n";

/**
 * The message shown for an API error code: `error.<CODE>`, or the generic message for a code the
 * client does not know. The server's own `message` is English text for logs and never shown.
 */
export function errorMessageKey(code: string): PlainKey {
  const key = `error.${code}`;
  return isPlainKey(key) ? key : "error.generic";
}

/**
 * A failure that is shown to the player. It carries a message key, not text, so the notice on the
 * screen follows the language when the player switches while it is visible.
 */
export class NoticeError extends Error {
  readonly key: PlainKey;

  constructor(key: PlainKey) {
    super(key);
    this.name = "NoticeError";
    this.key = key;
  }
}

/** The notice for anything a request can throw: our own notices, a dropped connection, or a bug. */
export function noticeKey(reason: unknown): PlainKey {
  if (reason instanceof NoticeError) return reason.key;
  // `fetch` rejects with a TypeError when the server cannot be reached.
  if (reason instanceof TypeError) return "app.connectError";
  return "error.generic";
}
