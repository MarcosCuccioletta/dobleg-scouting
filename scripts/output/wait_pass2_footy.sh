#!/bin/bash
while tasklist //FI "PID eq 25452" 2>/dev/null | grep -q 25452; do
  sleep 15
done
echo "API-Football pass 2 finished at $(date)"
tail -10 scripts/enrich-transfermarkt/backfill_nationality_api_football_pass2.log
