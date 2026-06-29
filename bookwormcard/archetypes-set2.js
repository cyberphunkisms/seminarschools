/* polymyth-horoscope-archetypes-set2.js
 * Set 2: Celtic Tree (13), Hellenistic decans (12 with decan modifiers), Egyptian deities (12).
 */

(function(global) {
  'use strict';

  if (!global.PolymythHoroscopeArchetypes) global.PolymythHoroscopeArchetypes = {};
  var ARCHETYPES = global.PolymythHoroscopeArchetypes;

  // ============================================================
  // CELTIC TREE ASTROLOGY (13 lunar tree-months, Robert Graves' systematization of older traditions)
  // ============================================================
  ARCHETYPES['celtic-birch'] = {
    name: 'Birch (Beth)',
    tradition: 'Celtic tree astrology',
    writeup: "First tree of the Celtic year — the pioneer that grows where other trees cannot. Birch archetype carries: capacity to begin, willingness to occupy disturbed ground, the figure who shows up first after the burn. Themes of cleansing, fresh starts, the ambition that can sustain itself through hostile early conditions. Shadow side: leaving when the conditions improve, the figure who is only at home in difficulty."
  };
  ARCHETYPES['celtic-rowan'] = {
    name: 'Rowan (Luis)',
    tradition: 'Celtic tree astrology',
    writeup: "The protective tree, planted at thresholds and graveyards across Celtic Europe. Rowan archetype carries: vision, the capacity to see what is coming and prepare the people, intuition operating as practical guard-work. Themes of warding, perception, the figure whose insight protects the household. Shadow side: paranoia, the figure who sees threats everywhere and exhausts those they protect with vigilance."
  };
  ARCHETYPES['celtic-ash'] = {
    name: 'Ash (Nion)',
    tradition: 'Celtic tree astrology',
    writeup: "World-tree across Indo-European traditions — Yggdrasil in the Norse, the cosmic axis in many Celtic readings. Ash archetype carries: connection between worlds, capacity to mediate between the immediate and the cosmic, the figure who reads the larger pattern in the small event. Themes of links, fate, sea-faring (ash was the wood of Celtic ships). Shadow side: the figure who is so attuned to large patterns they cannot navigate small ones."
  };
  ARCHETYPES['celtic-alder'] = {
    name: 'Alder (Fearn)',
    tradition: 'Celtic tree astrology',
    writeup: "The tree that grows in wet ground, that resists rotting in water — alder pilings hold up Venice. Alder archetype carries: resilience under conditions that destroy other materials, courage that sustains itself in emotional damp, the figure who holds the foundation while submerged. Themes of guidance, oracular bravery, the King Bran association in Welsh tradition. Shadow side: martyrdom, the figure who proves their worth by what they endure rather than what they accomplish."
  };
  ARCHETYPES['celtic-willow'] = {
    name: 'Willow (Saille)',
    tradition: 'Celtic tree astrology',
    writeup: "The moon's tree — willow leaves silver underneath, the tree that bends to the water. Willow archetype carries: emotional intelligence, lunar intuition, capacity to mourn properly without being destroyed by grief. Themes of dreaming, the unconscious, the figure who reads what others' bodies say before words. Shadow side: melancholy that becomes its own habit, the figure whose receptivity becomes absorption."
  };
  ARCHETYPES['celtic-hawthorn'] = {
    name: 'Hawthorn (Huath)',
    tradition: 'Celtic tree astrology',
    writeup: "The fairy-tree, the Beltane tree, the threshold-keeper. Hawthorn archetype carries: liminal intelligence, capacity to operate at edges between worlds, fierceness in protecting what looks delicate. Themes of fertility, danger, the protective hedge that wounds those who try to push through too quickly. Shadow side: prickliness as identity, the figure whose defensiveness prevents the contact they actually want."
  };
  ARCHETYPES['celtic-oak'] = {
    name: 'Oak (Duir)',
    tradition: 'Celtic tree astrology',
    writeup: "The king-tree, the Druid tree, the tree of the summer solstice. Oak archetype carries: gravitas, longevity, capacity to anchor a community through generations, the figure who becomes the meeting-place. Themes of strength as duration rather than violence, leadership earned by being there. Shadow side: rigidity, the figure who has stood so long they cannot bend at all when bending is what is needed."
  };
  ARCHETYPES['celtic-holly'] = {
    name: 'Holly (Tinne)',
    tradition: 'Celtic tree astrology',
    writeup: "The winter-king tree, the warrior's tree — holly stays green when everything else dies back. Holly archetype carries: courage in dark seasons, principled fighting, capacity to maintain identity when conditions are hostile. Themes of righteous defense, the figure whose ethics sharpen rather than soften under pressure. Shadow side: warlike posture as default, the figure whose readiness for fight summons fights that did not have to come."
  };
  ARCHETYPES['celtic-hazel'] = {
    name: 'Hazel (Coll)',
    tradition: 'Celtic tree astrology',
    writeup: "The wisdom-tree — Irish myth places nine hazels of poetic knowledge dropping nuts into the well of Connla. Hazel archetype carries: scholarly intelligence, capacity for divination, the figure who reads omens and synthesizes what others observed but did not connect. Themes of teaching, the well-of-knowledge, the inspired articulation. Shadow side: knowing-as-substitute-for-doing, the figure who reads everything and acts on nothing."
  };
  ARCHETYPES['celtic-vine'] = {
    name: 'Vine (Muin)',
    tradition: 'Celtic tree astrology',
    writeup: "The harvest tree — vine in the Celtic calendar covers grape, ivy, blackberry, the climbers and fruit-bearers. Vine archetype carries: capacity for joy and excess, social intelligence, the figure who is the host of the gathering. Themes of celebration, intoxication, the harvest that follows the long work. Shadow side: dependency, the figure whose climbing always requires another structure to climb on."
  };
  ARCHETYPES['celtic-ivy'] = {
    name: 'Ivy (Gort)',
    tradition: 'Celtic tree astrology',
    writeup: "The persistent tree — ivy outlives the structures it grew on, climbs anything, cannot be permanently removed. Ivy archetype carries: tenacity, capacity for spiraling growth that follows whatever support is offered, the figure who keeps going through what stops others. Themes of attachment, search-pattern intelligence, the long memory. Shadow side: clinging, the figure whose attachment outlasts the worth of what is being held onto."
  };
  ARCHETYPES['celtic-reed'] = {
    name: 'Reed (Ngetal)',
    tradition: 'Celtic tree astrology',
    writeup: "Not strictly a tree — reed is the marsh-plant that becomes pipe, arrow-shaft, thatching, the substance through which voice and action transmit. Reed archetype carries: communicative intelligence, capacity to be the medium for others' messages without losing self, the figure whose voice carries beyond their physical reach. Themes of music, narrative, the storyteller. Shadow side: hollowness, the figure who transmits so much they have no internal weather of their own."
  };
  ARCHETYPES['celtic-elder'] = {
    name: 'Elder (Ruis)',
    tradition: 'Celtic tree astrology',
    writeup: "Last tree of the year — elder is associated with endings, with wisdom that comes from completion, with the crone-figure in the triple-goddess. Elder archetype carries: capacity to release, knowledge of what was, willingness to be the figure who ends a chapter so the next can begin. Themes of regeneration through letting-go, the threshold of the cycle. Shadow side: nostalgia, the figure whose attachment to what was prevents what is."
  };

  // ============================================================
  // HELLENISTIC DECANS — sign-level + decan-modifier writeups
  // V1 stores sign-level archetype keyed as 'hellenistic-aries-1', 'hellenistic-aries-2', 'hellenistic-aries-3'
  // ============================================================
  // Decan rulers per Chaldean order (sign rulers in turn within each sign-triplet):
  // Aries: Mars/Sun/Venus  Taurus: Mercury/Moon/Saturn  Gemini: Jupiter/Mars/Sun  Cancer: Venus/Mercury/Moon
  // Leo: Saturn/Jupiter/Mars  Virgo: Sun/Venus/Mercury  Libra: Moon/Saturn/Jupiter  Scorpio: Mars/Sun/Venus
  // Sagittarius: Mercury/Moon/Saturn  Capricorn: Jupiter/Mars/Sun  Aquarius: Venus/Mercury/Moon  Pisces: Saturn/Jupiter/Mars

  function decan(sign, n, ruler, writeup) {
    ARCHETYPES['hellenistic-' + sign + '-' + n] = {
      name: 'Hellenistic ' + sign.charAt(0).toUpperCase() + sign.slice(1) + ' decan ' + n + ' (ruled by ' + ruler + ')',
      tradition: 'Hellenistic decanic astrology',
      writeup: writeup
    };
  }

  decan('aries', 1, 'Mars', "First decan of the first sign — Mars-on-Mars, the pure form of initiation. Carries the Aries archetype at maximum intensity: courage as immediate response, the figure who is first into the room without checking the room. Hellenistic readings of this decan emphasize military-style virtues, the warrior who cannot be paused.");
  decan('aries', 2, 'Sun', "Aries with solar overlay — the figure whose initiative comes wrapped in performance, the first-mover who is also the most-visible-mover. Carries themes of leadership through visibility, the courage that wants witnesses. The Sun softens the pure war-energy of Mars-decan-1 toward the king-rather-than-soldier mode.");
  decan('aries', 3, 'Venus', "Aries with Venus overlay — the first-mover whose initiations are toward beauty, pleasure, relation. The figure whose courage is deployed in service of love rather than conquest. Carries themes of romantic ardor, aesthetic risk-taking, the artist who charges the wall.");

  decan('taurus', 1, 'Mercury', "Taurus with Mercury overlay — earth-stability paired with mind-mobility. The figure whose senses operate as data-gathering instruments, the body as encyclopedia. Carries themes of grounded intelligence, the craftsman who is also the analyst.");
  decan('taurus', 2, 'Moon', "Pure Taurus core — Venusian-lunar pairing emphasizes the body-as-feeling-organ. The figure whose pleasure is also their wisdom, sensuality as a way of knowing. Carries themes of comfort, nurture, the home as primary value.");
  decan('taurus', 3, 'Saturn', "Taurus with Saturn overlay — earthy-pleasure constrained by long-time discipline. The figure who builds slowly toward durable beauty, the patient craftsperson. Carries themes of inheritance, the weight of what one has accumulated.");

  decan('gemini', 1, 'Jupiter', "Gemini with Jupiter overlay — air-mind expanded toward big-frame thinking. The figure who connects ideas across vast scales, the polymath. Carries themes of teaching, philosophical hunger, the verbal range that becomes its own subject.");
  decan('gemini', 2, 'Mars', "Gemini with Mars overlay — quick mind sharpened to weapon-like precision. The figure whose verbal agility cuts, the debater. Carries themes of intellectual combat, wit-as-defense, the journalist who exposes.");
  decan('gemini', 3, 'Sun', "Gemini with solar overlay — the messenger who is also the light source. The figure whose communications themselves illuminate, the public intellectual. Carries themes of broadcast intelligence, the figure who synthesizes for an audience.");

  decan('cancer', 1, 'Venus', "Cancer with Venus overlay — the home as site of beauty and pleasure. The figure whose nurture takes the form of aesthetic care. Carries themes of hospitality, the house-as-art, the love that expresses through provision.");
  decan('cancer', 2, 'Mercury', "Cancer with Mercury overlay — emotional intelligence paired with verbal articulation. The figure who can name what others feel but cannot name. Carries themes of therapy, the family-historian, the keeper of the family's verbal record.");
  decan('cancer', 3, 'Moon', "Pure Cancer core — Moon ruling its own sign at the highest density. The figure whose interiority is the work, the dream-life as primary reality. Carries themes of psychic permeability, the medium, the one who feels what is in the room before words are exchanged.");

  decan('leo', 1, 'Saturn', "Leo with Saturn overlay — solar charisma constrained by responsibility. The figure who performs because the role requires it, the dignified king. Carries themes of duty, the weight of being looked at, leadership as burden carried gracefully.");
  decan('leo', 2, 'Jupiter', "Leo with Jupiter overlay — solar generosity expanded by Jupiter's expansion. The figure whose performance gives more than it asks, the host on a grand scale. Carries themes of magnanimity, the public-facing benefactor.");
  decan('leo', 3, 'Mars', "Leo with Mars overlay — the warrior-king. The figure whose leadership is forged in conflict, the lion who has fought. Carries themes of charismatic struggle, the leader who came up through battle.");

  decan('virgo', 1, 'Sun', "Virgo with solar overlay — analytical service made visible, performed-with-craft. The figure whose precision is offered publicly, the master-craftsperson recognized. Carries themes of perfectionism deployed as gift to the community.");
  decan('virgo', 2, 'Venus', "Virgo with Venus overlay — discernment in service of beauty. The figure who notices what is wrong with the aesthetic and quietly fixes it. Carries themes of the editor, the curator, the figure who makes the rough thing presentable.");
  decan('virgo', 3, 'Mercury', "Pure Virgo core — Mercury ruling its own sign in detail-mode. The figure whose mind operates at the granular level, the analyst, the specialist. Carries themes of expertise, the figure who knows the small specific thing better than anyone.");

  decan('libra', 1, 'Moon', "Libra with Moon overlay — diplomatic intelligence paired with emotional attunement. The figure whose balance comes through feeling-with rather than abstract weighing. Carries themes of mediation through empathy, the social healer.");
  decan('libra', 2, 'Saturn', "Libra with Saturn overlay — Venusian-judicial weight. The figure whose justice is structural, who builds institutions of fairness. Carries themes of law, contract, the long-game architecture of equity.");
  decan('libra', 3, 'Jupiter', "Libra with Jupiter overlay — partnership expanded into philosophical and cultural breadth. The figure whose relationships open larger worlds, the diplomat between traditions. Carries themes of cross-cultural marriage, ambassadorial intelligence.");

  decan('scorpio', 1, 'Mars', "Pure Scorpio core — Mars ruling its night sign at maximum density. The figure whose intensity is unfiltered, the surgeon, the figure who can stay in the difficult feeling without dissociating. Carries themes of psychological precision, the work that involves blood.");
  decan('scorpio', 2, 'Sun', "Scorpio with solar overlay — depth-work made visible. The figure who brings shadow material into public light, the truth-teller of the family-secret. Carries themes of exposure, the brave revelation.");
  decan('scorpio', 3, 'Venus', "Scorpio with Venus overlay — depth-intensity directed toward eros and beauty. The figure whose desire is total, all-or-nothing love. Carries themes of erotic transformation, sexuality as spiritual practice.");

  decan('sagittarius', 1, 'Mercury', "Sagittarius with Mercury overlay — philosophical hunger paired with verbal range. The figure whose teaching travels, the lecturer-traveler. Carries themes of intellectual nomadism, books-as-territories.");
  decan('sagittarius', 2, 'Moon', "Sagittarius with Moon overlay — expansive vision tempered by emotional rhythm. The figure whose travels are also internal, the pilgrim. Carries themes of spiritual journey, the search for meaning that has emotional tides.");
  decan('sagittarius', 3, 'Saturn', "Sagittarius with Saturn overlay — Jupiterian breadth disciplined by structure. The figure whose philosophy becomes an institution, the founding teacher. Carries themes of legacy-building, the school established.");

  decan('capricorn', 1, 'Jupiter', "Capricorn with Jupiter overlay — ambition expanded by purpose. The figure whose climbing is in service of something larger, the principled empire-builder. Carries themes of ethical leadership, the long-game ambition with a why.");
  decan('capricorn', 2, 'Mars', "Capricorn with Mars overlay — Saturnian discipline weaponized. The figure whose long patience converts into precise strikes, the figure who waited for the right moment for years. Carries themes of strategic warfare, the military commander.");
  decan('capricorn', 3, 'Sun', "Capricorn with solar overlay — the king at the summit. The figure whose climbing is complete, the established authority. Carries themes of recognized rank, the late-career master.");

  decan('aquarius', 1, 'Venus', "Aquarius with Venus overlay — intellectual independence paired with aesthetic-relational care. The figure whose innovations are loving, the friend-as-philosopher. Carries themes of community-building through art, the salonniere.");
  decan('aquarius', 2, 'Mercury', "Aquarius with Mercury overlay — air-fixed-air, intellectual independence at maximum density. The figure whose ideas are radically their own, the inventor, the genius outsider. Carries themes of patent-bearing creativity, the loner who changes the field.");
  decan('aquarius', 3, 'Moon', "Aquarius with Moon overlay — innovation tempered by emotional connection. The figure whose new ideas are rooted in care for actual people. Carries themes of humanitarian science, the engineer who is also the social-worker.");

  decan('pisces', 1, 'Saturn', "Pisces with Saturn overlay — dissolution disciplined by structure. The figure whose mysticism takes form as institution, the contemplative who builds the monastery. Carries themes of disciplined imagination, the artist who finishes the work.");
  decan('pisces', 2, 'Jupiter', "Pisces with Jupiter overlay — Neptunian sensitivity expanded by Jupiter's reach. The figure whose empathy operates on a vast scale, the spiritual teacher with audience. Carries themes of devotional vision, the figure who articulates the larger meaning.");
  decan('pisces', 3, 'Mars', "Pisces with Mars overlay — sensitivity weaponized into action. The figure whose mysticism takes the form of urgent help, the mystic-activist. Carries themes of compassionate combat, the saint who fights.");

  // ============================================================
  // EGYPTIAN DECANIC (12 deity-signs)
  // ============================================================
  ARCHETYPES['egyptian-thoth'] = {
    name: 'Thoth (the Ibis)',
    tradition: 'Egyptian decanic',
    writeup: "Scribe of the gods, inventor of writing, judge of souls. Thoth archetype carries: scholarly intelligence, the figure whose tools are language and measurement, capacity to record what the powerful would prefer forgotten. Themes of accuracy, mediation between visible and invisible orders, the ibis-headed weighing of hearts. Shadow side: the figure whose record-keeping becomes its own end, the scribe who never enters the events being recorded."
  };
  ARCHETYPES['egyptian-horus'] = {
    name: 'Horus (the Falcon)',
    tradition: 'Egyptian decanic',
    writeup: "Sky-king, son who avenges the father, the falcon-eyed prince. Horus archetype carries: legitimate authority, vision from height, the figure who sees the field whole. Themes of dynastic continuation, the long fight to recover what was taken, kingship-as-duty rather than kingship-as-prize. Shadow side: the figure whose vendetta becomes character, the prince who cannot stop being prince long enough to become king."
  };
  ARCHETYPES['egyptian-wadjet'] = {
    name: 'Wadjet (the Cobra)',
    tradition: 'Egyptian decanic',
    writeup: "Serpent-protector of Lower Egypt, the cobra rearing on the pharaoh's brow. Wadjet archetype carries: fierce guardianship, the figure whose protection takes the form of warning-display, instinct as moral compass. Themes of female sovereignty, protection through threat-of-strike rather than actual violence. Shadow side: the figure whose vigilance becomes paranoia, the guard who attacks the friend who came too quickly."
  };
  ARCHETYPES['egyptian-sekhmet'] = {
    name: 'Sekhmet (the Lioness)',
    tradition: 'Egyptian decanic',
    writeup: "Lion-headed goddess of plague, war, healing — the destruction-and-restoration paired in one figure. Sekhmet archetype carries: necessary destructive force, the figure who burns down what cannot be reformed, healing-through-purgation. Themes of the wrath-of-the-mother, justice without mercy in service of larger care. Shadow side: rage that consumes without distinguishing its targets, the figure whose passion exhausts those who love them."
  };
  ARCHETYPES['egyptian-sphinx'] = {
    name: 'Sphinx (the Riddler)',
    tradition: 'Egyptian decanic',
    writeup: "Threshold guardian — at the Giza pyramid, at the gates of Thebes, at every site where passage must be earned. Sphinx archetype carries: liminal intelligence, the figure who tests the seeker before granting access, knowledge held in riddles. Themes of initiation, the question that separates the qualified from the merely ambitious. Shadow side: the figure whose riddle becomes pure obstruction, the gatekeeper who has forgotten what the gate was for."
  };
  ARCHETYPES['egyptian-shu'] = {
    name: 'Shu (the Air-Lifter)',
    tradition: 'Egyptian decanic',
    writeup: "The god who separates earth from sky, holding Nut above Geb so the world can have height. Shu archetype carries: structural support, the figure whose role is to keep things from collapsing into each other. Themes of necessary distance, the architect of breathing-room. Shadow side: the figure who confuses holding-apart with the actual relation, the structural-support who forgets they were holding for someone else's benefit."
  };
  ARCHETYPES['egyptian-isis'] = {
    name: 'Isis (the Throne / Magician-Mother)',
    tradition: 'Egyptian decanic',
    writeup: "Wife of Osiris, mother of Horus, magician who reassembled her husband's scattered body. Isis archetype carries: devotional intelligence, capacity to do the impossible reassembling-work, magical-practical agency. Themes of the mother-as-magician, the figure whose love is also their power. Shadow side: the figure whose devotion to others' restoration leaves nothing for their own, the magician who can fix everyone but themselves."
  };
  ARCHETYPES['egyptian-osiris'] = {
    name: 'Osiris (the Underworld-King)',
    tradition: 'Egyptian decanic',
    writeup: "Murdered, dismembered, reassembled, ruler of the dead. Osiris archetype carries: capacity for death-and-rebirth, the figure who has been broken and put back together, authority earned through suffering. Themes of the wounded king, justice administered by one who knows injury. Shadow side: the figure whose suffering becomes their identity, the wound as throne."
  };
  ARCHETYPES['egyptian-amun'] = {
    name: 'Amun (the Hidden One)',
    tradition: 'Egyptian decanic',
    writeup: "The unseen god — Amun's name means 'hidden,' he is the god whose nature is not to be visible. Amun archetype carries: power that does not announce itself, intelligence operating beneath surfaces, the figure whose effects are larger than their visibility. Themes of secret reservoirs, the source-that-cannot-be-imaged. Shadow side: the figure whose hiddenness becomes evasion, the power that refuses accountability."
  };
  ARCHETYPES['egyptian-hathor'] = {
    name: 'Hathor (the Cow / Joy-Bringer)',
    tradition: 'Egyptian decanic',
    writeup: "Goddess of love, music, motherhood, joy — depicted as cow or cow-horned woman, the nourisher. Hathor archetype carries: capacity for pleasure as a real value, music-as-medicine, the figure whose presence makes the room celebrate. Themes of fertility, sensuality, the dance. Shadow side: the figure who flees difficulty into pleasure, the celebrant who cannot face the wake."
  };
  ARCHETYPES['egyptian-anubis'] = {
    name: 'Anubis (the Jackal / Embalmer)',
    tradition: 'Egyptian decanic',
    writeup: "Jackal-headed psychopomp, embalmer of Osiris, weigher of hearts in the afterlife judgment. Anubis archetype carries: capacity to handle the dead and the dying, the figure who does the work others cannot bear, ritual precision in moments of dissolution. Themes of grief-work, the funerary intelligence, the figure who knows what to do when there is nothing to be done. Shadow side: the figure who is so comfortable with endings they bring them prematurely."
  };
  ARCHETYPES['egyptian-set'] = {
    name: 'Set (the Desert / Chaos-Brother)',
    tradition: 'Egyptian decanic',
    writeup: "Murderer of Osiris, god of desert and storm, the necessary-evil within the pantheon. Set archetype carries: disruptive intelligence, the figure who breaks what needs breaking, the chaos that prevents calcification. Themes of the antagonist-who-is-also-required, productive evil, the desert-as-purification. Shadow side: destruction without renewal, the figure whose role becomes pure opposition, the brother who cannot stop being the brother who killed."
  };

  global.PolymythHoroscopeArchetypes = ARCHETYPES;

})(typeof window !== 'undefined' ? window : this);
