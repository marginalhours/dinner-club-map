# Dinner Club Map

Interactive world map for tracking restaurant visits by cuisine/country. Click countries to see where you've eaten, discover new cuisines to try.

## Tech Stack

- D3.js (map, zoom/pan)
- Vanilla JS + CSS
- YAML data store

## Local Development

```bash
npx http-server
```

Then open http://localhost:8080

## YAML Schema

Edit `data/trips.yaml`:

| Field        | Required | Description                     |
| ------------ | -------- | ------------------------------- |
| `country`    | yes      | Country name (matched to map)   |
| `date`       | yes      | Visit date (YYYY-MM-DD)         |
| `restaurant` | yes      | Restaurant name                 |
| `maps_url`   | no       | Google Maps link (clickable 📍) |
| `notes`      | no       | Freeform text                   |

Example:

```yaml
trips:
  - country: Italy
    date: 2024-01-15
    restaurant: Trattoria Roma
    maps_url: https://maps.google.com/?q=Trattoria+Roma
    notes: Great pasta
```

## Todo

