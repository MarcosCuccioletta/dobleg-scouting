#!/bin/bash
set -a
source <(grep -E "^set (SUPABASE_URL|SUPABASE_SERVICE_KEY)=" scripts/sync-sofascore/run-sync.bat | sed 's/^set /export /')
set +a

while tasklist //FI "PID eq 6620" 2>/dev/null | grep -q 6620 || tasklist //FI "PID eq 25540" 2>/dev/null | grep -q 25540; do
  sleep 20
done

echo "Both old batches finished at $(date). Relaunching with fixed pagination to sweep remainder..."

cd scripts/enrich-transfermarkt
python -u backfill_nationality_sofascore.py > backfill_nationality_sofascore_pass2.log 2>&1 &
SOFA_PID=$!
python -u backfill_nationality_api_football.py > backfill_nationality_api_football_pass2.log 2>&1 &
FOOT_PID=$!

echo "Relaunched: sofascore pid=$SOFA_PID, api-football pid=$FOOT_PID"
wait $SOFA_PID $FOOT_PID
echo "Pass 2 complete at $(date)."
tail -5 backfill_nationality_sofascore_pass2.log
tail -5 backfill_nationality_api_football_pass2.log
