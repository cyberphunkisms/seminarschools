(function () {
  'use strict';

  var catalog = document.getElementById('catalog');
  var controls = document.getElementById('resource-finder');
  var searchInput = document.getElementById('search');
  var resultCount = document.getElementById('result-count');
  var emptyState = document.getElementById('empty');
  var clearButton = document.getElementById('clear');
  var expandButton = document.getElementById('expand-toggle');
  var filterToggle = document.getElementById('filter-toggle');
  var actionStatus = document.getElementById('finder-action-status');
  var openFirstButton = document.getElementById('open-first-result');
  var copyButton = document.getElementById('copy-view-link');
  var printButton = document.getElementById('print-results');

  if (!catalog || !controls || !searchInput || !resultCount || !emptyState) return;
  // Mount once across preview and navigation recovery.
  if (window.__ssTeacherResourcesFinderMounted) return;
  window.__ssTeacherResourcesFinderMounted = true;

  var SUBJECTS = {
    ela: 'English Language Arts',
    math: 'Mathematics',
    science: 'Sciences',
    sciences: 'Sciences',
    history: 'History',
    civics: 'Civics',
    fsl: 'French/FSL',
    french: 'French/FSL',
    indigenous: 'Indigenous',
    ib: 'IB',
    esl: 'ESL',
    'social-studies': 'Social Studies',
    geography: 'Geography',
    economics: 'Economics',
    multi: 'Interdisciplinary',
    arts: 'Arts',
    cs: 'Computer Science'
  };

  var CURRICULA = {
    ontario: 'Ontario',
    bc: 'British Columbia',
    alberta: 'Alberta',
    quebec: 'Quebec',
    atlantic: 'Atlantic Canada',
    'new-brunswick': 'New Brunswick',
    'ib-dp': 'IB Diploma',
    'ib-myp': 'IB MYP',
    'ib-pyp': 'IB PYP',
    ap: 'AP',
    'common-core': 'Common Core',
    'a-level': 'A Level',
    igcse: 'IGCSE'
  };

  var FORMAT_LABELS = {
    'french-lesson': 'French Lesson',
    'museum-lesson': 'Museum Lesson',
    'indigenous-pdf': 'Indigenous Education PDF'
  };

  var LANGUAGES = {
    'en-CA': 'English',
    'fr-CA': 'French',
    mul: 'Multilingual',
    und: 'Not yet classified'
  };

  var FORMAT_GROUPS = {
    textbook: {
      label: 'Textbook',
      members: ['holt-worktext', 'pearson-notebook', 'mcdougal-littell', 'full-book', 'openstax-book', 'ck12-book', 'textbook']
    },
    anthology: {
      label: 'Text / source',
      members: ['anthology', 'clean-text', 'gutenberg-text', 'primary-source', 'french-text']
    },
    lesson: {
      label: 'Lesson',
      members: ['lesson-plan', 'lesson-pdf', 'lesson-page', 'teacher-guide', 'museum-lesson', 'french-lesson', 'worksheet', 'curriculum-doc']
    },
    indigenous: {
      label: 'Indigenous resource',
      members: ['indigenous-pdf']
    },
    assessment: {
      label: 'Assessment',
      members: ['contest-paper', 'ib-paper', 'released-test']
    },
    interactive: {
      label: 'Interactive',
      members: ['interactive', 'simulation', 'khan-course', 'course-archive', 'ai-game', 'video-series']
    },
    reference: {
      label: 'Reference',
      members: ['aggregator', 'gov-resource', 'reference']
    }
  };

  var formatToGroup = {};
  Object.keys(FORMAT_GROUPS).forEach(function (groupId) {
    FORMAT_GROUPS[groupId].members.forEach(function (format) {
      formatToGroup[format] = groupId;
    });
  });

  function normalize(value) {
    var text = String(value || '').toLowerCase();
    if (text.normalize) text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return text.replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function editDistanceWithin(a, b, maximum) {
    if (Math.abs(a.length - b.length) > maximum) return false;
    if (maximum >= 1 && a.length === b.length) {
      var differences = [];
      for (var position = 0; position < a.length; position += 1) {
        if (a[position] !== b[position]) differences.push(position);
      }
      if (
        differences.length === 2 &&
        differences[1] === differences[0] + 1 &&
        a[differences[0]] === b[differences[1]] &&
        a[differences[1]] === b[differences[0]]
      ) return true;
    }
    var previous = Array.from({ length: b.length + 1 }, function (_, index) { return index; });
    for (var row = 1; row <= a.length; row += 1) {
      var current = [row];
      var rowMinimum = current[0];
      for (var column = 1; column <= b.length; column += 1) {
        var value = Math.min(
          current[column - 1] + 1,
          previous[column] + 1,
          previous[column - 1] + (a[row - 1] === b[column - 1] ? 0 : 1)
        );
        current.push(value);
        rowMinimum = Math.min(rowMinimum, value);
      }
      if (rowMinimum > maximum) return false;
      previous = current;
    }
    return previous[b.length] <= maximum;
  }

  function searchTokenMatches(entry, token) {
    if (entry.searchText.indexOf(token) !== -1) return true;
    if (token.length < 5) return false;
    var maximum = token.length >= 9 ? 2 : 1;
    return entry.searchWords.some(function (word) {
      if (word.indexOf(token) === 0 || token.indexOf(word) === 0) {
        return Math.abs(word.length - token.length) <= maximum;
      }
      return editDistanceWithin(token, word, maximum);
    });
  }

  function directText(root, selectors) {
    return selectors.map(function (selector) {
      var element = root.querySelector(selector);
      return element ? element.textContent : '';
    }).join(' ');
  }

  function expandGrade(value) {
    if (!value) return [];
    if (value === 'all') return ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
    var normalized = value.replace(/^K$/i, '0').replace(/^K-/i, '0-');
    if (normalized.indexOf('-') === -1) return [normalized === '0' ? 'K' : normalized];
    var bounds = normalized.split('-').map(Number);
    if (bounds.length !== 2 || bounds.some(isNaN)) return [value];
    var grades = [];
    for (var grade = bounds[0]; grade <= bounds[1]; grade += 1) {
      grades.push(grade === 0 ? 'K' : String(grade));
    }
    return grades;
  }

  var groups = Array.from(catalog.querySelectorAll('details.group')).map(function (groupElement) {
    var groupText = directText(groupElement, ['.grp-title', '.grp-kicker']);
    var categories = Array.from(groupElement.querySelectorAll('details.category')).map(function (categoryElement) {
      var categoryText = directText(categoryElement, ['.cat-title', '.cat-kicker', '.cat-blurb']);
      var entries = Array.from(categoryElement.querySelectorAll('.entry')).map(function (entryElement) {
        var sourceLanguage = entryElement.dataset.l || entryElement.dataset.language || 'und';
        entryElement.dataset.language = sourceLanguage;
        var searchText = normalize([
          entryElement.textContent,
          groupText,
          categoryText,
          entryElement.dataset.format,
          FORMAT_LABELS[entryElement.dataset.format],
          entryElement.dataset.grade,
          entryElement.dataset.subject,
          SUBJECTS[entryElement.dataset.subject],
          entryElement.dataset.curriculum,
          CURRICULA[entryElement.dataset.curriculum],
          sourceLanguage
        ].join(' '));
        return {
          element: entryElement,
          shell: entryElement.closest('.entry-shell'),
          format: entryElement.dataset.format || '',
          grade: entryElement.dataset.grade || '',
          subject: entryElement.dataset.subject || '',
          curriculum: entryElement.dataset.curriculum || '',
          languages: sourceLanguage.split(',').filter(Boolean),
          searchText: searchText,
          searchWords: Array.from(new Set(searchText.split(/\s+/).filter(Boolean)))
        };
      });
      return {
        element: categoryElement,
        countElement: categoryElement.querySelector('[data-cat-count]'),
        entries: entries,
        total: entries.length,
        matches: 0
      };
    });
    return {
      element: groupElement,
      countElement: groupElement.querySelector('[data-grp-count]'),
      categories: categories,
      total: categories.reduce(function (sum, category) { return sum + category.total; }, 0),
      matches: 0,
      matchingCategories: 0
    };
  });

  var entries = groups.flatMap(function (group) {
    return group.categories.flatMap(function (category) { return category.entries; });
  });

  var state = {
    search: '',
    formats: new Set(),
    grades: new Set(),
    subjects: new Set(),
    curricula: new Set(),
    languages: new Set()
  };
  var announceTimer = null;
  var expandLabelFrame = null;
  var LEGACY_FILTER_STORAGE_KEYS = ['tr-filters-v4', 'tr-filters-v3', 'tr-filters-v2'];

  var counts = {
    subjects: {},
    grades: {},
    formats: {},
    curricula: {},
    languages: {}
  };

  entries.forEach(function (entry) {
    if (entry.subject) counts.subjects[entry.subject] = (counts.subjects[entry.subject] || 0) + 1;
    if (entry.curriculum) counts.curricula[entry.curriculum] = (counts.curricula[entry.curriculum] || 0) + 1;
    entry.languages.forEach(function (language) {
      counts.languages[language] = (counts.languages[language] || 0) + 1;
    });
    if (entry.format) {
      var formatGroup = formatToGroup[entry.format];
      if (formatGroup) counts.formats[formatGroup] = (counts.formats[formatGroup] || 0) + 1;
    }
    expandGrade(entry.grade).forEach(function (grade) {
      counts.grades[grade] = (counts.grades[grade] || 0) + 1;
    });
  });

  function appendChip(parentId, type, value, label) {
    var parent = document.getElementById(parentId);
    if (!parent) return;
    if (parent.querySelector('[data-filter-type="' + type + '"][data-filter-value="' + value + '"]')) return;
    var chip = document.createElement('button');
    chip.className = 'chip';
    chip.type = 'button';
    chip.dataset.filterType = type;
    chip.dataset.filterValue = value;
    chip.setAttribute('aria-pressed', 'false');
    var labelText = document.createElement('span');
    labelText.textContent = label;
    var countText = document.createElement('span');
    countText.className = 'chip-count';
    countText.setAttribute('aria-hidden', 'true');
    chip.appendChild(labelText);
    chip.appendChild(countText);
    parent.appendChild(chip);
  }

  Object.keys(SUBJECTS).forEach(function (subject) {
    if (counts.subjects[subject]) appendChip('subject-chips', 'subject', subject, SUBJECTS[subject]);
  });
  Object.keys(LANGUAGES).forEach(function (language) {
    if (counts.languages[language]) appendChip('language-chips', 'language', language, LANGUAGES[language]);
  });
  ['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].forEach(function (grade) {
    if (counts.grades[grade]) appendChip('grade-chips', 'grade', grade, grade === 'K' ? 'K' : 'Gr. ' + grade);
  });
  Object.keys(FORMAT_GROUPS).forEach(function (format) {
    if (counts.formats[format]) appendChip('format-chips', 'format', format, FORMAT_GROUPS[format].label);
  });
  ['ontario', 'bc', 'alberta', 'quebec', 'atlantic'].forEach(function (curriculum) {
    if (counts.curricula[curriculum]) appendChip('province-chips', 'curriculum', curriculum, CURRICULA[curriculum]);
  });
  ['ib-dp', 'ib-myp', 'ap', 'common-core', 'a-level', 'igcse'].forEach(function (curriculum) {
    if (counts.curricula[curriculum]) appendChip('program-chips', 'curriculum', curriculum, CURRICULA[curriculum]);
  });

  function isFiltering() {
    return Boolean(
      state.search ||
      state.formats.size ||
      state.grades.size ||
      state.subjects.size ||
      state.curricula.size ||
      state.languages.size
    );
  }

  function gradeMatches(value) {
    if (!state.grades.size) return true;
    if (!value || value === 'all') return true;
    return expandGrade(value).some(function (grade) { return state.grades.has(grade); });
  }

  function entryMatches(entry, queryTokens, ignoreType, searchMatchCache) {
    if (queryTokens.length) {
      var searchMatches = searchMatchCache
        ? searchMatchCache.get(entry)
        : queryTokens.every(function (token) { return searchTokenMatches(entry, token); });
      if (!searchMatches) return false;
    }
    if (ignoreType !== 'format' && state.formats.size && !state.formats.has(formatToGroup[entry.format])) return false;
    if (ignoreType !== 'subject' && state.subjects.size && !state.subjects.has(entry.subject)) return false;
    if (ignoreType !== 'curriculum' && state.curricula.size && !state.curricula.has(entry.curriculum)) return false;
    if (ignoreType !== 'language' && state.languages.size && !entry.languages.some(function (language) {
      return state.languages.has(language);
    })) return false;
    return ignoreType === 'grade' || gradeMatches(entry.grade);
  }

  function entryHasFilterValue(entry, type, value) {
    if (type === 'format') return formatToGroup[entry.format] === value;
    if (type === 'subject') return entry.subject === value;
    if (type === 'curriculum') return entry.curriculum === value;
    if (type === 'language') return entry.languages.indexOf(value) !== -1;
    if (type === 'grade') return entry.grade === 'all' || expandGrade(entry.grade).indexOf(value) !== -1;
    return false;
  }

  function buildSearchMatchCache(queryTokens) {
    var cache = new Map();
    entries.forEach(function (entry) {
      cache.set(entry, !queryTokens.length || queryTokens.every(function (token) {
        return searchTokenMatches(entry, token);
      }));
    });
    return cache;
  }

  function updateFacetCounts(queryTokens, searchMatchCache) {
    var contexts = {};
    ['subject', 'grade', 'format', 'curriculum', 'language'].forEach(function (type) {
      contexts[type] = entries.filter(function (entry) {
        return entryMatches(entry, queryTokens, type, searchMatchCache);
      });
    });
    document.querySelectorAll('.chip').forEach(function (chip) {
      var type = chip.dataset.filterType;
      var count = (contexts[type] || []).filter(function (entry) {
        return entryHasFilterValue(entry, type, chip.dataset.filterValue);
      }).length;
      var countElement = chip.querySelector('.chip-count');
      if (countElement) countElement.textContent = String(count);
      var active = chip.getAttribute('aria-pressed') === 'true';
      chip.disabled = count === 0 && !active;
      chip.classList.toggle('unavailable', count === 0 && !active);
      chip.setAttribute('aria-label', chip.firstElementChild.textContent + ', ' + count + (count === 1 ? ' resource' : ' resources'));
    });
  }

  function setCount(element, text, filtered) {
    if (!element) return;
    element.textContent = text;
    element.classList.toggle('filtered', filtered);
  }

  function syncControls() {
    document.querySelectorAll('.chip').forEach(function (chip) {
      var set = chip.dataset.filterType === 'format' ? state.formats :
        chip.dataset.filterType === 'grade' ? state.grades :
        chip.dataset.filterType === 'subject' ? state.subjects :
        chip.dataset.filterType === 'curriculum' ? state.curricula :
        chip.dataset.filterType === 'language' ? state.languages : null;
      var active = Boolean(set && set.has(chip.dataset.filterValue));
      chip.classList.toggle('active', active);
      chip.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    document.querySelectorAll('[data-preset-subject],[data-preset-grade],[data-preset-format],[data-preset-grades]').forEach(function (button) {
      var active = false;
      if (button.dataset.presetSubject) active = state.subjects.has(button.dataset.presetSubject);
      if (button.dataset.presetGrade) active = state.grades.has(button.dataset.presetGrade);
      if (button.dataset.presetFormat) active = state.formats.has(button.dataset.presetFormat);
      if (button.dataset.presetGrades) {
        var grades = button.dataset.presetGrades.split(',');
        active = grades.every(function (grade) { return state.grades.has(grade); });
      }
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function clearLegacyLocalState() {
    try {
      LEGACY_FILTER_STORAGE_KEYS.forEach(function (key) { localStorage.removeItem(key); });
    } catch (error) {}
    controls.dataset.persistence = 'url-only';
  }

  function buildStatePath() {
    var params = new URLSearchParams();
    if (state.search) params.set('q', state.search);
    if (state.subjects.size) params.set('subject', Array.from(state.subjects).sort().join(','));
    if (state.grades.size) params.set('grade', Array.from(state.grades).sort(function (a, b) {
      return (a === 'K' ? 0 : Number(a)) - (b === 'K' ? 0 : Number(b));
    }).join(','));
    if (state.formats.size) params.set('format', Array.from(state.formats).sort().join(','));
    if (state.curricula.size) params.set('curriculum', Array.from(state.curricula).sort().join(','));
    if (state.languages.size) params.set('language', Array.from(state.languages).sort().join(','));
    var query = params.toString();
    return location.pathname + (query ? '?' + query : '') + location.hash;
  }

  function buildStateUrl() {
    var path = buildStatePath();
    try {
      return new URL(path, location.href).href;
    } catch (error) {
      return location.href;
    }
  }

  function saveState() {
    var path = buildStatePath();
    try {
      history.replaceState(null, '', path);
    } catch (error) {}
    return buildStateUrl();
  }

  function applyFilters(options) {
    options = options || {};
    var filtering = isFiltering();
    var queryTokens = normalize(state.search).split(/\s+/).filter(Boolean);
    var searchMatchCache = buildSearchMatchCache(queryTokens);
    var totalShown = 0;
    var collectionsShown = 0;

    groups.forEach(function (group) {
      group.matches = 0;
      group.matchingCategories = 0;
      group.categories.forEach(function (category) {
        category.matches = 0;
        category.entries.forEach(function (entry) {
          var matches = entryMatches(entry, queryTokens, null, searchMatchCache);
          entry.element.hidden = !matches;
          if (entry.shell) entry.shell.hidden = !matches;
          if (matches) category.matches += 1;
        });
        category.element.hidden = category.matches === 0;
        group.matches += category.matches;
        if (category.matches) {
          group.matchingCategories += 1;
          collectionsShown += 1;
        }
      });
      group.element.hidden = group.matches === 0;
      totalShown += group.matches;
    });

    var revealDirectResults = Boolean(filtering && totalShown <= 24);
    groups.forEach(function (group) {
      group.categories.forEach(function (category) {
        setCount(
          category.countElement,
          filtering ? category.matches + (category.matches === 1 ? ' match' : ' matches') : category.total + (category.total === 1 ? ' item' : ' items'),
          filtering
        );
        if (!category.element.hidden) category.element.open = filtering ? revealDirectResults : false;
      });
      setCount(
        group.countElement,
        filtering
          ? group.matchingCategories + (group.matchingCategories === 1 ? ' collection · ' : ' collections · ') + group.matches + (group.matches === 1 ? ' match' : ' matches')
          : group.categories.length + (group.categories.length === 1 ? ' collection · ' : ' collections · ') + group.total + ' items',
        filtering
      );
      if (!group.element.hidden) group.element.open = filtering;
    });

    resultCount.textContent = filtering
      ? totalShown + (totalShown === 1 ? ' resource' : ' resources') + ' across ' +
        collectionsShown + (collectionsShown === 1 ? ' collection' : ' collections')
      : entries.length + ' resources across ' + groups.reduce(function (sum, group) { return sum + group.categories.length; }, 0) + ' collections';
    resultCount.hidden = false;
    emptyState.hidden = totalShown !== 0;
    if (openFirstButton) openFirstButton.disabled = !filtering || !totalShown;
    if (clearButton) clearButton.classList.toggle('has-active', filtering);
    if (filterToggle) filterToggle.classList.toggle('has-active', filtering);
    document.body.classList.toggle('searching', Boolean(state.search));
    syncControls();
    updateFacetCounts(queryTokens, searchMatchCache);
    setExpandLabel();
    if (!options.skipSave) saveState();
  }

  function visibleGroups() {
    return groups.filter(function (group) { return !group.element.hidden; });
  }

  function allVisibleOpen() {
    var visible = visibleGroups();
    return visible.length > 0 && visible.every(function (group) {
      return group.element.open && group.categories.filter(function (category) {
        return !category.element.hidden;
      }).every(function (category) { return category.element.open; });
    });
  }

  function setExpandLabel() {
    if (!expandButton) return;
    var allOpen = allVisibleOpen();
    expandButton.textContent = allOpen ? 'Collapse all' : 'Expand all';
    expandButton.setAttribute('aria-pressed', allOpen ? 'true' : 'false');
  }

  function scheduleExpandLabel() {
    if (expandLabelFrame !== null) return;
    expandLabelFrame = window.requestAnimationFrame(function () {
      expandLabelFrame = null;
      setExpandLabel();
    });
  }

  function toggleSet(set, value) {
    if (set.has(value)) set.delete(value);
    else set.add(value);
  }

  function resetState() {
    state.search = '';
    state.formats.clear();
    state.grades.clear();
    state.subjects.clear();
    state.curricula.clear();
    state.languages.clear();
    searchInput.value = '';
  }

  function announce(message) {
    if (!actionStatus) return;
    window.clearTimeout(announceTimer);
    actionStatus.textContent = message;
    announceTimer = window.setTimeout(function () {
      if (actionStatus.textContent === message) actionStatus.textContent = '';
    }, 3000);
  }

  function validFilterValue(key, value) {
    if (key === 'subject') return Boolean(counts.subjects[value]);
    if (key === 'grade') return Boolean(counts.grades[value]);
    if (key === 'format') return Boolean(counts.formats[value]);
    if (key === 'curriculum') return Boolean(counts.curricula[value]);
    if (key === 'language') return Boolean(counts.languages[value]);
    return false;
  }

  function restoreState() {
    resetState();
    try {
      var params = new URLSearchParams(location.search);
      state.search = params.get('q') || '';
      ['subject', 'grade', 'format', 'curriculum', 'language'].forEach(function (key) {
        var value = params.get(key);
        if (!value) return;
        var set = key === 'subject' ? state.subjects :
          key === 'grade' ? state.grades :
          key === 'format' ? state.formats :
          key === 'curriculum' ? state.curricula : state.languages;
        value.split(',').filter(function (item) {
          return validFilterValue(key, item);
        }).forEach(function (item) { set.add(item); });
      });
    } catch (error) {}
    searchInput.value = state.search;
  }

  var searchTimer = null;
  function flushSearchAndApply(options) {
    window.clearTimeout(searchTimer);
    searchTimer = null;
    state.search = searchInput.value.trim();
    applyFilters(options);
  }

  searchInput.addEventListener('input', function () {
    window.clearTimeout(searchTimer);
    state.search = searchInput.value.trim();
    searchTimer = window.setTimeout(function () {
      searchTimer = null;
      applyFilters();
    }, 100);
  });

  controls.addEventListener('submit', function (event) {
    event.preventDefault();
  });

  controls.addEventListener('click', function (event) {
    var button = event.target.closest('button');
    if (!button) return;

    if (button.classList.contains('chip')) {
      var type = button.dataset.filterType;
      var set = type === 'format' ? state.formats :
        type === 'grade' ? state.grades :
        type === 'subject' ? state.subjects :
        type === 'curriculum' ? state.curricula :
        type === 'language' ? state.languages : null;
      if (set) toggleSet(set, button.dataset.filterValue);
      applyFilters();
      return;
    }

    if (button.dataset.presetSubject) toggleSet(state.subjects, button.dataset.presetSubject);
    else if (button.dataset.presetGrade) toggleSet(state.grades, button.dataset.presetGrade);
    else if (button.dataset.presetFormat) toggleSet(state.formats, button.dataset.presetFormat);
    else if (button.dataset.presetGrades) {
      var grades = button.dataset.presetGrades.split(',');
      var allActive = grades.every(function (grade) { return state.grades.has(grade); });
      grades.forEach(function (grade) {
        if (allActive) state.grades.delete(grade);
        else state.grades.add(grade);
      });
    } else return;
    applyFilters();
  });

  if (clearButton) {
    clearButton.addEventListener('click', function () {
      window.clearTimeout(searchTimer);
      searchTimer = null;
      resetState();
      applyFilters();
      searchInput.focus();
    });
  }

  if (expandButton) {
    expandButton.addEventListener('click', function () {
      var visible = visibleGroups();
      var allOpen = allVisibleOpen();
      visible.forEach(function (group) {
        group.element.open = !allOpen;
        group.categories.forEach(function (category) {
          if (!category.element.hidden) category.element.open = !allOpen;
        });
      });
      setExpandLabel();
    });
  }

  catalog.addEventListener('toggle', scheduleExpandLabel, true);

  if (filterToggle) {
    filterToggle.addEventListener('click', function () {
      var open = document.body.classList.toggle('filters-open');
      filterToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      filterToggle.textContent = open ? 'Hide filters' : 'More filters';
    });
  }

  if (copyButton) {
    copyButton.addEventListener('click', function () {
      flushSearchAndApply();
      // Current memory state keeps copied links complete if history is blocked.
      var link = buildStateUrl();
      var copied = navigator.clipboard && navigator.clipboard.writeText
        ? navigator.clipboard.writeText(link)
        : Promise.reject();
      copied.then(function () {
        announce('Filtered view link copied.');
      }).catch(function () {
        var field = document.createElement('textarea');
        field.value = link;
        field.setAttribute('readonly', '');
        field.className = 'copy-helper';
        document.body.appendChild(field);
        field.select();
        var successful = false;
        try {
          successful = Boolean(document.execCommand && document.execCommand('copy'));
        } catch (error) {}
        field.remove();
        announce(successful ? 'Filtered view link copied.' : 'Copy the address from your browser.');
      });
    });
  }

  if (printButton) {
    printButton.addEventListener('click', function () {
      flushSearchAndApply();
      window.print();
    });
  }

  function openFirstResult() {
    flushSearchAndApply();
    var first = entries.find(function (entry) { return !entry.element.hidden; });
    if (!isFiltering() || !first) {
      announce('Choose a search or filter first.');
      return;
    }
    window.location.assign(first.element.href);
  }

  if (openFirstButton) {
    openFirstButton.addEventListener('click', openFirstResult);
  }

  searchInput.addEventListener('keydown', function (event) {
    if (event.key !== 'Enter' || event.isComposing) return;
    event.preventDefault();
    openFirstResult();
  });

  var emptyResetButton = emptyState.querySelector('button');
  if (emptyResetButton) {
    emptyResetButton.addEventListener('click', function () {
      resetState();
      applyFilters();
      searchInput.focus();
    });
  }

  document.addEventListener('keydown', function (event) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName);
    if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
    if (event.key === 'Escape' && document.activeElement === searchInput && searchInput.value) {
      window.clearTimeout(searchTimer);
      state.search = '';
      searchInput.value = '';
      applyFilters();
    }
  });

  window.addEventListener('popstate', function () {
    window.clearTimeout(searchTimer);
    searchTimer = null;
    restoreState();
    applyFilters({ skipSave: true });
  });

  window.addEventListener('pagehide', function () {
    window.clearTimeout(searchTimer);
    searchTimer = null;
    window.clearTimeout(announceTimer);
    announceTimer = null;
    if (expandLabelFrame !== null) {
      window.cancelAnimationFrame(expandLabelFrame);
      expandLabelFrame = null;
    }
  });
  window.addEventListener('pageshow', function (event) {
    if (!event.persisted) return;
    restoreState();
    applyFilters({ skipSave: true });
  });

  clearLegacyLocalState();
  restoreState();
  // Initial navigation is read-only: explicit query state is authoritative and
  // a clean /teacherresources/ URL always opens the complete catalog.
  applyFilters({ skipSave: true });
})();
