#!/usr/bin/env bash
set -euo pipefail
git clone https://example.com/repo.git /tmp/min-skill || true
npm link
