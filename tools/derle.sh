#!/usr/bin/env bash
# Kitaplık derleme betiği.
#   tools/derle.sh <sürüm> <android-versionCode>
# Çıktılar: cikti/<sürüm>/
#   Kitaplik-<sürüm>.apk          Android uygulaması (imzalı)
#   app.asar                      Masaüstü programı (resources/app.asar yerine konur)
#   web.pkg / masaustu.pkg / android.pkg + .json   Firebase'e yayınlanacak imzalı güncelleme paketleri
set -euo pipefail
SURUM="$1"; KOD="$2"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SDK="${ANDROID_TOOLS:-/home/claude/tools}"
BT="$(ls -d "$SDK"/bt/*/ 2>/dev/null | head -1 || true)"; JAR="$SDK/pf/android-35/android.jar"
OUT="$ROOT/cikti/$SURUM"; B="$ROOT/.derleme"
rm -rf "$B" "$OUT"; mkdir -p "$B" "$OUT"

# 1) Web dosyaları (sürüm numarası işlenir)
mkdir -p "$B/www"
cp "$ROOT"/web/* "$B/www/"
sed -i "s/@SURUM@/$SURUM/g" "$B/www/guncelleme.js"
# 2.12.0: Programa yönetici Gemini anahtarı GÖMÜLMEZ — herkes kendi anahtarını girer (yöneticinin kotası harcanmasın).

# 2) Android APK  (APK_YOK=1 ile atlanır: yalnız web + masaüstü güncellemesi)
if [ -z "${APK_YOK:-}" ]; then
A="$B/android"; mkdir -p "$A/assets" "$A/gen" "$A/classes"
cp -r "$B/www" "$A/assets/www"
sed -e "s/@VERSION_CODE@/$KOD/" -e "s/@VERSION_NAME@/$SURUM/" "$ROOT/android/AndroidManifest.xml" > "$A/AndroidManifest.xml"
"$BT/aapt2" compile --dir "$ROOT/android/res" -o "$A/res.zip"
"$BT/aapt2" link -o "$A/base.apk" -I "$JAR" --manifest "$A/AndroidManifest.xml" -R "$A/res.zip" \
  --java "$A/gen" -A "$A/assets" --min-sdk-version 26 --target-sdk-version 35 --auto-add-overlay
javac -nowarn --release 11 -encoding UTF-8 -classpath "$JAR" -d "$A/classes" \
  $(find "$ROOT/android/src" "$A/gen" -name '*.java') 2>&1 | grep -v '^warning\|^Note:' || true
"$BT/d8" --release --min-api 26 --lib "$JAR" --output "$A" $(find "$A/classes" -name '*.class')
(cd "$A" && cp base.apk unsigned.apk && zip -q -j unsigned.apk classes.dex)
"$BT/zipalign" -f -p 4 "$A/unsigned.apk" "$A/aligned.apk"
PW="$(cat "$ROOT/keys/keystore-parola.txt")"
"$BT/apksigner" sign --ks "$ROOT/keys/kitaplik.keystore" --ks-key-alias kitaplik --ks-pass "pass:$PW" \
  --key-pass "pass:$PW" --out "$OUT/Kitaplik-$SURUM.apk" "$A/aligned.apk"
"$BT/apksigner" verify "$OUT/Kitaplik-$SURUM.apk"
fi

# 3) Masaüstü (app.asar)
D="$B/desktop"; mkdir -p "$D"
cp "$ROOT"/desktop/* "$D/"; cp -r "$B/www" "$D/www"
sed -i "s/@SURUM@/$SURUM/g" "$D/package.json"
(cd "$ROOT/tools" && [ -d node_modules/@electron/asar ] || npm i -s --no-audit --no-fund @electron/asar >/dev/null)
"$ROOT/tools/node_modules/.bin/asar" pack "$D" "$OUT/app.asar"

# 4) İmzalı güncelleme paketleri
node "$ROOT/tools/paketle.js" "$SURUM" "$KOD" "$B/www" "$D" "$OUT/Kitaplik-$SURUM.apk" "$OUT"
echo "Tamam: $OUT"; ls -la "$OUT"
