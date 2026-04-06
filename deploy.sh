#!/bin/bash
# ═══════════════════════════════════════════════════
# VZP Deploy Script — Dateien zu Cloudflare KV deployen
# ═══════════════════════════════════════════════════
# Nutzung:
#   ./deploy.sh                    # Alle geänderten Dateien deployen
#   ./deploy.sh index.html         # Einzelne Datei deployen
#   ./deploy.sh js/regelplan-templates.js js/pdf-export.js  # Mehrere Dateien
#
# Voraussetzungen: curl, python3 (oder python)

TOKEN="vzp123"
API_URL="https://vzp.app/api/deploy"
FALLBACK_URL="https://vzp-deploy.fatih-m-a.workers.dev/api/deploy"
USER_AGENT="VZP-Deploy/1.0"
BATCH_SIZE=10
VERSION_FILE="js/version.js"

# Farbcodes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Welche Dateien deployen?
if [ $# -gt 0 ]; then
  FILES="$@"
else
  # Alle relevanten Dateien (keine binären Assets)
  FILES=$(find . -type f \( -name "*.html" -o -name "*.js" -o -name "*.css" -o -name "*.svg" -o -name "*.md" \) | sed 's|^\./||' | grep -v node_modules | grep -v .git | sort)
fi

BUILD_DATE=$(date +%Y%m%d-%H%M)
GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || true)
if [ -n "$GIT_SHA" ]; then
  APP_VERSION="v${BUILD_DATE}-${GIT_SHA}"
else
  APP_VERSION="v${BUILD_DATE}"
fi

mkdir -p js
cat > "$VERSION_FILE" <<EOF
window.__VZP_BUILD__ = {
  version: "$APP_VERSION",
  builtAt: "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  commit: "$GIT_SHA"
};
window.APP_VERSION = window.__VZP_BUILD__.version;
EOF

case " $FILES " in
  *" $VERSION_FILE "*) ;;
  *) FILES="$VERSION_FILE $FILES" ;;
esac

echo -e "${YELLOW}═══ VZP Deploy ═══${NC}"
echo "Dateien: $(echo "$FILES" | wc -w)"
echo "Version: $APP_VERSION"

# Batch-Deploy: Dateien in JSON-Payload packen
BATCH_FILES=""
BATCH_COUNT=0
TOTAL_DEPLOYED=0

deploy_batch() {
  if [ -z "$BATCH_FILES" ]; then return; fi
  
  PAYLOAD="{\"files\":[$BATCH_FILES]}"
  echo "$PAYLOAD" > /tmp/vzp_deploy_payload.json
  
  RESULT=$(curl -s -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -H "User-Agent: $USER_AGENT" \
    -d @/tmp/vzp_deploy_payload.json 2>/dev/null)
  
  # Fallback URL wenn Hauptdomain fehlschlägt
  if echo "$RESULT" | grep -q "error\|Error\|1010" 2>/dev/null; then
    RESULT=$(curl -s -X POST "$FALLBACK_URL" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -H "User-Agent: $USER_AGENT" \
      -d @/tmp/vzp_deploy_payload.json 2>/dev/null)
  fi
  
  if echo "$RESULT" | grep -q '"success":true' 2>/dev/null; then
    DEPLOYED=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('deployed',0))" 2>/dev/null || echo "$BATCH_COUNT")
    echo -e "${GREEN}  ✓ $DEPLOYED Dateien deployed${NC}"
    TOTAL_DEPLOYED=$((TOTAL_DEPLOYED + DEPLOYED))
  else
    echo -e "${RED}  ✗ Fehler: $RESULT${NC}"
  fi
  
  BATCH_FILES=""
  BATCH_COUNT=0
}

for f in $FILES; do
  if [ ! -f "$f" ]; then
    echo -e "${RED}  ✗ Datei nicht gefunden: $f${NC}"
    continue
  fi
  
  echo -e "  📦 $f"
  
  # Dateiinhalt als JSON-escaped string
  CONTENT=$(python3 -c "
import json, sys
with open('$f', 'r', errors='replace') as fh:
    print(json.dumps(fh.read()))
" 2>/dev/null)
  
  if [ -z "$CONTENT" ]; then
    echo -e "${RED}    Konnte Datei nicht lesen${NC}"
    continue
  fi
  
  if [ -n "$BATCH_FILES" ]; then
    BATCH_FILES="$BATCH_FILES,"
  fi
  BATCH_FILES="$BATCH_FILES{\"path\":\"$f\",\"content\":$CONTENT}"
  BATCH_COUNT=$((BATCH_COUNT + 1))
  
  if [ $BATCH_COUNT -ge $BATCH_SIZE ]; then
    deploy_batch
  fi
done

# Rest deployen
deploy_batch

echo ""
echo -e "${GREEN}═══ Fertig: $TOTAL_DEPLOYED Dateien deployed ═══${NC}"
echo "Live unter: https://vzp.app"
