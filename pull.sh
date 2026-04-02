#!/bin/bash
# ═══════════════════════════════════════════════════
# VZP Pull Script — Live-Dateien von Cloudflare KV holen
# ═══════════════════════════════════════════════════
# Nutzung: ./pull.sh

TOKEN="vzp123"
LIST_URL="https://vzp.app/api/list?token=$TOKEN"
READ_URL="https://vzp-deploy.fatih-m-a.workers.dev/api/read?token=$TOKEN"
USER_AGENT="VZP-Deploy/1.0"

echo "═══ VZP Pull — Dateien von Cloudflare KV synchronisieren ═══"

FILES=$(curl -s -H "User-Agent: $USER_AGENT" "$LIST_URL" 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
for f in d['files']:
    print(f)
")

COUNT=$(echo "$FILES" | wc -l)
echo "Gefunden: $COUNT Dateien"

for f in $FILES; do
  dir=$(dirname "$f")
  mkdir -p "$dir"
  
  curl -s -H "Authorization: Bearer $TOKEN" -H "User-Agent: $USER_AGENT" \
    "$READ_URL&path=$f" 2>/dev/null | python3 -c "
import sys,json,base64
try:
    d=json.load(sys.stdin)
    c=d.get('content','')
    if c.startswith('data:'):
        parts=c.split(',',1)
        if len(parts)==2:
            with open('$f','wb') as out: out.write(base64.b64decode(parts[1]))
        else:
            with open('$f','w') as out: out.write(c)
    else:
        with open('$f','w') as out: out.write(c)
except: pass
" 2>/dev/null
  
  echo "  ✓ $f"
done

echo ""
echo "═══ Pull fertig: $COUNT Dateien synchronisiert ═══"
