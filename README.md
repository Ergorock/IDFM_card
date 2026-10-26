# IDFM – Next departures (`custom:idfm-departures-card`)

*[Version française](README.fr.md)*

Lovelace card that shows the next trains from one or more stations, using the **idfm** integration (Île-de-France Mobilités).

The interface is available in English and French (it follows the Home Assistant language).

## Installation

### HACS (custom repository)

1. HACS → ⋮ menu → *Custom repositories* → add `https://github.com/Ergorock/IDFM_card`, category **Dashboard**.
2. Install **IDFM Departures Card**, then reload your browser.

### Manual

1. Copy `idfm-departures-card.js` to `config/www/idfm-departures-card.js`.
2. *Settings → Dashboards → ⋮ → Resources*: add `/local/idfm-departures-card.js?v=1.0.0` (type *JavaScript module*).

After an update, force-refresh your browser (Ctrl+Shift+R).

## Usage

In a dashboard: **Add card → IDFM – Next departures**. Everything is set in the visual editor.

| Option | Default | Description |
|---|---|---|
| `title` | `Next trains` | Card title (empty = no title) |
| `stations` | — | List of IDFM devices (one station = one device of the integration) |
| `layout` | `grouped` | `grouped` (one section per station) or `merged` (a single sorted list) |
| `max_departures` | `4` | Number of departures shown (per station in `grouped` mode) |
| `time_display` | `both` | `both`, `countdown` (minutes) or `time` (clock time) |
| `style` | `modern` | `modern` (HA theme) or `board` (station departure board) |
| `destinations` | `[]` | Only keep these destinations (empty = all) |
| `show_platform` / `show_mission` / `show_status` / `show_disruptions` | `true` | Elements shown |
| `hide_terminus` | `true` | Hides trains whose terminus is the station (arrivals) |
| `hide_departed` | `true` | Hides trains that have already left |

In YAML, a station can also be an object to override its name or the line color:

```yaml
type: custom:idfm-departures-card
stations:
  - device: 33488fefc14287feb4eba02094c86eba
    name: Saint-Rémy
    color: "#5291CE"
layout: grouped
```

The number of available departures depends on the number of sensors created by the integration (4 by default).
To add a station: **Settings → Devices & services → Île-de-France Mobilités → Add entry**.

`test/preview.html` previews the card outside Home Assistant with mock data.
