/* polymyth-horoscope.js
 * Eleven cosmological traditions, each computing a symbolic-index sign from birth date/time/place.
 * Per polymyth ironmanned-cosmological-horoscopes methodology: signs are mnemonic indices into mythological corpora,
 * not predictive-causal claims. Multiple traditions run simultaneously. No tradition is privileged over another.
 * Each function returns { tradition, sign, key } or null if data insufficient.
 */

(function(global) {
  'use strict';

  // ============================================================
  // CHINESE ZODIAC
  // 12-animal cycle, year-based. Boundary = lunar new year, NOT Jan 1.
  // Lookup table 1900-2050 for lunar new year dates (verified astronomical).
  // For births before lunar new year of the gregorian year, sign = previous year's animal.
  // ============================================================
  var CHINESE_ANIMALS = ['rat','ox','tiger','rabbit','dragon','snake','horse','goat','monkey','rooster','dog','pig'];

  // Lunar new year date by gregorian year (month, day). Sourced from Hong Kong Observatory historical tables.
  // Truncated to 1920-2050 for v1. Years outside range fall back to naive year-mod-12 with Jan 1 boundary.
  var LUNAR_NEW_YEAR = {
    1920:[2,20], 1921:[2,8],  1922:[1,28], 1923:[2,16], 1924:[2,5],  1925:[1,24], 1926:[2,13], 1927:[2,2],
    1928:[1,23], 1929:[2,10], 1930:[1,30], 1931:[2,17], 1932:[2,6],  1933:[1,26], 1934:[2,14], 1935:[2,4],
    1936:[1,24], 1937:[2,11], 1938:[1,31], 1939:[2,19], 1940:[2,8],  1941:[1,27], 1942:[2,15], 1943:[2,5],
    1944:[1,25], 1945:[2,13], 1946:[2,2],  1947:[1,22], 1948:[2,10], 1949:[1,29], 1950:[2,17], 1951:[2,6],
    1952:[1,27], 1953:[2,14], 1954:[2,3],  1955:[1,24], 1956:[2,12], 1957:[1,31], 1958:[2,18], 1959:[2,8],
    1960:[1,28], 1961:[2,15], 1962:[2,5],  1963:[1,25], 1964:[2,13], 1965:[2,2],  1966:[1,21], 1967:[2,9],
    1968:[1,30], 1969:[2,17], 1970:[2,6],  1971:[1,27], 1972:[2,15], 1973:[2,3],  1974:[1,23], 1975:[2,11],
    1976:[1,31], 1977:[2,18], 1978:[2,7],  1979:[1,28], 1980:[2,16], 1981:[2,5],  1982:[1,25], 1983:[2,13],
    1984:[2,2],  1985:[2,20], 1986:[2,9],  1987:[1,29], 1988:[2,17], 1989:[2,6],  1990:[1,27], 1991:[2,15],
    1992:[2,4],  1993:[1,23], 1994:[2,10], 1995:[1,31], 1996:[2,19], 1997:[2,7],  1998:[1,28], 1999:[2,16],
    2000:[2,5],  2001:[1,24], 2002:[2,12], 2003:[2,1],  2004:[1,22], 2005:[2,9],  2006:[1,29], 2007:[2,18],
    2008:[2,7],  2009:[1,26], 2010:[2,14], 2011:[2,3],  2012:[1,23], 2013:[2,10], 2014:[1,31], 2015:[2,19],
    2016:[2,8],  2017:[1,28], 2018:[2,16], 2019:[2,5],  2020:[1,25], 2021:[2,12], 2022:[2,1],  2023:[1,22],
    2024:[2,10], 2025:[1,29], 2026:[2,17], 2027:[2,6],  2028:[1,26], 2029:[2,13], 2030:[2,3],  2031:[1,23],
    2032:[2,11], 2033:[1,31], 2034:[2,19], 2035:[2,8],  2036:[1,28], 2037:[2,15], 2038:[2,4],  2039:[1,24],
    2040:[2,12], 2041:[2,1],  2042:[1,22], 2043:[2,10], 2044:[1,30], 2045:[2,17], 2046:[2,6],  2047:[1,26],
    2048:[2,14], 2049:[2,2],  2050:[1,23]
  };

  function chinese(year, month, day) {
    if (!year) return null;
    var effectiveYear = year;
    var lny = LUNAR_NEW_YEAR[year];
    if (lny && month && day) {
      // If birth is BEFORE lunar new year of gregorian year, animal is previous year's
      if (month < lny[0] || (month === lny[0] && day < lny[1])) {
        effectiveYear = year - 1;
      }
    } else if (lny && !month) {
      // Year-only with no month/day: use the gregorian year sign (good enough — 80%+ accurate)
      effectiveYear = year;
    }
    var idx = ((effectiveYear - 4) % 12 + 12) % 12;
    var sign = CHINESE_ANIMALS[idx];
    return { tradition: 'chinese', sign: sign, key: 'chinese-' + sign };
  }

  // ============================================================
  // WESTERN TROPICAL ZODIAC (Sun sign)
  // Standard tropical sign boundaries — date-range table.
  // ============================================================
  var WESTERN_SIGNS = [
    { sign:'capricorn',   start:[12,22], end:[1,19] },
    { sign:'aquarius',    start:[1,20],  end:[2,18] },
    { sign:'pisces',      start:[2,19],  end:[3,20] },
    { sign:'aries',       start:[3,21],  end:[4,19] },
    { sign:'taurus',      start:[4,20],  end:[5,20] },
    { sign:'gemini',      start:[5,21],  end:[6,20] },
    { sign:'cancer',      start:[6,21],  end:[7,22] },
    { sign:'leo',         start:[7,23],  end:[8,22] },
    { sign:'virgo',       start:[8,23],  end:[9,22] },
    { sign:'libra',       start:[9,23],  end:[10,22] },
    { sign:'scorpio',     start:[10,23], end:[11,21] },
    { sign:'sagittarius', start:[11,22], end:[12,21] }
  ];

  function dateInRange(month, day, start, end) {
    var birthMD = month * 100 + day;
    var startMD = start[0] * 100 + start[1];
    var endMD = end[0] * 100 + end[1];
    if (startMD > endMD) {
      // Wraps around year (capricorn)
      return birthMD >= startMD || birthMD <= endMD;
    }
    return birthMD >= startMD && birthMD <= endMD;
  }

  function western(month, day) {
    if (!month || !day) return null;
    for (var i = 0; i < WESTERN_SIGNS.length; i++) {
      var s = WESTERN_SIGNS[i];
      if (dateInRange(month, day, s.start, s.end)) {
        return { tradition: 'western', sign: s.sign, key: 'western-' + s.sign };
      }
    }
    return null;
  }

  // ============================================================
  // CELTIC TREE ASTROLOGY (Robert Graves popularization, 13 trees)
  // 13 lunar months, each ~28 days. Tree-month boundaries from standard sources.
  // ============================================================
  var CELTIC_TREES = [
    { sign:'birch',     start:[12,24], end:[1,20] },
    { sign:'rowan',     start:[1,21],  end:[2,17] },
    { sign:'ash',       start:[2,18],  end:[3,17] },
    { sign:'alder',     start:[3,18],  end:[4,14] },
    { sign:'willow',    start:[4,15],  end:[5,12] },
    { sign:'hawthorn',  start:[5,13],  end:[6,9] },
    { sign:'oak',       start:[6,10],  end:[7,7] },
    { sign:'holly',     start:[7,8],   end:[8,4] },
    { sign:'hazel',     start:[8,5],   end:[9,1] },
    { sign:'vine',      start:[9,2],   end:[9,29] },
    { sign:'ivy',       start:[9,30],  end:[10,27] },
    { sign:'reed',      start:[10,28], end:[11,24] },
    { sign:'elder',     start:[11,25], end:[12,23] }
  ];

  function celtic(month, day) {
    if (!month || !day) return null;
    for (var i = 0; i < CELTIC_TREES.length; i++) {
      var s = CELTIC_TREES[i];
      if (dateInRange(month, day, s.start, s.end)) {
        return { tradition: 'celtic', sign: s.sign, key: 'celtic-' + s.sign };
      }
    }
    return null;
  }

  // ============================================================
  // HELLENISTIC DECAN (12 signs, 36 decans of 10 days each)
  // V1: report the SIGN's RULER at decan-level (decanic-planet) plus sign.
  // Decan 1 of Aries = Mars/Mars, Decan 2 = Sun, Decan 3 = Venus, etc. (Chaldean order)
  // For simplicity, return sign + decan-number (1, 2, or 3).
  // ============================================================
  function hellenistic(month, day) {
    if (!month || !day) return null;
    var w = western(month, day);
    if (!w) return null;
    var signEntry = WESTERN_SIGNS.filter(function(s) { return s.sign === w.sign; })[0];
    if (!signEntry) return null;
    // Decan: 1st 10 days = decan 1, etc.
    var dayInSign = daysIntoSign(month, day, signEntry.start, signEntry.end);
    var decan = dayInSign < 10 ? 1 : (dayInSign < 20 ? 2 : 3);
    return {
      tradition: 'hellenistic',
      sign: w.sign + '-decan-' + decan,
      key: 'hellenistic-' + w.sign + '-' + decan
    };
  }

  function daysIntoSign(month, day, start, end) {
    // Days elapsed since start of sign
    var startDate = new Date(2001, start[0]-1, start[1]); // arbitrary non-leap year
    var birthDate;
    if (start[0] === 12 && month === 1) {
      birthDate = new Date(2002, month-1, day);
    } else {
      birthDate = new Date(2001, month-1, day);
    }
    var diff = Math.floor((birthDate - startDate) / (1000 * 60 * 60 * 24));
    return diff < 0 ? diff + 365 : diff;
  }

  // ============================================================
  // EGYPTIAN DECANIC (36 decans → 12 zodiac segments via Roman-period mapping)
  // V1: simplified to 12 deity-names per decan-month (one per Egyptian solar month).
  // Sources: Cairo Calendar / Roman-period decanic tables.
  // ============================================================
  var EGYPTIAN_DEITIES = [
    { sign:'thoth',   start:[1,1],  end:[1,29] },   // wisdom
    { sign:'horus',   start:[1,30], end:[2,27] },   // sky/kingship
    { sign:'wadjet',  start:[2,28], end:[3,28] },   // serpent-protector
    { sign:'sekhmet', start:[3,29], end:[4,27] },   // lioness/destruction
    { sign:'sphinx',  start:[4,28], end:[5,26] },   // riddle/threshold
    { sign:'shu',     start:[5,27], end:[6,25] },   // air
    { sign:'isis',    start:[6,26], end:[7,25] },   // mother/magic
    { sign:'osiris',  start:[7,26], end:[8,28] },   // underworld/resurrection
    { sign:'amun',    start:[8,29], end:[9,27] },   // hidden one
    { sign:'hathor',  start:[9,28], end:[10,27] },  // love/joy
    { sign:'anubis',  start:[10,28],end:[11,26] },  // psychopomp/embalmer
    { sign:'set',     start:[11,27],end:[12,31] }   // chaos/desert (extended for year wrap)
  ];

  function egyptian(month, day) {
    if (!month || !day) return null;
    for (var i = 0; i < EGYPTIAN_DEITIES.length; i++) {
      var s = EGYPTIAN_DEITIES[i];
      if (dateInRange(month, day, s.start, s.end)) {
        return { tradition: 'egyptian', sign: s.sign, key: 'egyptian-' + s.sign };
      }
    }
    return null;
  }

  // ============================================================
  // MESOPOTAMIAN (Babylonian zodiac — 12 signs, predecessor of Hellenistic)
  // Uses sidereal-style boundaries (~1 month later than tropical due to precession at origin).
  // V1: same date-range structure with Babylonian sign-names (different deity-attributions).
  // ============================================================
  var MESOPOTAMIAN_SIGNS = [
    { sign:'enki',      start:[12,22], end:[1,19] },   // freshwater/wisdom (Capricornus → Goat-Fish)
    { sign:'gula',      start:[1,20],  end:[2,18] },   // healer (Aquarius)
    { sign:'nina',      start:[2,19],  end:[3,20] },   // fish-mother (Pisces)
    { sign:'shamash',   start:[3,21],  end:[4,19] },   // sun/justice (Aries)
    { sign:'inanna-bull',start:[4,20], end:[5,20] },   // bull-of-heaven (Taurus)
    { sign:'gilgamesh', start:[5,21],  end:[6,20] },   // twin-hero (Gemini)
    { sign:'gula-lulim',start:[6,21],  end:[7,22] },   // stag-of-temple (Cancer)
    { sign:'nergal',    start:[7,23],  end:[8,22] },   // lion-king-of-underworld (Leo)
    { sign:'shala',     start:[8,23],  end:[9,22] },   // grain-maiden (Virgo)
    { sign:'zibanitu',  start:[9,23],  end:[10,22] },  // scales-of-judgment (Libra)
    { sign:'gir-tab',   start:[10,23], end:[11,21] },  // scorpion-watchman (Scorpio)
    { sign:'pabilsag',  start:[11,22], end:[12,21] }   // archer-centaur (Sagittarius)
  ];

  function mesopotamian(month, day) {
    if (!month || !day) return null;
    for (var i = 0; i < MESOPOTAMIAN_SIGNS.length; i++) {
      var s = MESOPOTAMIAN_SIGNS[i];
      if (dateInRange(month, day, s.start, s.end)) {
        return { tradition: 'mesopotamian', sign: s.sign, key: 'mesopotamian-' + s.sign };
      }
    }
    return null;
  }

  // ============================================================
  // BURMESE ASTROLOGY (Mahabote — day of week + planetary association)
  // 8 signs (Wednesday split into morning/afternoon).
  // Birth weekday from gregorian date via Zeller's congruence.
  // ============================================================
  var BURMESE_DAYS = {
    0: { sign:'sun-garuda',     planet:'sun',     animal:'garuda' },         // Sunday
    1: { sign:'moon-tiger',     planet:'moon',    animal:'tiger' },          // Monday
    2: { sign:'mars-lion',      planet:'mars',    animal:'lion' },           // Tuesday
    3: { sign:'mercury-elephant', planet:'mercury', animal:'tusked-elephant' }, // Wed AM
    4: { sign:'rahu-elephant',  planet:'rahu',    animal:'tuskless-elephant' }, // Wed PM (special, treated as separate)
    5: { sign:'jupiter-rat',    planet:'jupiter', animal:'rat' },            // Thursday
    6: { sign:'venus-guinea-pig', planet:'venus',   animal:'guinea-pig' },     // Friday
    7: { sign:'saturn-naga',    planet:'saturn',  animal:'naga' }            // Saturday
  };

  function burmese(year, month, day, hour) {
    if (!year || !month || !day) return null;
    // Zeller's congruence (standard version)
    var y = year, m = month;
    if (m < 3) { m += 12; y -= 1; }
    var k = y % 100;
    var j = Math.floor(y / 100);
    var h = (day + Math.floor(13 * (m + 1) / 5) + k + Math.floor(k / 4) + Math.floor(j / 4) - 2 * j) % 7;
    // Convert Zeller (0=Saturday, 1=Sunday, ..., 6=Friday) to standard (0=Sunday, ..., 6=Saturday)
    var weekday = (h + 6) % 7;
    var idx = weekday;
    // Wednesday split: AM=Mercury (3), PM=Rahu (4)
    if (weekday === 3 && hour && hour >= 12) {
      idx = 4;
    } else if (weekday === 3) {
      idx = 3;
    } else if (weekday > 3) {
      idx = weekday + 1; // Shift Thursday-Saturday up to make room for Rahu
    }
    var entry = BURMESE_DAYS[idx];
    if (!entry) return null;
    return { tradition: 'burmese', sign: entry.sign, key: 'burmese-' + entry.sign };
  }

  // ============================================================
  // TIBETAN ELEMENT-ANIMAL (60-year cycle: 5 elements × 12 animals)
  // Year-based, uses same 12 animals as Chinese with element pairing.
  // Element rotates every 2 years; animal every 12 years.
  // ============================================================
  var TIBETAN_ELEMENTS = ['wood','fire','earth','iron','water'];
  // Reference: 1924 = wood-rat (start of Tibetan 60-cycle in modern reckoning)

  function tibetan(year) {
    if (!year) return null;
    var animalIdx = ((year - 4) % 12 + 12) % 12;
    var elemPairIdx = ((year - 4) % 10 + 10) % 10;
    var elementIdx = Math.floor(elemPairIdx / 2);
    var element = TIBETAN_ELEMENTS[elementIdx];
    var animal = CHINESE_ANIMALS[animalIdx];
    return {
      tradition: 'tibetan',
      sign: element + '-' + animal,
      key: 'tibetan-' + element + '-' + animal,
      element: element,
      animal: animal
    };
  }

  // ============================================================
  // MAYAN TZOLKIN (260-day count: 20 day-signs × 13 numbers)
  // Algorithm: gregorian → Julian Day Number → days since reference tzolkin date.
  // Reference: Aug 11, 3114 BCE = 4 Ahau (start of long count baktun 13).
  // V1: report just the day-sign (one of 20), not the trecena number.
  // ============================================================
  var MAYAN_DAY_SIGNS = [
    'imix','ik','akbal','kan','chicchan','cimi','manik','lamat','muluc','oc',
    'chuen','eb','ben','ix','men','cib','caban','etznab','cauac','ahau'
  ];

  function gregorianToJDN(year, month, day) {
    var a = Math.floor((14 - month) / 12);
    var y = year + 4800 - a;
    var m = month + 12 * a - 3;
    return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  }

  function mayan(year, month, day) {
    if (!year || !month || !day) return null;
    var jdn = gregorianToJDN(year, month, day);
    // Aug 11, 3114 BCE in JDN = 584283 (correlation constant GMT)
    var daysSinceLongCount = jdn - 584283;
    // Tzolkin day-sign cycle of 20: index 4 was Ahau on day 0 (4 Ahau)
    // So day_sign_index = (4 - 1 + daysSinceLongCount) mod 20 → starting from imix
    // Standard: tzolkin_day_index = (daysSinceLongCount + 19) mod 20  (because 4 Ahau is index 19)
    var idx = ((daysSinceLongCount + 19) % 20 + 20) % 20;
    var sign = MAYAN_DAY_SIGNS[idx];
    return { tradition: 'mayan', sign: sign, key: 'mayan-' + sign };
  }

  // ============================================================
  // AZTEC TONALPOHUALLI (260-day count: 20 day-signs × 13 numbers)
  // Same structure as Mayan tzolkin, different day-sign names (Nahuatl).
  // Same algorithm with Aztec-specific correlation.
  // ============================================================
  var AZTEC_DAY_SIGNS = [
    'cipactli','ehecatl','calli','cuetzpalin','coatl','miquiztli','mazatl','tochtli','atl','itzcuintli',
    'ozomatli','malinalli','acatl','ocelotl','cuauhtli','cozcacuauhtli','ollin','tecpatl','quiahuitl','xochitl'
  ];

  function aztec(year, month, day) {
    if (!year || !month || !day) return null;
    var jdn = gregorianToJDN(year, month, day);
    // Aztec correlation: same 4 Ahau / 1 Cipactli alignment (slightly different starting offset in some scholarship)
    var daysSinceLongCount = jdn - 584283;
    var idx = ((daysSinceLongCount + 0) % 20 + 20) % 20;
    var sign = AZTEC_DAY_SIGNS[idx];
    return { tradition: 'aztec', sign: sign, key: 'aztec-' + sign };
  }

  // ============================================================
  // HEBREW MONTH-SIGN (12 months of Hebrew calendar; v1 uses approximate Gregorian-to-Hebrew mapping)
  // Each Hebrew month has a tribal/zodiacal association from the Sefer Yetzirah tradition.
  // V1 approximation: Hebrew month boundaries shift year-to-year by ~10-30 days; using mid-month average.
  // ============================================================
  var HEBREW_MONTHS = [
    { sign:'tishrei-libra',  start:[9,15],  end:[10,14], tribe:'ephraim' },
    { sign:'cheshvan-scorpio', start:[10,15], end:[11,13], tribe:'manasseh' },
    { sign:'kislev-sagittarius', start:[11,14], end:[12,13], tribe:'benjamin' },
    { sign:'tevet-capricorn', start:[12,14], end:[1,12],  tribe:'dan' },
    { sign:'shevat-aquarius', start:[1,13],  end:[2,11],  tribe:'asher' },
    { sign:'adar-pisces',    start:[2,12],  end:[3,13],  tribe:'naphtali' },
    { sign:'nisan-aries',    start:[3,14],  end:[4,12],  tribe:'judah' },
    { sign:'iyar-taurus',    start:[4,13],  end:[5,12],  tribe:'issachar' },
    { sign:'sivan-gemini',   start:[5,13],  end:[6,11],  tribe:'zebulun' },
    { sign:'tammuz-cancer',  start:[6,12],  end:[7,11],  tribe:'reuben' },
    { sign:'av-leo',         start:[7,12],  end:[8,10],  tribe:'simeon' },
    { sign:'elul-virgo',     start:[8,11],  end:[9,14],  tribe:'gad' }
  ];

  function hebrew(month, day) {
    if (!month || !day) return null;
    for (var i = 0; i < HEBREW_MONTHS.length; i++) {
      var s = HEBREW_MONTHS[i];
      if (dateInRange(month, day, s.start, s.end)) {
        return { tradition: 'hebrew', sign: s.sign, key: 'hebrew-' + s.sign };
      }
    }
    return null;
  }

  // ============================================================
  // VEDIC NAKSHATRA (27 lunar mansions — requires birth-date+time+place for full accuracy)
  // V1: simplified Sun-sidereal nakshatra approximation (Sun moves ~13.33 days through each nakshatra)
  // Real jyotish uses moon position which requires ephemeris; v1 gives Sun-nakshatra as opening corpus.
  // Hegelianekitty tier: requires time+place and signals deeper data even though v1 doesn't compute moon-nakshatra yet.
  // ============================================================
  var NAKSHATRAS = [
    'ashwini','bharani','krittika','rohini','mrigashira','ardra','punarvasu','pushya','ashlesha',
    'magha','purva-phalguni','uttara-phalguni','hasta','chitra','swati','vishakha','anuradha','jyeshtha',
    'mula','purva-ashadha','uttara-ashadha','shravana','dhanishta','shatabhisha','purva-bhadrapada','uttara-bhadrapada','revati'
  ];

  function vedic(year, month, day, hour, minute, place) {
    if (!year || !month || !day) return null;
    // Sun position in sidereal zodiac approximation:
    // Sidereal Aries 0° ≈ April 14 each year (after ayanamsa correction)
    // 360° / 27 nakshatras = 13.333° per nakshatra
    // Sun moves ~0.986°/day, so ~13.51 days per nakshatra
    var refDate = new Date(year, 3, 14); // April 14 = Sidereal Aries 0
    var birthDate = new Date(year, month - 1, day);
    var dayDiff = Math.floor((birthDate - refDate) / (1000 * 60 * 60 * 24));
    if (dayDiff < 0) dayDiff += 365;
    var nakshatraIdx = Math.floor(dayDiff / 13.51) % 27;
    var sign = NAKSHATRAS[nakshatraIdx];
    var hegelianekitty = !!(hour !== undefined && hour !== null && place);
    return {
      tradition: 'vedic',
      sign: sign,
      key: 'vedic-' + sign,
      hegelianekitty: hegelianekitty
    };
  }

  // ============================================================
  // MASTER FUNCTION
  // Takes all available birth data and returns array of all calculable readings.
  // ============================================================
  function readAll(birthData) {
    var year = birthData.year ? parseInt(birthData.year, 10) : null;
    var month = birthData.month ? parseInt(birthData.month, 10) : null;
    var day = birthData.day ? parseInt(birthData.day, 10) : null;
    var hour = birthData.hour !== undefined && birthData.hour !== null && birthData.hour !== ''
      ? parseInt(birthData.hour, 10) : null;
    var minute = birthData.minute !== undefined && birthData.minute !== null && birthData.minute !== ''
      ? parseInt(birthData.minute, 10) : null;
    var place = birthData.place || null;

    var readings = [];

    // Year-only traditions
    var ch = chinese(year, month, day);  if (ch) readings.push(ch);
    var tb = tibetan(year);              if (tb) readings.push(tb);

    // Month+day traditions
    var w = western(month, day);         if (w) readings.push(w);
    var ce = celtic(month, day);         if (ce) readings.push(ce);
    var hl = hellenistic(month, day);    if (hl) readings.push(hl);
    var eg = egyptian(month, day);       if (eg) readings.push(eg);
    var me = mesopotamian(month, day);   if (me) readings.push(me);
    var hb = hebrew(month, day);         if (hb) readings.push(hb);

    // Full date traditions
    var my = mayan(year, month, day);    if (my) readings.push(my);
    var az = aztec(year, month, day);    if (az) readings.push(az);

    // Date+time traditions
    var bu = burmese(year, month, day, hour); if (bu) readings.push(bu);

    // Vedic — runs at year+month+day, but hegelianekitty flag fires only with hour+place
    var vd = vedic(year, month, day, hour, minute, place); if (vd) readings.push(vd);

    var hegelianekittyTier = !!(hour !== null && place);

    return {
      readings: readings,
      hegelianekittyTier: hegelianekittyTier,
      dataDepth: {
        year: !!year,
        monthDay: !!(month && day),
        time: !!(hour !== null),
        place: !!place
      }
    };
  }

  // Export
  global.PolymythHoroscope = {
    readAll: readAll,
    chinese: chinese,
    western: western,
    celtic: celtic,
    hellenistic: hellenistic,
    egyptian: egyptian,
    mesopotamian: mesopotamian,
    burmese: burmese,
    tibetan: tibetan,
    mayan: mayan,
    aztec: aztec,
    hebrew: hebrew,
    vedic: vedic
  };

})(typeof window !== 'undefined' ? window : this);
