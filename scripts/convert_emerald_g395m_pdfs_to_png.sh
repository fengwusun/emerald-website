#!/bin/sh
set -eu

MEDIA_DIR="${1:-/Users/sunfengwu/jwst_cycle4/emerald_cy4/media/emerald_msa_ptg-2026/emerald_grating_plots}"
MAX_SIZE="${MAX_SIZE:-2200}"

if ! command -v qlmanage >/dev/null 2>&1; then
  echo "qlmanage not found"
  exit 1
fi

if [ ! -d "$MEDIA_DIR" ]; then
  echo "missing directory: $MEDIA_DIR"
  exit 1
fi

count=0
for pdf in "$MEDIA_DIR"/*.pdf; do
  [ -e "$pdf" ] || continue
  png="${pdf%.pdf}.png"
  if [ -f "$png" ]; then
    continue
  fi

  tmpdir="$(mktemp -d /tmp/emerald-ql-XXXXXX)"
  base="$(basename "$pdf")"

  qlmanage -t -s "$MAX_SIZE" -o "$tmpdir" "$pdf" >/dev/null 2>&1

  rendered="$tmpdir/${base}.png"
  if [ ! -f "$rendered" ]; then
    echo "failed: $pdf"
    rm -rf "$tmpdir"
    continue
  fi

  mv "$rendered" "$png"
  rm -rf "$tmpdir"

  count=$((count + 1))
  if [ $((count % 25)) -eq 0 ]; then
    echo "converted $count PDFs"
  fi
done

echo "done: converted $count PDFs in $MEDIA_DIR"
