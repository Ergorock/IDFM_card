# IDFM – Prochains départs (`custom:idfm-departures-card`)

*[English version](README.md)*

Carte Lovelace qui affiche les prochains trains d'une ou plusieurs gares à partir de l'intégration **idfm** (Île-de-France Mobilités).

L'interface est disponible en français et en anglais (elle suit la langue de Home Assistant).

## Installation

### HACS (dépôt personnalisé)

1. HACS → menu ⋮ → *Dépôts personnalisés* → ajoutez `https://github.com/Ergorock/IDFM_card`, catégorie **Dashboard**.
2. Installez **IDFM Departures Card**, puis rechargez le navigateur.

### Manuelle

1. Copiez `idfm-departures-card.js` dans `config/www/idfm-departures-card.js`.
2. *Paramètres → Tableaux de bord → ⋮ → Ressources* : ajoutez `/local/idfm-departures-card.js?v=1.0.0` (type *Module JavaScript*).

Après une mise à jour, faites un rafraîchissement forcé du navigateur (Ctrl+Maj+R).

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
