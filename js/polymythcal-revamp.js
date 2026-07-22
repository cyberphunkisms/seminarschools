(() => {
  "use strict";

  const DATA_URL = "/polymythseminars/events.json";
  const CALENDAR_TIME_ZONE = "America/Toronto";
  const CALENDAR_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
    timeZone: CALENDAR_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric"
  });
  let cachedTodayMinute = -1;
  let cachedCalendarToday = null;
  const PAGE_SIZE = 50;
  const SAVED_KEY = "polymythcal.savedEvents.v2";
  const SET_KEYS = ["content", "places", "topics", "eventTypes", "opportunityTypes", "audiences", "formats", "statuses"];
  const STATE_KEYS = ["content", "time", ...SET_KEYS.filter(key => key !== "content")];

  const translations = {
    en: {
      loading: "Loading the calendar",
      loadError: "The calendar data could not be loaded. Refresh the page or use the calendar feeds.",
      eventsFound: count => `${count.toLocaleString("en-CA")} ${count === 1 ? "listing" : "listings"}`,
      shown: (shown, total) => `Showing ${shown.toLocaleString("en-CA")} of ${total.toLocaleString("en-CA")}`,
      calendarStatus: total => `${total.toLocaleString("en-CA")} matching listings in calendar view`,
      noResults: "No listings match these choices",
      noResultsHelp: "Remove one choice or reset the filters to widen the search.",
      clearAll: "Reset all",
      activeNone: "Upcoming events and opportunities",
      saved: "Saved",
      save: "Save",
      remove: "Remove",
      savedEmpty: "You have no saved listings yet.",
      source: "Official source",
      details: "View details",
      timePending: "Time unpublished",
      placePending: "Location unpublished",
      confirmed: "Confirmed",
      detailsPending: "Details pending",
      attend: "Event",
      apply: "Opportunity",
      loadMore: "Show more",
      shared: "Share link copied",
      shareOpened: "Share options opened",
      shareFail: "The share link is ready in your address bar.",
      calendarMore: n => `Show ${n} more`,
      monthPrevious: "Previous month",
      monthNext: "Next month",
      monthToday: "Go to this month",
      noMonthResults: "No matching listings in this month.",
      removeFilter: label => `Remove ${label}`,
      filtersSelected: count => count === 0 ? "No extra filters" : `${count} selected`,
      viewResults: count => `View ${count.toLocaleString("en-CA")} results`,
      resultPreview: count => `${count.toLocaleString("en-CA")} results`,
      oneContentRequired: "Keep at least one of Events or Opportunities selected.",
      presetApplied: label => `${label} view opened`,
      savedOn: date => `Saved listing for ${date}`,
      resultsReady: count => `${count.toLocaleString("en-CA")} matching listings`,
      eventsOnly: "Events only",
      opportunitiesOnly: "Opportunities only",
      clearSection: "Clear",
      ongoing: "Ongoing",
      until: "Until",
      ongoingNow: "Ongoing now",
      runningThisMonth: count => `${count.toLocaleString("en-CA")} ongoing or multi-day ${count === 1 ? "listing" : "listings"} this month`,
      runningHelp: "Shown once here instead of being repeated on every calendar day."
    },
    fr: {
      loading: "Chargement du calendrier",
      loadError: "Les données du calendrier sont indisponibles. Actualisez la page ou utilisez les fils du calendrier.",
      eventsFound: count => `${count.toLocaleString("fr-CA")} ${count === 1 ? "fiche" : "fiches"}`,
      shown: (shown, total) => `${shown.toLocaleString("fr-CA")} sur ${total.toLocaleString("fr-CA")} affichées`,
      calendarStatus: total => `${total.toLocaleString("fr-CA")} fiches correspondantes en vue calendrier`,
      noResults: "Aucune fiche ne correspond à ces choix",
      noResultsHelp: "Retirez un choix ou réinitialisez les filtres pour élargir la recherche.",
      clearAll: "Tout réinitialiser",
      activeNone: "Événements et possibilités à venir",
      saved: "Enregistré",
      save: "Enregistrer",
      remove: "Retirer",
      savedEmpty: "Vous n’avez encore enregistré aucune fiche.",
      source: "Source officielle",
      details: "Voir les détails",
      timePending: "Heure non publiée",
      placePending: "Lieu non publié",
      confirmed: "Confirmé",
      detailsPending: "Détails à confirmer",
      attend: "Événement",
      apply: "Possibilité",
      loadMore: "Afficher plus",
      shared: "Lien de partage copié",
      shareOpened: "Options de partage ouvertes",
      shareFail: "Le lien de partage est prêt dans la barre d’adresse.",
      calendarMore: n => `Afficher ${n} autres`,
      monthPrevious: "Mois précédent",
      monthNext: "Mois suivant",
      monthToday: "Aller au mois actuel",
      noMonthResults: "Aucune fiche correspondante ce mois-ci.",
      removeFilter: label => `Retirer ${label}`,
      filtersSelected: count => count === 0 ? "Aucun filtre supplémentaire" : `${count} sélectionnés`,
      viewResults: count => `Voir ${count.toLocaleString("fr-CA")} résultats`,
      resultPreview: count => `${count.toLocaleString("fr-CA")} résultats`,
      oneContentRequired: "Gardez au moins Événements ou Possibilités sélectionné.",
      presetApplied: label => `Vue ${label} ouverte`,
      savedOn: date => `Fiche enregistrée pour le ${date}`,
      resultsReady: count => `${count.toLocaleString("fr-CA")} fiches correspondantes`,
      eventsOnly: "Événements seulement",
      opportunitiesOnly: "Possibilités seulement",
      clearSection: "Effacer",
      ongoing: "En cours",
      until: "Jusqu’au",
      ongoingNow: "En cours maintenant",
      runningThisMonth: count => `${count.toLocaleString("fr-CA")} ${count === 1 ? "fiche en cours ou sur plusieurs jours" : "fiches en cours ou sur plusieurs jours"} ce mois-ci`,
      runningHelp: "Affichées une seule fois ici plutôt que répétées chaque jour du calendrier."
    }
  };

  const staticFrench = {
    "Skip to results": "Aller aux résultats",
    "Switch colour theme": "Changer le thème de couleurs",
    "Seminar Schools public calendar": "Calendrier public de Seminar Schools",
    "Find public events to attend and opportunities to apply for across Toronto, Kingston, Montréal, and the communities between them.": "Trouvez des événements publics et des possibilités de candidature à Toronto, Kingston, Montréal et dans les communautés qui les relient.",
    "Search the calendar": "Rechercher dans le calendrier",
    "Clear search": "Effacer la recherche",
    "Show results": "Voir les résultats",
    "Search accepts English, French, accents, and close spellings such as “Montral”.": "La recherche accepte le français, l’anglais, les accents et les orthographes proches comme « Montral ».",
    "Popular starting points": "Points de départ populaires",
    "Each shortcut starts a fresh view": "Chaque raccourci ouvre une nouvelle vue",
    "Philosophy and ethics": "Philosophie et éthique",
    "Humanities": "Sciences humaines",
    "Talks and lectures": "Causeries et conférences",
    "Festivals": "Festivals",
    "Writing and literature": "Écriture et littérature",
    "Fellowships and grants": "Bourses et subventions",
    "Toronto and GTA": "Toronto et RGT",
    "Kingston to Montréal": "Kingston à Montréal",
    "Share view": "Partager la vue",
    "Saved": "Enregistrés",
    "Get calendar updates": "Recevoir les mises à jour",
    "Submit an event": "Proposer un événement",
    "Correct a listing": "Corriger une fiche",
    "Français": "English",
    "Saved on this device": "Enregistré sur cet appareil",
    "Saved listings": "Fiches enregistrées",
    "Close saved listings": "Fermer les fiches enregistrées",
    "Filters": "Filtres",
    "No extra filters": "Aucun filtre supplémentaire",
    "Loading…": "Chargement…",
    "What do you want to find?": "Que voulez-vous trouver?",
    "Clear": "Effacer",
    "Choose events, opportunities, or both.": "Choisissez les événements, les possibilités ou les deux.",
    "Events to attend": "Événements auxquels participer",
    "Talks, workshops, festivals, performances, exhibitions, screenings, meetings, and community events.": "Causeries, ateliers, festivals, spectacles, expositions, projections, réunions et activités communautaires.",
    "Opportunities to apply for": "Possibilités de candidature",
    "Calls for papers, competitions, fellowships, grants, residencies, awards, and other applications. The listed date is the deadline.": "Appels de communications, concours, bourses, subventions, résidences, prix et autres candidatures. La date affichée est la date limite.",
    "When?": "Quand?",
    "Choose one date window.": "Choisissez une période.",
    "Date range": "Période",
    "Upcoming": "À venir",
    "Next 7 days": "7 prochains jours",
    "Next 30 days": "30 prochains jours",
    "Next 3 months": "3 prochains mois",
    "Next 12 months": "12 prochains mois",
    "All dates": "Toutes les dates",
    "Where?": "Où?",
    "Choose any number of areas.": "Choisissez autant de régions que nécessaire.",
    "Places": "Lieux",
    "Hamilton and Burlington": "Hamilton et Burlington",
    "Guelph and Waterloo Region": "Guelph et région de Waterloo",
    "Brockville and Prescott": "Brockville et Prescott",
    "Cornwall and SDG": "Cornwall et SDG",
    "Montréal and West Island": "Montréal et l’Ouest-de-l’Île",
    "Online and global": "En ligne et mondial",
    "Other or location pending": "Autre ou lieu à confirmer",
    "Topics": "Sujets",
    "Choose any number of interests.": "Choisissez autant de sujets que nécessaire.",
    "Learning and scholarship": "Apprentissage et recherche",
    "Arts and performance": "Arts et spectacle",
    "Film and media": "Cinéma et médias",
    "Civic and community": "Vie civique et communauté",
    "Science and technology": "Science et technologie",
    "Other topics": "Autres sujets",
    "Type": "Type",
    "Choose several. Event-type choices and opportunity-type choices work side by side.": "Choisissez-en plusieurs. Les types d’événements et de possibilités fonctionnent ensemble.",
    "Talks, panels, and lectures": "Causeries, panels et conférences",
    "Workshops": "Ateliers",
    "Conferences and academic events": "Colloques et activités universitaires",
    "Performances": "Spectacles",
    "Exhibitions": "Expositions",
    "Screenings": "Projections",
    "Community and civic events": "Activités communautaires et civiques",
    "Other events": "Autres événements",
    "Calls for papers and proposals": "Appels de communications et de propositions",
    "Competitions, prizes, and awards": "Concours et prix",
    "Fellowships, grants, and residencies": "Bourses, subventions et résidences",
    "Applications and submissions": "Candidatures et soumissions",
    "Other opportunities": "Autres possibilités",
    "More filters: audience, format, and listing status": "Autres filtres : public, format et état de la fiche",
    "Audience": "Public",
    "General public": "Grand public",
    "Students and youth": "Élèves et jeunes",
    "University and graduate": "Universitaire et cycles supérieurs",
    "Educators": "Personnel éducatif",
    "Families and all ages": "Familles et tous âges",
    "Format": "Format",
    "In person": "En personne",
    "Online": "En ligne",
    "Hybrid": "Hybride",
    "Format pending": "Format à confirmer",
    "Listing status": "État de la fiche",
    "Confirmed details": "Détails confirmés",
    "Some details pending": "Certains détails à confirmer",
    "Current choices": "Choix actuels",
    "Upcoming events and opportunities": "Événements et possibilités à venir",
    "Reset all": "Tout réinitialiser",
    "View results": "Voir les résultats",
    "Calendar listings": "Fiches du calendrier",
    "Keyboard:": "Clavier :",
    "search ·": "rechercher ·",
    "change calendar month ·": "changer de mois ·",
    "close saved listings": "fermer les fiches enregistrées",
    "Choose a filter to narrow the list. Multiple choices inside one group are combined.": "Choisissez un filtre pour préciser la liste. Plusieurs choix dans un même groupe sont combinés.",
    "Sort results": "Trier les résultats",
    "Soonest first": "Plus proche en premier",
    "Farthest date first": "Date la plus éloignée en premier",
    "Title A to Z": "Titre de A à Z",
    "List": "Liste",
    "Calendar": "Calendrier",
    "Show more": "Afficher plus",
    "Open a title for the stable Polymythcal page. Every listing also links to its official source. Missing times and locations stay visible as pending details. Saved listings remain on this device.": "Ouvrez un titre pour accéder à la page Polymythcal stable. Chaque fiche mène aussi à sa source officielle. Les heures et lieux manquants restent indiqués. Les fiches enregistrées restent sur cet appareil.",
    "Polymythcal needs JavaScript for interactive filtering. You can still use the": "Polymythcal exige JavaScript pour le filtrage interactif. Vous pouvez toujours utiliser les",
    "RSS and calendar feeds": "fils RSS et calendriers",
    "or browse the": "ou consulter le",
    "site map": "plan du site"
  };

  const searchSynonyms = {
    philosophie: ["philosophy"], philosophique: ["philosophy"], ethique: ["ethic", "ethics"],
    litterature: ["literature", "literary"], ecriture: ["writing", "writer"], auteur: ["author"], livre: ["book"],
    cinema: ["film", "screening"], projection: ["screening"], spectacle: ["performance"], exposition: ["exhibition"],
    atelier: ["workshop"], conference: ["conference", "lecture", "talk"], colloque: ["conference", "symposium"],
    bourse: ["fellowship", "grant", "scholarship"], subvention: ["grant"], concours: ["contest", "competition"],
    candidature: ["application", "apply"], appel: ["call"], communautaire: ["community"], scientifique: ["science"],
    montreal: ["montreal"], toronto: ["toronto"], kingston: ["kingston"]
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const lang = new URLSearchParams(location.search).get("lang") === "fr" ? "fr" : "en";
  const t = translations[lang];
  document.documentElement.lang = lang === "fr" ? "fr-CA" : "en-CA";

  const state = {
    q: "",
    content: new Set(["attend", "apply"]),
    time: "upcoming",
    places: new Set(),
    topics: new Set(),
    eventTypes: new Set(),
    opportunityTypes: new Set(),
    audiences: new Set(),
    formats: new Set(),
    statuses: new Set(),
    sort: "soonest",
    view: "list",
    visible: PAGE_SIZE,
    calendarMonth: startOfMonth(calendarToday())
  };

  let allEvents = [];
  let filteredEvents = [];
  let savedIds = loadSaved();
  let searchWriteTimer = null;
  let lastFocusedElement = null;
  const expandedCalendarDays = new Set();

  function startOfDay(value) {
    const d = new Date(value);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function startOfMonth(value) {
    const d = new Date(value);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  function addDays(value, days) {
    const d = new Date(value);
    d.setDate(d.getDate() + days);
    return d;
  }

  function addMonths(value, months) {
    return new Date(value.getFullYear(), value.getMonth() + months, 1);
  }

  function calendarDay(value) {
    if (!value) return null;
    const parts = CALENDAR_DATE_FORMATTER.formatToParts(value);
    const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return new Date(Number(map.year), Number(map.month) - 1, Number(map.day));
  }

  function calendarToday() {
    const minute = Math.floor(Date.now() / 60000);
    if (minute !== cachedTodayMinute || !cachedCalendarToday) {
      cachedTodayMinute = minute;
      cachedCalendarToday = calendarDay(new Date());
    }
    return cachedCalendarToday;
  }

  function parseDate(value) {
    if (!value) return null;
    const text = String(value).trim();
    const dateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnly) return new Date(Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 12));
    const d = new Date(text);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function isoDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function monthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[’']/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function textBlob(event) {
    return normalizeText([
      event.title, event.description, event.speaker_or_director, event.venue, event.city,
      event.country, event.type, ...(event.secondary_types || []), event.age_band,
      event.source_id, event.source_name, event.organizer
    ].join(" "));
  }

  function classifyContent(event) {
    const blob = textBlob(event);
    const opportunity = event.record_kind === "opportunity" ||
      ["cfp", "contest", "residency"].includes(event.type) ||
      /\b(deadline|apply|application|fellowship|grant|prize|award|competition|call for|submission)\b/.test(blob);
    return opportunity ? "apply" : "attend";
  }

  function classifyPlace(event) {
    const city = normalizeText(event.city);
    const venue = normalizeText(event.venue);
    const blob = `${city} ${venue}`;
    if (/\b(online|virtual|zoom|global)\b/.test(blob) || event.corridor_zone === "online-global") return "online";
    if (["toronto", "mississauga", "brampton", "markham", "vaughan", "oakville", "richmond hill"].some(x => city.includes(x))) return "toronto-gta";
    if (["hamilton", "burlington"].some(x => city.includes(x))) return "hamilton";
    if (["guelph", "waterloo", "kitchener", "cambridge"].some(x => city.includes(x))) return "guelph-waterloo";
    if (city.includes("kingston")) return "kingston";
    if (city.includes("gananoque")) return "gananoque";
    if (["brockville", "prescott"].some(x => city.includes(x))) return "brockville";
    if (["cornwall", "south stormont", "south dundas"].some(x => city.includes(x))) return "cornwall-sdg";
    if (["montreal", "vaudreuil", "dollard", "pointe claire"].some(x => city.includes(x))) return "montreal";
    return "other";
  }

  function classifyTopic(event) {
    const blob = textBlob(event);
    const topics = [];
    if (/philosoph|ethic|political theory|metaphys|epistem|phenomen|hegel|kant|aristotle/.test(blob)) topics.push("philosophy");
    if (/literature|literary|writing|writer|poetry|poet|book|reading|author|essay|novel/.test(blob)) topics.push("writing");
    if (/film|cinema|screening|media|documentary|animation/.test(blob)) topics.push("film");
    if (/art|artist|gallery|museum|exhibition|music|concert|theatre|theater|dance|performance|opera/.test(blob)) topics.push("arts");
    if (/civic|council|public meeting|community|protest|democracy|politic|policy|justice|activis/.test(blob)) topics.push("civic");
    if (/science|technology|digital|artificial intelligence|\bai\b|biology|physics|environment|climate|health/.test(blob)) topics.push("science");
    if (/education|teaching|teacher|student|school|university|graduate|lecture|conference|workshop|symposium|colloquium/.test(blob)) topics.push("learning");
    if (!topics.length) topics.push("other");
    return topics;
  }

  function classifyEventType(event) {
    const type = normalizeText(event.type).replaceAll(" ", "-");
    if (["lecture", "talk", "panel", "artist-talk", "book-talk", "scholar-talk", "colloquium", "symposium", "forum"].includes(type)) return "talks";
    if (["workshop", "retreat"].includes(type)) return "workshops";
    if (["conference", "defence", "webinar"].includes(type)) return "conferences";
    if (type === "performance") return "performances";
    if (["exhibition", "site-specific-art"].includes(type) || event.record_kind === "exhibition") return "exhibitions";
    if (type === "screening") return "screenings";
    if (["festival", "festival-of-form", "cultural-reproduction"].includes(type) || event.record_kind === "festival") return "festivals";
    if (["community", "meeting"].includes(type) || event.record_kind === "civic-action") return "community";
    return "other-events";
  }

  function classifyOpportunityType(event) {
    const blob = textBlob(event);
    // Prefer the actual opportunity being offered over a broad source type such as "cfp".
    if (/fellowship|grant|residency|scholarship|funding opportunity/.test(blob) || event.type === "residency") return "funding";
    if (event.type === "contest" || /contest|competition|prize|award/.test(blob)) return "competitions";
    if (/call for papers|call for proposals|abstract|paper proposal|\bcfp\b/.test(blob)) return "cfp";
    if (/application|apply|submission|deadline/.test(blob)) return "applications";
    if (event.type === "cfp") return "cfp";
    return "other-opportunities";
  }

  function classifyAudience(event) {
    const blob = normalizeText(`${event.age_band || ""} ${event.title || ""} ${event.description || ""}`);
    const groups = [];
    if (/youth|child|children|kid|teen|grade|high school|secondary school|student writing/.test(blob)) groups.push("youth");
    if (/university|graduate|scholar|faculty|academic|undergraduate|postdoc|phd|masters|master s/.test(blob)) groups.push("university");
    if (/teacher|educator|school staff/.test(blob)) groups.push("educators");
    if (/family|families|all ages/.test(blob)) groups.push("families");
    if (!groups.length || /public|open to all|adult/.test(blob)) groups.push("public");
    return [...new Set(groups)];
  }

  function classifyFormat(event) {
    const blob = normalizeText(`${event.city || ""} ${event.venue || ""} ${event.description || ""}`);
    const online = /online|virtual|zoom|webinar|livestream/.test(blob) || event.corridor_zone === "online-global";
    const inPerson = event.city && !["Unknown", "Online"].includes(event.city) && event.venue && !/online|virtual|zoom/.test(normalizeText(event.venue));
    if (online && inPerson) return "hybrid";
    if (online) return "online";
    if (inPerson) return "in-person";
    return "pending";
  }

  function hydrate(event) {
    const start = parseDate(event.date);
    const end = parseDate(event.end_date) || start;
    const text = textBlob(event);
    return {
      ...event,
      _start: start,
      _end: end,
      _startDay: calendarDay(start),
      _endDay: calendarDay(end),
      _text: text,
      _words: [...new Set(text.split(/\s+/).filter(Boolean))],
      _content: classifyContent(event),
      _place: classifyPlace(event),
      _topics: classifyTopic(event),
      _eventType: classifyEventType(event),
      _opportunityType: classifyOpportunityType(event),
      _audiences: classifyAudience(event),
      _format: classifyFormat(event),
      _status: event.confirmation_status === "confirmed" ? "confirmed" : "pending"
    };
  }

  function loadSaved() {
    try { return new Set(JSON.parse(localStorage.getItem(SAVED_KEY) || "[]")); }
    catch (_) { return new Set(); }
  }

  function persistSaved() {
    try { localStorage.setItem(SAVED_KEY, JSON.stringify([...savedIds])); }
    catch (_) { /* Device storage may be disabled. */ }
  }

  function translateStatic() {
    if (lang !== "fr") return;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const trimmed = node.nodeValue.trim();
      if (staticFrench[trimmed]) node.nodeValue = node.nodeValue.replace(trimmed, staticFrench[trimmed]);
    }
    $$('[aria-label]').forEach(node => {
      const value = node.getAttribute("aria-label");
      if (staticFrench[value]) node.setAttribute("aria-label", staticFrench[value]);
    });
    $$('[data-label]').forEach(node => {
      if (staticFrench[node.dataset.label]) node.dataset.label = staticFrench[node.dataset.label];
    });
    const search = $("#pmSearch");
    if (search) search.placeholder = "Rechercher événements, lieux ou thèmes";
    const languageLink = $("#pmLanguageLink");
    if (languageLink) {
      languageLink.textContent = "English";
      languageLink.hreflang = "en-CA";
    }
  }

  function validValuesFor(key) {
    return new Set($$(`[data-state-set="${key}"]`).map(input => input.value));
  }

  function readStateFromUrl() {
    const params = new URLSearchParams(location.search);
    state.q = params.get("q") || "";
    $("#pmSearch").value = state.q;
    const times = new Set($$('input[name="pm-time"]').map(input => input.value));
    state.time = times.has(params.get("time")) ? params.get("time") : "upcoming";
    state.sort = ["soonest", "latest", "title"].includes(params.get("sort")) ? params.get("sort") : "soonest";
    state.view = ["list", "calendar"].includes(params.get("view")) ? params.get("view") : "list";
    for (const key of SET_KEYS) {
      const valid = validValuesFor(key);
      const raw = params.get(key);
      if (raw) state[key] = new Set(raw.split(",").filter(value => valid.has(value)));
    }
    if (!state.content.size) state.content = new Set(["attend", "apply"]);
    const rawMonth = params.get("month");
    if (/^\d{4}-\d{2}$/.test(rawMonth || "")) {
      const [year, month] = rawMonth.split("-").map(Number);
      state.calendarMonth = new Date(year, month - 1, 1);
    }
    syncControlsFromState();
  }

  function buildUrl(targetLang = lang) {
    const params = new URLSearchParams();
    if (targetLang === "fr") params.set("lang", "fr");
    if (state.q) params.set("q", state.q);
    if (state.time !== "upcoming") params.set("time", state.time);
    if (state.sort !== "soonest") params.set("sort", state.sort);
    if (state.view !== "list") params.set("view", state.view);
    if (state.view === "calendar" && monthKey(state.calendarMonth) !== monthKey(calendarToday())) params.set("month", monthKey(state.calendarMonth));
    for (const key of SET_KEYS) {
      if (!state[key]?.size) continue;
      const values = [...state[key]].sort();
      const defaultContent = key === "content" && values.length === 2 && values.includes("attend") && values.includes("apply");
      if (!defaultContent) params.set(key, values.join(","));
    }
    const query = params.toString();
    return `${location.pathname}${query ? `?${query}` : ""}${location.hash || ""}`;
  }

  function writeStateToUrl() {
    try { history.replaceState(null, "", buildUrl(lang)); }
    catch (_) { /* Local file previews have a null origin. */ }
    updateLanguageLink();
  }

  function updateLanguageLink() {
    const link = $("#pmLanguageLink");
    if (!link) return;
    link.href = buildUrl(lang === "fr" ? "en" : "fr");
  }

  function syncControlsFromState() {
    $$('[data-state-set]').forEach(input => {
      const key = input.dataset.stateSet;
      input.checked = state[key] instanceof Set && state[key].has(input.value);
    });
    $$('input[name="pm-time"]').forEach(input => { input.checked = input.value === state.time; });
    $("#pmSort").value = state.sort;
    $$('[data-view]').forEach(button => button.setAttribute("aria-pressed", String(button.dataset.view === state.view)));
  }

  function eventInTime(event) {
    if (!event._start) return false;
    const today = calendarToday();
    const end = event._endDay || event._startDay;
    if (state.time === "all") return true;
    if (end < today) return false;
    if (state.time === "upcoming") return true;
    const limits = { "7d": 7, "30d": 30, "90d": 90, "365d": 365 };
    const limit = addDays(today, limits[state.time] || 365);
    return event._startDay < limit;
  }

  function setMatches(set, values) {
    if (!set.size) return true;
    const list = Array.isArray(values) ? values : [values];
    return list.some(value => set.has(value));
  }

  function editDistance(a, b, maximum = 2) {
    if (Math.abs(a.length - b.length) > maximum) return maximum + 1;
    let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const current = [i];
      let rowMin = current[0];
      for (let j = 1; j <= b.length; j++) {
        const value = Math.min(
          current[j - 1] + 1,
          previous[j] + 1,
          previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
        current.push(value);
        rowMin = Math.min(rowMin, value);
      }
      if (rowMin > maximum) return maximum + 1;
      previous = current;
    }
    return previous[b.length];
  }

  function tokenVariants(token) {
    const variants = new Set([token]);
    for (const value of searchSynonyms[token] || []) variants.add(normalizeText(value));
    return [...variants];
  }

  function eventMatchesSearch(event, query) {
    const tokens = normalizeText(query).split(/\s+/).filter(Boolean);
    if (!tokens.length) return true;
    return tokens.every(token => tokenVariants(token).some(variant => {
      if (event._text.includes(variant)) return true;
      if (variant.length < 4) return false;
      const threshold = variant.length >= 8 ? 2 : 1;
      return event._words.some(word => {
        if (word.startsWith(variant) || variant.startsWith(word)) return Math.abs(word.length - variant.length) <= 2;
        return editDistance(variant, word, threshold) <= threshold;
      });
    }));
  }

  function matchesFilters(event, ignoreKey = "") {
    if (ignoreKey !== "content" && !state.content.has(event._content)) return false;
    if (ignoreKey !== "time" && !eventInTime(event)) return false;
    if (ignoreKey !== "places" && !setMatches(state.places, event._place)) return false;
    if (ignoreKey !== "topics" && !setMatches(state.topics, event._topics)) return false;
    if (event._content === "attend" && ignoreKey !== "eventTypes" && !setMatches(state.eventTypes, event._eventType)) return false;
    if (event._content === "apply" && ignoreKey !== "opportunityTypes" && !setMatches(state.opportunityTypes, event._opportunityType)) return false;
    if (ignoreKey !== "audiences" && !setMatches(state.audiences, event._audiences)) return false;
    if (ignoreKey !== "formats" && !setMatches(state.formats, event._format)) return false;
    if (ignoreKey !== "statuses" && !setMatches(state.statuses, event._status)) return false;
    if (ignoreKey !== "q" && !eventMatchesSearch(event, state.q)) return false;
    return true;
  }

  function isOngoing(event) {
    const today = calendarToday();
    return Boolean(event._startDay && event._endDay && event._startDay < today && event._endDay >= today);
  }

  function chronologicalDate(event) {
    return isOngoing(event) ? calendarToday() : event._startDay;
  }

  function applyFilters() {
    filteredEvents = allEvents.filter(event => matchesFilters(event));
    filteredEvents.sort((a, b) => {
      const aDate = state.sort === "latest" ? (a._startDay?.getTime() || 0) : (chronologicalDate(a)?.getTime() || 0);
      const bDate = state.sort === "latest" ? (b._startDay?.getTime() || 0) : (chronologicalDate(b)?.getTime() || 0);
      const dateDiff = aDate - bDate;
      if (state.sort === "latest") return -dateDiff || String(a.title).localeCompare(String(b.title), lang === "fr" ? "fr" : "en");
      if (state.sort === "title") return String(a.title).localeCompare(String(b.title), lang === "fr" ? "fr" : "en");
      if (dateDiff) return dateDiff;
      if (isOngoing(a) && isOngoing(b)) return (a._endDay?.getTime() || 0) - (b._endDay?.getTime() || 0);
      return String(a.title).localeCompare(String(b.title), lang === "fr" ? "fr" : "en");
    });
  }

  function formatDate(date, options) {
    return new Intl.DateTimeFormat(lang === "fr" ? "fr-CA" : "en-CA", options).format(date);
  }

  function formatEventTime(date, options) {
    return new Intl.DateTimeFormat(lang === "fr" ? "fr-CA" : "en-CA", { ...options, timeZone: CALENDAR_TIME_ZONE }).format(date);
  }

  function formatMeta(event) {
    const parts = [];
    if (event.time_precision === "unknown") parts.push(t.timePending);
    else if (event._start && (event._start.getHours() || event._start.getMinutes())) parts.push(formatEventTime(event._start, { hour: "numeric", minute: "2-digit" }));
    const rawVenue = String(event.venue || "").trim();
    const normalizedVenue = normalizeText(rawVenue);
    const venueIsPlaceholder = /unconfirm|non confirm|unpublished|pending|unknown|location|lieu/.test(normalizedVenue);
    const venue = venueIsPlaceholder ? "" : rawVenue;
    const city = event.city && event.city !== "Unknown" ? event.city : "";
    const place = [venue, city].filter(Boolean).join(", ");
    parts.push(place || t.placePending);
    return parts.join(" · ");
  }

  function routeFor(event) {
    return `/polymythseminars/events/${encodeURIComponent(event.id)}/`;
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
  }

  function truncate(value, length = 300) {
    const text = String(value || "").trim();
    return text.length > length ? `${text.slice(0, length - 1).trimEnd()}…` : text;
  }

  function labelFor(key) {
    const control = $(`[data-label-key="${CSS.escape(key)}"]`);
    return control ? control.dataset.label || control.textContent.trim() : key.split(":").pop().replaceAll("-", " ");
  }

  function kindLabel(event) {
    const labels = lang === "fr" ? {
      talks: "Causerie ou conférence", workshops: "Atelier", conferences: "Colloque", performances: "Spectacle",
      exhibitions: "Exposition", screenings: "Projection", festivals: "Festival", community: "Activité communautaire",
      "other-events": "Événement", cfp: "Appel de communications", competitions: "Concours ou prix",
      funding: "Bourse ou subvention", applications: "Candidature", "other-opportunities": "Possibilité"
    } : {
      talks: "Talk or lecture", workshops: "Workshop", conferences: "Conference", performances: "Performance",
      exhibitions: "Exhibition", screenings: "Screening", festivals: "Festival", community: "Community event",
      "other-events": "Event", cfp: "Call for papers", competitions: "Competition or award",
      funding: "Fellowship or grant", applications: "Application", "other-opportunities": "Opportunity"
    };
    const key = event._content === "apply" ? event._opportunityType : event._eventType;
    return labels[key] || labelFor(`${event._content === "apply" ? "opportunityTypes" : "eventTypes"}:${key}`);
  }

  function dateBoxHtml(event) {
    if (isOngoing(event)) {
      const end = event._endDay;
      return `<time class="pm-date-box ongoing" datetime="${isoDate(end)}" aria-label="${escapeHtml(`${t.ongoing}. ${t.until} ${formatDate(end, { dateStyle: "long" })}`)}"><span class="pm-date-status">${escapeHtml(t.ongoing)}</span><span class="pm-date-until">${escapeHtml(t.until)}</span><span class="pm-date-end">${escapeHtml(formatDate(end, { month: "short", day: "numeric" }))}</span><span class="pm-date-year">${end.getFullYear()}</span></time>`;
    }
    const date = event._startDay;
    return `<time class="pm-date-box" datetime="${isoDate(date)}" aria-label="${escapeHtml(formatDate(date, { dateStyle: "long" }))}"><span class="pm-date-month">${escapeHtml(formatDate(date, { month: "short" }))}</span><span class="pm-date-day">${date.getDate()}</span><span class="pm-date-year">${date.getFullYear()}</span></time>`;
  }

  function cardHtml(event) {
    const descriptionText = event.description && event.description !== event.venue ? truncate(event.description) : "";
    const saved = savedIds.has(event.id);
    const specificKind = kindLabel(event);
    const contentKind = event._content === "apply" ? t.apply : t.attend;
    const kindBadge = normalizeText(specificKind) === normalizeText(contentKind) ? "" : `<span class="pm-badge">${escapeHtml(specificKind)}</span>`;
    return `
      <article class="pm-event-card" data-event-id="${escapeHtml(event.id)}">
        ${dateBoxHtml(event)}
        <div class="pm-event-main">
          <div class="pm-badge-row">
            <span class="pm-badge ${event._content}">${escapeHtml(contentKind)}</span>
            ${kindBadge}
          </div>
          <h3 class="pm-event-title"><a href="${routeFor(event)}">${escapeHtml(event.title)}</a></h3>
          <p class="pm-event-meta">${escapeHtml(formatMeta(event))}</p>
          ${descriptionText ? `<p class="pm-event-description">${escapeHtml(descriptionText)}</p>` : ""}
          <div class="pm-card-actions">
            <a class="pm-action primary-link" href="${routeFor(event)}">${escapeHtml(t.details)} <span aria-hidden="true">→</span></a>
            ${event.source_url ? `<a class="pm-action" href="${escapeHtml(event.source_url)}" rel="noopener noreferrer">${escapeHtml(t.source)}</a>` : ""}
            <button type="button" class="pm-action pm-save" data-save-id="${escapeHtml(event.id)}" aria-pressed="${saved}" aria-label="${escapeHtml(saved ? `${t.saved}: ${event.title}` : `${t.save}: ${event.title}`)}">${escapeHtml(saved ? t.saved : t.save)}</button>
          </div>
        </div>
      </article>`;
  }

  function renderList() {
    const container = $("#pmEventList");
    const slice = filteredEvents.slice(0, state.visible);
    if (!slice.length) {
      container.innerHTML = `<div class="pm-empty"><h3>${escapeHtml(t.noResults)}</h3><p>${escapeHtml(t.noResultsHelp)}</p><button class="pm-button primary" type="button" data-clear-all>${escapeHtml(t.clearAll)}</button></div>`;
      $("#pmLoadMore").hidden = true;
      return;
    }
    let currentMonth = "";
    const parts = [];
    for (const event of slice) {
      const groupingDate = chronologicalDate(event);
      const key = isOngoing(event) ? "ongoing" : `${groupingDate.getFullYear()}-${groupingDate.getMonth()}`;
      if (key !== currentMonth) {
        currentMonth = key;
        const heading = key === "ongoing" ? t.ongoingNow : formatDate(groupingDate, { month: "long", year: "numeric" });
        parts.push(`<h3 class="pm-month-heading">${escapeHtml(heading)}</h3>`);
      }
      parts.push(cardHtml(event));
    }
    container.innerHTML = parts.join("");
    $("#pmLoadMore").hidden = slice.length >= filteredEvents.length;
    $("#pmLoadMore").textContent = t.loadMore;
  }

  function calendarEventMap(rangeStart, rangeEnd) {
    const map = new Map();
    for (const event of filteredEvents) {
      if (!event._start) continue;
      const start = event._startDay;
      if (start < rangeStart || start > rangeEnd) continue;
      const key = isoDate(start);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(event);
    }
    for (const events of map.values()) events.sort((a, b) => a._start - b._start || a.title.localeCompare(b.title));
    return map;
  }

  function calendarSpan(event, monthStart) {
    const start = event._startDay;
    const end = event._endDay || event._startDay;
    if (start < monthStart && end >= monthStart) return `${t.ongoing} · ${t.until} ${formatDate(end, { month: "short", day: "numeric", year: "numeric" })}`;
    return `${formatDate(start, { month: "short", day: "numeric" })} – ${formatDate(end, { month: "short", day: "numeric", year: "numeric" })}`;
  }

  function renderCalendar() {
    const root = $("#pmCalendar");
    const month = state.calendarMonth;
    const first = startOfMonth(month);
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999);
    const gridStart = addDays(first, -first.getDay());
    const gridEnd = addDays(gridStart, 41);
    const monthEvents = calendarEventMap(gridStart, gridEnd);
    const runningEvents = filteredEvents.filter(event => {
      if (!event._start || !event._end) return false;
      const start = event._startDay;
      const end = event._endDay;
      return end > start && start <= monthEnd && end >= first;
    }).sort((a, b) => a._end - b._end || a._start - b._start || a.title.localeCompare(b.title));
    const weekdays = Array.from({ length: 7 }, (_, i) => formatDate(addDays(new Date(2026, 0, 4), i), { weekday: "short" }));
    const today = calendarToday();
    const days = [];
    for (let i = 0; i < 42; i++) {
      const date = addDays(gridStart, i);
      const key = isoDate(date);
      const events = monthEvents.get(key) || [];
      const outside = date.getMonth() !== month.getMonth();
      const isToday = date.getTime() === today.getTime();
      const expanded = expandedCalendarDays.has(key);
      const limit = expanded ? events.length : 3;
      const links = events.slice(0, limit).map(event => `<a href="${routeFor(event)}" title="${escapeHtml(event.title)}">${escapeHtml(event.title)}</a>`).join("");
      const more = events.length > 3 && !expanded ? `<button type="button" class="pm-calendar-more" data-expand-day="${key}">${escapeHtml(t.calendarMore(events.length - 3))}</button>` : "";
      days.push(`<section class="pm-calendar-day${outside ? " outside" : ""}${isToday ? " today" : ""}" aria-label="${escapeHtml(formatDate(date, { dateStyle: "long" }))}"><span class="pm-calendar-number">${date.getDate()}</span>${links}${more}</section>`);
    }
    const agendaDays = [];
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    for (let day = 1; day <= last; day++) {
      const date = new Date(month.getFullYear(), month.getMonth(), day);
      const events = monthEvents.get(isoDate(date)) || [];
      if (!events.length) continue;
      agendaDays.push(`<section class="pm-agenda-day"><h3><time datetime="${isoDate(date)}">${escapeHtml(formatDate(date, { weekday: "long", month: "long", day: "numeric" }))}</time></h3><ul>${events.map(event => `<li><a href="${routeFor(event)}">${escapeHtml(event.title)}</a><span>${escapeHtml(formatMeta(event))}</span></li>`).join("")}</ul></section>`);
    }
    const runningHtml = runningEvents.length ? `
      <details class="pm-calendar-running">
        <summary><span>${escapeHtml(t.runningThisMonth(runningEvents.length))}</span><small>${escapeHtml(t.runningHelp)}</small></summary>
        <ul>${runningEvents.map(event => `<li><a href="${routeFor(event)}">${escapeHtml(event.title)}</a><span>${escapeHtml(calendarSpan(event, first))}</span></li>`).join("")}</ul>
      </details>` : "";
    root.innerHTML = `
      <div class="pm-calendar-head">
        <button type="button" class="pm-button icon" data-calendar-nav="previous" aria-label="${escapeHtml(t.monthPrevious)}">←</button>
        <div class="pm-calendar-title">${escapeHtml(formatDate(month, { month: "long", year: "numeric" }))}</div>
        <div class="pm-calendar-head-actions">
          <button type="button" class="pm-button text" data-calendar-nav="today">${escapeHtml(lang === "fr" ? "Aujourd’hui" : "Today")}</button>
          <button type="button" class="pm-button icon" data-calendar-nav="next" aria-label="${escapeHtml(t.monthNext)}">→</button>
        </div>
      </div>
      ${runningHtml}
      <div class="pm-calendar-grid-view">
        <div class="pm-calendar-grid">
          ${weekdays.map(day => `<div class="pm-weekday">${escapeHtml(day)}</div>`).join("")}
          ${days.join("")}
        </div>
      </div>
      <div class="pm-calendar-agenda">${agendaDays.length ? agendaDays.join("") : `<div class="pm-empty"><p>${escapeHtml(t.noMonthResults)}</p></div>`}</div>`;
  }

  function activeFilterItems() {
    const items = [];
    if (state.q) items.push({ key: "q", value: "", label: `“${state.q}”` });
    if (state.content.size === 1) items.push({ key: "content", value: [...state.content][0], label: state.content.has("attend") ? t.eventsOnly : t.opportunitiesOnly });
    if (state.time !== "upcoming") items.push({ key: "time", value: state.time, label: labelFor(`time:${state.time}`) });
    for (const key of ["places", "topics", "eventTypes", "opportunityTypes", "audiences", "formats", "statuses"]) {
      for (const value of state[key]) items.push({ key, value, label: labelFor(`${key}:${value}`) });
    }
    return items;
  }

  function renderActiveFilters() {
    const items = activeFilterItems();
    const list = $("#pmActiveList");
    list.innerHTML = items.map(item => `<button type="button" class="pm-active-chip" data-remove-filter="${escapeHtml(item.key)}" data-remove-value="${escapeHtml(item.value)}" aria-label="${escapeHtml(t.removeFilter(item.label))}"><span>${escapeHtml(item.label)}</span><span aria-hidden="true">×</span></button>`).join("");
    $("#pmActiveEmpty").hidden = items.length > 0;
    $("#pmActivePanel").classList.toggle("is-empty", items.length === 0);
    const reset = $("#pmResetFilters");
    reset.disabled = items.length === 0;
    reset.textContent = t.clearAll;
    const count = items.length;
    $("#pmFilterSelectionCount").textContent = t.filtersSelected(count);
    $("#pmMobileFilterCount").textContent = String(count);
    $$('[data-clear-section]').forEach(button => {
      const key = button.dataset.clearSection;
      let active = false;
      if (key === "content") active = state.content.size !== 2;
      else if (key === "time") active = state.time !== "upcoming";
      else if (key === "types") active = state.eventTypes.size > 0 || state.opportunityTypes.size > 0;
      else active = state[key]?.size > 0;
      button.hidden = !active;
      button.textContent = t.clearSection;
    });
  }

  function eventHasFacet(event, key, value) {
    if (key === "content") return event._content === value;
    if (key === "places") return event._place === value;
    if (key === "topics") return event._topics.includes(value);
    if (key === "eventTypes") return event._content === "attend" && event._eventType === value;
    if (key === "opportunityTypes") return event._content === "apply" && event._opportunityType === value;
    if (key === "audiences") return event._audiences.includes(value);
    if (key === "formats") return event._format === value;
    if (key === "statuses") return event._status === value;
    return false;
  }

  function renderFacetCounts() {
    $$('[data-count-for]').forEach(node => {
      const [key, value] = node.dataset.countFor.split(":");
      const total = allEvents.filter(event => eventHasFacet(event, key, value)).length;
      const count = allEvents.filter(event => matchesFilters(event, key) && eventHasFacet(event, key, value)).length;
      node.textContent = count.toLocaleString(lang === "fr" ? "fr-CA" : "en-CA");
      const label = node.closest("label");
      const input = label?.querySelector("input");
      if (label && input) {
        // Hide choices that cannot add any result in the current context. A selected
        // zero-result choice stays visible so the user can always remove it.
        label.hidden = (total === 0 || count === 0) && !input.checked;
        label.classList.toggle("zero-results", count === 0 && input.checked);
        input.disabled = false;
      }
    });
  }

  function renderCounts() {
    $("#pmResultsTitle").textContent = t.eventsFound(filteredEvents.length);
    const shown = Math.min(state.visible, filteredEvents.length);
    $("#pmStatus").textContent = filteredEvents.length ? (state.view === "calendar" ? t.calendarStatus(filteredEvents.length) : t.shown(shown, filteredEvents.length)) : "";
    $("#pmFilterResultPreview").textContent = t.resultPreview(filteredEvents.length);
    $("#pmMobileResults").textContent = t.viewResults(filteredEvents.length);
    $("#pmJumpResults").textContent = t.viewResults(filteredEvents.length);
  }

  function renderSaved() {
    const list = $("#pmSavedList");
    const events = allEvents.filter(event => savedIds.has(event.id)).sort((a, b) => (a._start || 0) - (b._start || 0));
    list.innerHTML = events.length
      ? `<ul>${events.map(event => `<li class="pm-saved-item"><div><a href="${routeFor(event)}">${escapeHtml(event.title)}</a><span><time datetime="${isoDate(event._startDay)}">${escapeHtml(formatDate(event._startDay, { dateStyle: "medium" }))}</time> · ${escapeHtml(formatMeta(event))}</span></div><button type="button" class="pm-button subtle" data-remove-saved="${escapeHtml(event.id)}" aria-label="${escapeHtml(`${t.remove}: ${event.title}`)}">${escapeHtml(t.remove)}</button></li>`).join("")}</ul>`
      : `<p class="pm-empty-saved">${escapeHtml(t.savedEmpty)}</p>`;
    $("#pmSavedCount").textContent = String(events.length);
  }

  function updateSaveButtons(id) {
    $$(`[data-save-id="${CSS.escape(id)}"]`).forEach(button => {
      const event = allEvents.find(item => item.id === id);
      const saved = savedIds.has(id);
      button.setAttribute("aria-pressed", String(saved));
      button.textContent = saved ? t.saved : t.save;
      if (event) button.setAttribute("aria-label", `${saved ? t.saved : t.save}: ${event.title}`);
    });
    renderSaved();
  }

  function renderPresetStates() {
    const checks = {
      philosophy: state.topics.size === 1 && state.topics.has("philosophy"),
      humanities: state.topics.size === 3 && ["philosophy", "writing", "arts"].every(x => state.topics.has(x)),
      lectures: state.content.size === 1 && state.content.has("attend") && state.eventTypes.size === 1 && state.eventTypes.has("talks"),
      festivals: state.content.size === 1 && state.content.has("attend") && state.eventTypes.size === 1 && state.eventTypes.has("festivals"),
      writing: state.topics.size === 1 && state.topics.has("writing"),
      fellowships: state.content.size === 1 && state.content.has("apply") && state.opportunityTypes.size === 1 && state.opportunityTypes.has("funding"),
      toronto: state.places.size === 1 && state.places.has("toronto-gta"),
      corridor: state.places.size === 5 && ["kingston", "gananoque", "brockville", "cornwall-sdg", "montreal"].every(x => state.places.has(x))
    };
    $$('[data-preset]').forEach(button => button.setAttribute("aria-pressed", String(Boolean(checks[button.dataset.preset]))));
  }

  function render() {
    applyFilters();
    renderCounts();
    renderActiveFilters();
    renderFacetCounts();
    renderPresetStates();
    if (state.view === "calendar") {
      $("#pmEventList").hidden = true;
      $("#pmLoadMore").hidden = true;
      $("#pmCalendar").hidden = false;
      renderCalendar();
    } else {
      $("#pmCalendar").hidden = true;
      $("#pmEventList").hidden = false;
      renderList();
    }
    renderSaved();
    $("#pmClearSearch").hidden = !state.q;
    writeStateToUrl();
  }

  function resetFilters(options = {}) {
    state.q = "";
    state.content = new Set(["attend", "apply"]);
    state.time = "upcoming";
    for (const key of ["places", "topics", "eventTypes", "opportunityTypes", "audiences", "formats", "statuses"]) state[key].clear();
    state.sort = "soonest";
    state.visible = PAGE_SIZE;
    $("#pmSearch").value = "";
    syncControlsFromState();
    render();
    if (options.focusSearch) $("#pmSearch").focus();
  }

  function clearSection(key) {
    if (key === "content") state.content = new Set(["attend", "apply"]);
    else if (key === "time") state.time = "upcoming";
    else if (key === "types") { state.eventTypes.clear(); state.opportunityTypes.clear(); }
    else if (state[key] instanceof Set) state[key].clear();
    state.visible = PAGE_SIZE;
    syncControlsFromState();
    render();
  }

  function removeFilter(key, value) {
    if (key === "q") { state.q = ""; $("#pmSearch").value = ""; }
    else if (key === "time") state.time = "upcoming";
    else if (key === "content") state.content = new Set(["attend", "apply"]);
    else if (state[key] instanceof Set) state[key].delete(value);
    state.visible = PAGE_SIZE;
    syncControlsFromState();
    render();
  }

  function openSavedDialog() {
    const dialog = $("#pmSavedPanel");
    lastFocusedElement = document.activeElement;
    renderSaved();
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    $("#pmCloseSaved").focus();
  }

  function closeSavedDialog() {
    const dialog = $("#pmSavedPanel");
    if (typeof dialog.close === "function" && dialog.open) dialog.close();
    else dialog.removeAttribute("open");
    if (lastFocusedElement?.focus) lastFocusedElement.focus();
  }

  function copyTextFallback(text) {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    const copied = document.execCommand?.("copy");
    area.remove();
    return copied;
  }

  async function shareCurrentView() {
    writeStateToUrl();
    const base = location.origin && location.origin !== "null" ? location.origin : "https://seminarschools.com";
    const url = new URL(buildUrl(lang), base).href;
    if (navigator.share && matchMedia("(max-width: 760px)").matches) {
      try {
        await navigator.share({ title: document.title, url });
        $("#pmStatus").textContent = t.shareOpened;
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
      else if (!copyTextFallback(url)) throw new Error("copy unavailable");
      $("#pmStatus").textContent = t.shared;
      const button = $("#pmShare");
      const original = button.textContent;
      button.textContent = lang === "fr" ? "Lien copié" : "Link copied";
      setTimeout(() => { button.textContent = original; }, 1800);
    } catch (_) {
      $("#pmStatus").textContent = t.shareFail;
    }
  }

  function applyPreset(name, label) {
    resetFilters();
    const presets = {
      philosophy: () => state.topics.add("philosophy"),
      humanities: () => ["philosophy", "writing", "arts"].forEach(x => state.topics.add(x)),
      lectures: () => { state.content = new Set(["attend"]); state.eventTypes.add("talks"); },
      festivals: () => { state.content = new Set(["attend"]); state.eventTypes.add("festivals"); },
      writing: () => state.topics.add("writing"),
      fellowships: () => { state.content = new Set(["apply"]); state.opportunityTypes.add("funding"); },
      toronto: () => state.places.add("toronto-gta"),
      corridor: () => ["kingston", "gananoque", "brockville", "cornwall-sdg", "montreal"].forEach(x => state.places.add(x))
    };
    presets[name]?.();
    syncControlsFromState();
    state.visible = PAGE_SIZE;
    render();
    $("#pmStatus").textContent = t.presetApplied(label);
    if (matchMedia("(max-width: 760px)").matches) $("#pmQuickStarts").open = false;
    $("#pmResults").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function configureResponsivePanels() {
    const mobile = matchMedia("(max-width: 760px)").matches;
    const hasIncomingFilters = activeFilterItems().length > 0;
    $("#pmFilterDrawer").open = !mobile || hasIncomingFilters;
    $("#pmQuickStarts").open = !mobile;
  }

  function bindEvents() {
    $("#pmSearch").addEventListener("input", event => {
      state.q = event.target.value.trim();
      state.visible = PAGE_SIZE;
      render();
      clearTimeout(searchWriteTimer);
      searchWriteTimer = setTimeout(writeStateToUrl, 150);
    });

    document.addEventListener("keydown", event => {
      const target = event.target;
      const typing = target instanceof HTMLElement && (target.matches("input, textarea, select") || target.isContentEditable);
      if (state.view === "calendar" && !typing && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        event.preventDefault();
        state.calendarMonth = addMonths(state.calendarMonth, event.key === "ArrowRight" ? 1 : -1);
        expandedCalendarDays.clear();
        render();
        $("#pmCalendar").focus({ preventScroll: true });
      }
    });

    document.addEventListener("change", event => {
      const input = event.target;
      if (input.matches('[data-state-set]')) {
        const key = input.dataset.stateSet;
        if (input.checked) state[key].add(input.value); else state[key].delete(input.value);
        if (key === "content" && !state.content.size) {
          input.checked = true;
          state.content.add(input.value);
          $("#pmStatus").textContent = t.oneContentRequired;
          return;
        }
        state.visible = PAGE_SIZE;
        render();
      }
      if (input.matches('input[name="pm-time"]')) {
        state.time = input.value;
        state.visible = PAGE_SIZE;
        render();
      }
      if (input.id === "pmSort") {
        state.sort = input.value;
        render();
      }
    });

    document.addEventListener("click", async event => {
      const clearAll = event.target.closest("[data-clear-all]");
      if (clearAll) { resetFilters({ focusSearch: true }); return; }

      const clearSearch = event.target.closest("#pmClearSearch");
      if (clearSearch) { state.q = ""; $("#pmSearch").value = ""; state.visible = PAGE_SIZE; render(); $("#pmSearch").focus(); return; }

      const clearSectionButton = event.target.closest("[data-clear-section]");
      if (clearSectionButton) { clearSection(clearSectionButton.dataset.clearSection); return; }

      const removeFilterButton = event.target.closest("[data-remove-filter]");
      if (removeFilterButton) { removeFilter(removeFilterButton.dataset.removeFilter, removeFilterButton.dataset.removeValue); return; }

      const view = event.target.closest("[data-view]");
      if (view) {
        state.view = view.dataset.view;
        $$('[data-view]').forEach(button => button.setAttribute("aria-pressed", String(button === view)));
        render();
        return;
      }

      const loadMore = event.target.closest("#pmLoadMore");
      if (loadMore) { state.visible += PAGE_SIZE; render(); loadMore.focus(); return; }

      const save = event.target.closest("[data-save-id]");
      if (save) {
        const id = save.dataset.saveId;
        if (savedIds.has(id)) savedIds.delete(id); else savedIds.add(id);
        persistSaved();
        updateSaveButtons(id);
        save.focus();
        return;
      }

      const removeSaved = event.target.closest("[data-remove-saved]");
      if (removeSaved) {
        const id = removeSaved.dataset.removeSaved;
        savedIds.delete(id);
        persistSaved();
        updateSaveButtons(id);
        return;
      }

      if (event.target.closest("#pmSavedToggle")) { openSavedDialog(); return; }
      if (event.target.closest("#pmCloseSaved")) { closeSavedDialog(); return; }
      if (event.target.closest("#pmShare")) { await shareCurrentView(); return; }

      const preset = event.target.closest("[data-preset]");
      if (preset) { applyPreset(preset.dataset.preset, preset.textContent.trim()); return; }

      const nav = event.target.closest("[data-calendar-nav]");
      if (nav) {
        if (nav.dataset.calendarNav === "today") state.calendarMonth = startOfMonth(calendarToday());
        else state.calendarMonth = addMonths(state.calendarMonth, nav.dataset.calendarNav === "next" ? 1 : -1);
        expandedCalendarDays.clear();
        renderCalendar();
        writeStateToUrl();
        return;
      }

      const expandDay = event.target.closest("[data-expand-day]");
      if (expandDay) {
        expandedCalendarDays.add(expandDay.dataset.expandDay);
        renderCalendar();
        const day = $(`[data-expand-day="${CSS.escape(expandDay.dataset.expandDay)}"]`);
        day?.focus();
        return;
      }

      if (event.target.closest("#pmJumpResults") || event.target.closest("#pmMobileResults")) {
        $("#pmFilterDrawer").open = false;
        $("#pmResults").scrollIntoView({ behavior: "smooth", block: "start" });
        $("#pmResultsTitle").focus({ preventScroll: true });
        return;
      }

      if (event.target.closest("#pmMobileFilters")) {
        $("#pmFilterDrawer").open = true;
        $("#pmFilterDrawer").scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    });

    const dialog = $("#pmSavedPanel");
    dialog.addEventListener("click", event => { if (event.target === dialog) closeSavedDialog(); });
    dialog.addEventListener("close", () => { if (lastFocusedElement?.focus) lastFocusedElement.focus(); });
  }

  async function init() {
    translateStatic();
    bindEvents();
    readStateFromUrl();
    configureResponsivePanels();
    $("#pmStatus").textContent = t.loading;
    try {
      const response = await fetch(DATA_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const raw = Array.isArray(payload) ? payload : (payload.events || payload.items || []);
      allEvents = raw.map(hydrate).filter(event => event._start);
      const validIds = new Set(allEvents.map(event => event.id));
      const cleaned = new Set([...savedIds].filter(id => validIds.has(id)));
      if (cleaned.size !== savedIds.size) { savedIds = cleaned; persistSaved(); }
      render();
    } catch (error) {
      console.error(error);
      $("#pmStatus").textContent = t.loadError;
      $("#pmEventList").innerHTML = `<div class="pm-empty"><h3>${escapeHtml(t.loadError)}</h3><p><a href="/polymythseminars/subscribe/">${escapeHtml(lang === "fr" ? "Fils et abonnements calendrier" : "Feeds and calendar subscriptions")}</a></p></div>`;
    }
  }

  init();
})();
