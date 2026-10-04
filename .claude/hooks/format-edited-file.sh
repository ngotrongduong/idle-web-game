#!/usr/bin/env bash
# PostToolUse hook: formats a file Claude just edited with the repo's Prettier config so
# `pnpm format:check` stays green. Files in .prettierignore are left alone. Never blocks the edit.
project_dir="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"

file=$(node -e '
  let input = "";
  process.stdin.on("data", (chunk) => (input += chunk)).on("end", () => {
    try {
      const file = JSON.parse(input).tool_input?.file_path;
      if (typeof file === "string" && file) process.stdout.write(require("node:path").resolve(file));
    } catch {}
  });
' 2>/dev/null)

case "$file" in
  "$project_dir"/*) ;;
  *) exit 0 ;;
esac
case "$file" in
  *.ts | *.tsx | *.css | *.html | *.json | *.yml | *.yaml | *.mjs) ;;
  *) exit 0 ;;
esac

prettier="$project_dir/node_modules/.bin/prettier"
[ -x "$prettier" ] || exit 0
cd "$project_dir" && "$prettier" --write --log-level silent "$file" >/dev/null 2>&1
exit 0
