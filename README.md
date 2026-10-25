# IDFM – Prochains départs (`custom:idfm-departures-card`)

Carte Lovelace qui affiche les prochains trains d'une ou plusieurs gares à partir de l'intégration **idfm** (Île-de-France Mobilités).

## Installation

La carte est enregistrée comme ressource de tableau de bord (module JavaScript intégré directement dans la ressource).
Après une mise à jour du code, remplacez la ressource puis faites un rafraîchissement forcé du navigateur (Ctrl+Maj+R).

## Utilisation

Dans un tableau de bord : **Ajouter une carte → IDFM – Prochains départs**. Tous les réglages se font dans l'éditeur visuel.

| Option | Défaut | Description |
|---|---|---|
| `title` | `Prochains trains` | Titre de la carte (vide = aucun titre) |
| `stations` | — | Liste des appareils IDFM (une gare = un appareil de l'intégration) |
| `layout` | `grouped` | `grouped` (une section par gare) ou `merged` (une seule liste triée) |
| `max_departures` | `4` | Nombre de départs affichés (par gare en mode `grouped`) |
| `time_display` | `both` | `both`, `countdown` (minutes) ou `time` (heure) |
| `style` | `modern` | `modern` (thème HA) ou `board` (tableau de gare) |
| `destinations` | `[]` | Ne garder que ces destinations (vide = toutes) |
| `show_platform` / `show_mission` / `show_status` / `show_disruptions` | `true` | Éléments affichés |
| `hide_terminus` | `true` | Masque les trains dont la gare est le terminus (arrivées) |
| `hide_departed` | `true` | Masque les trains déjà partis |

En YAML, une gare peut aussi être un objet pour surcharger son nom ou la couleur de la ligne :

```yaml
type: custom:idfm-departures-card
stations:
  - device: 33488fefc14287feb4eba02094c86eba
    name: Saint-Rémy
    color: "#5291CE"
layout: grouped
```

Le nombre de départs disponibles dépend du nombre de capteurs créés par l'intégration (4 par défaut).
Pour ajouter une gare : **Paramètres → Appareils et services → Île-de-France Mobilités → Ajouter une entrée**.

`test/preview.html` permet de prévisualiser la carte hors de Home Assistant avec des données fictives.
