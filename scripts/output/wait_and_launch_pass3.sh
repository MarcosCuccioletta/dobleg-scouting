#!/bin/bash
while tasklist //FI "PID eq 25452" 2>/dev/null | grep -q 25452; do
  sleep 15
done
echo "Pass 2 (API-Football) finished at $(date). Tail:"
tail -6 scripts/enrich-transfermarkt/backfill_nationality_api_football_pass2.log

set -a
source <(grep -E "^set (SUPABASE_URL|SUPABASE_SERVICE_KEY)=" scripts/sync-sofascore/run-sync.bat | sed 's/^set /export /')
set +a

echo "Launching pass 3 (API-Football, fixed backoff) to resweep false-negative sin-dato rows..."
cd scripts/enrich-transfermarkt
python -u backfill_nationality_api_football.py > backfill_nationality_api_football_pass3.log 2>&1
echo "Pass 3 complete at $(date)."
tail -15 backfill_nationality_api_football_pass3.log
