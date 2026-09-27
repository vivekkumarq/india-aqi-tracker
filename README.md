# India Air Quality Tracker

Air Quality Index for 524 Indian cities (population over 1 lakh), recorded twice a day at 6 AM and 6 PM IST.

**Live dashboard:** https://vivekkumarq.github.io/india-aqi-tracker/

## How it works

1. A scheduled GitHub Actions workflow runs `fetch.py` at 6 AM and 6 PM IST.
2. The script pulls the last 24 hours of pollutant concentrations (PM2.5, PM10, NO₂, SO₂, CO, O₃) for every city from the Open-Meteo Air Quality API.
3. It computes the AQI with the CPCB National Air Quality Index method: 24-hour averages for PM2.5, PM10, NO₂ and SO₂, 8-hour averages for CO and O₃, and the highest sub-index becomes the city's AQI.
4. Each run is saved as a snapshot in `data/snapshots/` and committed, so the repo holds the full history.
5. The dashboard (`index.html`, served by GitHub Pages) is a single static page with no build step.

## Dashboard features

- **City search** with autocomplete and keyboard navigation (press `/` to jump to it), plus **Near me** to open the closest tracked city
- **City profile** with a Wikipedia photo and summary, AQI gauge, change since the last reading, national rank, health advice and a PM2.5 cigarette equivalent
- **Trend chart** over 7, 30 or 90 days with hover and keyboard readout
- **Map** of all 524 cities coloured by AQI category and sized by population
- **Rankings**: most polluted, cleanest, fastest rising and most improved since the last reading
- **States by median AQI**, click a state to filter the whole page
- **Browse history** by date and reading time; every view has a shareable link
- **Saved cities** pinned at the top, stored in your browser
- **Full table** with sorting, filtering and CSV download
- Light and dark themes, works on phones

## Data

| File | Contents |
|---|---|
| `data/cities.json` | City name, state, coordinates, population |
| `data/index.json` | List of all snapshots |
| `data/snapshots/YYYY-MM-DD_HHMM.json` | One reading of every city; `v[i]` belongs to city `id = i` |

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
- Header photo: "Polluted killer fog in Delhi" by Sumitmpsd, [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Poulluted_killer_fog_in_Delhi.jpg), CC BY-SA 4.0, cropped.
