# Watching Bikes in Boston

An interactive web map for exploring Bluebikes station activity and Boston-area bike infrastructure.

This project combines Mapbox, D3, station metadata, trip records, and bike-lane geometry into a browser-based visualization. The goal is to make it easy to see where bike-share traffic concentrates, how flows shift by time of day, and which stations behave more like departure hubs versus arrival hubs.

## Live Demo

[View the interactive map](https://jtoast65.github.io/bikes/)

## What It Shows

- Bluebikes stations across the Boston area plotted on a Mapbox street map.
- Existing bike-network geometry layered from a GeoJSON file.
- Station circles sized by total traffic volume.
- Station circles colored by traffic flow:
  - more departures
  - balanced activity
  - more arrivals
- A time slider that filters rides around a selected time of day.
- Hover tooltips with station name, total traffic, departures, and arrivals.

## Data

The project uses three local datasets:

- `data/bluebikes-stations.json` - 453 Bluebikes stations with location and capacity metadata
- `data/bluebikes-traffic-2024-03.csv` - 261,687 Bluebikes trips from March 2024
- `data/Existing_Bike_Network_2022.geojson` - 3,166 Boston-area bike-network features

## How It Works

The map starts with a Mapbox GL JS basemap centered on Boston. D3 loads the station and trip datasets, groups rides by start and end station, then calculates each station's:

- departures
- arrivals
- total traffic
- net traffic flow

Those values drive the station overlay. Circle radius uses a square-root scale so high-traffic stations stand out without overwhelming the map. Color uses a diverging scale to distinguish stations with more departures from stations with more arrivals.

When the time slider changes, the visualization filters trips to rides that started or ended within one hour of the selected time and recomputes the station-level metrics.

## Tech Stack

- JavaScript
- D3.js
- Mapbox GL JS
- HTML
- CSS
- GeoJSON
- CSV / JSON data

## Running Locally

Because the project loads local data files in the browser, run it with a local server:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Project Structure

```text
.
├── index.html
├── map.js
├── map.css
├── global.css
├── assets/
└── data/
    ├── Existing_Bike_Network_2022.geojson
    ├── bluebikes-stations.json
    └── bluebikes-traffic-2024-03.csv
```

## Why This Project Matters

Bike-share systems create a lot of movement data, but raw trip tables are hard to interpret without geography. This project turns trip records into a spatial interface that makes commuting patterns, popular stations, and directional traffic imbalances easier to understand at a glance.
