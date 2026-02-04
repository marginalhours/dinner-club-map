# Dinner Club Map

Interactive world map for tracking restaurant visits by cuisine/country. Click countries to see where you've eaten, discover new cuisines to try.

## Tech Stack

- D3.js (map visualization, zoom/pan)
- Vanilla JS + CSS
- YAML for trip data

## Local Development

```bash
npx http-server
```

Then open http://localhost:8080

## YAML Schema

Edit `data/trips.yaml` to add visits. Entries live under `trips:`.

| Field | Required | Description |
|-------|----------|-------------|
| `country` | yes | Country name (matched to map) |
| `date` | yes | Visit date (YYYY-MM-DD) |
| `restaurant` | yes | Restaurant name |
| `rating` | no | 0-5 (decimals ok) |
| `notes` | no | Freeform text |
| `maps_url` | no | Google Maps link (displays as clickable pin) |

Example:

```yaml
trips:
  - country: Italy
    date: 2024-01-15
    restaurant: Trattoria Roma
    rating: 4.5
    maps_url: https://maps.google.com/?q=Trattoria+Roma
    notes: Great pasta
```

## Feature Ideas

- [ ] Search restaurants
- [ ] Statistics view (total countries, visits, average rating)
- [ ] Add photos to visits
