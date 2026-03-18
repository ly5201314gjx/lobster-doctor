#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/ly5201314gjx/lobster-doctor.git"
OPENCLAW_HOME="${OPENCLAW_HOME:-$HOME/.openclaw}"
SKILLS_DIR="$OPENCLAW_HOME/skills"
TARGET_DIR="$SKILLS_DIR/lobster-doctor"

mkdir -p "$SKILLS_DIR"

if [ -d "$TARGET_DIR/.git" ]; then
  echo "[lobster-doctor] 已存在，执行更新..."
  git -C "$TARGET_DIR" pull --ff-only
else
  echo "[lobster-doctor] 克隆到 $TARGET_DIR"
  git clone "$REPO_URL" "$TARGET_DIR"
fi

cd "$TARGET_DIR"

if command -v npm >/dev/null 2>&1; then
  echo "[lobster-doctor] 执行 npm link"
  npm link
else
  echo "[lobster-doctor] 未找到 npm，无法执行 npm link" >&2
  exit 1
fi

echo "[lobster-doctor] 安装完成"
echo "[lobster-doctor] 试试：lobster-doctor all"
