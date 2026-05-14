import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@3.9.0/+esm';

mapboxgl.accessToken = 'pk.eyJ1IjoianRvYXM2NSIsImEiOiJjbXA0cHAyd2oxNTd2MnFwcGw1ZWRvc29xIn0._dMyFaw2WMlVeRcjNiZTsA';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-71.09415, 42.36027],
  zoom: 12,
});

let stations = [];
let trips = [];
let svg;
let stationLayer;
let tooltip;
let circles;
let radiusScale;
let timeFilter = -1;

function formatTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}

function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function filterTripsByTime(trips, timeFilter) {
  if (timeFilter === -1) return trips;

  return trips.filter((trip) => {
    const started = minutesSinceMidnight(trip.started_at);
    const ended = minutesSinceMidnight(trip.ended_at);

    return (
      Math.abs(started - timeFilter) <= 60 ||
      Math.abs(ended - timeFilter) <= 60
    );
  });
}

function computeStationTraffic(stations, trips) {
  const departures = d3.rollup(
    trips,
    (v) => v.length,
    (d) => d.start_station_id
  );

  const arrivals = d3.rollup(
    trips,
    (v) => v.length,
    (d) => d.end_station_id
  );

  return stations.map((station) => {
    const id = station.short_name;

    const departuresCount = departures.get(id) ?? 0;
    const arrivalsCount = arrivals.get(id) ?? 0;

    return {
      ...station,
      departures: departuresCount,
      arrivals: arrivalsCount,
      totalTraffic: departuresCount + arrivalsCount,
      trafficFlow: departuresCount - arrivalsCount,
    };
  });
}

function getScreenPoint(station) {
  return map.project([station.lon, station.lat]);
}

function updateOverlaySize() {
  const canvas = map.getCanvas();
  const rect = canvas.getBoundingClientRect();

  svg
    .attr('width', rect.width)
    .attr('height', rect.height)
    .style('width', `${rect.width}px`)
    .style('height', `${rect.height}px`);
}

function updatePositions() {
  if (!circles) return;

  updateOverlaySize();

  circles
    .attr('cx', (d) => getScreenPoint(d).x)
    .attr('cy', (d) => getScreenPoint(d).y);
}

function updateLegend(colorScale, maxFlow) {
  d3.select('.legend').remove();

  const legend = d3
    .select('body')
    .append('div')
    .attr('class', 'legend');

  legend.append('h3').text('Traffic flow');

  const items = [
    { label: 'More departures', value: maxFlow },
    { label: 'Balanced', value: 0 },
    { label: 'More arrivals', value: -maxFlow },
  ];

  items.forEach((item) => {
    const row = legend.append('div').attr('class', 'legend-item');

    row
      .append('span')
      .attr('class', 'swatch')
      .style('background-color', colorScale(item.value));

    row.append('span').text(item.label);
  });
}

function updateStations() {
  const filteredTrips = filterTripsByTime(trips, timeFilter);
  const filteredStations = computeStationTraffic(stations, filteredTrips);

  if (timeFilter === -1) {
    radiusScale.range([0, 25]);
  } else {
    radiusScale.range([3, 50]);
  }

  const maxFlow =
    d3.max(filteredStations, (d) => Math.abs(d.trafficFlow)) || 1;

  const colorScale = d3
    .scaleSequential(d3.interpolateRdBu)
    .domain([maxFlow, -maxFlow]);

  updateOverlaySize();

  circles = stationLayer
    .selectAll('circle')
    .data(filteredStations, (d) => d.short_name)
    .join('circle')
    .attr('cx', (d) => getScreenPoint(d).x)
    .attr('cy', (d) => getScreenPoint(d).y)
    .attr('r', (d) => radiusScale(d.totalTraffic))
    .attr('fill', (d) => colorScale(d.trafficFlow))
    .attr('fill-opacity', 0.75)
    .attr('stroke', 'white')
    .attr('stroke-width', 1)
    .on('mouseenter', function (event, d) {
      d3.select(this).attr('fill-opacity', 1);

      tooltip
        .style('opacity', 1)
        .html(`
          <strong>${d.name}</strong><br>
          Total traffic: ${d.totalTraffic}<br>
          Departures: ${d.departures}<br>
          Arrivals: ${d.arrivals}
        `);
    })
    .on('mousemove', function (event) {
      tooltip
        .style('left', `${event.clientX + 12}px`)
        .style('top', `${event.clientY + 12}px`);
    })
    .on('mouseleave', function () {
      d3.select(this).attr('fill-opacity', 0.75);
      tooltip.style('opacity', 0);
    });

  updateLegend(colorScale, maxFlow);
}

map.on('load', async () => {
  map.addSource('bike-lanes', {
    type: 'geojson',
    data: 'data/Existing_Bike_Network_2022.geojson',
  });

  map.addLayer({
    id: 'bike-lanes-line',
    type: 'line',
    source: 'bike-lanes',
    paint: {
      'line-color': '#32D400',
      'line-width': 3,
      'line-opacity': 0.4,
    },
  });

  const stationData = await fetch('data/bluebikes-stations.json').then((r) =>
    r.json()
  );
  stations = stationData.data.stations;

  trips = await d3.csv('data/bluebikes-traffic-2024-03.csv', (trip) => ({
    ...trip,
    started_at: new Date(trip.started_at),
    ended_at: new Date(trip.ended_at),
  }));

  const stationTraffic = computeStationTraffic(stations, trips);

  radiusScale = d3
    .scaleSqrt()
    .domain([0, d3.max(stationTraffic, (d) => d.totalTraffic) || 1])
    .range([0, 25]);

  svg = d3
    .select(map.getCanvasContainer())
    .append('svg')
    .attr('class', 'station-overlay');

  stationLayer = svg.append('g').attr('class', 'stations');

  tooltip = d3
    .select('body')
    .append('div')
    .attr('class', 'station-tooltip')
    .style('opacity', 0);

  const timeSlider = document.getElementById('time-slider');
  const selectedTime = document.getElementById('selected-time');
  const anyTimeLabel = document.getElementById('any-time');

  function updateTimeDisplay() {
    timeFilter = Number(timeSlider.value);

    if (timeFilter === -1) {
      selectedTime.textContent = '';
      anyTimeLabel.style.display = 'block';
    } else {
      selectedTime.textContent = formatTime(timeFilter);
      anyTimeLabel.style.display = 'none';
    }

    updateStations();
  }

  timeSlider.addEventListener('input', updateTimeDisplay);

  updateTimeDisplay();

  map.on('move', updatePositions);
  map.on('zoom', updatePositions);
  map.on('resize', updatePositions);
  map.on('moveend', updatePositions);
});