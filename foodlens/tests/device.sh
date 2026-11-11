#!/usr/bin/env bash
# Device smoke test: installs the APK on the connected phone or emulator, launches it with the
# self-test flag and reads the app's own log. Passes only if the bundled page started inside the
# WebView and one real HTTPS call to the Claude API went through the native bridge (a keyless
# call, so the expected answer is HTTP 401). Usage: bash tests/device.sh dist/FoodLens.apk [screenshot.png]
set -euo pipefail
APK="${1:?path to the APK}"
SHOT="${2:-}"
PKG=com.foodlens.app

adb wait-for-device
adb uninstall "$PKG" > /dev/null 2>&1 || true
adb install "$APK"
adb logcat -c
adb shell am start -W -n "$PKG/.MainActivity" --ez selftest true

LOG=""
for _ in $(seq 1 45); do
  LOG="$(adb logcat -d -s FoodLens:I AndroidRuntime:E || true)"
  if grep -q "selftest http" <<< "$LOG" || grep -q "FATAL EXCEPTION" <<< "$LOG"; then break; fi
  sleep 2
done
echo "---- app log ----"
echo "$LOG"
echo "-----------------"
[ -n "$SHOT" ] && adb exec-out screencap -p > "$SHOT" || true

fail() { echo "DEVICE TEST FAILED: $1"; exit 1; }
grep -q "FATAL EXCEPTION" <<< "$LOG" && fail "the app crashed"
adb shell pidof "$PKG" > /dev/null || fail "the app is not running"
grep -q "ready lang=vi foods=64 tabs=4" <<< "$LOG" || fail "the page did not start inside the WebView"
grep -q "selftest http 401" <<< "$LOG" || fail "the HTTPS bridge did not reach the Claude API (expected HTTP 401)"
echo "DEVICE TEST PASSED: installed, launched, page ready, API reachable through the bridge"
