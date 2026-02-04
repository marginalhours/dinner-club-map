// Dinner Club Map App

let tripsData = [];
let visitedCountries = new Set();
let countryNameToId = {};  // "italy" -> "ITA"
let countryIdToName = {};  // "ITA" -> "Italy"

// Map state (for zoom/discover)
let mapState = {
    svg: null,
    g: null,
    zoom: null,
    path: null,
    features: [],
    width: 0,
    height: 0
};

// Initialize the app
async function init() {
    await loadTrips();
    await loadMap();
    setupEventListeners();
    addLegend();
}

// Load trips from YAML
async function loadTrips() {
    try {
        const response = await fetch('data/trips.yaml');
        if (!response.ok) {
            console.log('No trips.yaml found, using empty data');
            return;
        }
        const yamlText = await response.text();
        const data = jsyaml.load(yamlText);

        if (data && data.trips) {
            tripsData = data.trips;
            // Build set of visited countries (lowercase names)
            tripsData.forEach(trip => {
                visitedCountries.add(trip.country.toLowerCase());
            });
        }
    } catch (error) {
        console.error('Error loading trips:', error);
    }
}

// Load and render the map with D3
async function loadMap() {
    const container = document.getElementById('map-container');
    const width = container.clientWidth || 960;
    const height = container.clientHeight || 500;

    try {
        const response = await fetch('data/countries.geojson');
        if (!response.ok) throw new Error('Failed to load GeoJSON');
        const geojson = await response.json();

        // Filter out tiny territories that cause click issues
        const tinyTerritories = new Set([
            'BMU', 'ABW', 'AIA', 'ASM', 'AND', 'ATG', 'BHR', 'BRB', 'BLZ',
            'VGB', 'CYM', 'COM', 'COK', 'DMA', 'FLK', 'FRO', 'GIB', 'GRD', 'GLP',
            'GUM', 'GGY', 'HKG', 'IMN', 'JEY', 'KIR', 'LIE', 'MAC', 'MDV', 'MLT',
            'MHL', 'MTQ', 'MUS', 'FSM', 'MCO', 'MSR', 'NRU', 'ANT', 'NCL', 'NIU',
            'NFK', 'MNP', 'PLW', 'PCN', 'PRI', 'REU', 'SHN', 'KNA', 'LCA',
            'SPM', 'VCT', 'WSM', 'SMR', 'STP', 'SYC', 'SGP', 'SXM', 'SLB', 'TCA',
            'TKL', 'TON', 'TTO', 'TUV', 'VIR', 'VAT', 'WLF'
        ]);
        geojson.features = geojson.features.filter(f => !tinyTerritories.has(f.id));

        // Build name mappings from GeoJSON
        geojson.features.forEach(feature => {
            const id = feature.id;
            const name = feature.properties.name;
            if (id && name) {
                countryNameToId[name.toLowerCase()] = id;
                countryIdToName[id] = name;
            }
        });

        // Create SVG
        const svg = d3.select(container)
            .append('svg')
            .attr('viewBox', `0 0 ${width} ${height}`)
            .attr('preserveAspectRatio', 'xMidYMid meet');

        // Group for all map content (zoom transforms this)
        const g = svg.append('g');

        // Ocean background (large rect so it covers when zoomed out)
        g.append('rect')
            .attr('class', 'ocean')
            .attr('x', -width)
            .attr('y', -height)
            .attr('width', width * 3)
            .attr('height', height * 3);

        // Set up projection
        const projection = d3.geoNaturalEarth1()
            .fitExtent([[10, 10], [width - 10, height - 10]], geojson);

        const path = d3.geoPath().projection(projection);

        // Draw countries
        g.selectAll('path.country')
            .data(geojson.features)
            .enter()
            .append('path')
            .attr('class', d => {
                const name = d.properties.name?.toLowerCase();
                const isVisited = visitedCountries.has(name);
                return `country${isVisited ? ' visited' : ''}`;
            })
            .attr('d', path)
            .attr('data-id', d => d.id)
            .attr('data-name', d => d.properties.name)
            .on('click', handleCountryClick);

        // Zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([1, 12])
            .wheelDelta((event) => -event.deltaY * 0.002)
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });

        svg.call(zoom);

        // Store references for discover feature
        mapState = { svg, g, zoom, path, features: geojson.features, width, height };

    } catch (error) {
        console.error('Error loading map:', error);
        container.innerHTML = `
            <div style="padding: 2rem; text-align: center; color: #636e72;">
                <p>Failed to load map data.</p>
                <p style="font-size: 0.875rem;">Make sure countries.geojson is in the data folder.</p>
            </div>
        `;
    }
}

