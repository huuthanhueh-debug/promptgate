#!/bin/sh
# Vision 6D for macOS and Linux. Needs Node.js 18+.
exec node "$(dirname "$0")/tools/desktop.js" "$@"
