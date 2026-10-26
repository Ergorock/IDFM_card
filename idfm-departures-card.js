/**
 * IDFM Departures Card
 * Carte Lovelace affichant les prochains départs d'une ou plusieurs gares
 * à partir de l'intégration "idfm" (Île-de-France Mobilités).
 */

const CARD_VERSION = "1.0.0";

// Couleurs officielles des lignes (RER, Transilien, Métro, Tram)
const LINE_COLORS = {
  A: "#E3051C", B: "#5291CE", C: "#FFCE00", D: "#00814F", E: "#C04191",
  H: "#8D5E2A", J: "#D5C900", K: "#9F9825", L: "#CEADD2", N: "#00A092",
  P: "#F0B600", R: "#E4B4D1", U: "#D60058", V: "#9B9842",
  "1": "#FFCD00", "2": "#003CA6", "3": "#837902", "3BIS": "#6EC4E8",
  "4": "#CF009E", "5": "#FF7E2E", "6": "#6ECA97", "7": "#FA9ABA",
  "7BIS": "#6ECA97", "8": "#E19BDF", "9": "#B6BD00", "10": "#C9910D",
  "11": "#704B1C", "12": "#007852", "13": "#6EC4E8", "14": "#62259D",
  T1: "#003CA6", T2: "#CF009E", T3A: "#FF7E2E", T3B: "#00AE41",
  T4: "#E19BDF", T5: "#683C11", T6: "#E2231A", T7: "#704B1C",
  T8: "#837902", T9: "#5291CE", T10: "#6E6E00", T11: "#FF5A00",
  T12: "#A50034", T13: "#8D5E2A",
};

const STATUS = {
  onTime: { label: "À l'heure", cls: "ok" },
  early: { label: "En avance", cls: "ok" },
  delayed: { label: "Retardé", cls: "warn" },
  cancelled: { label: "Supprimé", cls: "bad" },
  arrived: { label: "À quai", cls: "ok" },
  missed: { label: "Manqué", cls: "bad" },
  notExpected: { label: "Non prévu", cls: "warn" },
  noReport: { label: "", cls: "" },
};

const DEFAULTS = {
  title: "Prochains trains",
  layout: "grouped",
  max_departures: 4,
  time_display: "both",
  show_platform: true,
  show_mission: true,
  show_status: true,
  show_disruptions: true,
  hide_terminus: true,
  hide_departed: true,
  style: "modern",
  destinations: [],
};

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const norm = (s) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const parseTs = (s) => {
  if (!s || s === "unknown" || s === "unavailable") return null;
  const d = new Date(String(s).replace(" ", "T"));
  return isNaN(d) ? null : d;
};

const textColorFor = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return "#fff";
  const n = parseInt(m[1], 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? "#1a1a1a" : "#fff";
};

// Normalise l'entrée "stations" : liste d'id d'appareils ou d'objets { device, name, color }
const normalizeStations = (stations) =>
  (Array.isArray(stations) ? stations : stations ? [stations] : [])
    .map((s) => (typeof s === "string" ? { device: s } : s))
    .filter((s) => s && s.device);

// Liste les appareils créés par l'intégration idfm
const idfmDevices = (hass) => {
  const ids = new Set();
  Object.values(hass?.entities || {}).forEach((e) => {
    if (e.platform === "idfm" && e.device_id) ids.add(e.device_id);
  });
  return [...ids];
};

// Extrait les infos d'une gare (ligne, nom, capteurs) à partir de son appareil
const stationInfo = (hass, station) => {
  const dev = hass.devices?.[station.device];
  const entities = Object.values(hass.entities || {}).filter((e) => e.device_id === station.device);
  // Nom d'origine de l'appareil : "B - Arrêt - Commune -> direction"
  const raw = dev?.name || "";
  const parts = raw.split(" -> ")[0].split(" - ");
  const line = (parts.length > 1 ? parts[0] : "").trim();
  const stop = (parts.length > 1 ? parts[1] : parts[0] || "").trim();
  const departures = entities
    .filter((e) => e.entity_id.startsWith("sensor."))
    .map((e) => hass.states[e.entity_id])
    .filter(Boolean);
  const disruption = entities.find((e) => e.entity_id.startsWith("binary_sensor."));
  const calendar = entities.find((e) => e.entity_id.startsWith("calendar."));
  const color = station.color || LINE_COLORS[line.toUpperCase().replace(/\s/g, "")] || "var(--primary-color)";
  return {
    device: station.device,
    line,
    stop,
    name: station.name || dev?.name_by_user || stop || raw || "Gare",
    stopName: station.name || stop,
    color,
    textColor: textColorFor(color),
    departures,
    disruption: disruption ? hass.states[disruption.entity_id] : undefined,
    calendar: calendar ? hass.states[calendar.entity_id] : undefined,
  };
};

class IdfmDeparturesCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement("idfm-departures-card-editor");
  }

  static getStubConfig(hass) {
    const first = idfmDevices(hass)[0];
    return { title: DEFAULTS.title, stations: first ? [first] : [] };
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._expanded = new Set();
    this._lastKey = "";
  }

  setConfig(config) {
    if (!config) throw new Error("Configuration invalide");
    this._config = { ...DEFAULTS, ...config, stations: normalizeStations(config.stations) };
    this._lastKey = "";
    if (this._hass) this._render();
  }

  set hass(hass) {
    this._hass = hass;
    // Ne re-rendre que si un état utilisé a changé
    const key = this._stateKey();
    if (key !== this._lastKey) {
      this._lastKey = key;
      this._render();
    }
  }

  connectedCallback() {
    this._timer = setInterval(() => this._render(), 30000);
  }

  disconnectedCallback() {
    clearInterval(this._timer);
  }

  getCardSize() {
    const n = this._config?.stations?.length || 1;
    return 1 + n * (1 + (this._config?.max_departures || 4));
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  _stateKey() {
    if (!this._hass || !this._config) return "";
    const ids = [];
    this._config.stations.forEach((s) => {
      Object.values(this._hass.entities || {}).forEach((e) => {
        if (e.device_id === s.device) ids.push(e.entity_id);
      });
    });
    return ids.map((id) => {
      const st = this._hass.states[id];
      return st ? `${id}:${st.last_updated}` : id;
    }).join("|");
  }

  _collect(info) {
    const c = this._config;
    const now = Date.now();
    const filter = (c.destinations || []).map(norm);
    return info.departures
      .map((st) => ({
        station: info,
        time: parseTs(st.state),
        destination: st.attributes.destination || st.attributes.direction || "",
        mission: st.attributes.details || "",
        platform: st.attributes.platform || "",
        status: st.attributes.status || "",
        atStop: !!st.attributes.at_stop,
      }))
      .filter((d) => d.time)
      .filter((d) => !c.hide_departed || d.time.getTime() > now - 60000 || d.atStop)
      .filter((d) => !c.hide_terminus || !info.stop || norm(d.destination) !== norm(info.stop))
      .filter((d) => !filter.length || filter.includes(norm(d.destination)))
      .sort((a, b) => a.time - b.time);
  }

  _fmtTime(d) {
    return d.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: this._hass?.config?.time_zone,
    });
  }

  _countdown(dep) {
    if (dep.status === "cancelled") return { big: "—", unit: "" };
    if (dep.atStop) return { big: "À quai", unit: "" };
    const min = Math.floor((dep.time.getTime() - Date.now()) / 60000);
    if (min <= 0) return { big: "0", unit: "min", imminent: true };
    if (min >= 60) return { big: this._fmtTime(dep.time), unit: "" };
    return { big: String(min), unit: "min", imminent: min <= 2 };
  }

  _badge(info) {
    if (!info.line) return `<span class="badge"><ha-icon icon="mdi:train"></ha-icon></span>`;
    return `<span class="badge" style="background:${esc(info.color)};color:${esc(info.textColor)}">${esc(info.line)}</span>`;
  }

  _row(dep, merged) {
    const c = this._config;
    const st = STATUS[dep.status] || { label: dep.status, cls: "" };
    const cd = this._countdown(dep);
    const time = this._fmtTime(dep.time);
    const cancelled = dep.status === "cancelled";
    let right = "";
    if (c.time_display === "time") {
      right = `<div class="big">${esc(time)}</div>`;
    } else {
      right = `<div class="big ${cd.imminent ? "imminent" : ""}">${esc(cd.big)}${cd.unit ? `<small> ${cd.unit}</small>` : ""}</div>`;
      if (c.time_display === "both" && cd.unit) right += `<div class="sub">${esc(time)}</div>`;
    }
    const meta = [];
    if (merged) meta.push(`<span>${esc(dep.station.stopName)}</span>`);
    if (c.show_mission && dep.mission) meta.push(`<span class="mission">${esc(dep.mission)}</span>`);
    if (c.show_status && st.label) meta.push(`<span class="status ${st.cls}">${esc(st.label)}</span>`);
    return `
      <div class="row ${cancelled ? "cancelled" : ""}">
        ${merged ? this._badge(dep.station) : ""}
        <div class="main">
          <div class="dest">${esc(dep.destination)}</div>
          ${meta.length ? `<div class="meta">${meta.join("")}</div>` : ""}
        </div>
        ${c.show_platform && dep.platform ? `<div class="platform"><span>Voie</span><b>${esc(dep.platform)}</b></div>` : ""}
        <div class="when">${right}</div>
      </div>`;
  }

  _disruption(info) {
    const d = info.disruption;
    if (!this._config.show_disruptions || !d || d.state !== "on") return "";
    const title = info.calendar?.attributes?.message || d.attributes.cause || "Perturbation en cours";
    const desc = String(d.attributes.description || "").replace(/([a-zà-ÿ.)])([A-ZÀ-Ý])/g, "$1\n$2");
    const open = this._expanded.has(info.device);
    const sev = Number(d.attributes.severity) >= 40 ? "bad" : "warn";
    return `
      <div class="alert ${sev}" data-toggle="${esc(info.device)}">
        <div class="alert-head">
          <ha-icon icon="mdi:alert"></ha-icon>
          <span>${esc(title)}</span>
          ${desc ? `<ha-icon class="chev" icon="${open ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>` : ""}
        </div>
        ${open && desc ? `<div class="alert-body">${esc(desc)}</div>` : ""}
      </div>`;
  }

  _render() {
    if (!this._config || !this._hass) return;
    const c = this._config;
    const infos = c.stations.map((s) => stationInfo(this._hass, s));
    const max = Math.max(1, Number(c.max_departures) || 4);
    const empty = `<div class="empty">Aucun départ prévu</div>`;
    let body = "";

    if (!infos.length) {
      body = `<div class="empty">Sélectionnez au moins une gare dans l'éditeur de la carte.</div>`;
    } else if (c.layout === "merged") {
      const deps = infos.flatMap((i) => this._collect(i)).sort((a, b) => a.time - b.time).slice(0, max);
      body = infos.map((i) => this._disruption(i)).join("") +
        `<div class="list">${deps.length ? deps.map((d) => this._row(d, true)).join("") : empty}</div>`;
    } else {
      body = infos.map((i) => {
        const deps = this._collect(i).slice(0, max);
        return `
          <section>
            <div class="station">
              ${this._badge(i)}
              <span class="name">${esc(i.name)}</span>
            </div>
            ${this._disruption(i)}
            <div class="list">${deps.length ? deps.map((d) => this._row(d, false)).join("") : empty}</div>
          </section>`;
      }).join("");
    }

    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <ha-card class="${c.style === "board" ? "board" : ""}">
        ${c.title ? `<div class="header"><ha-icon icon="mdi:train"></ha-icon><span>${esc(c.title)}</span></div>` : ""}
        <div class="content">${body}</div>
      </ha-card>`;

    this.shadowRoot.querySelectorAll("[data-toggle]").forEach((el) =>
      el.addEventListener("click", () => {
        const id = el.dataset.toggle;
        this._expanded.has(id) ? this._expanded.delete(id) : this._expanded.add(id);
        this._render();
      })
    );
  }
}

const STYLES = `
  :host { display: block; }
  ha-card { display: block; overflow: hidden; }
  .header { display: flex; align-items: center; gap: 10px; padding: 16px 16px 4px; font-size: 1.25rem; font-weight: 500; }
  .header ha-icon { color: var(--primary-color); }
  .content { padding: 8px 16px 16px; display: flex; flex-direction: column; gap: 14px; }
  section { display: flex; flex-direction: column; gap: 6px; }
  .station { display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 1.05rem; }
  .badge { flex: none; display: inline-flex; align-items: center; justify-content: center; min-width: 28px; height: 28px; padding: 0 6px; box-sizing: border-box; border-radius: 7px; font-weight: 700; font-size: 0.95rem; background: var(--primary-color); color: #fff; }
  .badge ha-icon { --mdc-icon-size: 18px; }
  .list { display: flex; flex-direction: column; border-radius: 12px; overflow: hidden; background: var(--secondary-background-color, rgba(127,127,127,.08)); }
  .row { display: flex; align-items: center; gap: 12px; padding: 10px 12px; min-height: 44px; }
  .row + .row { border-top: 1px solid var(--divider-color, rgba(127,127,127,.2)); }
  .main { flex: 1; min-width: 0; }
  .dest { font-weight: 500; line-height: 1.25; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .meta { display: flex; flex-wrap: wrap; gap: 6px 10px; margin-top: 2px; font-size: 0.8rem; color: var(--secondary-text-color); align-items: center; }
  .mission { font-family: ui-monospace, monospace; letter-spacing: .5px; padding: 0 5px; border-radius: 4px; border: 1px solid var(--divider-color, rgba(127,127,127,.4)); }
  .status.ok { color: var(--success-color, #43a047); }
  .status.warn { color: var(--warning-color, #ffa600); font-weight: 600; }
  .status.bad { color: var(--error-color, #db4437); font-weight: 600; }
  .platform { flex: none; display: flex; flex-direction: column; align-items: center; line-height: 1.1; min-width: 36px; }
  .platform span { font-size: 0.65rem; text-transform: uppercase; color: var(--secondary-text-color); }
  .platform b { font-size: 1.05rem; }
  .when { flex: none; text-align: right; min-width: 56px; }
  .big { font-size: 1.3rem; font-weight: 700; line-height: 1.1; white-space: nowrap; }
  .big small { font-size: 0.75rem; font-weight: 500; }
  .big.imminent { color: var(--warning-color, #ffa600); }
  .sub { font-size: 0.8rem; color: var(--secondary-text-color); }
  .row.cancelled .dest, .row.cancelled .when { text-decoration: line-through; opacity: .6; }
  .empty { padding: 14px 12px; color: var(--secondary-text-color); font-style: italic; }
  .alert { border-radius: 10px; padding: 8px 12px; cursor: pointer; font-size: 0.9rem; }
  .alert.warn { background: rgba(255,166,0,.15); border-left: 4px solid var(--warning-color, #ffa600); }
  .alert.bad { background: rgba(219,68,55,.15); border-left: 4px solid var(--error-color, #db4437); }
  .alert-head { display: flex; align-items: center; gap: 8px; font-weight: 500; }
  .alert-head span { flex: 1; }
  .alert-head ha-icon { --mdc-icon-size: 20px; }
  .alert.warn .alert-head > ha-icon:first-child { color: var(--warning-color, #ffa600); }
  .alert.bad .alert-head > ha-icon:first-child { color: var(--error-color, #db4437); }
  .alert-body { margin-top: 6px; white-space: pre-line; color: var(--secondary-text-color); font-size: 0.85rem; line-height: 1.4; }

  /* Style "tableau de gare" */
  ha-card.board { --ha-card-background: #0b1e3f; background: #0b1e3f; color: #fff; }
  ha-card.board .header ha-icon { color: #ffd500; }
  ha-card.board .list { background: #10294f; }
  ha-card.board .row + .row { border-top-color: rgba(255,255,255,.12); }
  ha-card.board .dest { color: #fff; }
  ha-card.board .big { color: #ffd500; font-variant-numeric: tabular-nums; }
  ha-card.board .meta, ha-card.board .sub, ha-card.board .platform span, ha-card.board .empty, ha-card.board .alert-body { color: rgba(255,255,255,.7); }
  ha-card.board .mission { border-color: rgba(255,255,255,.35); }
`;

/* ---------------------------- Éditeur visuel ---------------------------- */

const LABELS = {
  title: "Titre",
  stations: "Gares (appareils IDFM)",
  layout: "Disposition",
  max_departures: "Nombre de départs affichés",
  time_display: "Affichage de l'heure",
  style: "Style",
  destinations: "Filtrer les destinations (vide = toutes)",
  show_platform: "Afficher la voie",
  show_mission: "Afficher le code mission",
  show_status: "Afficher le statut",
  show_disruptions: "Afficher les perturbations",
  hide_terminus: "Masquer les trains terminus",
  hide_departed: "Masquer les trains partis",
};

class IdfmDeparturesCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._form) {
      this._form.hass = hass;
    } else {
      this._render();
    }
  }

  _destinations() {
    const set = new Set();
    normalizeStations(this._config?.stations).forEach((s) => {
      stationInfo(this._hass, s).departures.forEach((st) => {
        const d = st.attributes.destination || st.attributes.direction;
        if (d) set.add(d);
      });
    });
    (this._config?.destinations || []).forEach((d) => set.add(d));
    return [...set].sort().map((d) => ({ value: d, label: d }));
  }

  _schema() {
    return [
      { name: "title", selector: { text: {} } },
      { name: "stations", required: true, selector: { device: { multiple: true, filter: { integration: "idfm" } } } },
      {
        type: "grid", name: "", schema: [
          { name: "layout", selector: { select: { mode: "dropdown", options: [
            { value: "grouped", label: "Groupé par gare" },
            { value: "merged", label: "Liste unique (toutes gares)" },
          ] } } },
          { name: "max_departures", selector: { number: { min: 1, max: 20, mode: "box" } } },
          { name: "time_display", selector: { select: { mode: "dropdown", options: [
            { value: "both", label: "Minutes + heure" },
            { value: "countdown", label: "Minutes restantes" },
            { value: "time", label: "Heure de départ" },
          ] } } },
          { name: "style", selector: { select: { mode: "dropdown", options: [
            { value: "modern", label: "Moderne (thème HA)" },
            { value: "board", label: "Tableau de gare" },
          ] } } },
        ],
      },
      { name: "destinations", selector: { select: { multiple: true, custom_value: true, options: this._destinations() } } },
      {
        type: "grid", name: "", schema: [
          { name: "show_platform", selector: { boolean: {} } },
          { name: "show_mission", selector: { boolean: {} } },
          { name: "show_status", selector: { boolean: {} } },
          { name: "show_disruptions", selector: { boolean: {} } },
          { name: "hide_terminus", selector: { boolean: {} } },
          { name: "hide_departed", selector: { boolean: {} } },
        ],
      },
    ];
  }

  _render() {
    if (!this._hass || !this._config) return;
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (s) => LABELS[s.name] || s.name;
      this._form.addEventListener("value-changed", (ev) => this._changed(ev));
      this.appendChild(this._form);
    }
    // L'éditeur manipule une simple liste d'id d'appareils
    const stations = normalizeStations(this._config.stations).map((s) => s.device);
    this._form.hass = this._hass;
    this._form.data = { ...DEFAULTS, ...this._config, stations };
    this._form.schema = this._schema();
  }

  _changed(ev) {
    ev.stopPropagation();
    const value = { ...ev.detail.value };
    // Conserve les surcharges YAML (name, color) des gares déjà configurées
    const previous = normalizeStations(this._config.stations);
    value.stations = (value.stations || []).map((id) => {
      const p = previous.find((s) => s.device === id);
      return p && Object.keys(p).length > 1 ? p : id;
    });
    // N'enregistre pas les valeurs par défaut pour garder un YAML lisible
    Object.keys(DEFAULTS).forEach((k) => {
      if (k !== "title" && JSON.stringify(value[k]) === JSON.stringify(DEFAULTS[k])) delete value[k];
    });
    this._config = value;
    this._form.schema = this._schema();
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: value }, bubbles: true, composed: true }));
  }
}

if (!customElements.get("idfm-departures-card")) customElements.define("idfm-departures-card", IdfmDeparturesCard);
if (!customElements.get("idfm-departures-card-editor")) customElements.define("idfm-departures-card-editor", IdfmDeparturesCardEditor);

window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === "idfm-departures-card")) {
  window.customCards.push({
    type: "idfm-departures-card",
    name: "IDFM – Prochains départs",
    description: "Prochains trains au départ d'une ou plusieurs gares (intégration Île-de-France Mobilités).",
    preview: true,
  });
}

console.info(`%c IDFM-DEPARTURES-CARD %c v${CARD_VERSION} `, "background:#5291CE;color:#fff;font-weight:700", "");
