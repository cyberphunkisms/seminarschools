#!/usr/bin/env bash
# IndexNow submission helper for seminarschools.com
# Run this after each deploy to push fresh URLs into Bing/Yandex.

set -e

KEY="fb6c946e5e7a86de5e1e5ae9c03edda9"
HOST="seminarschools.com"
KEY_LOCATION="https://${HOST}/${KEY}.txt"

# Build URL list. Edit this when you add new contentinternet surfaces.
URLS=$(cat <<EOL
[
  "https://${HOST}/llms.txt",
  "https://${HOST}/polymyth/manifest.txt",
  "https://${HOST}/polymyth/methodologylist.txt",
  "https://${HOST}/polymyth/methodologylist-methodology.txt",
  "https://${HOST}/polymyth/methodologylist-gorgonification.txt",
  "https://${HOST}/polymyth/methodologylist-degorgonification.txt",
  "https://${HOST}/polymyth/methodologylist-analysis.txt",
  "https://${HOST}/polymyth/methodologylist-sabachtan.txt",
  "https://${HOST}/polymyth/methodologylist-idiomary.txt",
  "https://${HOST}/polymyth/methodologylist-citation.txt",
  "https://${HOST}/polymyth/methodologylist-studylist.txt",
  "https://${HOST}/polymyth/methodologylist-rainbowsol.txt",
  "https://${HOST}/polymyth/methodologylist-polycognate.txt",
  "https://${HOST}/polymyth/methodologylist-learnings.txt",
  "https://${HOST}/polymyth/methodologylist-coreplus.txt",
  "https://${HOST}/polymyth/methodologylist-pending.txt",
  "https://${HOST}/polymyth/methodologylist-pending-user-authorship.txt"
]
EOL
)

echo "Submitting to IndexNow..."
curl -sS -X POST "https://api.indexnow.org/IndexNow" \
  -H "Content-Type: application/json; charset=utf-8" \
  -w "HTTP %{http_code}\n" \
  -d "{
    \"host\": \"${HOST}\",
    \"key\": \"${KEY}\",
    \"keyLocation\": \"${KEY_LOCATION}\",
    \"urlList\": ${URLS}
  }"
