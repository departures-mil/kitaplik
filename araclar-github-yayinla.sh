#!/usr/bin/env bash
# GitHub'a yayın: tools/derle.sh <sürüm> <versionCode> çalıştıktan sonra
#   bash araclar-github-yayinla.sh <sürüm> "<notlar>" [web] [masaustu] [android]
set -euo pipefail
SURUM="$1"; NOT="$2"; shift 2; SEC="${*:-web masaustu}"
O="cikti/$SURUM"
for s in $SEC; do
  case $s in web) ch=web;; masaustu) ch=masaustu2;; android) ch=android2;; esac
  rm -f guncelleme/$ch-*.pkg
  cp "$O/$s.pkg" "guncelleme/$ch-$SURUM.pkg"
  node -e 'const fs=require("fs");const [O,s,ch,v,n]=process.argv.slice(1);const m=JSON.parse(fs.readFileSync(`${O}/${s}.json`));
  m.file=`${ch}-${v}.pkg`;m.bytes=fs.statSync(`${O}/${s}.pkg`).size;m.notes=n;m.publishedAt=new Date().toISOString();
  fs.writeFileSync(`guncelleme/${ch}.json`,JSON.stringify(m,null,2))' "$O" "$s" "$ch" "$SURUM" "$NOT"
done
git add -A && git commit -m "Kitaplık $SURUM" && git push
