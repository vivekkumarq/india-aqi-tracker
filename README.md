# India Air Quality Tracker

Air Quality Index for 524 Indian cities (population over 1 lakh), recorded twice a day at 6 AM and 6 PM IST.

**Live dashboard:** https://vivekkumarq.github.io/india-aqi-tracker/

## How it works

1. A scheduled GitHub Actions workflow runs `fetch.py` at 6 AM and 6 PM IST. GitHub sometimes skips scheduled runs, so each slot has two retries that exit early when the reading already exists.
2. The script pulls the last 24 hours of pollutant concentrations (PM2.5, PM10, NO₂, SO₂, CO, O₃) for every city from the Open-Meteo Air Quality API.
3. It computes the AQI with the CPCB National Air Quality Index method: 24-hour averages for PM2.5, PM10, NO₂ and SO₂, 8-hour averages for CO and O₃, and the highest sub-index becomes the city's AQI.
4. Each run is saved as a snapshot in `data/snapshots/` and committed, so the repo holds the full history.
5. The dashboard (`index.html`, served by GitHub Pages) is a single static page with no build step.

## Dashboard features

- **City search** with autocomplete and keyboard navigation (press `/`), plus **Near me** to open the closest tracked city
- **Live clock**, digital or analog, 12 or 24 hour, with five themes (including a Swiss railway style face) and a countdown to the next reading
- **Photo slideshow** of Indian landmarks, each captioned with its city's live AQI, and a scrolling ticker of 40 major cities
- **City profile**: Wikipedia photo and summary, live weather, AQI gauge, change since the last reading, national rank, health advice and a PM2.5 cigarette equivalent
- **48-hour AQI forecast** calculated in the browser from the Open-Meteo forecast, with the best and worst hours to be outdoors
- **History chart** (7 days to all time) and a GitHub-style **calendar** of each day's worst AQI
- **Compare** up to three cities side by side, with pollutant bars and a shared trend chart
- **Map** of all 524 cities, **rankings** (most polluted, cleanest, rising, improving) and **states by median AQI**
- **Browse any past reading**; every view has a shareable link
- **Saved cities**, a sortable and filterable **table**, and **CSV download**
- Light and dark themes, responsive down to phone width, and installable as an app that also opens offline

## Data

| File | Contents |
|---|---|
| `data/cities.json` | City name, state, coordinates, population |
| `data/index.json` | List of all snapshots |
| `data/snapshots/YYYY-MM-DD_HHMM.json` | One reading of every city; `v[i]` belongs to city `id = i` |
| `data/history/YYYY-MM.json` | Every AQI of that month, so charts load one file |

## Run locally

```
python fetch.py            # take a snapshot
python test_fetch.py       # check the AQI maths
python -m http.server      # open http://localhost:8000
```

## Sources

- Air quality: [Open-Meteo](https://open-meteo.com/en/docs/air-quality-api), based on Copernicus Atmosphere Monitoring Service (CAMS) data. These are modelled values and can differ from individual CPCB monitoring stations.
- Cities: [GeoNames](https://www.geonames.org/) (CC BY 4.0).
- City photos and summaries: [Wikipedia](https://en.wikipedia.org/), loaded in the browser.
- Header photos: Wikimedia Commons, credited individually in the page footer.
- Weather and forecasts: [Open-Meteo](https://open-meteo.com/), loaded in the browser.
