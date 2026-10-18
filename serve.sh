#!/bin/sh
# Serves the app to the home network on port 3020.
cd "$(dirname "$0")" && exec python3 -m http.server "${PORT:-3020}" --bind 0.0.0.0
