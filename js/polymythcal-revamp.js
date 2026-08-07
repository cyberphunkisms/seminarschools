(() => {
  "use strict";

  // Keep the controller idempotent if an optimizer, preview, or interrupted
  // navigation evaluates the deferred bundle more than once.
  if (window.__ssPolymythcalRevampMounted) return;
  window.__ssPolymythcalRevampMounted = true;

  // Calendar shells load the compact browse projection. The complete canonical
  // record remains public at /polymythseminars/events.json for feeds, detail
  // pages, research, and downstream reuse.
  const DATA_URL = "/polymythseminars/browse.json";
  const DATA_CACHE = "polymythcal-browse-v1";
  const FETCH_TIMEOUT_MS = 12000;
  const FETCH_ATTEMPTS = 2;
  const CALENDAR_TIME_ZONE = "America/Toronto";
  const CALENDAR_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
    timeZone: CALENDAR_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric"
  });
  let cachedTodayMinute = -1;
  let cachedCalendarToday = null;
  const PAGE_SIZE = 24;
  const SAVED_KEY = "polymythcal.savedEvents.v2";
  const LEGACY_SAVED_KEY = "polymythcal.savedEvents.v1";
  const SEARCHES_KEY = "polymythcal.savedSearches.v2";
  const LEGACY_SEARCHES_KEY = "polymythcal.savedSearches.v1";
  const LANGUAGE_KEY = "polymythcal.lang.v1";
  const SET_KEYS = ["content", "places", "topics", "eventTypes", "opportunityTypes", "audiences", "formats", "statuses"];
  const STATE_KEYS = ["content", "time", ...SET_KEYS.filter(key => key !== "content")];
  const ARTS_TOPIC_RE = /\b(?:art|arts|artist|artists|artistic|artwork|artworks|gallery|museum|exhibition|film|cinema|screening|media|documentary|animation|music|musical|concert|theatre|theater|dance|performance|opera)\b/;

  const translations = {
    en: {
      loading: "Loading the calendar",
      loadError: "The calendar data could not be loaded. Refresh the page or use the calendar feeds.",
      unavailable: "Calendar temporarily unavailable",
      retry: "Try loading again",
      retrying: "The calendar is taking longer than expected. Trying once more…",
      cachedData: "Showing the last calendar copy saved by this browser. Reconnect for current listings.",
      savedForVisit: "Saved for this visit. Device storage is unavailable.",
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
      undo: "Undo",
      removedSaved: title => `Removed ${title}.`,
      removedSearch: title => `Removed saved search ${title}.`,
      restored: title => `Restored ${title}.`,
      savedEmpty: "You have no saved listings yet.",
      savedSearchesEmpty: "You have no saved searches yet.",
      saveSearch: "Save search",
      searchSaved: "Search saved",
      savedItems: "Saved items",
      officialSource: "Official or institutional source",
      sourceListing: "Source listing",
      details: "View details",
      timePending: "Time unpublished",
      placePending: "Location unpublished",
      confirmed: "Confirmed details",
      detailsPending: "Some details pending",
      checkedOn: "Last checked",
      projectedDate: "Projected date",
      organizerPending: "Official confirmation pending",
      past: "Past",
      attend: "Event",
      apply: "Opportunity",
      loadMore: "Show more",
      loadMoreCount: count => `Show ${count.toLocaleString("en-CA")} more`,
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
      runningHelp: "Shown once here instead of being repeated on every calendar day.",
      approximateDistance: (distance, origin, precision) => `Approx. ${distance} km from ${origin} · ${precision}`,
      venueEstimate: "venue estimate",
      cityEstimate: "city estimate"
    },
    fr: {
      loading: "Chargement du calendrier",
      loadError: "Les données du calendrier sont indisponibles. Actualisez la page ou utilisez les fils du calendrier.",
      unavailable: "Calendrier temporairement indisponible",
      retry: "Réessayer le chargement",
      retrying: "Le chargement prend plus de temps que prévu. Nouvel essai…",
      cachedData: "Affichage de la dernière copie du calendrier enregistrée par ce navigateur. Reconnectez-vous pour obtenir les fiches actuelles.",
      savedForVisit: "Enregistré pour cette visite. Le stockage de l’appareil est indisponible.",
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
      undo: "Annuler",
      removedSaved: title => `${title} a été retiré.`,
      removedSearch: title => `La recherche enregistrée ${title} a été retirée.`,
      restored: title => `${title} a été rétabli.`,
      savedEmpty: "Vous n’avez encore enregistré aucune fiche.",
      savedSearchesEmpty: "Vous n’avez encore enregistré aucune recherche.",
      saveSearch: "Enregistrer la recherche",
      searchSaved: "Recherche enregistrée",
      savedItems: "Éléments enregistrés",
      officialSource: "Source officielle ou institutionnelle",
      sourceListing: "Fiche source",
      details: "Voir les détails",
      timePending: "Heure non publiée",
      placePending: "Lieu non publié",
      confirmed: "Détails confirmés",
      detailsPending: "Certains détails à confirmer",
      checkedOn: "Dernière vérification",
      projectedDate: "Date projetée",
      organizerPending: "Confirmation officielle en attente",
      past: "Passé",
      attend: "Événement",
      apply: "Possibilité",
      loadMore: "Afficher plus",
      loadMoreCount: count => `Afficher ${count.toLocaleString("fr-CA")} de plus`,
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
      runningHelp: "Affichées une seule fois ici plutôt que répétées chaque jour du calendrier.",
      approximateDistance: (distance, origin, precision) => `Environ ${distance} km de ${origin} · ${precision}`,
      venueEstimate: "estimation du lieu",
      cityEstimate: "estimation de la ville"
    }
  };

  const staticFrench = {
    "Skip to results": "Aller aux résultats",
    "Switch colour theme": "Changer le thème de couleurs",
    "Seminar Schools public calendar": "Calendrier public de Seminar Schools",
    "public calendar": "calendrier public",
    "focused calendar": "calendrier ciblé",
    "is selected. Use the filters below,": ": vue active. Utilisez les filtres ci-dessous,",
    ", or return to": ", ou retournez à",
    "Calendar data at a glance": "Aperçu des données du calendrier",
    "Browse by interest or place": "Parcourir par intérêt ou lieu",
    "Focused Polymythcal calendars": "Calendriers Polymythcal ciblés",
    "Related Polymyth Commons projects": "Projets connexes de Polymyth Commons",
    "July 21, 2026": "21 juillet 2026",
    "Find events to attend and opportunities to apply for from Toronto to Montréal.": "Trouvez des événements et des possibilités de candidature de Toronto à Montréal.",
    "Search the calendar": "Rechercher dans le calendrier",
    "Clear search": "Effacer la recherche",
    "Show results": "Voir les résultats",
    "English, French, accents, and close spellings work.": "Le français, l’anglais, les accents et les orthographes proches fonctionnent.",
    "Shortcuts": "Raccourcis",
    "Popular starting points": "Points de départ populaires",
    "Start by goal, interest, or place": "Commencer par un but, un intérêt ou un lieu",
    "Shortcuts reset the filters": "Les raccourcis réinitialisent les filtres",
    "Search": "Rechercher",
    "Calendar tools": "Outils du calendrier",
    "Personal calendar tools": "Outils de calendrier personnels",
    "Contribute and language": "Contribution et langue",
    "Current filter choices": "Choix de filtres actuels",
    "Choose list or calendar view": "Choisir la vue liste ou calendrier",
    "Focused Polymythcal view": "Vue Polymythcal ciblée",
    "Other focused calendars": "Autres calendriers ciblés",
    "Choose another focused view": "Choisir une autre vue ciblée",
    "Browse by focus": "Parcourir par thème",
    "Choose one or more opportunity types.": "Choisissez un ou plusieurs types de possibilités.",
    "browse every listing": "parcourir toutes les fiches",
    
    "Philosophy and ethics": "Philosophie et éthique",
    "Humanities": "Sciences humaines",
    "Talks and lectures": "Causeries et conférences",
    "Festivals": "Festivals",
    "Writing and literature": "Écriture et littérature",
    "Fellowships and grants": "Bourses et subventions",
    "Toronto and GTA": "Toronto et RGT",
    "Kingston to Montréal": "Kingston à Montréal",
    "Then narrow by interest or place": "Puis préciser par intérêt ou lieu",
    "Today": "Aujourd’hui",
    "What do you want to do?": "Que voulez-vous faire?",
    "Find something today": "Trouver quelque chose aujourd’hui",
    "Events happening or continuing today": "Événements qui ont lieu ou se poursuivent aujourd’hui",
    "Plan this week": "Planifier cette semaine",
    "Events in the next seven days": "Événements des sept prochains jours",
    "Go to an event": "Participer à un événement",
    "Talks, festivals, workshops, arts, and community gatherings": "Causeries, festivals, ateliers, arts et rencontres communautaires",
    "Meet an application deadline": "Respecter une date limite",
    "Calls, contests, fellowships, grants, and submissions": "Appels, concours, bourses, subventions et soumissions",
    "Find youth or family listings": "Trouver des fiches jeunesse ou famille",
    "Student, youth, family, and all-ages options": "Options pour élèves, jeunes, familles et tous âges",
    "Find something for educators": "Trouver quelque chose pour le personnel éducatif",
    "Professional learning and education-focused listings": "Perfectionnement professionnel et fiches axées sur l’éducation",
    "Join online": "Participer en ligne",
    "Remote events and opportunities from any place": "Événements et possibilités à distance, où que vous soyez",
    "listings": "fiches",
    "last updated": "dernière mise à jour",
    "Weekly": "Chaque semaine",
    "updates": "mises à jour",
    "Sources linked": "Sources liées",
    "every listing": "chaque fiche",
    "Need classroom material?": "Besoin de matériel pédagogique?",
    "Search 644 Teacher Resources.": "Parcourez 644 ressources pédagogiques.",
    "Looking for a library?": "Vous cherchez une bibliothèque?",
    "Browse libraries and commons projects in Polymythlib.": "Parcourez les bibliothèques et les communs dans Polymythlib.",
    "See the whole Commons": "Voir l’ensemble des communs",
    "Understand the collection, calendar, directory, and shared method.": "Comprenez la collection, le calendrier, le répertoire et la méthode partagée.",
    "Focused calendars": "Calendriers ciblés",
    "Focused academic calendars": "Calendriers universitaires ciblés",
    "University+": "Université+",
    "Philosophy": "Philosophie",
    "Calls for papers": "Appels de communications",
    "Lectures": "Conférences",
    "Fellowships": "Bourses",
    "Share view": "Partager la vue",
    "Saved": "Enregistrés",
    "Save search": "Enregistrer la recherche",
    "Get calendar updates": "Recevoir les mises à jour",
    "Submit an event": "Proposer un événement",
    "Correct a listing": "Corriger une fiche",
    "Français": "English",
    "Saved on this device": "Enregistré sur cet appareil",
    "Saved items": "Éléments enregistrés",
    "Saved listings": "Fiches enregistrées",
    "Saved searches": "Recherches enregistrées",
    "Close saved listings": "Fermer les fiches enregistrées",
    "Filters": "Filtres",
    "No extra filters": "Aucun filtre supplémentaire",
    "Loading…": "Chargement…",
    "Show": "Afficher",
    "Clear": "Effacer",
    "What do you want to find?": "Que voulez-vous inclure?",
    "Choose one or both.": "Choisissez l’un, l’autre ou les deux.",
    "Events to attend": "Événements auxquels participer",
    "Talks, workshops, festivals, performances, exhibitions, screenings, and community events.": "Causeries, ateliers, festivals, spectacles, expositions, projections et activités communautaires.",
    "Opportunities to apply for": "Possibilités de candidature",
    "Calls for papers, competitions, fellowships, grants, residencies, and awards. The date shown is when applications close.": "Appels de communications, concours, bourses, subventions, résidences et prix. La date affichée est la date de clôture.",
    "When?": "Quand?",
    "Choose one range.": "Choisissez une période.",
    "Date range": "Période",
    "Upcoming": "À venir",
    "Next 7 days": "7 prochains jours",
    "Next 30 days": "30 prochains jours",
    "Next 3 months": "3 prochains mois",
    "Next 12 months": "12 prochains mois",
    "All dates": "Toutes les dates",
    "Where?": "Où?",
    "Choose any number.": "Choisissez autant de régions que nécessaire.",
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
    "Selected": "Sélection",
    "Upcoming events and opportunities": "Événements et possibilités à venir",
    "Reset all": "Tout réinitialiser",
    "View results": "Voir les résultats",
    "Calendar listings": "Fiches du calendrier",
    "Choose filters to narrow the list.": "Choisissez des filtres pour réduire la liste.",
    "Undo": "Annuler",
    "Organizer signals": "Signaux des organisateurs",
    "Announcements awaiting a date": "Annonces en attente d’une date",
    "These are public organizer announcements that may become events. They stay outside the dated calendar until an event date is published.": "Ce sont des annonces publiques d’organisateurs qui pourraient devenir des événements. Elles restent hors du calendrier daté jusqu’à la publication d’une date.",
    "Keyboard:": "Clavier :",
    "search ·": "rechercher ·",
    "change calendar month ·": "changer de mois ·",
    "close saved listings": "fermer les fiches enregistrées",
    "Filters in the same group are combined.": "Les filtres d’un même groupe sont combinés.",
    "Sort results": "Trier les résultats",
    "Near": "Près de",
    "No nearby ranking": "Sans classement par proximité",
    "Approximate distance; no location permission.": "Distance approximative; aucune autorisation de localisation.",
    "Rank near a place": "Classer près d’un lieu",
    "Optional approximate ranking. The calendar asks for no location permission.": "Classement approximatif facultatif. Le calendrier ne demande aucune autorisation de localisation.",
    "Soonest first": "Plus proche en premier",
    "Farthest date first": "Date la plus éloignée en premier",
    "Title A to Z": "Titre de A à Z",
    "Nearest to selected place": "Le plus près du lieu choisi",
    "List": "Liste",
    "Calendar": "Calendrier",
    "Show more": "Afficher plus",
    "Open a title for details, the official source, calendar download, and corrections. Saved items stay on this device.": "Ouvrez un titre pour les détails, la source officielle, le téléchargement du calendrier et les corrections. Les éléments enregistrés restent sur cet appareil.",
    "Polymythcal needs JavaScript for interactive filtering. You can still use the": "Polymythcal exige JavaScript pour le filtrage interactif. Vous pouvez toujours utiliser les",
    "RSS and calendar feeds": "fils RSS et calendriers",
    "or browse the": "ou consulter le",
    "site map": "plan du site",
    "Writing opportunities": "Possibilités d’écriture",
    "All writing opportunities": "Toutes les possibilités d’écriture",
    "Writing opportunities for kids": "Possibilités d’écriture pour les enfants",
    "Writing opportunities for juniors": "Possibilités d’écriture pour les jeunes",
    "Writing opportunities for teens": "Possibilités d’écriture pour les adolescents",
    "Writing opportunities for Grades 11 and 12": "Possibilités d’écriture pour les 11e et 12e années",
    "Academic calendar": "Calendrier universitaire",
    "Academic opportunities": "Possibilités universitaires",
    "University and graduate opportunities": "Possibilités universitaires et aux cycles supérieurs",
    "Philosophy and ethics": "Philosophie et éthique",
    "Humanities": "Sciences humaines",
    "Calls for papers and proposals": "Appels de communications et de propositions",
    "Talks and lectures": "Causeries et conférences",
    "Fellowships, grants, and residencies": "Bourses, subventions et résidences",
    "Writing contests, prizes, publications, and submission opportunities for young writers.": "Concours, prix, publications et possibilités de soumission pour les jeunes auteurs.",
    "Elementary-friendly writing contests and publication opportunities.": "Concours d’écriture et possibilités de publication adaptés au primaire.",
    "Middle-grade writing contests and publication opportunities.": "Concours d’écriture et possibilités de publication pour le premier cycle du secondaire.",
    "High-school writing contests, prizes, and publication opportunities.": "Concours, prix et possibilités de publication pour les élèves du secondaire.",
    "Senior high-school writing contests and portfolio-building opportunities.": "Concours d’écriture et possibilités de portfolio pour les élèves de 11e et 12e années.",
    "University talks, conferences, workshops, calls, and academic opportunities.": "Causeries, conférences, ateliers, appels et possibilités universitaires.",
    "Philosophy talks, conferences, workshops, calls for papers, and fellowships.": "Causeries, conférences, ateliers, appels de communications et bourses en philosophie.",
    "Humanities talks, conferences, workshops, calls, and opportunities.": "Causeries, conférences, ateliers, appels et possibilités en sciences humaines.",
    "Calls for papers, proposals, abstracts, and conference submissions.": "Appels de communications, propositions, résumés et soumissions à des conférences.",
    "Public talks, lectures, panels, colloquia, and speaker events.": "Causeries publiques, conférences, panels, colloques et rencontres avec des conférenciers.",
    "Fellowships, grants, residencies, scholarships, and funding opportunities.": "Bourses, subventions, résidences et possibilités de financement.",
    "Focused Polymythcal calendar": "Calendrier Polymythcal ciblé",
    "shows this group first. Every filter below still works.": "affiche d’abord ce groupe. Tous les filtres ci-dessous fonctionnent encore.",
    "Browse all Polymythcal listings": "Parcourir toutes les fiches Polymythcal",
    "All writing": "Toute l’écriture",
    "Kids": "Enfants",
    "Juniors": "Jeunes",
    "Teens": "Adolescents",
    "Grades 11 and 12": "11e et 12e années",
    "Academic": "Universitaire",
    "Writing": "Écriture"
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

  const NEARBY_ORIGINS = Object.freeze({
    "yonge-lawrence": { label: "Yonge & Lawrence", latitude: 43.7252, longitude: -79.4023 },
    "downtown-toronto": { label: "Downtown Toronto", latitude: 43.6532, longitude: -79.3832 },
    scarborough: { label: "Scarborough", latitude: 43.7764, longitude: -79.2318 },
    "north-york": { label: "North York", latitude: 43.7615, longitude: -79.4111 },
    "west-toronto": { label: "West Toronto", latitude: 43.6505, longitude: -79.4505 },
    "east-toronto": { label: "East Toronto", latitude: 43.6764, longitude: -79.3191 },
    mississauga: { label: "Mississauga", latitude: 43.5890, longitude: -79.6441 },
    hamilton: { label: "Hamilton", latitude: 43.2557, longitude: -79.8711 },
    "guelph-waterloo": { label: "Guelph / Waterloo", latitude: 43.4977, longitude: -80.3359 },
    kingston: { label: "Kingston", latitude: 44.2312, longitude: -76.4860 },
    brockville: { label: "Brockville", latitude: 44.5895, longitude: -75.6843 },
    cornwall: { label: "Cornwall", latitude: 45.0213, longitude: -74.7303 },
    montreal: { label: "Montréal", latitude: 45.5019, longitude: -73.5674 }
  });

  const CITY_POINTS = Object.freeze([
    [/\btoronto\b/, 43.6532, -79.3832],
    [/\bmississauga\b/, 43.5890, -79.6441],
    [/\bbrampton\b/, 43.7315, -79.7624],
    [/\bmarkham\b/, 43.8561, -79.3370],
    [/\bvaughan\b/, 43.8361, -79.4983],
    [/\boakville\b/, 43.4675, -79.6877],
    [/\brichmond hill\b/, 43.8828, -79.4403],
    [/\bhamilton\b/, 43.2557, -79.8711],
    [/\bburlington\b/, 43.3255, -79.7990],
    [/\bguelph\b/, 43.5448, -80.2482],
    [/\bwaterloo\b/, 43.4643, -80.5204],
    [/\bkitchener\b/, 43.4516, -80.4925],
    [/\bcambridge\b/, 43.3616, -80.3144],
    [/\bkingston\b/, 44.2312, -76.4860],
    [/\bgananoque\b/, 44.3311, -76.1627],
    [/\bbrockville\b/, 44.5895, -75.6843],
    [/\bprescott\b/, 44.7168, -75.5193],
    [/\bcornwall\b/, 45.0213, -74.7303],
    [/\bsouth stormont\b/, 45.0020, -74.9350],
    [/\bsouth dundas\b/, 44.8990, -75.1830],
    [/\bmontr(?:eal|éal)\b/, 45.5019, -73.5674],
    [/\bvaudreuil\b/, 45.4001, -74.0325],
    [/\bdollard\b/, 45.4944, -73.8242],
    [/\bpointe claire\b/, 45.4487, -73.8167]
  ]);

  const TORONTO_VENUE_POINTS = Object.freeze([
    [/\bscarborough|neilson park\b/, 43.7764, -79.2318],
    [/\byork university|york federation|keele campus\b/, 43.7735, -79.5019],
    [/\bdownsview\b/, 43.7438, -79.4827],
    [/\bnorth york\b/, 43.7615, -79.4111],
    [/\bwoodbine|beaches|danforth|gerrard india|queen street east\b/, 43.6764, -79.3191],
    [/\bexhibition|lamport|roncesvalles|lakeshore boulevard\b/, 43.6356, -79.4255],
    [/\bharbourfront|queens quay|toronto music garden|ward s island|biidaasige\b/, 43.6380, -79.3810],
    [/\buniversity of toronto|u of t|queen s park|queens park|royal ontario museum|massey college|devonshire|st george|bloor yorkville|koerner hall\b/, 43.6677, -79.3948],
    [/\btoronto reference library|appel salon|789 yonge|tarragon theatre\b/, 43.6717, -79.3866],
    [/\bcity hall|nathan phillips|sankofa|yonge dundas|tmu|victoria st\b/, 43.6537, -79.3839],
    [/\btiff|king st|metro toronto convention|roy thomson|david pecaut\b/, 43.6455, -79.3865],
    [/\bchurch wellesley|church street\b/, 43.6664, -79.3815],
    [/\bst clair\b/, 43.6874, -79.4300]
  ]);

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const mobileViewport = matchMedia("(max-width: 760px)");
  function pathLanguage() {
    const path = location.pathname.replace(/\/index\.html$/, "/");
    if (/^\/polymythseminars\/fr(?:\/|$)/.test(path)) return "fr";
    if (/^\/(?:writingclub|writingkids|writingjuniors|writingteens|writinggrads|university|philosophy|humanities|cfps|lectures|fellowships)\/fr(?:\/|$)/.test(path)) return "fr";
    if (/^\/polymythseminars\/(?:events\/[^/]+\/|submit\/|correct\/|subscribe\/|thanks\/)?$/.test(path)) return "en";
    if (/^\/(?:writingclub|writingkids|writingjuniors|writingteens|writinggrads|university|philosophy|humanities|cfps|lectures|fellowships)\/$/.test(path)) return "en";
    return "";
  }
  function preferredLanguage() {
    const fromPath = pathLanguage();
    if (fromPath) return fromPath;
    if (new URLSearchParams(location.search).get("lang") === "fr") return "fr";
    try { return localStorage.getItem(LANGUAGE_KEY) === "fr" ? "fr" : "en"; }
    catch (_) { return "en"; }
  }
  const lang = preferredLanguage();
  const t = translations[lang];
  document.documentElement.lang = lang === "fr" ? "fr-CA" : "en-CA";
  try { localStorage.setItem(LANGUAGE_KEY, lang); } catch (_) {}
  const routeSlug = document.body.dataset.pmRoute || "";
  const routeDefaultContent = document.body.dataset.pmDefaultContent || "both";
  const defaultContentValues = routeDefaultContent === "attend" ? ["attend"] : routeDefaultContent === "apply" ? ["apply"] : ["attend", "apply"];
  const defaultContent = () => new Set(defaultContentValues);

  const state = {
    q: "",
    content: defaultContent(),
    time: "upcoming",
    places: new Set(),
    topics: new Set(),
    eventTypes: new Set(),
    opportunityTypes: new Set(),
    audiences: new Set(),
    formats: new Set(),
    statuses: new Set(),
    sort: "soonest",
    near: "",
    view: "list",
    visible: PAGE_SIZE,
    calendarMonth: startOfMonth(calendarToday())
  };

  let allEvents = [];
  let routeEvents = [];
  let filteredEvents = [];
  const routeFacetTotals = new Map();
  let searchRenderTimer = null;
  let lastListSignature = "";
  let lastCalendarSignature = "";
  let savedIds = loadSaved();
  let savedSearches = loadSavedSearches();
  let lastSavedRemoval = null;
  let lastFocusedElement = null;
  let calendarLoading = false;
  let activeLoadController = null;
  let loadRequestId = 0;
  let pageLeaving = false;
  let calendarDataSource = "none";
  const expandedCalendarDays = new Set();
  let printSnapshot = null;

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
    if (dateOnly) {
      const year = Number(dateOnly[1]);
      const month = Number(dateOnly[2]);
      const day = Number(dateOnly[3]);
      const parsed = new Date(Date.UTC(year, month - 1, day, 12));
      return parsed.getUTCFullYear() === year &&
        parsed.getUTCMonth() === month - 1 &&
        parsed.getUTCDate() === day
        ? parsed
        : null;
    }
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
    const secondaryTypes = Array.isArray(event.secondary_types) ? event.secondary_types : [];
    return normalizeText([
      event.title, event.description, event.speaker_or_director, event.venue, event.city,
      event.country, event.type, ...secondaryTypes, event.age_band,
      event.source_id, event.source_name, event.organizer, event.raw_excerpt, event.topics, event.tags, event.qualification_reasons
    ].join(" "));
  }

  function classifyContent(event) {
    const blob = textBlob(event);
    const confirmedDatedEvent = event.record_kind === "event" &&
      event.confirmation_status === "confirmed" &&
      ["lecture", "performance"].includes(event.type);
    if (confirmedDatedEvent) return "attend";
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
    if (ARTS_TOPIC_RE.test(blob)) topics.push("arts");
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

  function eventPoint(event) {
    const latitude = Number(event.latitude);
    const longitude = Number(event.longitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude, precision: event.location_precision === "venue" ? "venue" : "city" };
    }
    const city = normalizeText(event.city);
    const venue = normalizeText(event.venue);
    const joined = `${venue} ${city}`;
    if (/\b(online|virtual|zoom|global)\b/.test(joined)) return null;
    if (city.includes("toronto")) {
      const venueMatch = TORONTO_VENUE_POINTS.find(([pattern]) => pattern.test(venue));
      if (venueMatch) {
        return { latitude: venueMatch[1], longitude: venueMatch[2], precision: "venue" };
      }
    }
    const cityMatch = CITY_POINTS.find(([pattern]) => pattern.test(city));
    return cityMatch
      ? { latitude: cityMatch[1], longitude: cityMatch[2], precision: "city" }
      : null;
  }

  function distanceKm(origin, point) {
    if (!origin || !point) return null;
    const radians = value => value * Math.PI / 180;
    const lat1 = radians(origin.latitude);
    const lat2 = radians(point.latitude);
    const deltaLat = lat2 - lat1;
    const deltaLon = radians(point.longitude - origin.longitude);
    const a = Math.sin(deltaLat / 2) ** 2
      + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
    return 6371.0088 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function eventDistance(event) {
    const origin = NEARBY_ORIGINS[state.near];
    return origin ? distanceKm(origin, event._point) : null;
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
      _status: event.confirmation_status === "confirmed" ? "confirmed" : "pending",
      _point: eventPoint(event)
    };
  }

  function loadSaved() {
    try {
      const value = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
      const current = Array.isArray(value) ? value.filter(id => typeof id === "string" && id) : [];
      const legacy = JSON.parse(localStorage.getItem(LEGACY_SAVED_KEY) || "[]");
      const migrated = Array.isArray(legacy)
        ? legacy.map(item => typeof item === "string" ? item : item?.id).filter(id => typeof id === "string" && id)
        : [];
      const combined = [...new Set([...current, ...migrated])];
      if (migrated.length) localStorage.setItem(SAVED_KEY, JSON.stringify(combined));
      return new Set(combined);
    }
    catch (_) { return new Set(); }
  }

  function persistSaved() {
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify([...savedIds]));
      return true;
    } catch (_) {
      return false;
    }
  }

  function loadSavedSearches() {
    try {
      const value = JSON.parse(localStorage.getItem(SEARCHES_KEY) || "[]");
      const current = Array.isArray(value) ? value.filter(item => item && typeof item.href === "string" && typeof item.label === "string") : [];
      const legacy = JSON.parse(localStorage.getItem(LEGACY_SEARCHES_KEY) || "[]");
      const migrated = Array.isArray(legacy) ? legacy.map(item => {
        if (!item || typeof item !== "object" || typeof item.label !== "string") return null;
        const href = typeof item.href === "string"
          ? item.href
          : `/polymythseminars/${typeof item.query === "string" ? item.query : ""}`;
        return { id: href, href, label: item.label, savedAt: item.savedAt || item.created || new Date(0).toISOString() };
      }).filter(Boolean) : [];
      const combined = [...current, ...migrated.filter(item => !current.some(existing => existing.href === item.href))].slice(0, 20);
      if (migrated.length) localStorage.setItem(SEARCHES_KEY, JSON.stringify(combined));
      return combined;
    } catch (_) { return []; }
  }

  function persistSavedSearches() {
    try {
      localStorage.setItem(SEARCHES_KEY, JSON.stringify(savedSearches.slice(0, 20)));
      return true;
    } catch (_) {
      return false;
    }
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
    $$('a[href^="/polymythseminars/"]').forEach(link => {
      if (link.id === "pmLanguageLink") return;
      const url = new URL(link.getAttribute("href"), location.origin);
      if (!/^\/polymythseminars\/(?:events\/|submit\/|correct\/|subscribe\/|$)/.test(url.pathname)) return;
      url.pathname = url.pathname.replace(/^\/polymythseminars\/(?!fr\/)/, "/polymythseminars/fr/");
      link.setAttribute("href", url.pathname + url.search + url.hash);
    });
  }

  function validValuesFor(key) {
    return new Set($$(`[data-state-set="${key}"]`).map(input => input.value));
  }

  function readStateFromUrl() {
    const params = new URLSearchParams(location.search);
    state.q = params.get("q") || "";
    $("#pmSearch").value = state.q;
    state.content = defaultContent();
    for (const key of SET_KEYS.filter(key => key !== "content")) state[key] = new Set();
    const times = new Set($$('input[name="pm-time"]').map(input => input.value));
    state.time = times.has(params.get("time")) ? params.get("time") : "upcoming";
    state.near = Object.hasOwn(NEARBY_ORIGINS, params.get("near")) ? params.get("near") : "";
    state.sort = ["soonest", "latest", "title", "nearest"].includes(params.get("sort")) ? params.get("sort") : "soonest";
    if (state.sort === "nearest" && !state.near) state.sort = "soonest";
    state.view = ["list", "calendar"].includes(params.get("view")) ? params.get("view") : "list";
    state.visible = PAGE_SIZE;
    state.calendarMonth = startOfMonth(calendarToday());
    expandedCalendarDays.clear();
    for (const key of SET_KEYS) {
      const valid = validValuesFor(key);
      const raw = params.get(key);
      if (raw) state[key] = new Set(raw.split(",").filter(value => valid.has(value)));
    }
    if (!state.content.size) state.content = defaultContent();
    const rawMonth = params.get("month");
    if (/^\d{4}-\d{2}$/.test(rawMonth || "")) {
      const [year, month] = rawMonth.split("-").map(Number);
      state.calendarMonth = new Date(year, month - 1, 1);
    }
    syncControlsFromState();
  }

  function buildUrl(targetLang = lang) {
    const params = new URLSearchParams();
    if (state.q) params.set("q", state.q);
    if (state.time !== "upcoming") params.set("time", state.time);
    if (state.sort !== "soonest") params.set("sort", state.sort);
    if (state.near) params.set("near", state.near);
    if (state.view !== "list") params.set("view", state.view);
    if (state.view === "calendar" && monthKey(state.calendarMonth) !== monthKey(calendarToday())) params.set("month", monthKey(state.calendarMonth));
    for (const key of SET_KEYS) {
      if (!state[key]?.size) continue;
      const values = [...state[key]].sort();
      const isDefaultContent = key === "content" && values.length === defaultContentValues.length && defaultContentValues.every(value => values.includes(value));
      if (!isDefaultContent) params.set(key, values.join(","));
    }
    const query = params.toString();
    const current = location.pathname.replace(/\/index\.html$/, "/");
    const focusedMatch = current.match(/^\/(writingclub|writingkids|writingjuniors|writingteens|writinggrads|university|philosophy|humanities|cfps|lectures|fellowships)(?:\/fr)?\/$/);
    const pathname = focusedMatch
      ? `/${focusedMatch[1]}/${targetLang === "fr" ? "fr/" : ""}`
      : targetLang === "fr" ? "/polymythseminars/fr/" : "/polymythseminars/";
    return `${pathname}${query ? `?${query}` : ""}${location.hash || ""}`;
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
    $("#pmNear").value = state.near;
    const nearestOption = $('#pmSort option[value="nearest"]');
    if (nearestOption) nearestOption.disabled = !state.near;
    $$('[data-view]').forEach(button => button.setAttribute("aria-pressed", String(button.dataset.view === state.view)));
  }

  function eventInTime(event) {
    if (!event._start) return false;
    const today = calendarToday();
    const end = event._endDay || event._startDay;
    if (state.time === "all") return true;
    if (end < today) return false;
    if (state.time === "today") return event._startDay <= today && end >= today;
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

  function searchRank(event, query) {
    const normalizedQuery = normalizeText(query).trim();
    if (!normalizedQuery) return 0;
    const title = normalizeText(event.title || "");
    if (title === normalizedQuery) return 0;
    if (title.startsWith(normalizedQuery)) return 1;
    if (title.includes(normalizedQuery)) return 2;

    const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
    const titleWords = new Set(title.split(/\s+/).filter(Boolean));
    const titleMatches = tokens.filter(token => {
      if (titleWords.has(token)) return true;
      if (token.length < 4) return false;
      const threshold = token.length >= 8 ? 2 : 1;
      return [...titleWords].some(word => editDistance(token, word, threshold) <= threshold);
    }).length;
    if (titleMatches === tokens.length) return 3;
    if (titleMatches > 0) return 4;
    return 5;
  }

  function routeMatches(event) {
    if (!routeSlug) return true;
    const writing = Array.isArray(event.writing_bands) ? event.writing_bands.map(String) : [];
    const academic = Array.isArray(event.academic_bands) ? event.academic_bands.map(String) : [];
    if (routeSlug === "writingclub") return event.type === "contest" && writing.length > 0;
    if (routeSlug === "writingkids") return event.type === "contest" && writing.includes("kids");
    if (routeSlug === "writingjuniors") return event.type === "contest" && writing.includes("juniors");
    if (routeSlug === "writingteens") return event.type === "contest" && writing.includes("teens");
    if (routeSlug === "writinggrads") return event.type === "contest" && writing.includes("grads");
    return academic.includes(routeSlug);
  }

  function matchesFilters(event, ignoreKey = "") {
    if (!routeMatches(event)) return false;
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
    filteredEvents = routeEvents.filter(event => matchesFilters(event));
    filteredEvents.sort((a, b) => {
      if (state.q && state.sort !== "nearest") {
        const rankDiff = searchRank(a, state.q) - searchRank(b, state.q);
        if (rankDiff) return rankDiff;
      }
      if (state.sort === "nearest") {
        const aDistance = eventDistance(a);
        const bDistance = eventDistance(b);
        const distanceDiff = (aDistance ?? Number.POSITIVE_INFINITY)
          - (bDistance ?? Number.POSITIVE_INFINITY);
        if (distanceDiff) return distanceDiff;
      }
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
    else if (event.time_precision === "exact" && event._start) parts.push(formatEventTime(event._start, { hour: "numeric", minute: "2-digit" }));
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
    return lang === "fr"
      ? `/polymythseminars/fr/events/${encodeURIComponent(event.id)}/`
      : `/polymythseminars/events/${encodeURIComponent(event.id)}/`;
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

  function eventFreshness(event) {
    const items = [event._status === "confirmed" ? t.confirmed : t.detailsPending];
    const reasons = Array.isArray(event.qualification_reasons) ? event.qualification_reasons.map(normalizeText) : [];
    const projected = reasons.some(reason => reason.includes("current edition unconfirmed") || reason.includes("projected"));
    if (projected) items.push(t.projectedDate);
    if (reasons.some(reason => reason.includes("official source unconfirmed"))) items.push(t.organizerPending);
    const end = event._endDay || event._startDay;
    if (end && end < calendarToday()) items.push(t.past);
    const checkedRaw = event.last_checked_at || event.scraped_at || event.first_seen_at;
    const checked = checkedRaw ? new Date(checkedRaw) : null;
    if (checked && !Number.isNaN(checked.getTime())) {
      items.push(`${t.checkedOn} ${formatEventTime(checked, { year: "numeric", month: "short", day: "numeric" })}`);
    }
    return [...new Set(items)];
  }

  function freshnessHtml(event) {
    return `<p class="pm-freshness-row">${eventFreshness(event).map(item => `<span>${escapeHtml(item)}</span>`).join('<span aria-hidden="true">·</span>')}</p>`;
  }

  function renderDataSummary(payload, fallbackCount) {
    const count = Number.isInteger(payload?._canonical_count)
      ? payload._canonical_count
      : (Number.isInteger(payload?.count) ? payload.count : fallbackCount);
    const countElement = $("#pmListingCount");
    if (countElement && Number.isFinite(count)) {
      countElement.textContent = Number(count).toLocaleString(lang === "fr" ? "fr-CA" : "en-CA");
    }
    const generated = payload?._generated_at ? new Date(payload._generated_at) : null;
    const dateElement = $("#pmDataUpdated");
    if (dateElement && generated && !Number.isNaN(generated.getTime())) {
      dateElement.textContent = formatEventTime(generated, {
        year: "numeric",
        month: "long",
        day: "numeric"
      });
      dateElement.dataset.generatedAt = generated.toISOString();
    }
  }

  function distanceHtml(event) {
    const origin = NEARBY_ORIGINS[state.near];
    const distance = eventDistance(event);
    if (!origin || distance === null) return "";
    const rounded = distance < 10 ? distance.toFixed(1) : Math.round(distance).toLocaleString(lang === "fr" ? "fr-CA" : "en-CA");
    const precision = event._point?.precision === "venue" ? t.venueEstimate : t.cityEstimate;
    return `<p class="pm-distance">${escapeHtml(t.approximateDistance(rounded, origin.label, precision))}</p>`;
  }

  function dateBoxHtml(event) {
    if (event._content === "apply") {
      const date = event._startDay;
      const deadline = lang === "fr" ? "Échéance" : "Deadline";
      return `<time class="pm-date-box deadline" datetime="${isoDate(date)}" aria-label="${escapeHtml(`${deadline}. ${formatDate(date, { dateStyle: "long" })}`)}"><span class="pm-date-status">${deadline}</span><span class="pm-date-month">${escapeHtml(formatDate(date, { month: "short" }))}</span><span class="pm-date-day">${date.getDate()}</span><span class="pm-date-year">${date.getFullYear()}</span></time>`;
    }
    if (isOngoing(event)) {
      const end = event._endDay;
      return `<time class="pm-date-box ongoing" datetime="${isoDate(end)}" aria-label="${escapeHtml(`${t.ongoing}. ${t.until} ${formatDate(end, { dateStyle: "long" })}`)}"><span class="pm-date-status">${escapeHtml(t.ongoing)}</span><span class="pm-date-until">${escapeHtml(t.until)}</span><span class="pm-date-end">${escapeHtml(formatDate(end, { month: "short", day: "numeric" }))}</span><span class="pm-date-year">${end.getFullYear()}</span></time>`;
    }
    const date = event._startDay;
    return `<time class="pm-date-box" datetime="${isoDate(date)}" aria-label="${escapeHtml(formatDate(date, { dateStyle: "long" }))}"><span class="pm-date-month">${escapeHtml(formatDate(date, { month: "short" }))}</span><span class="pm-date-day">${date.getDate()}</span><span class="pm-date-year">${date.getFullYear()}</span></time>`;
  }

  function sourceLabel(event) {
    const quality = ["official", "official-or-institutional", "institutional"].includes(String(event.source_quality || "").toLowerCase())
      ? t.officialSource
      : t.sourceListing;
    try {
      const host = new URL(event.source_url).hostname.replace(/^www\./, "");
      return host ? `${quality} · ${host}` : quality;
    } catch (_) {
      const sourceId = String(event.source_id || "").trim();
      return sourceId ? `${quality} · ${sourceId}` : quality;
    }
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
          ${distanceHtml(event)}
          ${freshnessHtml(event)}
          ${descriptionText ? `<p class="pm-event-description">${escapeHtml(descriptionText)}</p>` : ""}
          <div class="pm-card-actions">
            <a class="pm-action primary-link" href="${routeFor(event)}">${escapeHtml(t.details)} <span aria-hidden="true">→</span></a>
            ${event.source_url ? `<a class="pm-action" href="${escapeHtml(event.source_url)}" rel="noopener noreferrer">${escapeHtml(sourceLabel(event))}</a>` : ""}
            <button type="button" class="pm-action pm-save" data-save-id="${escapeHtml(event.id)}" aria-pressed="${saved}" aria-label="${escapeHtml(saved ? `${t.saved}: ${event.title}` : `${t.save}: ${event.title}`)}">${escapeHtml(saved ? t.saved : t.save)}</button>
          </div>
        </div>
      </article>`;
  }

  function renderList() {
    const container = $("#pmEventList");
    const slice = filteredEvents.slice(0, state.visible);
    const signature = `${state.visible}|${slice.map(event => event.id).join("|")}`;
    if (signature === lastListSignature) {
      $("#pmLoadMore").hidden = slice.length >= filteredEvents.length;
      return;
    }
    lastListSignature = signature;
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
    const remaining = Math.max(0, filteredEvents.length - slice.length);
    const nextCount = Math.min(PAGE_SIZE, remaining);
    $("#pmLoadMore").hidden = remaining === 0;
    $("#pmLoadMore").textContent = nextCount ? t.loadMoreCount(nextCount) : t.loadMore;
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
    const signature = `${month.getFullYear()}-${month.getMonth()}|${filteredEvents.map(event => event.id).join("|")}|${[...expandedCalendarDays].sort().join("|")}`;
    if (signature === lastCalendarSignature) return;
    lastCalendarSignature = signature;
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
      days.push(`<section class="pm-calendar-day${outside ? " outside" : ""}${isToday ? " today" : ""}" data-calendar-date="${key}" tabindex="-1" aria-label="${escapeHtml(formatDate(date, { dateStyle: "long" }))}"><span class="pm-calendar-number">${date.getDate()}</span>${links}${more}</section>`);
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
    const contentIsDefault = state.content.size === defaultContentValues.length && defaultContentValues.every(value => state.content.has(value));
    if (!contentIsDefault) items.push({ key: "content", value: [...state.content][0] || "", label: state.content.has("attend") && !state.content.has("apply") ? t.eventsOnly : t.opportunitiesOnly });
    if (state.time !== "upcoming") items.push({ key: "time", value: state.time, label: labelFor(`time:${state.time}`) });
    if (state.near) items.push({ key: "near", value: state.near, label: `${lang === "fr" ? "Près de" : "Near"} ${NEARBY_ORIGINS[state.near].label}` });
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
      if (key === "content") active = !(state.content.size === defaultContentValues.length && defaultContentValues.every(value => state.content.has(value)));
      else if (key === "time") active = state.time !== "upcoming";
      else if (key === "types") active = state.eventTypes.size > 0 || state.opportunityTypes.size > 0;
      else active = state[key]?.size > 0;
      button.hidden = false;
      button.disabled = !active;
      button.classList.toggle("is-inactive", !active);
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
    const contexts = new Map();
    const controls = $$('[data-count-for]');
    for (const node of controls) {
      const [key] = node.dataset.countFor.split(":");
      if (!contexts.has(key)) contexts.set(key, routeEvents.filter(event => matchesFilters(event, key)));
    }
    const countsByKey = new Map();
    for (const [key, events] of contexts) {
      const counts = new Map();
      for (const event of events) {
        const values = key === "content" ? [event._content]
          : key === "places" ? [event._place]
          : key === "topics" ? event._topics
          : key === "eventTypes" ? (event._content === "attend" ? [event._eventType] : [])
          : key === "opportunityTypes" ? (event._content === "apply" ? [event._opportunityType] : [])
          : key === "audiences" ? event._audiences
          : key === "formats" ? [event._format]
          : key === "statuses" ? [event._status] : [];
        for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
      }
      countsByKey.set(key, counts);
    }
    for (const node of controls) {
      const [key, value] = node.dataset.countFor.split(":");
      const count = countsByKey.get(key)?.get(value) || 0;
      node.textContent = count.toLocaleString(lang === "fr" ? "fr-CA" : "en-CA");
      const label = node.closest("label");
      const input = label?.querySelector("input");
      if (label && input) {
        const unavailable = count === 0 && !input.checked;
        label.hidden = false;
        label.classList.toggle("zero-results", unavailable);
        input.disabled = unavailable;
      }
    }
  }

  function renderCounts() {
    $("#pmResultsTitle").textContent = t.eventsFound(filteredEvents.length);
    const shown = Math.min(state.visible, filteredEvents.length);
    $(".pm-results-count").textContent = filteredEvents.length ? t.resultsReady(filteredEvents.length) : t.noResults;
    $("#pmStatus").textContent = filteredEvents.length
      ? (state.view === "calendar" ? t.calendarStatus(filteredEvents.length) : t.shown(shown, filteredEvents.length))
      : t.noResults;
    $("#pmFilterResultPreview").textContent = t.resultPreview(filteredEvents.length);
    $("#pmMobileResults").textContent = t.viewResults(filteredEvents.length);
    $("#pmJumpResults").textContent = t.viewResults(filteredEvents.length);
  }

  function hasCustomSearch() {
    return activeFilterItems().length > 0 || state.sort !== "soonest" || state.view !== "list";
  }

  function currentSearchLabel() {
    const labels = activeFilterItems().map(item => item.label);
    if (state.view === "calendar") labels.push(lang === "fr" ? "Vue calendrier" : "Calendar view");
    if (state.sort !== "soonest") labels.push(labelFor(`sort:${state.sort}`));
    const shown = labels.slice(0, 3);
    const remaining = labels.length - shown.length;
    return `${shown.join(" + ")}${remaining > 0 ? ` + ${remaining}` : ""}` || (lang === "fr" ? "Recherche du calendrier" : "Calendar search");
  }

  function saveCurrentSearch() {
    if (!hasCustomSearch()) return;
    writeStateToUrl();
    const href = buildUrl(lang);
    const item = { id: href, href, label: currentSearchLabel(), savedAt: new Date().toISOString() };
    savedSearches = [item, ...savedSearches.filter(existing => existing.href !== href)].slice(0, 20);
    const persisted = persistSavedSearches();
    renderSaved();
    const button = $("#pmSaveSearch");
    button.textContent = t.searchSaved;
    $("#pmStatus").textContent = persisted ? t.searchSaved : t.savedForVisit;
    setTimeout(() => { button.textContent = t.saveSearch; }, 1600);
  }


  function updateSavedSummary() {
    const eventCount = [...savedIds].filter(id => allEvents.some(event => event.id === id)).length;
    $("#pmSavedCount").textContent = String(eventCount + savedSearches.length);
    $("#pmSaveSearch").disabled = !hasCustomSearch();
    $("#pmSaveSearch").textContent = t.saveSearch;
  }
  function renderSaved() {
    const list = $("#pmSavedList");
    const events = allEvents.filter(event => savedIds.has(event.id)).sort((a, b) => (a._start || 0) - (b._start || 0));
    list.innerHTML = events.length
      ? `<ul>${events.map(event => `<li class="pm-saved-item"><div><a href="${routeFor(event)}">${escapeHtml(event.title)}</a><span><time datetime="${isoDate(event._startDay)}">${escapeHtml(formatDate(event._startDay, { dateStyle: "medium" }))}</time> · ${escapeHtml(formatMeta(event))}</span></div><button type="button" class="pm-button subtle" data-remove-saved="${escapeHtml(event.id)}" aria-label="${escapeHtml(`${t.remove}: ${event.title}`)}">${escapeHtml(t.remove)}</button></li>`).join("")}</ul>`
      : `<p class="pm-empty-saved">${escapeHtml(t.savedEmpty)}</p>`;
    const searchList = $("#pmSavedSearchList");
    searchList.innerHTML = savedSearches.length
      ? `<ul>${savedSearches.map(item => `<li class="pm-saved-item pm-saved-search-item"><div><a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a><span>${escapeHtml(lang === "fr" ? "Ouvrir cette vue enregistrée" : "Open this saved view")}</span></div><button type="button" class="pm-button subtle" data-remove-search="${escapeHtml(item.id)}" aria-label="${escapeHtml(`${t.remove}: ${item.label}`)}">${escapeHtml(t.remove)}</button></li>`).join("")}</ul>`
      : `<p class="pm-empty-saved">${escapeHtml(t.savedSearchesEmpty)}</p>`;
    updateSavedSummary();
  }

  function offerSavedUndo(removal) {
    if (!removal) return;
    lastSavedRemoval = removal;
    const region = $("#pmUndoRegion");
    const message = $("#pmUndoMessage");
    const button = $("#pmUndoSaved");
    if (!region || !message || !button) return;
    message.textContent = removal.kind === "event"
      ? t.removedSaved(removal.label)
      : t.removedSearch(removal.label);
    button.textContent = t.undo;
    region.hidden = false;
    button.focus({ preventScroll: true });
  }

  function undoSavedRemoval() {
    if (!lastSavedRemoval) return;
    const removal = lastSavedRemoval;
    lastSavedRemoval = null;
    if (removal.kind === "event") {
      savedIds.add(removal.id);
      persistSaved();
      updateSaveButtons(removal.id);
    } else {
      savedSearches = [
        removal.item,
        ...savedSearches.filter(item => item.id !== removal.item.id)
      ].slice(0, 20);
      persistSavedSearches();
      renderSaved();
    }
    const region = $("#pmUndoRegion");
    if (region) region.hidden = true;
    $("#pmStatus").textContent = t.restored(removal.label);
    const restoredLink = $(
      removal.kind === "event"
        ? `#pmSavedList a[href="${CSS.escape(routeFor(removal.event))}"]`
        : `#pmSavedSearchList a[href="${CSS.escape(removal.item.href)}"]`
    );
    restoredLink?.focus({ preventScroll: true });
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
      today: state.time === "today",
      week: state.time === "7d",
      attend: state.content.size === 1 && state.content.has("attend"),
      apply: state.content.size === 1 && state.content.has("apply"),
      families: state.audiences.size === 2 && ["youth", "families"].every(x => state.audiences.has(x)),
      educators: state.audiences.size === 1 && state.audiences.has("educators"),
      online: state.formats.size === 1 && state.formats.has("online"),
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
    updateSavedSummary();
    const savedDialog = $("#pmSavedPanel");
    if (savedDialog?.open) renderSaved();
    $("#pmClearSearch").hidden = !state.q;
    writeStateToUrl();
    if (calendarDataSource === "cache") $("#pmStatus").textContent = t.cachedData;
  }

  function prepareCompletePrintView() {
    if (!allEvents.length || printSnapshot) return;
    printSnapshot = {
      visible: state.visible,
      eventListHidden: $("#pmEventList").hidden,
      calendarHidden: $("#pmCalendar").hidden
    };
    state.visible = Math.max(state.visible, filteredEvents.length);
    lastListSignature = "";
    renderList();
    $("#pmEventList").hidden = false;
    $("#pmCalendar").hidden = true;
  }

  function restoreInteractiveViewAfterPrint() {
    if (!printSnapshot) return;
    state.visible = printSnapshot.visible;
    $("#pmEventList").hidden = printSnapshot.eventListHidden;
    $("#pmCalendar").hidden = printSnapshot.calendarHidden;
    printSnapshot = null;
    lastListSignature = "";
    render();
  }

  function renderWithAnchor(anchor, callback = render) {
    const node = anchor instanceof Element ? anchor.closest('.pm-filter-section, .pm-panel, details') : null;
    const before = node?.getBoundingClientRect().top;
    callback();
    if (node && Number.isFinite(before)) {
      const after = node.getBoundingClientRect().top;
      const delta = after - before;
      if (Math.abs(delta) > 1) window.scrollBy(0, delta);
    }
  }

  function resetFilters(options = {}) {
    state.q = "";
    state.content = defaultContent();
    state.time = "upcoming";
    for (const key of ["places", "topics", "eventTypes", "opportunityTypes", "audiences", "formats", "statuses"]) state[key].clear();
    state.sort = "soonest";
    state.near = "";
    state.visible = PAGE_SIZE;
    $("#pmSearch").value = "";
    syncControlsFromState();
    render();
    if (options.focusSearch) $("#pmSearch").focus();
  }

  function clearSection(key) {
    if (key === "content") state.content = defaultContent();
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
    else if (key === "content") state.content = defaultContent();
    else if (key === "near") {
      state.near = "";
      if (state.sort === "nearest") state.sort = "soonest";
    }
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
    if (navigator.share && mobileViewport.matches) {
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
      today: () => { state.content = new Set(["attend"]); state.time = "today"; },
      week: () => { state.content = new Set(["attend"]); state.time = "7d"; },
      attend: () => { state.content = new Set(["attend"]); },
      apply: () => { state.content = new Set(["apply"]); },
      families: () => { ["youth", "families"].forEach(x => state.audiences.add(x)); },
      educators: () => state.audiences.add("educators"),
      online: () => state.formats.add("online"),
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
    renderWithAnchor(document.activeElement);
    $("#pmStatus").textContent = t.presetApplied(label);
    // Keep the page anchored. Presets update in place; the explicit Results
    // button remains available for people who want to jump down.
  }

  function syncResponsiveDisclosureState() {
    const drawer = $("#pmFilterDrawer");
    const button = $("#pmMobileFilters");
    if (drawer && button) {
      button.setAttribute("aria-expanded", String(drawer.open));
    }
  }

  function configureResponsivePanels() {
    const mobile = mobileViewport.matches;
    $("#pmFilterDrawer").open = !mobile;
    if ($("#pmQuickStarts")) $("#pmQuickStarts").open = !mobile;
    syncResponsiveDisclosureState();
    // The stylesheet paints these same responsive states before this deferred
    // controller runs. Mark hydration only after the native details states
    // agree, so opening or closing them never moves the page after first paint.
    document.documentElement.classList.add("pm-ui-ready");
  }

  function bindEvents() {
    $("#pmSearch").addEventListener("input", event => {
      state.q = event.target.value.trim();
      state.visible = PAGE_SIZE;

      // Keep the clear control physically stable and immediately available.
      // Results remain lightly debounced, while this control never waits for
      // a large event-list render before appearing or disappearing.
      $("#pmClearSearch").hidden = !state.q;
      const saveSearchButton = $("#pmSaveSearch");
      if (saveSearchButton) saveSearchButton.disabled = !hasCustomSearch();

      clearTimeout(searchRenderTimer);
      searchRenderTimer = setTimeout(() => {
        render();
        searchRenderTimer = null;
      }, 110);
    });

    document.addEventListener("keydown", event => {
      const target = event.target;
      const typing = target instanceof HTMLElement && (target.matches("input, textarea, select") || target.isContentEditable);
      const unmodifiedShortcut = !event.ctrlKey && !event.metaKey && !event.altKey;
      if (!typing && unmodifiedShortcut && event.key === "/") {
        event.preventDefault();
        $("#pmSearch").focus();
        return;
      }
      if (state.view === "calendar" && !typing && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        event.preventDefault();
        state.calendarMonth = addMonths(state.calendarMonth, event.key === "ArrowRight" ? 1 : -1);
        expandedCalendarDays.clear();
        render();
        $("#pmCalendar").focus({ preventScroll: true });
      }
    });

    window.addEventListener("popstate", () => {
      const requestedLang = new URLSearchParams(location.search).get("lang") === "fr" ? "fr" : "en";
      if (requestedLang !== lang) {
        location.reload();
        return;
      }
      readStateFromUrl();
      configureResponsivePanels();
      lastListSignature = "";
      lastCalendarSignature = "";
      render();
    });

    const filterDrawer = $("#pmFilterDrawer");
    filterDrawer.addEventListener("toggle", syncResponsiveDisclosureState);
    if (typeof mobileViewport.addEventListener === "function") {
      mobileViewport.addEventListener("change", configureResponsivePanels);
    } else if (typeof mobileViewport.addListener === "function") {
      mobileViewport.addListener(configureResponsivePanels);
    }

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
        renderWithAnchor(input);
      }
      if (input.matches('input[name="pm-time"]')) {
        state.time = input.value;
        state.visible = PAGE_SIZE;
        renderWithAnchor(input);
      }
      if (input.id === "pmSort") {
        state.sort = input.value;
        renderWithAnchor(input);
      }
      if (input.id === "pmNear") {
        state.near = Object.hasOwn(NEARBY_ORIGINS, input.value) ? input.value : "";
        if (state.near) state.sort = "nearest";
        else if (state.sort === "nearest") state.sort = "soonest";
        state.visible = PAGE_SIZE;
        syncControlsFromState();
        renderWithAnchor(input);
      }
    });

    document.addEventListener("click", async event => {
      const clearAll = event.target.closest("[data-clear-all]");
      if (clearAll) { resetFilters({ focusSearch: true }); return; }

      if (event.target.closest("[data-retry-calendar]")) {
        await loadCalendarData();
        return;
      }

      const clearSearch = event.target.closest("#pmClearSearch");
      if (clearSearch) {
        // Cancel pending search work before clearing. Otherwise a delayed
        // render can arrive under the pointer and make the control unstable.
        clearTimeout(searchRenderTimer);
        searchRenderTimer = null;
        state.q = "";
        $("#pmSearch").value = "";
        state.visible = PAGE_SIZE;
        render();
        $("#pmSearch").focus({ preventScroll: true });
        return;
      }

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
      if (loadMore) {
        state.visible += PAGE_SIZE;
        lastListSignature = "";
        render();
        requestAnimationFrame(() => $("#pmLoadMore")?.focus({ preventScroll: true }));
        return;
      }

      const save = event.target.closest("[data-save-id]");
      if (save) {
        const id = save.dataset.saveId;
        if (savedIds.has(id)) savedIds.delete(id); else savedIds.add(id);
        const persisted = persistSaved();
        updateSaveButtons(id);
        if (!persisted) $("#pmStatus").textContent = t.savedForVisit;
        save.focus();
        return;
      }

      const removeSaved = event.target.closest("[data-remove-saved]");
      if (removeSaved) {
        const id = removeSaved.dataset.removeSaved;
        const removedEvent = allEvents.find(item => item.id === id);
        savedIds.delete(id);
        const persisted = persistSaved();
        updateSaveButtons(id);
        if (removedEvent) {
          offerSavedUndo({
            kind: "event",
            id,
            event: removedEvent,
            label: removedEvent.title
          });
        }
        if (!persisted) $("#pmStatus").textContent = t.savedForVisit;
        return;
      }

      const removeSearch = event.target.closest("[data-remove-search]");
      if (removeSearch) {
        const removedItem = savedSearches.find(item => item.id === removeSearch.dataset.removeSearch);
        savedSearches = savedSearches.filter(item => item.id !== removeSearch.dataset.removeSearch);
        const persisted = persistSavedSearches();
        renderSaved();
        if (removedItem) {
          offerSavedUndo({
            kind: "search",
            item: removedItem,
            label: removedItem.label
          });
        }
        if (!persisted) $("#pmStatus").textContent = t.savedForVisit;
        return;
      }

      if (event.target.closest("#pmUndoSaved")) { undoSavedRemoval(); return; }
      if (event.target.closest("#pmSaveSearch")) { saveCurrentSearch(); return; }
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
        const day = $(`[data-calendar-date="${CSS.escape(expandDay.dataset.expandDay)}"]`);
        day?.focus({ preventScroll: true });
        return;
      }

      if (event.target.closest("#pmJumpResults") || event.target.closest("#pmMobileResults")) {
        $("#pmFilterDrawer").open = false;
        requestAnimationFrame(() => {
          $("#pmResults").scrollIntoView({ behavior: "auto", block: "start" });
          $("#pmResultsTitle").focus({ preventScroll: true });
        });
        return;
      }

      if (event.target.closest("#pmMobileFilters")) {
        $("#pmFilterDrawer").open = true;
        $("#pmFilterDrawer").querySelector('summary')?.focus({ preventScroll: true });
        return;
      }
    });

    const dialog = $("#pmSavedPanel");
    dialog.addEventListener("click", event => { if (event.target === dialog) closeSavedDialog(); });
    dialog.addEventListener("close", () => { if (lastFocusedElement?.focus) lastFocusedElement.focus(); });
  }

  function setCalendarControlsDisabled(disabled) {
    $$([
      "#pmSearch",
      "#pmClearSearch",
      "#pmSort",
      "#pmNear",
      "#pmJumpResults",
      "#pmMobileResults",
      "[data-state-set]",
      'input[name="pm-time"]',
      "[data-preset]",
      "[data-view]",
      "[data-clear-section]",
      "#pmResetFilters"
    ].join(",")).forEach(control => {
      control.disabled = disabled;
    });
  }

  function abortError() {
    try {
      return new DOMException("Calendar loading was interrupted", "AbortError");
    } catch (_) {
      const error = new Error("Calendar loading was interrupted");
      error.name = "AbortError";
      return error;
    }
  }

  function waitForRetry(milliseconds, signal) {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(abortError());
        return;
      }
      const onAbort = () => {
        clearTimeout(timer);
        reject(abortError());
      };
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      }, milliseconds);
      signal.addEventListener("abort", onAbort, { once: true });
    });
  }

  function validateCalendarPayload(payload) {
    const raw = Array.isArray(payload)
      ? payload
      : (payload && typeof payload === "object" ? (payload.events || payload.items) : null);
    if (!Array.isArray(raw) || raw.length === 0) {
      throw new Error("Calendar payload contained no listings");
    }

    if (payload && !Array.isArray(payload)) {
      for (const key of ["count", "_canonical_count", "_total_events"]) {
        const declared = payload[key];
        if (Number.isInteger(declared) && declared !== raw.length) {
          throw new Error(`Calendar payload ${key} did not match its listings`);
        }
      }
    }

    const ids = new Set();
    raw.forEach((event, index) => {
      if (!event || typeof event !== "object" || Array.isArray(event)) {
        throw new Error(`Calendar listing ${index + 1} was malformed`);
      }
      if (typeof event.id !== "string" || !event.id.trim() || ids.has(event.id)) {
        throw new Error(`Calendar listing ${index + 1} had a missing or duplicate id`);
      }
      if (typeof event.title !== "string" || !event.title.trim()) {
        throw new Error(`Calendar listing ${event.id} had no title`);
      }
      if (typeof event.date !== "string" || !parseDate(event.date)) {
        throw new Error(`Calendar listing ${event.id} had an unusable date`);
      }
      if (event.end_date && !parseDate(event.end_date)) {
        throw new Error(`Calendar listing ${event.id} had an unusable end date`);
      }
      ids.add(event.id);
    });
    return raw;
  }

  async function fetchCalendarPayload(signal) {
    const controller = new AbortController();
    let timedOut = false;
    const relayAbort = () => controller.abort();
    signal.addEventListener("abort", relayAbort, { once: true });
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(DATA_URL, {
        // Honour the audited five-minute HTTP freshness window. `no-cache`
        // forced a revalidation on every cross-route calendar visit.
        cache: "default",
        signal: controller.signal,
        headers: { Accept: "application/json" }
      });
      if (signal.aborted) throw abortError();
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      return { payload, raw: validateCalendarPayload(payload) };
    } catch (error) {
      if (signal.aborted) throw abortError();
      if (timedOut) throw new Error("Calendar request timed out");
      throw error;
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener("abort", relayAbort);
    }
  }

  async function fetchCalendarWithRetry(signal) {
    let lastError = null;
    for (let attempt = 0; attempt < FETCH_ATTEMPTS; attempt += 1) {
      try {
        return await fetchCalendarPayload(signal);
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        lastError = error;
        if (attempt + 1 < FETCH_ATTEMPTS) {
          $("#pmStatus").textContent = t.retrying;
          await waitForRetry(650, signal);
        }
      }
    }
    throw lastError || new Error("Calendar request failed");
  }

  async function persistCalendarCache(payload) {
    if (!("caches" in window) || typeof Response !== "function") return;
    try {
      const cache = await caches.open(DATA_CACHE);
      const payloadVersion = String(payload?._generated_at || "");
      const existing = await cache.match(DATA_URL);
      if (
        payloadVersion
        && existing?.headers.get("X-Polymythcal-Version") === payloadVersion
      ) return;
      const body = JSON.stringify(payload);
      await cache.put(DATA_URL, new Response(body, {
        headers: {
          "Content-Type": "application/json",
          "X-Polymythcal-Cache": "last-good",
          "X-Polymythcal-Version": payloadVersion
        }
      }));
    } catch (_) {
      // Cache Storage can be unavailable, full, or disabled. Live data remains.
    }
  }

  async function readCalendarCache() {
    if (!("caches" in window)) return null;
    try {
      const cache = await caches.open(DATA_CACHE);
      const response = await cache.match(DATA_URL);
      if (!response) return null;
      const payload = await response.json();
      return { payload, raw: validateCalendarPayload(payload) };
    } catch (_) {
      return null;
    }
  }

  async function loadCalendarData() {
    if (calendarLoading || pageLeaving) return;
    calendarLoading = true;
    const requestId = ++loadRequestId;
    const controller = new AbortController();
    activeLoadController = controller;
    const results = $("#pmResults");
    results.setAttribute("aria-busy", "true");
    setCalendarControlsDisabled(true);
    $("#pmStatus").textContent = t.loading;
    try {
      let loaded;
      let source = "network";
      try {
        loaded = await fetchCalendarWithRetry(controller.signal);
      } catch (networkError) {
        if (networkError?.name === "AbortError") throw networkError;
        loaded = await readCalendarCache();
        if (!loaded) throw networkError;
        source = "cache";
      }
      if (controller.signal.aborted || requestId !== loadRequestId || pageLeaving) throw abortError();

      allEvents = loaded.raw.map(hydrate);
      if (allEvents.some(event => !event._start)) throw new Error("Calendar payload contained unusable dates");
      renderDataSummary(loaded.payload, loaded.raw.length);
      routeEvents = allEvents.filter(routeMatches);
      calendarDataSource = source;
      routeFacetTotals.clear();
      lastListSignature = "";
      lastCalendarSignature = "";
      const validIds = new Set(allEvents.map(event => event.id));
      const cleaned = new Set([...savedIds].filter(id => validIds.has(id)));
      if (cleaned.size !== savedIds.size) { savedIds = cleaned; persistSaved(); }
      setCalendarControlsDisabled(false);
      render();
      renderSaved();
      if (source === "network") void persistCalendarCache(loaded.payload);
      else $("#pmStatus").textContent = t.cachedData;
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.error(error);
      allEvents = [];
      routeEvents = [];
      filteredEvents = [];
      calendarDataSource = "none";
      lastListSignature = "";
      lastCalendarSignature = "";
      $("#pmResultsTitle").textContent = t.unavailable;
      $(".pm-results-count").textContent = t.loadError;
      $("#pmFilterResultPreview").textContent = t.unavailable;
      $("#pmStatus").textContent = t.loadError;
      $("#pmCalendar").hidden = true;
      $("#pmEventList").hidden = false;
      $("#pmLoadMore").hidden = true;
      $("#pmEventList").innerHTML = `<div class="pm-empty"><h3>${escapeHtml(t.unavailable)}</h3><p>${escapeHtml(t.loadError)}</p><p class="pm-empty-actions"><button class="pm-button primary" data-retry-calendar type="button">${escapeHtml(t.retry)}</button><a class="pm-link-button" href="/polymythseminars/subscribe/">${escapeHtml(lang === "fr" ? "Fils et abonnements calendrier" : "Feeds and calendar subscriptions")}</a></p></div>`;
    } finally {
      if (requestId === loadRequestId) {
        calendarLoading = false;
        activeLoadController = null;
        results.setAttribute("aria-busy", "false");
      }
    }
  }

  function init() {
    translateStatic();
    document.documentElement.classList.remove("pm-lang-pending");
    bindEvents();
    readStateFromUrl();
    configureResponsivePanels();
    window.addEventListener("online", () => {
      if (calendarDataSource !== "network") loadCalendarData();
    }, { passive: true });
    window.addEventListener("pagehide", () => {
      pageLeaving = true;
      loadRequestId += 1;
      calendarLoading = false;
      clearTimeout(searchRenderTimer);
      activeLoadController?.abort();
      activeLoadController = null;
    });
    window.addEventListener("pageshow", event => {
      pageLeaving = false;
      if (event.persisted) configureResponsivePanels();
      if (event.persisted && calendarDataSource === "none") loadCalendarData();
    });
    window.addEventListener("beforeprint", prepareCompletePrintView);
    window.addEventListener("afterprint", restoreInteractiveViewAfterPrint);
    loadCalendarData();
  }

  init();
})();
