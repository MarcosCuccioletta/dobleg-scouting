"""One-off backfill: nationality for players sourced from API-Football
(0 < id < 20,000,000) that don't have it yet. Fetched from the player's OWN
profile (`/players?id=X&season=Y`) — never inferred from name/club (ver
saneamiento de datos: `nationality` estaba vacío en el 100% de los jugadores
porque ningún pipeline llamaba al endpoint de perfil completo, solo a los
livianos de partidos/alineaciones que no la traen). Also fills `birth_date`
if it's missing, same source, same rule (only fills nulls, never overwrites).

Same proxy que fix_bad_ages.py (server-side, la key de API-Football no se
expone acá — ver memoria de seguridad de la key). Resumable: re-correr solo
retoma lo que siga con `nationality is null`.

Run: python backfill_nationality_api_football.py [--limit N]
Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, FOOTBALL_PROXY (opcional, tiene default)
"""
import os
import sys
import json
import time
import argparse
import urllib.request
import urllib.error

# La consola de Windows no siempre soporta UTF-8 (nombres con tildes/ć/etc.
# tiraban UnicodeEncodeError y mataban el batch a mitad de camino — el PATCH
# ya se había guardado bien, solo fallaba el print).
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
FOOTBALL_PROXY = os.environ.get("FOOTBALL_PROXY", "https://dobleg-scouting.netlify.app/api/football")
REST_URL = f"{SUPABASE_URL}/rest/v1"
SB_HEADERS = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}", "Content-Type": "application/json"}

FETCH_DELAY = float(os.environ.get("FETCH_DELAY", "1.0"))


def sb_select(table, params):
    req = urllib.request.Request(f"{REST_URL}/{table}?{params}", headers=SB_HEADERS)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def sb_select_all(table, params, page_size=1000):
    # PostgREST corta en 1000 filas por default sin paginar — sin esto el
    # batch procesaba solo el primer millar y quedaba "terminado" en falso.
    out = []
    offset = 0
    while True:
        page = sb_select(table, f"{params}&limit={page_size}&offset={offset}")
        out.extend(page)
        if len(page) < page_size:
            break
        offset += page_size
    return out


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


def fetch_profile(pid, season, retries=6):
    # La corrida anterior con retries=2 y backoff corto (5/10s) tiraba la
    # toalla ante rate-limiting sostenido y marcaba "sin dato" a jugadores
    # que en realidad sí tenían perfil — no era falta de dato real, era el
    # proxy devolviendo 429 (la key de API-Football se comparte con otros
    # sitios del usuario, así que hay presión de cuota ajena a este script).
    # Backoff más largo y con más intentos para absorber eso.
    url = f"{FOOTBALL_PROXY}?endpoint=/players&id={pid}&season={season}"
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(url, timeout=20) as resp:
                data = json.loads(resp.read())
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = 10 * (attempt + 1)
                print(f"    429, esperando {wait}s...")
                time.sleep(wait)
                continue
            return None
        except Exception as e:
            print(f"    fetch error: {e}")
            return None
        quota_error = (data.get("errors") or {}).get("requests")
        if quota_error:
            print(f"    CUOTA DIARIA AGOTADA: {quota_error}")
            raise SystemExit(1)
        resp_list = data.get("response") or []
        if resp_list:
            p = resp_list[0].get("player", {})
            return {"nationality": p.get("nationality"), "birth_date": (p.get("birth") or {}).get("date")}
        return None
    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    players = sb_select_all("players", "select=id,name,birth_date&nationality=is.null&id=gt.0&id=lt.20000000&order=id")
    if args.limit:
        players = players[: args.limit]

    print(f"{len(players)} jugadores de API-Football sin nacionalidad. Delay: {FETCH_DELAY}s")
    print(f"Tiempo estimado: ~{len(players) * FETCH_DELAY / 60:.0f} min\n")

    stats = {"filled": 0, "no_data": 0, "errors": 0}
    for i, p in enumerate(players, 1):
        time.sleep(FETCH_DELAY)
        try:
            profile = None
            for season in (2026, 2025):
                profile = fetch_profile(p["id"], season)
                if profile and profile.get("nationality"):
                    break
        except Exception as e:
            print(f"[{i}/{len(players)}] {p['name']} (id={p['id']}) ... error: {e}")
            stats["errors"] += 1
            continue

        if not profile or not profile.get("nationality"):
            print(f"[{i}/{len(players)}] {p['name']} (id={p['id']}) ... sin dato")
            stats["no_data"] += 1
            continue

        patch = {"nationality": profile["nationality"]}
        if profile.get("birth_date") and not p.get("birth_date"):
            patch["birth_date"] = profile["birth_date"]

        sb_patch("players", p["id"], patch)
        print(f"[{i}/{len(players)}] {p['name']} (id={p['id']}) ... {patch}")
        stats["filled"] += 1

    print(f"\n{json.dumps(stats, indent=2)}")


if __name__ == "__main__":
    main()
