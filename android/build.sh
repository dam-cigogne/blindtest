#!/usr/bin/env bash
# Fabrique l'appli Android TV (public/tv.apk) avec les outils du SDK Android, sans Gradle.
set -euo pipefail
cd "$(dirname "$0")"
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/usr/local/lib/android/sdk}}"
BT="$SDK/build-tools/$(ls "$SDK/build-tools" | sort -V | tail -1)"
PLAT="$(ls -d "$SDK"/platforms/android-* | sort -V | tail -1)/android.jar"
V="${GITHUB_RUN_NUMBER:-1}"
echo "build-tools : $BT"
echo "plateforme  : $PLAT"
echo "version     : 1.$V"
rm -rf build && mkdir -p build/obj build/dex
"$BT/aapt2" compile --dir res -o build/res.zip
"$BT/aapt2" link -o build/app.unaligned.apk -I "$PLAT" --manifest AndroidManifest.xml \
  --min-sdk-version 21 --target-sdk-version 34 --version-code "$V" --version-name "1.$V" build/res.zip
javac -encoding UTF-8 -source 8 -target 8 -nowarn -bootclasspath "$PLAT" -classpath "$PLAT" -d build/obj $(find src -name '*.java')
"$BT/d8" --release --min-api 21 --lib "$PLAT" --output build/dex $(find build/obj -name '*.class')
(cd build/dex && zip -q -u ../app.unaligned.apk classes.dex)
"$BT/zipalign" -f -p 4 build/app.unaligned.apk build/app.aligned.apk
"$BT/apksigner" sign --ks tv.keystore --ks-pass pass:blindtest --key-pass pass:blindtest --out ../public/tv.apk build/app.aligned.apk
"$BT/apksigner" verify --print-certs ../public/tv.apk | head -3
ls -la ../public/tv.apk
echo "OK : appli fabriquée"
