"""One-off cleanup: for every player with an implausible age (<14 or >45),
re-fetch their birth_date from their OWN authoritative source (API-Football for
ids < 20,000,000, Sofascore for ids >= 20,000,000) and overwrite the bad
Transfermarkt-derived value if the source disagrees. Clears the wrong
transfermarkt_id/url too so a future enrich.py run can re-match correctly.

Run: python fix_bad_ages.py
Env: SUPABASE_URL, SUPABASE_SERVICE_KEY
"""
import os
import sys
import json
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
FOOTBALL_PROXY = os.environ.get("FOOTBALL_PROXY", "https://dobleg-scouting.netlify.app/api/football")
REST_URL = f"{SUPABASE_URL}/rest/v1"
SB_HEADERS = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}", "Content-Type": "application/json"}

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "sync-sofascore"))
import sync as sofa  # reuses sofa_fetch / rate limiting


def sb_select(table, params):
    req = urllib.request.Request(f"{REST_URL}/{table}?{params}", headers=SB_HEADERS)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def sb_patch(table, pid, data):
    req = urllib.request.Request(
        f"{REST_URL}/{table}?id=eq.{pid}", data=json.dumps(data).encode(),
        headers=SB_HEADERS, method="PATCH",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        print(f"    PATCH failed {e.code}: {e.read().decode(errors='replace')[:200]}")
        return 0


def age_from(birth_date_str, today):
    y, m, d = (int(x) for x in birth_date_str[:10].split("-"))
    age = today.year - y - ((today.month, today.day) < (m, d))
    return age


def fetch_api_football_birth(pid):
    for season in (2026, 2025):
        url = f"{FOOTBALL_PROXY}?endpoint=/players&id={pid}&season={season}"
        try:
            with urllib.request.urlopen(url, timeout=20) as resp:
                data = json.loads(resp.read())
        except Exception as e:
            print(f"    api-football fetch error: {e}")
            continue
        resp_list = data.get("response") or []
        if resp_list:
            birth = resp_list[0].get("player", {}).get("birth", {}).get("date")
            if birth:
                return birth
    return None


def fetch_sofascore_birth(raw_id):
    try:
        data = sofa.sofa_fetch(f"/player/{raw_id}")
    except Exception as e:
        print(f"    sofascore fetch error: {e}")
        return None
    ts = data.get("player", {}).get("dateOfBirthTimestamp")
    if not ts:
        return None
    return datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m-%d")


def main():
    today = datetime.now(timezone.utc).date()
    players = sb_select("players", "select=id,name,birth_date,transfermarkt_id&birth_date=not.is.null&limit=20000")
    bad = []
    for p in players:
        try:
            age = age_from(p["birth_date"], today)
        except Exception:
            continue
        if age < 14 or age > 45:
            bad.append(p)

    limit = os.environ.get("LIMIT")
    if limit:
        bad = bad[:int(limit)]

    print(f"Found {len(bad)} players with implausible age (<14 or >45) [processing {len(bad)}]")
    fixed = 0
    unchanged = 0
    errors = 0

    for i, p in enumerate(bad):
        pid = p["id"]
        name = p["name"]
        old_bd = p["birth_date"]
        print(f"[{i+1}/{len(bad)}] {name} (id={pid}, was {old_bd})", end=" ... ")

        if pid < 20_000_000:
            new_bd = fetch_api_football_birth(pid)
        else:
            new_bd = fetch_sofascore_birth(pid - sofa.ID_OFFSET)
            time.sleep(sofa.FETCH_DELAY)

        if not new_bd:
            print("no source data found, skipped")
            unchanged += 1
            continue

        if new_bd[:10] == old_bd[:10]:
            print("source agrees with stored value, no change (real anomaly, not a bad match)")
            unchanged += 1
            continue

        new_age = age_from(new_bd, today)
        status = sb_patch("players", pid, {
            "birth_date": new_bd,
            "transfermarkt_id": None,
            "transfermarkt_url": None,
        })
        if 200 <= status < 300:
            print(f"FIXED -> {new_bd} (age {new_age}), cleared bad transfermarkt link")
            fixed += 1
        else:
            errors += 1

    print(json.dumps({"total_flagged": len(bad), "fixed": fixed, "unchanged": unchanged, "errors": errors}, indent=2))


if __name__ == "__main__":
    main()
