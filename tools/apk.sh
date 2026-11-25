#!/usr/bin/env bash
# Kitaplık Android APK (Gradle'sız: aapt2 + javac + d8 + zipalign + apksigner).
#   bash tools/apk.sh                 → cikti/Kitaplik-<sürüm>.apk (sürüm ve versionCode tools/surum.js'ten)
# Android SDK: $ANDROID_TOOLS (bt/<sürüm>/, pf/android-35/) ya da $ANDROID_HOME / $ANDROID_SDK_ROOT (build-tools/, platforms/).
# İmza (sırayla): ANDROID_KEYSTORE (dosya yolu) + ANDROID_KEYSTORE_PASS (+ ANDROID_KEY_ALIAS, varsayılan kitaplik, ANDROID_KEY_PASS)
#   ya da yerel keys/kitaplik.keystore + keys/keystore-parola.txt. Anahtar yoksa APK_IMZASIZ=1 ile yalnız derleme denenir.
# Tüm sürümler AYNI anahtarla imzalanmalı (geliştiricinin bilgisayarındaki anahtar klasörü); başka anahtarla kurulu uygulama güncellenmez.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SURUM="$(node -p "require('$ROOT/tools/surum.js').version()")"
KOD="$(node -p "require('$ROOT/tools/surum.js').versionCode(require('$ROOT/tools/surum.js').version())")"
node "$ROOT/tools/hazirla.js" >/dev/null

if [ -n "${ANDROID_TOOLS:-}" ]; then
  BT="$(ls -d "$ANDROID_TOOLS"/bt/*/ | sort -V | tail -1)"; PF="$ANDROID_TOOLS/pf"
else
  SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"; [ -n "$SDK" ] || { echo "Android SDK yok (ANDROID_TOOLS / ANDROID_HOME)"; exit 2; }
  BT="$(ls -d "$SDK"/build-tools/*/ | sort -V | tail -1)"; PF="$SDK/platforms"
fi
JAR="$PF/android-35/android.jar"; [ -f "$JAR" ] || JAR="$(ls "$PF"/android-*/android.jar | sort -V | tail -1)"
echo "build-tools: $BT  platform: $JAR"

B="$ROOT/.derleme/android"; OUT="$ROOT/cikti"
rm -rf "$B"; mkdir -p "$B/assets" "$B/gen" "$B/classes" "$OUT"
cp -r "$ROOT/.derleme/www" "$B/assets/www"
sed -e "s/@VERSION_CODE@/$KOD/" -e "s/@VERSION_NAME@/$SURUM/" "$ROOT/android/AndroidManifest.xml" > "$B/AndroidManifest.xml"
"$BT/aapt2" compile --dir "$ROOT/android/res" -o "$B/res.zip"
"$BT/aapt2" link -o "$B/base.apk" -I "$JAR" --manifest "$B/AndroidManifest.xml" -R "$B/res.zip" \
  --java "$B/gen" -A "$B/assets" --min-sdk-version 26 --target-sdk-version 35 --auto-add-overlay
javac -nowarn --release 11 -encoding UTF-8 -classpath "$JAR" -d "$B/classes" $(find "$ROOT/android/src" "$B/gen" -name '*.java') 2>&1 | grep -v '^warning\|^Note:\|^Picked up' || true
ls "$B/classes/com/kitaplik/uygulama/MainActivity.class" "$B/classes/com/departuresmil/ortak/ApkPatchInstaller.class" >/dev/null
"$BT/d8" --release --min-api 26 --lib "$JAR" --output "$B" $(find "$B/classes" -name '*.class')
(cd "$B" && cp base.apk unsigned.apk && zip -q -j -X unsigned.apk classes.dex)
"$BT/zipalign" -f -p 4 "$B/unsigned.apk" "$B/aligned.apk"

KS="${ANDROID_KEYSTORE:-}"; PW="${ANDROID_KEYSTORE_PASS:-}"; AL="${ANDROID_KEY_ALIAS:-kitaplik}"
if [ -z "$KS" ] && [ -f "$ROOT/keys/kitaplik.keystore" ]; then KS="$ROOT/keys/kitaplik.keystore"; PW="$(cat "$ROOT/keys/keystore-parola.txt")"; fi
if [ -z "$KS" ]; then
  [ -n "${APK_IMZASIZ:-}" ] || { echo "İmza anahtarı yok (ANDROID_KEYSTORE / keys/)"; exit 3; }
  cp "$B/aligned.apk" "$OUT/Kitaplik-$SURUM-imzasiz.apk"; echo "İMZASIZ: $OUT/Kitaplik-$SURUM-imzasiz.apk"; exit 0
fi
"$BT/apksigner" sign --ks "$KS" --ks-key-alias "$AL" --ks-pass "pass:$PW" --key-pass "pass:${ANDROID_KEY_PASS:-$PW}" \
  --out "$OUT/Kitaplik-$SURUM.apk" "$B/aligned.apk"
"$BT/apksigner" verify "$OUT/Kitaplik-$SURUM.apk"
echo "Tamam: $OUT/Kitaplik-$SURUM.apk (versionName $SURUM, versionCode $KOD)"
