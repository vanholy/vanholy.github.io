#!/usr/bin/env bash
# Assembla la pagina unica a partire dai sorgenti.
#   dist/casa-carobbio.html      -> frammento per l'artifact di claude.ai (senza doctype)
#   dist/casa-carobbio-nas.html  -> pagina completa da servire altrove (NAS, hosting statico)
#   ../casa-carobbio/index.html  -> pagina pubblica su GitHub Pages: senza dati, li legge da Supabase dopo l'accesso
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p dist ../casa-carobbio
SHELL_HEAD='<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>'
{ cat head.html body.html; echo '<script>'; cat data.js svg.js app.js app2.js; echo '</script>'; } > dist/casa-carobbio.html
{ echo "$SHELL_HEAD</head><body>"; cat dist/casa-carobbio.html; echo '</body></html>'; } > dist/casa-carobbio-nas.html
PUB=../casa-carobbio/index.html
{ echo "$SHELL_HEAD<title>Casa Carobbio</title><meta name=\"robots\" content=\"noindex,nofollow\">"
  echo '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></script></head><body>'
  cat head.html body.html; echo '<script>'; cat supabase-config.js seed-vuoto.js svg.js app.js app2.js; echo '</script></body></html>'; } > "$PUB.tmp"
node tools/verifica-pubblica.mjs "$PUB.tmp" || { rm -f "$PUB.tmp"; exit 1; }
mv "$PUB.tmp" "$PUB"
echo "ok: dist/casa-carobbio.html, dist/casa-carobbio-nas.html, $PUB"
