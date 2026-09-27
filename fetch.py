"""Fetch air quality for every city in data/cities.json and save one snapshot.

AQI follows the CPCB National AQI method: 24h means for PM2.5, PM10, NO2, SO2
and 8h means for CO and O3; the city AQI is the highest sub-index.
"""
import json, os, sys, time, urllib.request
from datetime import datetime, timedelta, timezone

IST = timezone(timedelta(hours=5, minutes=30))
API = "https://air-quality-api.open-meteo.com/v1/air-quality"
VARS = ["pm2_5", "pm10", "nitrogen_dioxide", "sulphur_dioxide", "carbon_monoxide", "ozone"]
KEYS = ["pm25", "pm10", "no2", "so2", "co", "o3"]
HOURS = {"pm25": 24, "pm10": 24, "no2": 24, "so2": 24, "co": 8, "o3": 8}

# Concentration breakpoints per AQI band (CO in mg/m3, the rest in ug/m3).
# ponytail: CPCB leaves the Severe band open-ended; the last value is the usual cap.
BANDS = {
    "pm25": [0, 30, 60, 90, 120, 250, 380],
    "pm10": [0, 50, 100, 250, 350, 430, 510],
    "no2": [0, 40, 80, 180, 280, 400, 520],
    "so2": [0, 40, 80, 380, 800, 1600, 2100],
    "co": [0, 1, 2, 10, 17, 34, 46],
    "o3": [0, 50, 100, 168, 208, 748, 1000],
}
INDEX = [0, 50, 100, 200, 300, 400, 500]


def sub_index(key, c):
    bp = BANDS[key]
    for i in range(len(bp) - 1):
        if c <= bp[i + 1]:
            return INDEX[i] + (c - bp[i]) * (INDEX[i + 1] - INDEX[i]) / (bp[i + 1] - bp[i])
    return 500


def city_row(hourly):
    means = {}
    for key, var in zip(KEYS, VARS):
        vals = [v for v in hourly[var][-HOURS[key]:] if v is not None]
        means[key] = sum(vals) / len(vals) if vals else None
    if means["co"] is not None:
        means["co"] /= 1000  # ug/m3 -> mg/m3
    subs = {k: sub_index(k, v) for k, v in means.items() if v is not None}
    if not subs:
        return None
    dom = max(subs, key=subs.get)
    return [round(subs[dom]), dom] + [None if means[k] is None else round(means[k], 2) for k in KEYS]


def get(url):
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                return json.load(r)
        except Exception as e:
            print(f"retry {attempt + 1}: {e}", file=sys.stderr)
            time.sleep(20 * (attempt + 1))
    raise SystemExit("Open-Meteo unreachable, no snapshot written")


def main():
    cities = json.load(open("data/cities.json", encoding="utf-8"))
    rows = []
    for start in range(0, len(cities), 100):
        batch = cities[start:start + 100]
        url = (f"{API}?latitude={','.join(str(c['lat']) for c in batch)}"
               f"&longitude={','.join(str(c['lon']) for c in batch)}"
               f"&hourly={','.join(VARS)}&past_hours=24&forecast_hours=1&timezone=Asia%2FKolkata")
        res = get(url)
        rows += [city_row(r["hourly"]) for r in (res if isinstance(res, list) else [res])]
        time.sleep(5)

    now = datetime.now(IST)
    name = now.strftime("%Y-%m-%d_%H%M")
    os.makedirs("data/snapshots", exist_ok=True)
    with open(f"data/snapshots/{name}.json", "w") as f:
        json.dump({"t": now.isoformat(timespec="minutes"), "cols": ["aqi", "dom"] + KEYS, "v": rows}, f, separators=(",", ":"))

    index = sorted(p[:-5] for p in os.listdir("data/snapshots") if p.endswith(".json"))
    with open("data/index.json", "w") as f:
        json.dump(index, f)
    build_history(name[:7], index)
    print(f"{name}: {sum(r is not None for r in rows)}/{len(cities)} cities")


def build_history(month, index):
    """Rebuild data/history/YYYY-MM.json: every AQI of that month, so charts load one file instead of many snapshots."""
    ids = [i for i in index if i.startswith(month)]
    aqi = []
    for i in ids:
        with open(f"data/snapshots/{i}.json") as f:
            aqi.append([r[0] if r else None for r in json.load(f)["v"]])
    os.makedirs("data/history", exist_ok=True)
    with open(f"data/history/{month}.json", "w") as f:
        json.dump({"ids": ids, "aqi": aqi}, f, separators=(",", ":"))


if __name__ == "__main__":
    main()