// Handle country click
function handleCountryClick(event, d) {
    const countryName = d.properties.name;
    const countryId = d.id;

    // Remove previous active state
    d3.selectAll('path.country').classed('active', false);

    // Add active state to clicked country
    d3.select(event.currentTarget).classed('active', true);

    // Get trips for this country
    const trips = getTripsForCountry(countryName);

    // Show sidebar
    showSidebar(countryName, trips);
}

// Get trips for a specific country (match by name, case-insensitive)
function getTripsForCountry(countryName) {
    const name = countryName.toLowerCase();
    return tripsData.filter(trip => trip.country.toLowerCase() === name);
}

// Show the sidebar with trip information
function showSidebar(countryName, trips) {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const title = document.getElementById('sidebar-title');
    const tripsList = document.getElementById('trips-list');

    // Set title
    title.textContent = countryName;

    // Populate trips
    if (trips.length === 0) {
        tripsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🍽️</div>
                <p class="empty-state-text">No visits yet!</p>
                <p class="empty-state-text" style="margin-top: 0.5rem; font-size: 0.875rem;">
                    Time to find a great ${countryName} restaurant?
                </p>
            </div>
        `;
    } else {
        tripsList.innerHTML = trips.map(trip => createTripCard(trip)).join('');
    }

    // Show sidebar
    sidebar.classList.add('open');
    overlay.classList.add('visible');
}

// Create HTML for a trip card
function createTripCard(trip) {
    const date = trip.date ? formatDate(trip.date) : '';
    const rating = trip.rating ? `<span class="trip-rating">★ ${trip.rating}</span>` : '';
    const location = trip.location ? `<span>📍 ${trip.location}</span>` : '';
    const notes = trip.notes ? `<div class="trip-notes">"${trip.notes}"</div>` : '';

    return `
        <div class="trip-card">
            <div class="trip-restaurant">${escapeHtml(trip.restaurant)}</div>
            <div class="trip-meta">
                ${date ? `<span>📅 ${date}</span>` : ''}
                ${location}
                ${rating}
            </div>
            ${notes}
        </div>
    `;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Format date for display
function formatDate(dateStr) {
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch {
        return dateStr;
    }
}

// Close the sidebar
function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    sidebar.classList.remove('open');
    overlay.classList.remove('visible');

    // Remove active state from country
    d3.selectAll('path.country').classed('active', false);
}

// Setup event listeners
function setupEventListeners() {
    document.getElementById('sidebar-close').addEventListener('click', closeSidebar);
    document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);
    document.getElementById('discover-btn').addEventListener('click', discoverCountry);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeSidebar();
        }
    });
}

// Discover a random unvisited country
function discoverCountry() {
    const { svg, g, zoom, path, features, width, height } = mapState;
    if (!svg || !features.length) return;

    // Find unvisited countries
    const unvisited = features.filter(f => {
        const name = f.properties.name?.toLowerCase();
        return !visitedCountries.has(name);
    });

    if (unvisited.length === 0) {
        alert('You\'ve visited everywhere! Amazing!');
        return;
    }

    // Pick random unvisited country
    const country = unvisited[Math.floor(Math.random() * unvisited.length)];
    const bounds = path.bounds(country);

    // Calculate zoom transform to fit country
    const [[x0, y0], [x1, y1]] = bounds;
    const bWidth = x1 - x0;
    const bHeight = y1 - y0;
    const bCenterX = (x0 + x1) / 2;
    const bCenterY = (y0 + y1) / 2;

    // Scale to fit with padding
    const scale = Math.min(8, 0.8 / Math.max(bWidth / width, bHeight / height));
    const translateX = width / 2 - bCenterX * scale;
    const translateY = height / 2 - bCenterY * scale;

    // Animate zoom
    svg.transition()
        .duration(1000)
        .call(zoom.transform, d3.zoomIdentity.translate(translateX, translateY).scale(scale));

    // Highlight and show sidebar
    d3.selectAll('path.country').classed('active', false);
    d3.select(`path[data-id="${country.id}"]`).classed('active', true);
    showSidebar(country.properties.name, []);
}

// Add legend to the map
function addLegend() {
    const main = document.querySelector('.main');
    const legend = document.createElement('div');
    legend.className = 'legend';
    legend.innerHTML = `
        <div class="legend-item">
            <div class="legend-color visited"></div>
            <span>Visited</span>
        </div>
        <div class="legend-item">
            <div class="legend-color not-visited"></div>
            <span>Not visited</span>
        </div>
    `;
    main.appendChild(legend);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
