/* aa-bridge.js
 * aa* archetype mini-cloud, integrated into bb's smash phase.
 *
 * Public API (window.AaBridge):
 *   open(opts)              — mount the cloud panel; opts = {onPick: fn(picked)}
 *   close()                 — hide cloud, restore card-preview pane
 *   isOpen()                — boolean
 *
 * onPick fires when the player clicks a figure or archetype:
 *   { name: 'Trickster (Norse mythology — Loki)', archetypeId: 'trickster',
 *     figureLabel: 'Loki', tradition: 'mythological', taxonomyLabel: 'Norse Mythology' }
 *
 * The picked.name is what auto-fills the smash-name input.
 *
 * Trigger from bb chat: player types `browse` at smash-name prompt → bb
 * calls AaBridge.open(...) which hides #card-preview and shows the cloud.
 * On pick, bb sets inputEl.value = picked.name and submits via Enter.
 *
 * Layout: replaces card-preview area inside the existing aside.
 * Voice: bb's terminal palette (green/amber on dark), VT323 monospace.
 */
(function(global){
  'use strict';

  // ============================================================
  // INLINED aa* SLIM DATA (extracted from /aa/ at build time)
  //   tags: top 60 archetype tags by cross-tradition cardinality
  //   taxonomies: lookup of tax-ids referenced
  // ============================================================
  var AA_DATA = {"tags":[{"id":"hero","display":"Hero","traditions":12,"figures":[{"orig":"Hero","taxId":"jung-classical"},{"orig":"Hero (immature)","taxId":"moore-gillette"},{"orig":"Hero (Seeker or Victim)","taxId":"propp"},{"orig":"Hero (Protagonist)","taxId":"truby"}]},{"id":"warrior","display":"Warrior","traditions":10,"figures":[{"orig":"Warrior","taxId":"pearson12"}]},{"id":"trickster","display":"Trickster","traditions":8,"figures":[{"orig":"Trickster","taxId":"jung-classical"}]},{"id":"magician","display":"Magician","traditions":8,"figures":[{"orig":"Magician","taxId":"pearson12"},{"orig":"1 Magician","taxId":"tarot-major"}]},{"id":"lover","display":"Lover","traditions":6,"figures":[{"orig":"Lover","taxId":"pearson12"}]},{"id":"sage","display":"Sage","traditions":6,"figures":[{"orig":"Sage","taxId":"pearson12"}]},{"id":"bard","display":"Bard","traditions":6,"figures":[{"orig":"Bard","taxId":"dnd5e-classes"}]},{"id":"self","display":"Self","traditions":5,"figures":[{"orig":"Self","taxId":"jung-classical"}]},{"id":"shadow","display":"Shadow","traditions":5,"figures":[{"orig":"Shadow","taxId":"jung-classical"}]},{"id":"caregiver","display":"Caregiver","traditions":5,"figures":[{"orig":"Caregiver","taxId":"pearson12"}]},{"id":"wizard","display":"Wizard","traditions":5,"figures":[{"orig":"Wizard","taxId":"myss"}]},{"id":"rogue","display":"Rogue","traditions":5,"figures":[{"orig":"Rogue","taxId":"bakhtin"}]},{"id":"druid","display":"Druid","traditions":5,"figures":[{"orig":"Druid","taxId":"dnd5e-classes"}]},{"id":"monk","display":"Monk","traditions":5,"figures":[{"orig":"Monk","taxId":"dnd5e-classes"}]},{"id":"paladin","display":"Paladin","traditions":5,"figures":[{"orig":"Paladin","taxId":"dnd5e-classes"}]},{"id":"mage","display":"Mage","traditions":5,"figures":[{"orig":"Mage","taxId":"wow-classes"}]},{"id":"mother","display":"Mother","traditions":4,"figures":[{"orig":"Mother","taxId":"vonfranz"}]},{"id":"senex","display":"Senex","traditions":4,"figures":[{"orig":"Senex","taxId":"hillman"},{"orig":"Senex (old man)","taxId":"new-comedy"}]},{"id":"innocent","display":"Innocent","traditions":4,"figures":[{"orig":"Innocent","taxId":"pearson12"}]},{"id":"creator","display":"Creator","traditions":4,"figures":[{"orig":"Creator","taxId":"pearson12"}]},{"id":"ruler","display":"Ruler","traditions":4,"figures":[{"orig":"Ruler","taxId":"pearson12"}]},{"id":"king","display":"King","traditions":4,"figures":[{"orig":"King","taxId":"moore-gillette"}]},{"id":"artemis","display":"Artemis","traditions":4,"figures":[{"orig":"Artemis","taxId":"bolen-goddess"},{"orig":"Artemis (Amazon / Gorgon)","taxId":"schmidt45"}]},{"id":"hestia","display":"Hestia","traditions":4,"figures":[{"orig":"Hestia","taxId":"bolen-goddess"},{"orig":"Hestia (Mystic / Betrayer)","taxId":"schmidt45"}]},{"id":"demeter","display":"Demeter","traditions":4,"figures":[{"orig":"Demeter","taxId":"bolen-goddess"},{"orig":"Demeter (Nurturer / Overcontrolling Mother)","taxId":"schmidt45"}]},{"id":"aphrodite","display":"Aphrodite","traditions":4,"figures":[{"orig":"Aphrodite","taxId":"bolen-goddess"},{"orig":"Aphrodite (Pagan Grace)","taxId":"paris"},{"orig":"Aphrodite (Seductive Muse / Femme Fatale)","taxId":"schmidt45"}]},{"id":"hermes","display":"Hermes","traditions":4,"figures":[{"orig":"Hermes","taxId":"paris"},{"orig":"Hermes (Fool / Derelict)","taxId":"schmidt45"}]},{"id":"comedy","display":"Comedy (Spring)","traditions":4,"figures":[{"orig":"Comedy (Spring)","taxId":"frye"},{"orig":"Comedy","taxId":"booker7"}]},{"id":"fighter","display":"Fighter","traditions":4,"figures":[{"orig":"Fighter","taxId":"dnd5e-classes"}]},{"id":"ranger","display":"Ranger","traditions":4,"figures":[{"orig":"Ranger","taxId":"dnd5e-classes"}]},{"id":"anima","display":"Anima","traditions":3,"figures":[{"orig":"Anima","taxId":"jung-classical"}]},{"id":"animus","display":"Animus","traditions":3,"figures":[{"orig":"Animus","taxId":"jung-classical"}]},{"id":"great-mother","display":"Great Mother","traditions":3,"figures":[{"orig":"Great Mother","taxId":"jung-classical"}]},{"id":"maiden","display":"Maiden (Kore)","traditions":3,"figures":[{"orig":"Maiden (Kore)","taxId":"jung-classical"},{"orig":"Maiden","taxId":"graves-triple-goddess"}]},{"id":"puer","display":"Puer","traditions":3,"figures":[{"orig":"Puer","taxId":"hillman"},{"orig":"Puer (boy)","taxId":"horace-ages"}]},{"id":"orphan","display":"Orphan","traditions":3,"figures":[{"orig":"Orphan","taxId":"pearson12"}]},{"id":"seeker","display":"Seeker","traditions":3,"figures":[{"orig":"Seeker","taxId":"pearson12"}]},{"id":"destroyer","display":"Destroyer","traditions":3,"figures":[{"orig":"Destroyer","taxId":"pearson12"}]},{"id":"fool-jester","display":"Fool / Jester","traditions":3,"figures":[{"orig":"Fool / Jester","taxId":"pearson12"}]},{"id":"athena","display":"Athena","traditions":3,"figures":[{"orig":"Athena","taxId":"bolen-goddess"},{"orig":"Athena (Father's Daughter / Backstabber)","taxId":"schmidt45"}]},{"id":"hera","display":"Hera","traditions":3,"figures":[{"orig":"Hera","taxId":"bolen-goddess"},{"orig":"Hera (Matriarch / Scorned Woman)","taxId":"schmidt45"}]},{"id":"crone","display":"Crone","traditions":3,"figures":[{"orig":"Crone","taxId":"myss"}]},{"id":"scholar","display":"Scholar","traditions":3,"figures":[{"orig":"Scholar","taxId":"myss"}]},{"id":"thief","display":"Thief","traditions":3,"figures":[{"orig":"Thief","taxId":"myss"}]},{"id":"dionysus","display":"Dionysus","traditions":3,"figures":[{"orig":"Dionysus","taxId":"paris"},{"orig":"Dionysus (Woman's Man / Seducer)","taxId":"schmidt45"}]},{"id":"mentor","display":"Mentor","traditions":3,"figures":[{"orig":"Mentor","taxId":"vogler"}]},{"id":"isis","display":"Isis (Female Messiah / Destroyer)","traditions":3,"figures":[{"orig":"Isis (Female Messiah / Destroyer)","taxId":"schmidt45"},{"orig":"Isis","taxId":"egyptian"}]},{"id":"helper","display":"Helper","traditions":3,"figures":[{"orig":"Helper","taxId":"propp"},{"orig":"2. Helper","taxId":"enneagram"}]},{"id":"romance","display":"Romance (Summer)","traditions":3,"figures":[{"orig":"Romance (Summer)","taxId":"frye"},{"orig":"Romance","taxId":"hauge"}]},{"id":"tragedy","display":"Tragedy (Autumn)","traditions":3,"figures":[{"orig":"Tragedy (Autumn)","taxId":"frye"},{"orig":"Tragedy","taxId":"booker7"}]},{"id":"beast","display":"Beast","traditions":3,"figures":[{"orig":"Beast","taxId":"warner"}]},{"id":"witch","display":"Witch","traditions":3,"figures":[{"orig":"Witch","taxId":"warner"}]},{"id":"protagonist","display":"Protagonist","traditions":3,"figures":[{"orig":"Protagonist","taxId":"mckee"}]},{"id":"guardian","display":"Guardian","traditions":3,"figures":[{"orig":"Guardian","taxId":"dramatica"},{"orig":"Guardian (SJ)","taxId":"keirsey"}]},{"id":"krishna","display":"Krishna (or Balarama)","traditions":3,"figures":[{"orig":"Krishna (or Balarama)","taxId":"dashavatara"},{"orig":"Krishna","taxId":"hyde-trickster"}]},{"id":"coyote","display":"Coyote","traditions":3,"figures":[{"orig":"Coyote","taxId":"hyde-trickster"}]},{"id":"anansi","display":"Anansi","traditions":3,"figures":[{"orig":"Anansi","taxId":"hyde-trickster"},{"orig":"Anansi (Akan)","taxId":"african-trickster"}]},{"id":"barbarian","display":"Barbarian","traditions":3,"figures":[{"orig":"Barbarian","taxId":"dnd5e-classes"}]},{"id":"cleric","display":"Cleric","traditions":3,"figures":[{"orig":"Cleric","taxId":"dnd5e-classes"}]},{"id":"sorcerer","display":"Sorcerer","traditions":3,"figures":[{"orig":"Sorcerer","taxId":"dnd5e-classes"}]}],"taxonomies":{"jung-classical":{"name":"Jung's Classical Archetypes","tradition":"depth","originator":"C. G. Jung","year":1919},"vonfranz":{"name":"Marie-Louise von Franz Fairy-Tale Archetypes","tradition":"depth","originator":"Marie-Louise von Franz","year":1970},"hillman":{"name":"Hillman / Archetypal Psychology (Polytheistic)","tradition":"depth","originator":"James Hillman","year":1971},"pearson12":{"name":"Pearson — Twelve Archetypes","tradition":"depth","originator":"Carol S. Pearson","year":1991},"mark-pearson":{"name":"Mark & Pearson — 12 Brand Archetypes","tradition":"brand","originator":"Margaret Mark and Carol S. Pearson","year":2001},"moore-gillette":{"name":"Moore & Gillette — King, Warrior, Magician, Lover","tradition":"depth","originator":"Robert Moore and Douglas Gillette","year":1990},"bolen-goddess":{"name":"Bolen — Goddesses in Everywoman","tradition":"depth","originator":"Jean Shinoda Bolen","year":1984},"wolff":{"name":"Toni Wolff — Structural Forms of the Feminine Psyche","tradition":"depth","originator":"Toni Wolff","year":1951},"myss":{"name":"Myss — Sacred Contracts Archetypes","tradition":"depth","originator":"Caroline Myss","year":2001},"neumann":{"name":"Neumann — Stages of Consciousness","tradition":"depth","originator":"Erich Neumann","year":1949},"pmai":{"name":"Pearson-Marr Archetype Indicator (PMAI)","tradition":"depth","originator":"Carol S. Pearson and Hugh Marr","year":2002},"singer":{"name":"June Singer — Boundaries of the Soul","tradition":"depth","originator":"June Singer","year":1972},"paris":{"name":"Ginette Paris — Pagan Meditations / Pagan Grace","tradition":"depth","originator":"Ginette Paris","year":1986},"vogler":{"name":"Vogler — The Writer's Journey","tradition":"drama","originator":"Christopher Vogler","year":1992},"schmidt45":{"name":"Schmidt — 45 Master Characters","tradition":"lit","originator":"Victoria Lynn Schmidt","year":2001},"propp":{"name":"Propp — Morphology of the Folktale","tradition":"folk","originator":"Vladimir Propp","year":1928},"frye":{"name":"Frye — Anatomy of Criticism Mythoi","tradition":"lit","originator":"Northrop Frye","year":1957},"leeming":{"name":"Leeming — World of Myth typology","tradition":"myth","originator":"David Adams Leeming","year":1990},"warner":{"name":"Warner — Fairy-Tale Archetypal Categories","tradition":"folk","originator":"Marina Warner","year":1995},"booker7":{"name":"Booker — Seven Basic Plots","tradition":"lit","originator":"Christopher Booker","year":2004},"cowden16":{"name":"Cowden, LaFever, Viders — 16 Master Archetypes","tradition":"lit","originator":"Tami D. Cowden, Caro LaFever, Sue Viders","year":2000},"bakhtin":{"name":"Bakhtin — Chronotopes and Carnival Types","tradition":"lit","originator":"Mikhail Bakhtin","year":1981},"truby":{"name":"Truby — The Anatomy of Story","tradition":"drama","originator":"John Truby","year":2007},"mckee":{"name":"McKee — Story","tradition":"drama","originator":"Robert McKee","year":1997},"hauge":{"name":"Hauge — Six Stage Character Types","tradition":"drama","originator":"Michael Hauge","year":1988},"dramatica":{"name":"Dramatica — Eight Throughline Archetypes","tradition":"drama","originator":"Melanie Anne Phillips & Chris Huntley","year":1993},"new-comedy":{"name":"Greek New Comedy / Roman Stock Characters","tradition":"drama","originator":"Menander, Plautus, Terence","year":-322},"dashavatara":{"name":"Dashavatara — Ten Avatars of Vishnu","tradition":"relig","originator":"Hindu tradition","year":500},"olympians":{"name":"Twelve Olympians","tradition":"relig","originator":"Greek tradition","year":-700},"egyptian":{"name":"Egyptian Ennead and Ogdoad","tradition":"relig","originator":"Egyptian tradition","year":-2500},"hyde-trickster":{"name":"Hyde — Cross-Cultural Trickster","tradition":"myth","originator":"Lewis Hyde","year":1998},"dnd5e-classes":{"name":"Dungeons & Dragons 5e Classes","tradition":"game","originator":"Wizards of the Coast","year":2014},"pf2e":{"name":"Pathfinder 2e Ancestries and Classes","tradition":"game","originator":"Paizo","year":2019},"ff-jobs":{"name":"Final Fantasy / JRPG Job System","tradition":"game","originator":"Square Enix","year":1987},"wow-classes":{"name":"World of Warcraft Class Roles","tradition":"game","originator":"Blizzard Entertainment","year":2004},"lol-classes":{"name":"League of Legends Champion Classes","tradition":"game","originator":"Riot Games","year":2009},"keirsey":{"name":"Keirsey Four Temperaments","tradition":"pers","originator":"David Keirsey","year":1978},"enneagram":{"name":"Enneagram of Personality","tradition":"pers","originator":"Oscar Ichazo, Claudio Naranjo, Riso & Hudson, Helen Palmer","year":1950},"16-personalities":{"name":"16 Personalities (NERIS)","tradition":"pers","originator":"NERIS Analytics","year":2011},"ifs":{"name":"Internal Family Systems (IFS)","tradition":"pers","originator":"Richard Schwartz","year":1995},"pearson-corlett":{"name":"Pearson & Corlett — Mapping the Organizational Psyche","tradition":"brand","originator":"Carol Pearson and John Corlett","year":2003},"greimas-actant":{"name":"Greimas — Actantial Model","tradition":"crit","originator":"Algirdas Julien Greimas","year":1966},"haraway":{"name":"Haraway — Cyborg Manifesto Figures","tradition":"crit","originator":"Donna Haraway","year":1991},"tarot-major":{"name":"Tarot Major Arcana — 22 Archetypes","tradition":"esot","originator":"Tarot tradition","year":1440},"hermetic":{"name":"Hermetic / Alchemical Figure Typologies","tradition":"esot","originator":"Western esoteric tradition / Jung","year":1500},"african-trickster":{"name":"African Trickster Comparative Set","tradition":"indig","originator":"West African and diasporic traditions","year":1000},"beebe-eight":{"name":"Beebe — Eight-Function/Eight-Archetype Model","tradition":"depth","originator":"John Beebe","year":2004},"stevens-evolutionary":{"name":"Stevens — Evolutionary Archetypes","tradition":"depth","originator":"Anthony Stevens","year":1982},"stein-cartographic":{"name":"Stein — Cartographic Jungian Map","tradition":"depth","originator":"Murray Stein","year":1998},"young-eisendrath":{"name":"Young-Eisendrath — Feminist Jungian Gender Archetypes","tradition":"depth","originator":"Polly Young-Eisendrath","year":1984},"baring-cashford":{"name":"Baring & Cashford — Goddess-Image Sequence","tradition":"depth","originator":"Anne Baring and Jules Cashford","year":1991},"graves-triple-goddess":{"name":"Graves — Triple Goddess","tradition":"myth","originator":"Robert Graves","year":1948},"weiland-archetypal":{"name":"Weiland — Six-Archetype Life-Cycle Arcs","tradition":"drama","originator":"K.M. Weiland","year":2022},"abrahams-aa":{"name":"Abrahams — African American Folktale Character Types","tradition":"folk","originator":"Roger D. Abrahams","year":1985},"white-metahistory":{"name":"White — Metahistory Tropes & Emplotments","tradition":"crit","originator":"Hayden White","year":1973},"creed-monstrous":{"name":"Creed — Monstrous-Feminine Seven Faces","tradition":"crit","originator":"Barbara Creed","year":1993},"horace-ages":{"name":"Horace — Ars Poetica Age-Decorum Types","tradition":"drama","originator":"Horace","year":-19},"truby-genres":{"name":"Truby — Anatomy of Genres","tradition":"drama","originator":"John Truby","year":2022},"melodrama-archetypes":{"name":"Melodrama Character Archetypes","tradition":"drama","originator":"Peter Brooks","year":1976},"bahai-manifestations":{"name":"Bahá'í Manifestations of God","tradition":"relig","originator":"Bahá'u'lláh","year":1862},"navajo-holypeople":{"name":"Navajo (Diné) Holy People","tradition":"indig","originator":"Diné tradition","year":1500},"dnd-creatures":{"name":"D&D Monster Manual Creature Types","tradition":"game","originator":"Wizards of the Coast","year":2014},"changeling-lost":{"name":"Changeling: The Lost — Seemings","tradition":"game","originator":"White Wolf / Onyx Path","year":2007},"shadowrun-roles":{"name":"Shadowrun — Metatypes and Archetypes","tradition":"game","originator":"Catalyst Game Labs / FASA","year":1989},"dungeon-world":{"name":"Dungeon World — Playbooks","tradition":"game","originator":"Sage LaTorra and Adam Koebel","year":2012},"bionicle-toa":{"name":"BIONICLE — Toa Elemental Archetypes","tradition":"game","originator":"LEGO Group / Greg Farshtey","year":2001},"daggerheart":{"name":"Daggerheart Classes","tradition":"game","originator":"Darrington Press / Critical Role","year":2025},"ffxiv-jobs":{"name":"FFXIV — Jobs","tradition":"game","originator":"Square Enix","year":2010}}};

  // ============================================================
  // STATE
  // ============================================================
  var panel = null;
  var onPickCallback = null;
  var hiddenElements = [];

  // ============================================================
  // PUBLIC API
  // ============================================================
  function open(opts){
    opts = opts || {};
    onPickCallback = opts.onPick || null;
    if(!panel){
      build();
    }
    showPanel();
    renderTagGrid();
    // Install Escape-key listener while open
    document.addEventListener('keydown', handleKeyDown);
  }
  function close(){
    document.removeEventListener('keydown', handleKeyDown);
    hidePanel();
    onPickCallback = null;
  }
  function handleKeyDown(e){
    if(e.key === 'Escape' && isOpen()){
      e.preventDefault();
      close();
    }
  }
  function isOpen(){
    return !!(panel && panel.classList.contains('aa-bridge-visible'));
  }

  // ============================================================
  // BUILD DOM — once, lazily
  // ============================================================
  function build(){
    if(document.getElementById('aa-bridge-style')){
      // Already built earlier — reuse
      panel = document.getElementById('aa-bridge-panel');
      if(panel) return;
    } else {
      var style = document.createElement('style');
      style.id = 'aa-bridge-style';
      style.textContent = AA_BRIDGE_CSS;
      document.head.appendChild(style);
    }

    panel = document.createElement('div');
    panel.id = 'aa-bridge-panel';
    panel.className = 'aa-bridge-panel';
    panel.innerHTML = '\n' +
      '  <div class="aa-bridge-header">\n' +
      '    <div class="aa-bridge-title">archetype browser</div>\n' +
      '    <button type="button" class="aa-bridge-close" aria-label="close browser">close</button>\n' +
      '  </div>\n' +
      '  <div class="aa-bridge-hint">click an archetype to see how different traditions named it. click a figure to use it.</div>\n' +
      '  <div class="aa-bridge-body"></div>\n' +
      '  <div class="aa-bridge-footer">\n' +
      '    <a href="/aa/" target="_blank" rel="noopener">→ explore the full archive at /aa/</a>\n' +
      '  </div>\n';

    // Mount in the existing aside, after the card-preview
    var aside = document.getElementById('preview-pane');
    if(aside){
      aside.appendChild(panel);
    } else {
      document.body.appendChild(panel);
    }

    panel.querySelector('.aa-bridge-close').addEventListener('click', close);
  }

  // ============================================================
  // SHOW / HIDE — toggles card-preview off, panel on
  // ============================================================
  function showPanel(){
    panel.classList.add('aa-bridge-visible');
    // Hide the wormcard preview so they don't compete for space
    hiddenElements = [];
    var cardPre = document.getElementById('card-preview');
    var titleDiv = document.querySelector('#preview-pane .preview-title');
    [cardPre, titleDiv].forEach(function(el){
      if(el && el.style.display !== 'none'){
        hiddenElements.push({ el: el, prev: el.style.display });
        el.style.display = 'none';
      }
    });
  }
  function hidePanel(){
    if(panel) panel.classList.remove('aa-bridge-visible');
    hiddenElements.forEach(function(h){ h.el.style.display = h.prev || ''; });
    hiddenElements = [];
  }

  // ============================================================
  // RENDER — top-level archetype grid
  // ============================================================
  function renderTagGrid(){
    var body = panel.querySelector('.aa-bridge-body');
    body.innerHTML = '';
    var grid = document.createElement('div');
    grid.className = 'aa-tag-grid';
    AA_DATA.tags.forEach(function(t){
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'aa-tag-btn';
      btn.dataset.tagId = t.id;
      btn.innerHTML = '<span class="aa-tag-name">' + escape(t.display) + '</span>' +
                      '<span class="aa-tag-count">' + t.traditions + '</span>';
      btn.addEventListener('click', function(){ renderTagDetail(t.id); });
      grid.appendChild(btn);
    });
    body.appendChild(grid);
  }

  function renderTagDetail(tagId){
    var tag = AA_DATA.tags.find(function(t){ return t.id === tagId; });
    if(!tag) return;
    var body = panel.querySelector('.aa-bridge-body');
    body.innerHTML = '';

    var back = document.createElement('button');
    back.type = 'button';
    back.className = 'aa-back-btn';
    back.textContent = '← back to all archetypes';
    back.addEventListener('click', renderTagGrid);
    body.appendChild(back);

    var heading = document.createElement('div');
    heading.className = 'aa-detail-heading';
    heading.innerHTML = '<span class="aa-detail-name">' + escape(tag.display) + '</span>' +
                        '<span class="aa-detail-meta">' + tag.traditions + ' traditions</span>';
    body.appendChild(heading);

    var hint = document.createElement('div');
    hint.className = 'aa-detail-hint';
    hint.textContent = 'click any to use it as a smash-name. the tradition gets recorded with it.';
    body.appendChild(hint);

    var list = document.createElement('div');
    list.className = 'aa-figure-list';
    tag.figures.forEach(function(f){
      var tax = AA_DATA.taxonomies[f.taxId] || {};
      var taxLabel = tax.name || f.taxId;
      var tradition = tax.tradition || '';

      var row = document.createElement('button');
      row.type = 'button';
      row.className = 'aa-figure-row';
      row.innerHTML =
        '<span class="aa-fig-orig">' + escape(f.orig) + '</span>' +
        '<span class="aa-fig-tax">' + escape(taxLabel) + '</span>' +
        (tradition ? '<span class="aa-fig-trad">' + escape(tradition) + '</span>' : '');
      row.addEventListener('click', function(){
        pickFigure(tag, f, tax);
      });
      list.appendChild(row);
    });
    body.appendChild(list);

    // Also: pick the archetype itself, no specific tradition
    var pickAbstract = document.createElement('button');
    pickAbstract.type = 'button';
    pickAbstract.className = 'aa-pick-abstract';
    pickAbstract.textContent = 'or use ' + tag.display + ' as a pure archetype';
    pickAbstract.addEventListener('click', function(){
      pickArchetype(tag);
    });
    body.appendChild(pickAbstract);
  }

  function pickFigure(tag, fig, tax){
    var taxLabel = tax.name || '';
    var name;
    if(fig.orig.toLowerCase() === tag.display.toLowerCase()){
      // Generic archetype-name — annotate with tradition if present, else just the name
      name = taxLabel ? (tag.display + ' (' + taxLabel + ')') : tag.display;
    } else {
      // Distinct figure name — show figure as primary
      name = taxLabel ? (fig.orig + ' (' + tag.display + ' — ' + taxLabel + ')')
                       : (fig.orig + ' (' + tag.display + ')');
    }
    var picked = {
      name: name,
      archetypeId: tag.id,
      figureLabel: fig.orig,
      tradition: tax.tradition || '',
      taxonomyLabel: taxLabel
    };
    deliver(picked);
  }
  function pickArchetype(tag){
    var picked = {
      name: 'the ' + tag.display + ' archetype',
      archetypeId: tag.id,
      figureLabel: tag.display,
      tradition: '',
      taxonomyLabel: ''
    };
    deliver(picked);
  }

  function deliver(picked){
    if(typeof onPickCallback === 'function'){
      onPickCallback(picked);
    }
    close();
  }

  // ============================================================
  // HELPERS
  // ============================================================
  function escape(s){
    return String(s).replace(/[&<>"']/g, function(c){
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }

  // ============================================================
  // CSS
  // ============================================================
  var AA_BRIDGE_CSS = [
    '.aa-bridge-panel{display:none;flex-direction:column;flex:1;min-height:0;font-family:VT323,monospace;color:var(--fg-dim);overflow:hidden}',
    '.aa-bridge-panel.aa-bridge-visible{display:flex}',
    '.aa-bridge-header{display:flex;align-items:center;justify-content:space-between;padding-bottom:0.5rem;border-bottom:1px dashed var(--fg-darker);margin-bottom:0.6rem;flex-shrink:0}',
    '.aa-bridge-title{font-size:0.95rem;color:var(--fg-dim);text-transform:uppercase;letter-spacing:1.5px;text-shadow:none}',
    '.aa-bridge-close{background:transparent;border:1px solid var(--fg-darker);color:var(--fg-dim);font-family:inherit;font-size:0.8rem;padding:0.15rem 0.5rem;cursor:pointer;letter-spacing:1px}',
    '.aa-bridge-close:hover{border-color:var(--fg);color:var(--fg)}',
    '.aa-bridge-hint{font-size:0.85rem;color:var(--fg-darker);font-style:italic;margin-bottom:0.7rem;line-height:1.35;flex-shrink:0}',
    '.aa-bridge-body{flex:1;overflow-y:auto;overflow-x:hidden;min-height:0}',
    '.aa-bridge-footer{padding-top:0.5rem;border-top:1px dashed var(--fg-darker);font-size:0.8rem;flex-shrink:0;margin-top:0.5rem}',
    '.aa-bridge-footer a{color:var(--fg-darker);text-decoration:none}',
    '.aa-bridge-footer a:hover{color:var(--fg);text-decoration:underline}',
    /* tag grid */
    '.aa-tag-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:0.4rem}',
    '.aa-tag-btn{background:rgba(0,0,0,0.4);border:1px solid var(--fg-darker);color:var(--fg-dim);font-family:inherit;font-size:0.95rem;padding:0.4rem 0.5rem;cursor:pointer;display:flex;flex-direction:column;align-items:flex-start;gap:0.1rem;text-align:left;line-height:1.2;transition:all 0.15s}',
    '.aa-tag-btn:hover{border-color:var(--fg);color:var(--fg);background:rgba(255,176,0,0.05)}',
    '.aa-tag-name{font-size:1rem;letter-spacing:0.3px}',
    '.aa-tag-count{font-size:0.7rem;color:var(--fg-darker);letter-spacing:1px}',
    /* detail */
    '.aa-back-btn{background:transparent;border:none;color:var(--fg-darker);font-family:inherit;font-size:0.85rem;cursor:pointer;padding:0.2rem 0;margin-bottom:0.5rem;letter-spacing:0.5px}',
    '.aa-back-btn:hover{color:var(--fg)}',
    '.aa-detail-heading{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:0.4rem;border-bottom:1px solid var(--fg-darker);padding-bottom:0.3rem}',
    '.aa-detail-name{font-size:1.4rem;color:var(--accent);text-shadow:0 0 6px rgba(255,176,0,0.4)}',
    '.aa-detail-meta{font-size:0.75rem;color:var(--fg-darker);letter-spacing:1px}',
    '.aa-detail-hint{font-size:0.8rem;color:var(--fg-darker);font-style:italic;margin-bottom:0.6rem;line-height:1.35}',
    '.aa-figure-list{display:flex;flex-direction:column;gap:0.3rem;margin-bottom:0.7rem}',
    '.aa-figure-row{background:rgba(0,0,0,0.4);border:1px solid var(--fg-darker);color:var(--fg-dim);font-family:inherit;padding:0.4rem 0.6rem;cursor:pointer;display:flex;flex-direction:column;align-items:flex-start;gap:0.1rem;text-align:left;line-height:1.25}',
    '.aa-figure-row:hover{border-color:var(--fg);color:var(--fg);background:rgba(255,176,0,0.05)}',
    '.aa-fig-orig{font-size:1rem}',
    '.aa-fig-tax{font-size:0.78rem;color:var(--fg-darker)}',
    '.aa-fig-trad{font-size:0.7rem;color:var(--fg-darker);font-style:italic}',
    '.aa-pick-abstract{background:transparent;border:1px dashed var(--fg-darker);color:var(--fg-dim);font-family:inherit;font-size:0.85rem;padding:0.5rem;width:100%;cursor:pointer;letter-spacing:0.5px}',
    '.aa-pick-abstract:hover{border-color:var(--fg);color:var(--fg);border-style:solid}'
  ].join('\n');

  // ============================================================
  // EXPORTS
  // ============================================================
  global.AaBridge = {
    open: open,
    close: close,
    isOpen: isOpen,
    _data: AA_DATA  // exposed for debugging only
  };
})(typeof window !== 'undefined' ? window : globalThis);
