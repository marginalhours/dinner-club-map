// Dinner Club Map App

let tripsData = [];
let visitedCountries = new Set();
let countryNameToId = {}; // "italy" -> "ITA"
let countryIdToName = {}; // "ITA" -> "Italy"

// Loaded from JSON files
let countryToContinent = {};
let alpha3to2 = {};

// Convert ISO alpha-2 code to flag emoji
function getFlag(alpha3) {
  const alpha2 = alpha3to2[alpha3];
  if (!alpha2) return "";
  return String.fromCodePoint(
    ...[...alpha2].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

// Map state (for zoom/discover)
let mapState = {
  svg: null,
  g: null,
  zoom: null,
  path: null,
  features: [],
  width: 0,
  height: 0,
};

// Initialize the app
async function init() {
  await loadMappings();
  await loadTrips();
  await loadMap();
  setupEventListeners();
  setupResizeHandler();
  addLegend();
}

// Load country mappings from JSON files
async function loadMappings() {
  try {
    const [continentsRes, codesRes] = await Promise.all([
      fetch("data/country-continents.json"),
      fetch("data/country-codes.json"),
    ]);
    countryToContinent = await continentsRes.json();
    alpha3to2 = await codesRes.json();
  } catch (error) {
    console.error("Error loading mappings:", error);
  }
}

// Load trips from YAML
async function loadTrips() {
  try {
    const response = await fetch("data/trips.yaml");
    if (!response.ok) {
      console.log("No trips.yaml found, using empty data");
      return;
    }
    const yamlText = await response.text();
    const data = jsyaml.load(yamlText);

    if (data && data.trips) {
      tripsData = data.trips;
      // Build set of visited countries (lowercase names)
      tripsData.forEach((trip) => {
        visitedCountries.add(trip.country.toLowerCase());
      });
    }
  } catch (error) {
    console.error("Error loading trips:", error);
  }
}

// Load and render the map with D3
async function loadMap() {
  const container = document.getElementById("map-container");
  const width = container.clientWidth || 960;
  const height = container.clientHeight || 500;

  try {
    const response = await fetch("data/countries.geojson");
    if (!response.ok) throw new Error("Failed to load GeoJSON");
    const geojson = await response.json();

    // Filter out tiny territories that cause click issues
    const tinyTerritories = new Set([
      "BMU",
      "ABW",
      "AIA",
      "ASM",
      "AND",
      "ATG",
      "BHR",
      "BRB",
      "BLZ",
      "VGB",
      "CYM",
      "COM",
      "COK",
      "DMA",
      "FLK",
      "FRO",
      "GIB",
      "GRD",
      "GLP",
      "GUM",
      "GGY",
      "HKG",
      "IMN",
      "JEY",
      "KIR",
      "LIE",
      "MAC",
      "MDV",
      "MLT",
      "MHL",
      "MTQ",
      "MUS",
      "FSM",
      "MCO",
      "MSR",
      "NRU",
      "ANT",
      "NCL",
      "NIU",
      "NFK",
      "MNP",
      "PLW",
      "PCN",
      "PRI",
      "REU",
      "SHN",
      "KNA",
      "LCA",
      "SPM",
      "VCT",
      "WSM",
      "SMR",
      "STP",
      "SYC",
      "SGP",
      "SXM",
      "SLB",
      "TCA",
      "TKL",
      "TON",
      "TTO",
      "TUV",
      "VIR",
      "VAT",
      "WLF",
    ]);
    geojson.features = geojson.features.filter(
      (f) => !tinyTerritories.has(f.id),
    );

    // Build name mappings from GeoJSON
    geojson.features.forEach((feature) => {
      const id = feature.id;
      const name = feature.properties.name;
      if (id && name) {
        countryNameToId[name.toLowerCase()] = id;
        countryIdToName[id] = name;
      }
    });

    // Create SVG
    const svg = d3
      .select(container)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet");

    // Scale patterns relative to viewport width (map scales with width since it's landscape)
    const unit = width / 160;
    const strokeWidth = unit / 3;
    const activeStrokeWidth = unit / 1.7;

    // Define hatch pattern for visited countries
    const defs = svg.append("defs");
    const pattern = defs
      .append("pattern")
      .attr("id", "visited-hatch")
      .attr("patternUnits", "userSpaceOnUse")
      .attr("width", unit)
      .attr("height", unit)
      .attr("patternTransform", "rotate(45)");
    pattern
      .append("rect")
      .attr("width", unit)
      .attr("height", unit)
      .attr("fill", "#dfe6e9");
    pattern
      .append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", 0)
      .attr("y2", unit)
      .attr("stroke", "#b2bec3")
      .attr("stroke-width", strokeWidth);

    // Hover hatch pattern
    const patternHover = defs
      .append("pattern")
      .attr("id", "visited-hatch-hover")
      .attr("patternUnits", "userSpaceOnUse")
      .attr("width", unit)
      .attr("height", unit)
      .attr("patternTransform", "rotate(45)");
    patternHover
      .append("rect")
      .attr("width", unit)
      .attr("height", unit)
      .attr("fill", "#c8d1d6");
    patternHover
      .append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", 0)
      .attr("y2", unit)
      .attr("stroke", "#949ea3")
      .attr("stroke-width", strokeWidth);

    // Active hatch pattern (uses visited color family)
    const patternActive = defs
      .append("pattern")
      .attr("id", "visited-hatch-active")
      .attr("patternUnits", "userSpaceOnUse")
      .attr("width", unit)
      .attr("height", unit)
      .attr("patternTransform", "rotate(45)");
    patternActive
      .append("rect")
      .attr("width", unit)
      .attr("height", unit)
      .attr("fill", "#f4ead5");
    patternActive
      .append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", 0)
      .attr("y2", unit)
      .attr("stroke", "#c4956a")
      .attr("stroke-width", activeStrokeWidth);

    // Group for all map content (zoom transforms this)
    const g = svg.append("g");

    // Ocean background (large rect so it covers when zoomed out)
    g.append("rect")
      .attr("class", "ocean")
      .attr("x", -width)
      .attr("y", -height)
      .attr("width", width * 3)
      .attr("height", height * 3);

    // Set up projection
    const projection = d3.geoNaturalEarth1().fitExtent(
      [
        [10, 10],
        [width - 10, height - 10],
      ],
      geojson,
    );

    const path = d3.geoPath().projection(projection);

    // Draw shadow layer (beneath main countries, revealed on hover via CSS lift)
    g.selectAll("path.country-shadow")
      .data(geojson.features)
      .enter()
      .append("path")
      .attr("class", "country-shadow")
      .attr("d", path);

    // Draw countries
    g.selectAll("path.country")
      .data(geojson.features)
      .enter()
      .append("path")
      .attr("class", (d) => {
        const name = d.properties.name?.toLowerCase();
        const isVisited = visitedCountries.has(name);
        return `country${isVisited ? " visited" : ""}`;
      })
      .attr("d", path)
      .attr("data-id", (d) => d.id)
      .attr("data-name", (d) => d.properties.name)
      .on("click", handleCountryClick);

    // Zoom behavior (portrait devices get higher min zoom to fill vertical space)
    const isPortrait = height > width;
    // Map is ~2:1 aspect ratio. To fill 90% of portrait height, need zoom = 0.9 * height / (width * 0.5)
    const minZoom = isPortrait ? 1.6 * (height / width) : 1;

    const zoom = d3
      .zoom()
      .scaleExtent([minZoom, 12])
      .translateExtent([
        [0, 0],
        [width, height],
      ])
      .wheelDelta((event) => -event.deltaY * 0.002)
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    // On portrait screens, start at min zoom (map fills height) centered
    if (isPortrait) {
      // Center the zoomed map in the viewport
      const initialScale = minZoom;
      const initialX = -(width * initialScale - width) / 2;
      const initialY = -(height * initialScale - height) / 2;
      svg.call(
        zoom.transform,
        d3.zoomIdentity.translate(initialX, initialY).scale(initialScale),
      );
    }

    // Store references for discover feature
    mapState = {
      svg,
      g,
      zoom,
      path,
      features: geojson.features,
      width,
      height,
    };
  } catch (error) {
    console.error("Error loading map:", error);
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
  d3.selectAll("path.country").classed("active", false);

  // Add active state to clicked country
  d3.select(event.currentTarget).classed("active", true).raise();

  // Zoom to country, positioned for sidebar
  zoomToCountry(d);

  // Get trips for this country
  const trips = getTripsForCountry(countryName);

  // Show sidebar
  showSidebar(countryName, countryId, trips);
}

// Zoom and pan to show country alongside sidebar
// Sidebar position determined by CSS media query: <=600px = bottom, >600px = left
function zoomToCountry(feature) {
  const { svg, zoom, path, width, height } = mapState;
  if (!svg) return;

  const bounds = path.bounds(feature);
  const [[x0, y0], [x1, y1]] = bounds;
  const bWidth = x1 - x0;
  const bHeight = y1 - y0;
  const bCenterX = (x0 + x1) / 2;
  const bCenterY = (y0 + y1) / 2;

  // Scale to fit country with padding (max 8x)
  const scale = Math.min(8, 0.8 / Math.max(bWidth / width, bHeight / height));

  // Target position depends on sidebar orientation (match CSS breakpoint)
  const sidebarFromBottom = window.innerWidth <= 600;
  const sidebarWidth = 400;
  let targetX, targetY;

  if (sidebarFromBottom) {
    // Sidebar from bottom (55% height): center in upper half
    targetX = width / 2;
    targetY = height * 0.225;
  } else {
    // Sidebar from left (400px): center in remaining space
    targetX = sidebarWidth + (width - sidebarWidth) / 2;
    targetY = height / 2;
  }

  // Calculate translation to put country center at target screen position
  const translateX = targetX - bCenterX * scale;
  const translateY = targetY - bCenterY * scale;

  // Animate zoom + pan
  svg
    .transition()
    .duration(750)
    .call(
      zoom.transform,
      d3.zoomIdentity.translate(translateX, translateY).scale(scale),
    );
}

// Get trips for a specific country (match by name, case-insensitive)
function getTripsForCountry(countryName) {
  const name = countryName.toLowerCase();
  return tripsData.filter((trip) => trip.country.toLowerCase() === name);
}

// Show the sidebar with trip information
function showSidebar(countryName, countryId, trips, highlightDate = null) {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebar-overlay");
  const title = document.getElementById("sidebar-title");
  const tripsList = document.getElementById("trips-list");

  // Set title with flag
  const flag = getFlag(countryId);
  title.innerHTML = flag
    ? `<span class="sidebar-flag">${flag}</span><span class="sidebar-country">${escapeHtml(countryName)}</span>`
    : `<span class="sidebar-country">${escapeHtml(countryName)}</span>`;

  // Populate trips
  if (trips.length === 0) {
    const searchQuery = encodeURIComponent(
      `${countryName} restaurants near London, UK`,
    );
    const mapsUrl = `https://www.google.com/maps/search/${searchQuery}`;
    tripsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🍽️</div>
                <p class="empty-state-text">No visits yet!</p>
                <a href="${mapsUrl}" target="_blank" rel="noopener" class="find-btn">Find a restaurant</a>
            </div>
        `;
  } else {
    const searchQuery = encodeURIComponent(
      `${countryName} restaurants near London, UK`,
    );
    const mapsUrl = `https://www.google.com/maps/search/${searchQuery}`;
    tripsList.innerHTML =
      trips.map((trip) => createTripCard(trip, highlightDate)).join("") +
      `<a href="${mapsUrl}" target="_blank" rel="noopener" class="find-btn find-btn-secondary">Find another restaurant</a>`;
  }

  // Show sidebar
  sidebar.classList.add("open");
  overlay.classList.add("visible");

  // Scroll to highlighted card if present
  if (highlightDate) {
    setTimeout(() => {
      const highlighted = tripsList.querySelector(".trip-card.highlighted");
      if (highlighted) {
        highlighted.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
  }
}

// Create HTML for a trip card
function createTripCard(trip, highlightDate = null) {
  const date = trip.date ? formatDate(trip.date) : "";
  const location = trip.maps_url
    ? `<a href="${escapeHtml(trip.maps_url)}" target="_blank" rel="noopener" class="trip-location">📍 Google Maps</a>`
    : "";
  const notes = trip.notes
    ? `<div class="trip-notes">"${trip.notes}"</div>`
    : "";
  const isHighlighted = highlightDate && trip.date === highlightDate;

  return `
        <div class="trip-card${isHighlighted ? " highlighted" : ""}" data-date="${escapeHtml(trip.date || "")}">
            <div class="trip-restaurant">${escapeHtml(trip.restaurant)}</div>
            <div class="trip-meta">
                ${date ? `<span>📅 ${date}</span>` : ""}
                ${location}
            </div>
            ${notes}
        </div>
    `;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Format date for display
function formatDate(dateStr) {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

// Handle viewport resize (rotation, etc.)
function setupResizeHandler() {
  let resizeTimeout;
  const container = document.getElementById("map-container");

  const handleResize = () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const { svg, g, zoom, path, features } = mapState;
      if (!svg) return;

      const newWidth = container.clientWidth || 960;
      const newHeight = container.clientHeight || 500;

      // Update SVG viewBox
      svg.attr("viewBox", `0 0 ${newWidth} ${newHeight}`);

      // Update zoom constraints (match loadMap formula)
      const isPortrait = newHeight > newWidth;
      const minZoom = isPortrait ? 1.6 * (newHeight / newWidth) : 1;

      zoom.scaleExtent([minZoom, 12]).translateExtent([
        [0, 0],
        [newWidth, newHeight],
      ]);

      // Update mapState
      mapState.width = newWidth;
      mapState.height = newHeight;

      // Re-fit projection and redraw paths
      const projection = d3.geoNaturalEarth1().fitExtent(
        [
          [10, 10],
          [newWidth - 10, newHeight - 10],
        ],
        { type: "FeatureCollection", features },
      );
      const newPath = d3.geoPath().projection(projection);
      mapState.path = newPath;

      // Update all country paths
      g.selectAll("path.country").attr("d", newPath);
      g.selectAll("path.country-shadow").attr("d", newPath);

      // Reset to initial view for new orientation
      if (isPortrait) {
        const initialScale = minZoom;
        const initialX = -(newWidth * initialScale - newWidth) / 2;
        const initialY = -(newHeight * initialScale - newHeight) / 2;
        svg.call(
          zoom.transform,
          d3.zoomIdentity.translate(initialX, initialY).scale(initialScale),
        );
      } else {
        svg.call(zoom.transform, d3.zoomIdentity);
      }
    }, 150);
  };

  // Use ResizeObserver for robust detection
  if (window.ResizeObserver) {
    new ResizeObserver(handleResize).observe(container);
  } else {
    window.addEventListener("resize", handleResize);
  }
}

// Close the sidebar
function closeSidebar() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebar-overlay");

  sidebar.classList.remove("open");
  overlay.classList.remove("visible");

  // Remove active state from country
  d3.selectAll("path.country").classed("active", false);
}

// Setup event listeners
function setupEventListeners() {
  document
    .getElementById("sidebar-close")
    .addEventListener("click", closeSidebar);
  document
    .getElementById("sidebar-overlay")
    .addEventListener("click", closeSidebar);
  document
    .getElementById("discover-btn")
    .addEventListener("click", discoverCountry);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeSidebar();
      closeStatsModal();
      closeCalendarModal();
    }
  });

  // Stats modal
  document
    .getElementById("stats-btn")
    .addEventListener("click", openStatsModal);
  document
    .getElementById("stats-close")
    .addEventListener("click", closeStatsModal);
  document.getElementById("stats-overlay").addEventListener("click", (e) => {
    if (e.target.id === "stats-overlay") closeStatsModal();
  });

  // Calendar modal
  document
    .getElementById("calendar-btn")
    .addEventListener("click", openCalendarModal);
  document
    .getElementById("calendar-close")
    .addEventListener("click", closeCalendarModal);
  document.getElementById("calendar-overlay").addEventListener("click", (e) => {
    if (e.target.id === "calendar-overlay") closeCalendarModal();
  });
}

// Stats modal
function openStatsModal() {
  const overlay = document.getElementById("stats-overlay");
  const content = document.getElementById("stats-content");

  content.innerHTML = buildStatsContent();
  overlay.classList.add("visible");

  // Add click handlers to carousel items
  content.querySelectorAll(".carousel-item").forEach((item) => {
    item.addEventListener("click", () => {
      const countryName = item.dataset.country;
      const countryId = item.dataset.countryId;
      if (countryName) {
        closeStatsModal();
        openCountryFromCarousel(countryName, countryId);
      }
    });
  });
}

function closeStatsModal() {
  document.getElementById("stats-overlay").classList.remove("visible");
}

// Calendar modal
function openCalendarModal() {
  const overlay = document.getElementById("calendar-overlay");
  const content = document.getElementById("calendar-content");

  content.innerHTML = buildCalendarContent();
  overlay.classList.add("visible");

  // Add click handlers to active months
  content.querySelectorAll(".streak-month.active").forEach((cell) => {
    cell.addEventListener("click", () => {
      const tripDate = cell.dataset.tripDate;
      const tripCountry = cell.dataset.tripCountry;
      if (tripCountry) {
        closeCalendarModal();
        openCountryFromCalendar(tripCountry, tripDate);
      }
    });
  });
}

function closeCalendarModal() {
  document.getElementById("calendar-overlay").classList.remove("visible");
}

function buildCalendarContent() {
  const monthNames = [
    "J",
    "F",
    "M",
    "A",
    "M",
    "J",
    "J",
    "A",
    "S",
    "O",
    "N",
    "D",
  ];

  // Group trips by year and month (store first trip for each month)
  const tripsByYearMonth = {};
  tripsData.forEach((trip) => {
    if (!trip.date) return;
    const date = new Date(trip.date);
    const year = date.getFullYear();
    const month = date.getMonth();
    const key = `${year}-${month}`;
    if (!tripsByYearMonth[key]) {
      tripsByYearMonth[key] = trip;
    }
  });

  // Get year range
  const years = [
    ...new Set(tripsData.map((t) => new Date(t.date).getFullYear())),
  ].sort();
  if (years.length === 0) {
    return '<div class="empty-state">No trips recorded yet</div>';
  }

  const minYear = years[0];
  const maxYear = Math.max(years[years.length - 1], new Date().getFullYear());

  let html = "";
  let totalMonths = 0;
  let activeMonths = 0;

  // Month header row
  html += `<div class="streak-header"><div class="streak-year-label"></div><div class="streak-months">`;
  monthNames.forEach((m) => {
    html += `<div class="streak-month-header">${m}</div>`;
  });
  html += `</div></div>`;

  // Build year rows (most recent first)
  for (let year = maxYear; year >= minYear; year--) {
    html += `<div class="streak-year">`;
    html += `<div class="streak-year-label">${year}</div>`;
    html += `<div class="streak-months">`;

    for (let month = 0; month < 12; month++) {
      const key = `${year}-${month}`;
      const trip = tripsByYearMonth[key];
      const isFuture =
        year === new Date().getFullYear() && month > new Date().getMonth();

      if (!isFuture) {
        totalMonths++;
        if (trip) activeMonths++;
      }

      if (trip) {
        const tripDate = trip.date || "";
        const tripCountry = trip.country || "";
        html += `<div class="streak-month active" data-trip-date="${escapeHtml(tripDate)}" data-trip-country="${escapeHtml(tripCountry)}"></div>`;
      } else {
        html += `<div class="streak-month${isFuture ? " future" : ""}"></div>`;
      }
    }

    html += `</div></div>`;
  }

  html += `<div class="streak-summary">${activeMonths}/${totalMonths} months (${Math.round((activeMonths / totalMonths) * 100)}%)</div>`;

  return html;
}

function openCountryFromCalendar(countryName, tripDate) {
  const countryId = countryNameToId[countryName.toLowerCase()];

  // Remove previous active state and set new one
  d3.selectAll("path.country").classed("active", false);
  if (countryId) {
    d3.select(`path[data-id="${countryId}"]`).classed("active", true).raise();
  }

  // Get trips and show sidebar
  const displayName = countryIdToName[countryId] || countryName;
  const trips = getTripsForCountry(displayName);
  showSidebar(displayName, countryId, trips, tripDate);
}

function openCountryFromCarousel(countryName, countryId) {
  // Remove previous active state and set new one
  d3.selectAll("path.country").classed("active", false);
  if (countryId) {
    d3.select(`path[data-id="${countryId}"]`).classed("active", true).raise();
  }

  // Get trips and show sidebar
  const trips = getTripsForCountry(countryName);
  showSidebar(countryName, countryId, trips);
}

function buildStatsContent() {
  const features = mapState.features || [];
  const totalCountries = features.length;
  const visitedCount = visitedCountries.size;
  const percentage =
    totalCountries > 0 ? ((visitedCount / totalCountries) * 100).toFixed(1) : 0;

  // Continent breakdown
  const continentStats = {};
  const continentTotals = {};

  features.forEach((f) => {
    const continent = countryToContinent[f.id] || "Other";
    continentTotals[continent] = (continentTotals[continent] || 0) + 1;

    const name = f.properties.name?.toLowerCase();
    if (visitedCountries.has(name)) {
      continentStats[continent] = (continentStats[continent] || 0) + 1;
    }
  });

  // Most visited countries (by trip count)
  const tripCounts = {};
  tripsData.forEach((trip) => {
    const country = trip.country.toLowerCase();
    tripCounts[country] = (tripCounts[country] || 0) + 1;
  });

  const mostVisited = Object.entries(tripCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Build HTML
  let html = `
    <div class="stats-overview">
      <div class="stats-big-number">${visitedCount}/${totalCountries}</div>
      <div class="stats-label">countries visited</div>
      <div class="stats-percentage">${percentage}%</div>
    </div>
  `;

  // Continent breakdown
  const continentOrder = [
    "Europe",
    "Asia",
    "Africa",
    "North America",
    "South America",
    "Oceania",
  ];
  html += `<div class="stats-section"><h3>By Continent</h3><div class="continent-list">`;

  continentOrder.forEach((continent) => {
    const visited = continentStats[continent] || 0;
    const total = continentTotals[continent] || 0;
    if (total > 0) {
      html += `
        <div class="continent-row">
          <span class="continent-name">${continent}</span>
          <span class="continent-stat">${visited}/${total} (${Math.round((visited / total) * 100)}%)</span>
        </div>
      `;
    }
  });
  html += `</div></div>`;

  // Most visited carousel
  if (mostVisited.length > 0) {
    html += `<div class="stats-section"><h3>Most Visited</h3><div class="carousel">`;

    mostVisited.forEach(([country, count]) => {
      const countryId = countryNameToId[country];
      const displayName = countryIdToName[countryId] || country;
      const flag = countryId ? getFlag(countryId) : "";

      html += `
        <div class="carousel-item" data-country="${escapeHtml(displayName)}" data-country-id="${countryId || ""}">
          <div class="carousel-flag">${flag}</div>
          <div class="carousel-country">${escapeHtml(displayName)}</div>
          <div class="carousel-count">${count} visit${count > 1 ? "s" : ""}</div>
        </div>
      `;
    });

    html += `</div></div>`;
  }

  return html;
}

// Discover a random unvisited country
function discoverCountry() {
  const { svg, features } = mapState;
  if (!svg || !features.length) return;

  // Find unvisited countries
  const unvisited = features.filter((f) => {
    const name = f.properties.name?.toLowerCase();
    return !visitedCountries.has(name);
  });

  if (unvisited.length === 0) {
    alert("You've visited everywhere! Amazing!");
    return;
  }

  // Pick random unvisited country
  const country = unvisited[Math.floor(Math.random() * unvisited.length)];

  // Highlight and show sidebar
  d3.selectAll("path.country").classed("active", false);
  d3.select(`path[data-id="${country.id}"]`).classed("active", true).raise();
  zoomToCountry(country);
  showSidebar(country.properties.name, country.id, []);
}

// Add legend to the map (disabled)
function addLegend() {
  // Removed - people will get it
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", init);
