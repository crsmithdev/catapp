#!/bin/sh
# Serves the app to the home network on port 8421.
cd "$(dirname "$0")" && exec python3 -m http.server "${PORT:-8421}" --bind 0.0.0.0
