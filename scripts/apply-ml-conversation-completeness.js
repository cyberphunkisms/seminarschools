#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  parseSeedWithAddenda,
  parseSnakelogicExampleAddendum,
} = require('./lib/parse-seed-with-addenda');

const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'polymyth', 'methodologylist', 'index.html');
let source = fs.readFileSync(FILE, 'utf8');

function objectRangeForTitle(title) {
  const titleNeedle = `"t": ${JSON.stringify(title)}`;
  const titleIndex = source.indexOf(titleNeedle);
  if (titleIndex === -1) throw new Error(`ML* entry not found: ${title}`);
  if (source.indexOf(titleNeedle, titleIndex + titleNeedle.length) !== -1) {
    throw new Error(`ML* entry title is not unique: ${title}`);
  }
  const start = source.lastIndexOf('\n  {', titleIndex) + 1;
  if (start <= 0) throw new Error(`ML* entry start not found: ${title}`);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === '\\') {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '{') depth += 1;
    if (character === '}') {
      depth -= 1;
      if (depth === 0) return {start, end: index + 1};
    }
  }
  throw new Error(`ML* entry end not found: ${title}`);
}

function renderEntry(entry) {
  return [
    '  {',
    ...Object.entries(entry).map(
      ([key, value], index, all) =>
        `    ${JSON.stringify(key)}: ${JSON.stringify(value)}${index === all.length - 1 ? '' : ','}`,
    ),
    '  }',
  ].join('\n');
}

function updateEntry(title, mutate) {
  const range = objectRangeForTitle(title);
  const entry = JSON.parse(source.slice(range.start, range.end));
  mutate(entry);
  source =
    source.slice(0, range.start) +
    renderEntry(entry) +
    source.slice(range.end);
}

function replaceRequired(value, before, after, label) {
  if (value.includes(after)) return value;
  if (!value.includes(before)) throw new Error(`Missing ${label}`);
  return value.replace(before, after);
}

function appendCsvTerms(value, terms) {
  const existing = value
    .split(',')
    .map((term) => term.trim())
    .filter(Boolean);
  const seen = new Set(existing);
  for (const term of terms) {
    if (!seen.has(term)) {
      existing.push(term);
      seen.add(term);
    }
  }
  return existing.join(', ');
}

function replaceCsvTerm(value, before, after) {
  const terms = value
    .split(',')
    .map((term) => term.trim())
    .filter(Boolean);
  const result = [];
  for (const term of terms) {
    if (term === before) result.push(...after);
    else result.push(term);
  }
  return appendCsvTerms('', result);
}

function appendOnce(value, addition) {
  return value.includes(addition) ? value : value + addition;
}

updateEntry('Snakelogic', (entry) => {
  entry.x = entry.x.replace(
    'Gorgonlogic (gorgonification section, the unit-form and automatic-discharge distinction)',
    'Gorgonlogic (gorgonification section, automatic-discharge test; complete relation to single-or-chain Snakelogic unratified)',
  );
});

updateEntry(
  '“Gorgonified feminism” qualifier-TWIST audit (retired third-head label)',
  (entry) => {
    entry.b = replaceRequired(
      entry.b,
      `AUTOMATIC OR ASSEMBLED. When the qualifier appears reflexively because respectable language prefers a narrower charge, the transfer is Gorgonlogic. When an operator assembles a capture story, exception, subtype, and qualifier until the softened claim appears more precise, the transfer is Snakelogic.`,
      `SNAKELOGIC STATUS. Whenever “gorgonified feminism” is deployed as an operative qualifier, it is Snakelogic because its show of precision routes the charge into a protected clean remainder. The classification does not depend on whether the insertion was reflexive, deliberate, one surface move, or accumulated across revisions. Metalinguistic quotation that identifies or audits the retired phrase does not redeploy it.`,
      'qualifier overlap paragraph',
    );
    entry.tg = appendCsvTerms(entry.tg, [
      'operative-qualifier-is-snakelogic',
      'user-set-classification-2026-07-27',
    ]);
    entry.x = entry.x.replace(
      'Gorgonlogic (automatic discharge); Snakelogic (assembled routing)',
      'Gorgonlogic (prior proposed additional classification retained as unratified history; cannot displace the user-set label); Snakelogic (current user-set classification, single move or chain)',
    );
    entry.tg = replaceCsvTerm(entry.tg, 'gorgonlogic', [
      'additional-gorgonlogic-classification-unratified',
    ]);
  },
);

updateEntry('Gorgonlogic (discharge without operator thinking)', (entry) => {
  entry.b = replaceRequired(
    entry.b,
    `LAYMAN. Gorgonlogic is the unit-form or automatic discharge of gorgonification at the reasoning layer. An operation reads as analysis while performing deflection. It fires on trigger-contact without operator-mediated sequencing and without passing through the critical layer.`,
    `LAYMAN. Gorgonlogic is automatic discharge of gorgonification at the reasoning layer. An operation reads as analysis while performing deflection. It fires on trigger contact without operator-mediated sequencing and without passing through the critical layer. Surface length determines neither Gorgonlogic nor Snakelogic.`,
    'Gorgonlogic layman definition',
  );
  entry.b = replaceRequired(
    entry.b,
    `DISTINGUISHED FROM SNAKELOGIC. Snakelogic is the concatenated form. Several units, premises, rules, corrections, credentials, precedents, or procedures are sequenced until the route appears to be a derivation. The sequence may be deliberate or may accumulate across revisions. Intent does not decide the category. Gorgonlogic self-fires as a unit. Snakelogic gains force from the chain.`,
    `RELATION TO SNAKELOGIC. The canonical Snakelogic entry already permits a single move or a chain. Gorgonlogic names automatic discharge without operator-mediated sequencing. The conversation has not ratified a complete exclusivity-or-overlap ontology between the two terms. Do not use unit length to erase a user-set Snakelogic classification, and do not assert that every Snakelogic move is Gorgonlogic. Preserve the named classification and mark any additional classification unresolved until the operator ratifies it.`,
    'Gorgonlogic/Snakelogic relationship status',
  );
  entry.b = replaceRequired(
    entry.b,
    `QUALIFIER-TWIST EXAMPLE. “Gorgonified feminism” is Gorgonlogic when the softening qualifier appears reflexively. It becomes Snakelogic when capture story, subtype exception, and qualifier are chained to produce the softened conclusion.`,
    `QUALIFIER-TWIST EXAMPLE. The operator classified “gorgonified feminism” as Snakelogic. That classification holds whether the qualifier appears as one surface insertion or through an accumulated capture story. Whether the same occurrence may also receive the Gorgonlogic label remains unratified and must not replace or soften the user-set Snakelogic classification.`,
    'qualifier classification in Gorgonlogic',
  );
  entry.b = replaceRequired(
    entry.b,
    `SCANNER PROTOCOL. Ask whether the force comes from a self-firing unit or from accumulated sequencing. If the same unit would emerge from interchangeable operators on the same trigger, classify Gorgonlogic. If the apparent conclusion depends on the order and inheritance of several moves, classify Snakelogic. Preserve mixed cases when automatic units are chained.`,
    `SCANNER PROTOCOL. Test Gorgonlogic only by automatic discharge: did the route self-fire on trigger contact without critical mediation. Do not infer or exclude Snakelogic from the number of moves. Apply the canonical Snakelogic wrong-direction test separately. Because the complete relation between the terms remains unratified, preserve the operator’s named classification and mark any proposed cross-classification unresolved.`,
    'Gorgonlogic scanner protocol',
  );
  entry.b = entry.b.replace(
    'CROSS-REFERENCES. Snakelogic (concatenated cousin).',
    'CROSS-REFERENCES. Snakelogic (separate single-or-chain wrong-direction test; complete relation unratified).',
  );
  entry.x =
    'User social media posts deploy gorgonlogic as a distinct scanner concept (Jun 2026). A July 2026 interim correction made unit-form versus concatenated-form load-bearing; the July 27 conversation-fidelity audit superseded that exclusivity because canonical Snakelogic already permits one move or a chain. The complete relationship remains unratified. Cluster-discharge was already filed as a gorgonlogic sub-pattern, but the parent concept had no standalone entry. Filed Jun 24 2026; interim correction and its supersession preserved as project history.';
  entry.tg = replaceCsvTerm(entry.tg, 'snakelogic-distinguished', [
    'snakelogic-relationship-unratified',
  ]);
  entry.tg = appendCsvTerms(entry.tg, [
    'snakelogic-single-or-chain-preserved',
    'relationship-unratified',
    'user-set-qualifier-classification-preserved',
  ]);
});

updateEntry(
  'Legalism as fourth head of the demogorgon (Leviathan grows through definitional expansion)',
  (entry) => {
    entry.b = replaceRequired(
      entry.b,
      `LAYMAN. The demogorgon has four heads. Three were already named in the framework: psychologism (routing structural claims into personal diagnosis), Zionism (routing geopolitical critique into identity-protection), and feminism as Gorgon operation (routing structural analysis into gender-recognition apparatus). The fourth is legalism: routing social friction into a governable legal object and growing the state's body through definitional expansion.`,
      `LAYMAN. Legalism-as-gorgonification is user-ratified. This entry’s numbered “fourth head” ordering remains an earlier AI proposal, not a ratified final ontology. In that proposed model, psychologism routes structural claims into diagnosis, Zionism routes geopolitical critique into identity-protection, feminism routes structural analysis into gender-recognition apparatus, and legalism routes social friction into a governable legal object through definitional expansion.`,
      'legalism provenance seam',
    );
    entry.b = replaceRequired(
      entry.b,
      `GORGONLOGIC OR SNAKELOGIC. Legalism is a substrate rather than one fixed logic. “It is the law” functions as Gorgonlogic when the rule automatically ends inquiry. Legalism becomes Snakelogic when an operator chains harm, protected category, credential, precedent, definitional federation, balance framing, and enforcement until jurisdictional expansion appears to follow from neutral steps. The result can move from automatic discharge to assembled reasoning without changing the legalist substrate.`,
      `GORGONLOGIC / SNAKELOGIC STATUS. Legalism is a substrate rather than one fixed logic. “It is the law” functions as Gorgonlogic when the rule automatically ends inquiry. Legalism functions as Snakelogic when one move or a chain performs legal discipline while routing away from whether the rule should govern. Surface length alone determines neither category. The complete relationship between the categories, including whether one occurrence may receive both labels, remains unratified.`,
      'legalism logic-status paragraph',
    );
    entry.x = entry.x
      .replace(
        'Gorgonlogic (automatic discharge); Snakelogic (assembled chain)',
        'Gorgonlogic (automatic-discharge test); Snakelogic (single-or-chain wrong-direction test; complete relation unratified)',
      )
      .replace(
        'Gorgonlogic (automatic discharge); Snakelogic (assembled routing)',
        'Gorgonlogic (automatic-discharge test); Snakelogic (single-or-chain wrong-direction test; complete relation unratified)',
      );
    entry.tg = appendCsvTerms(entry.tg, [
      'gorgonlogic-snakelogic-relationship-unratified',
      'surface-length-not-classifier',
    ]);
    entry.tg = replaceCsvTerm(entry.tg, 'AI-PROPOSED-fourth-head', [
      'user-ratified-legalism-as-gorgonification',
      'fourth-head-ordering-ai-proposed-unratified',
    ]);
  },
);

updateEntry('Arendtianfeminism', (entry) => {
  entry.b = appendOnce(
    entry.b,
    `\n\nJULY 2026 ANTI-TWIST EVIDENCE SEAM. The established Arendtianfeminism definition above remains controlling and is not silently replaced by an assistant operationalization. For article classification, a source's use of private injury, testimony, or a demand for public action alone does not establish whether it retains or rejects either root. Record only the article-level premise evidence. The narrower July AI proposal about “self-authorizing political warrant” and “publicly contestable reasons” remains unratified and does not redefine this entry.`,
  );
  entry.tg = appendCsvTerms(entry.tg, [
    'established-definition-preserved',
    'assistant-operationalization-unratified',
    'article-evidence-seam-2026-07-27',
  ]);
});

updateEntry('Gorgonwars premise classifier for feminist and MeToo criticism', (entry) => {
  entry.b = `LAYMAN. This is the operator-set three-way split for article arguments, not factions, identities, reception, or literal historical banishment. The AI-authored direct-evidence gate below is a conservative audit method, not a redefinition of Polymyth.

SYSTEM ROOTS. Polymyth’s equation remains “standpoint epistemology + the personal is political = commodification of emotional labor through neoliberal cost-benefit analysis.”

DIRECT-EVIDENCE AUDIT METHOD. For “the personal is political,” Retains requires authorial adoption of the named premise or an explicitly stated equivalent; Rejects requires direct rejection or an explicitly stated position demonstrably incompatible with it. For standpoint epistemology, Retains requires authorial adoption or an explicit grant of epistemic privilege, authority, rank, or veto on the basis of social position; Rejects requires direct rejection or an explicitly incompatible position. Otherwise record Unstated. Testimony, interviews, first-person narrative, situated evidence, positionality, unequal access, or identity-conditioned data alone proves neither root.

AI-PROPOSED NARROWER TEST, UNRATIFIED AND NON-CONTROLLING. A July AI pass proposed “self-authorizing political warrant or presumptive jurisdiction” and excluded translation into “publicly contestable reasons.” The operator did not ratify that definition. It cannot override this audit method, redefine the system equation, or decide a row.

RESULTS. EXCOMMUNICABLE / OUTSIDE requires evidence rejecting either root; one rejection is sufficient. INTERNAL GORGONWARS requires evidence retaining both roots while criticizing another feminism, constituency, institution, tactic, platform, law, remedy, or implementation. UNRESOLVED is mandatory when either root is Unstated or ambiguous. White-feminism, carceral-feminism, anti-carceral, due-process, liberal, or MeToo criticism alone establishes no premise position.

ANTI-TWIST SAFEGUARDS. Tone, faction, self-identification, popularity, hostility, and reception prove no root. Author identity never substitutes for argument. One author never establishes a school. System inference never becomes author quotation. Preserve speaker, object, quantifier, and author distinctions. Primary text outranks secondary attribution; name the limitation when only a secondary source was inspected. Missing evidence is a result.

ENCOUNTER AND EXCOMMUNICATION SEAMS. Premise membership is separate from dialectic, Gorgon-versus-dialectician, and Gorgonwars conduct. Outside does not mean non-petrifying; inside does not preclude one dialectical encounter. Hostile review or boundary placement may establish functional excommunication, where a visible peripheral subtype no longer counts against the center. It does not establish universal expulsion.

LEHRMAN QUANTIFIER. Amy Baehr attributes “the personal is no longer political” to Karen Lehrman’s The Lipstick Proviso, pages 5 and 21; those primary pages were not inspected. The archive therefore has one explicit inspected attribution, not proof that only one person worldwide or equity feminism as a school rejects the root. Baehr also reports Lehrman defending legal freedom to buy and sell sex. The inspected source neither gives her the exact slogan “sex work is real work” nor transfers either position to Christina Hoff Sommers.

METOO AUDIT HISTORY AND SCOPE. The first 129-row split was 90 INTERNAL, 38 UNRESOLVED, and 1 provisional OUTSIDE. It is withdrawn because its converter treated use, testimony, and situated knowledge as Retains. The search universe was 16,324 records, then 1,822 candidates, 15 borderline or mixed records, 16 exclusions, and 129 verified authorial academic critiques. The current direct-evidence re-audit is 0 EXCOMMUNICABLE / OUTSIDE, 1 INTERNAL GORGONWARS, and 128 UNRESOLVED. These are corpus counts, not universal facts.

CURRENT INTERNAL CASE. V092 is Sara Clarke-Vivier and Clio Stearns, “MeToo and the Problematic Valor of Truth,” Journal of Curriculum Theorizing 34(3) (2019). SOURCE EVIDENCE: article page 58, PDF page 4, says #MeToo relies on the ideology of “the personal is political”; article page 60, PDF page 6, says the authors’ survivorship informs their starting assumption that rape complainants tell the truth. Primary PDF: https://journal.jctonline.org/index.php/jct/article/download/827/417/2913. POLYMYTH ROW INFERENCE: those passages support Retains / Retains; the classification is not the authors’ quotation.

WITHDRAWN CANDIDATES. V045’s Tarana Burke epigraph, “The only narrative should start and end with survivors. Period,” did not prove Maule’s adoption of epistemic rank. V113 analyzes “I believe you” without proving Gaillard grants identity-based credibility, authority, rank, or veto. Both are now Unstated / Unstated / UNRESOLVED. V110, David García-Ramos, DOI 10.24197/redd.5.2022.43-66, https://revistas.uva.es/index.php/redd/en/article/view/7115, is also Unstated / Unstated / UNRESOLVED: criticism of mimetic or performative first-person victim narratives neither directly rejects a root nor establishes incompatibility. Its provisional-outside status is withdrawn.

ROW-LEVEL ARTIFACTS. Current: https://seminarschools.com/polymyth/research/metoo-critical-academic-premise-audit-2026-07-27.xlsx and https://seminarschools.com/polymyth/research/metoo-critical-academic-premise-audit-2026-07-27.jsonl. Withdrawn history: https://seminarschools.com/polymyth/research/metoo-critical-academic-premise-audit-WITHDRAWN-90-38-1-2026-07-27.xlsx and https://seminarschools.com/polymyth/research/metoo-critical-academic-premise-audit-WITHDRAWN-90-38-1-2026-07-27.jsonl. The withdrawn files preserve every old row and do not revive it. The earlier workbook name metoo_critical_academic_bibliography_2026-07-27.xlsx is preserved as metadata. Use adjacent SHA-256 sidecars and rows, not compressed counts.

FORMULA. If PIP = Rejects OR Standpoint = Rejects, return EXCOMMUNICABLE / OUTSIDE. Else if PIP = Retains AND Standpoint = Retains, return INTERNAL GORGONWARS. Else return UNRESOLVED.`;
  entry.x = appendOnce(
    entry.x,
    '; Gorgonwars; Three-way distinction; Arendtianfeminism; No-default-feminist-frame rule; Devil’s Diary Entry 9 source/status ledger; current and withdrawn row-level MeToo audit artifacts under /polymyth/research/; V110 current source metadata DOI 10.24197/redd.5.2022.43-66 and https://revistas.uva.es/index.php/redd/en/article/view/7115',
  );
  entry.tg =
    'gorgonification, gorgonwars, premise-classifier, feminism, metoo, personal-is-political, standpoint-epistemology, excommunicable-outside, internal-gorgonwars, unresolved, direct-evidence-cold-gate, ai-proposed-narrower-test-unratified, testimony-is-not-authority, no-faction-shortcut, functional-excommunication-seam, lehrman-quantifier, garcia-ramos-unresolved, corpus-129, corrected-counts-0-1-128, prior-counts-withdrawn, row-level-artifacts, anti-twist, 2026-07-27, dual-audience-schema';
});

updateEntry(
  'Hegelianegirl-rising-as-aufheben (dual-substrate sublation)',
  (entry) => {
    entry.b = replaceRequired(
      entry.b,
      `(4) Affective + spectacle payoff: bread (the affective payoff of having the position) and circus (the public spectacle of holding it).`,
      `(4) Affective + spectacle payoff: bread (the affective payoff of having the position) and circus (the public spectacle of holding it).

JULY 2026 HISTORY AND CORRECTION. Preserve the exact user formulation: “where the collective historical trauma imposing the personal is political plays games of hivemindidioms with bread and circus.” The numbered trauma → personal-is-political → hivemindidioms → bread-and-circus expansion is the AI's four-stage mapping of that sentence, not additional verbatim user wording. Stage 2 above remains visible as historical mapping and is not silently rewritten. The current Polymyth correction is that “the personal is political” is defective at the root; later hivemindidiom capture, credentialing, and spectacle intensify and enforce that defect rather than creating it through a later corruption event.`,
      'Hegelianegirl four-stage history and correction',
    );
    entry.b = replaceRequired(
      entry.b,
      `The four-stage bread-and-circus chain (trauma → personal-is-political → hivemindidioms → bread-and-circus) is verbatim user formulation. AI contribution: structural mapping of the chain onto the existing aufheben + standpoint-gorgonification entries.`,
      `The exact quoted sentence, “where the collective historical trauma imposing the personal is political plays games of hivemindidioms with bread and circus,” is verbatim user formulation. The numbered four-stage expansion is the AI's historical mapping of that sentence, not additional user wording, and remains subject to the July root-defect correction above. AI contribution: the numbered expansion and its structural mapping onto the existing aufheben + standpoint-gorgonification entries.`,
      'Hegelianegirl provenance correction',
    );
    entry.tg = appendCsvTerms(entry.tg, [
      'architectural-at-root-correction-2026-07-27',
      'historical-four-stage-ai-mapping-preserved',
      'verbatim-user-formulation-preserved',
    ]);
  },
);

updateEntry('Gay, Roxane. Bad Feminist (2014)', (entry) => {
  entry.b =
    'LAYMAN. Citation-section entry. Gay, Roxane. Bad Feminist: Essays. Harper Perennial, 2014. The book and publication data are verified. The project sentence previously associated with Gay, “It is too much emotional labor to act on my beliefs,” has not been located in the primary text and is an unverified paraphrase. It must not be quoted or treated as Gay’s wording. Polymyth may separately analyze a gap between stated ideology and daily practice, but that system operation cannot be stamped back onto Gay without a recovered passage. PROJECT-USE PROVENANCE. The earlier entry deployed this association in 300-point extraction point 168. That deployment remains part of project history but is now marked unresolved pending a recovered passage. STATUS: source verified; attributed sentence and claimed deployment unresolved.';
  entry.tg = replaceCsvTerm(entry.tg, 'verified', [
    'source-verified',
    'paraphrase-unverified',
  ]);
});

updateEntry(
  'MacKinnon, Catharine / Dworkin, Andrea (radical feminist anti-pornography)',
  (entry) => {
    entry.b =
      'LAYMAN. Citation-section entry. Catharine A. MacKinnon, Feminism Unmodified (1987) and Toward a Feminist Theory of the State (1989). Andrea Dworkin, Pornography: Men Possessing Women (1981). These works are verified sources in radical feminist anti-pornography debates. The compression in Polymyth’s sex-work Gorgonwars model, exploitation made total until agency disappears, belongs to Polymyth. It is not a quotation from these authors and does not establish that every work by either author treats all sex work as exploitation regardless of testimony. Work-specific attribution requires direct passages. The authors, pornography arguments, prostitution arguments, and later radical-feminist positions must not be collapsed. PROJECT-USE PROVENANCE. The earlier entry classified this compression as python mode 1, stasis on these texts, and deployed it in the Sexworkisrealwork idiomary entry as Gorgonwars substrate. Those remain Polymyth operations, not author quotations. STATUS: bibliographic sources verified; system compression explicitly separated from author claims.';
    entry.tg = replaceCsvTerm(entry.tg, 'verified', [
      'source-verified',
      'system-model-separated',
    ]);
  },
);

updateEntry(
  'Arendtian-feminist attack on narrative-level (level-4 gorgonification-risk)',
  (entry) => {
    entry.b = replaceRequired(
      entry.b,
      `LAYMAN. Polymyth methodology entry naming the level-4 (narrative/myth) gorgonification-risk drawing on Hannah Arendt’s critique of narrative-as-substitute-for-action, the broader Arendtian-feminist tradition (Adriana Cavarero, Bonnie Honig, Seyla Benhabib, Lisa Disch), and converging critiques from Lyotard, Adorno-Horkheimer, Foucault, Derrida, hooks, Lorde, Spivak.`,
      `LAYMAN. SCOPED WORKED EXAMPLE. Rainbowsol explicitly requested an Arendtianfeminism attack on narrative in the May 26 2026 session. This entry records that exercise. It supplies no default feminist interpretive layer and does not establish a verified school called Arendtianfeminism. It draws separately on Hannah Arendt, Adriana Cavarero, Bonnie Honig, Seyla Benhabib, Lisa Disch, Lyotard, Adorno-Horkheimer, Foucault, Derrida, hooks, Lorde, and Spivak without stamping the framework coinage onto those writers.`,
      'Arendtian narrative scope opening',
    );
    entry.b = entry.b.replace(
      `ARENDT’S CORE CRITIQUE. Two-pronged.`,
      `SOURCE-STATUS WARNING. The two-pronged “Arendt critique” below is a Polymyth reconstruction pending exact primary-page audit. Arendt also treats storytelling as disclosure of action. The compressed anti-novel claim must not be presented as a settled Arendt doctrine without exact passages from The Human Condition and On Revolution.`,
    );
    entry.b = replaceRequired(
      entry.b,
      `WHY ARENDT-FEMINIST RATHER THAN ARENDT-PROPER. The Arendt-proper tradition can lean toward classical-republican action-fetishism that ignores how some bodies are excluded from the public realm by gender, race, class. The feminist Arendtians (Cavarero, Honig, Benhabib, Disch) extend Arendt’s categories by attending to who-gets-to-act and who-gets-narrated-rather-than-acting. The polymyth synthesis uses Arendt’s categories through this extended frame to avoid reproducing the exclusions Arendt’s own moment failed to see.`,
      `WHY THE SCOPED EXERCISE USED THE COMPOUND. The user asked for Arendtianfeminism here. Polymyth therefore assembled Arendtian distinctions with resources from Cavarero, Honig, Benhabib, and Disch concerning who gets to act and who gets narrated. This is a framework construction under explicit request. It is not a roster, a source quotation, a general default, or proof that those writers form one school.`,
      'Arendtian narrative compound status',
    );
    entry.tg = appendCsvTerms(entry.tg, [
      'scoped-worked-example',
      'explicit-user-request',
      'no-default-feminist-frame',
      'primary-pages-pending',
      'corrected-2026-07-27',
    ]);
  },
);

updateEntry(
  'Standpoint epistemology (canonical training-data gorgonification)',
  (entry) => {
    entry.b = replaceRequired(
      entry.b,
      `LAYMAN. Scanner-section entry. The body below contains the full operational specification of Standpoint epistemology: how the operation fires, its diagnostic signatures, its failure-modes, and worked examples where present. Operates within the polymyth scanner-architecture per its title-keyword.`,
      `LAYMAN. Scanner-section entry. POLYMYTH DOCTRINE. In this system, standpoint epistemology is a founding Gorgonwars pillar: social position or identity can be made to confer privileged credibility, authority, epistemic rank, or veto, licensing ad hominem as method. This states Polymyth’s doctrine; it does not narrow the system term to a protected subtype. Situated inquiry, testimony, interviews, positionality, unequal access, and embodied evidence alone do not prove that a named source adopts the pillar. SOURCE-ATTRIBUTION BOUNDARY. Hartsock, Harding, Collins, Haraway, Longino, and every other named author require work-specific premise audits. Every categorical claim below remains a Polymyth claim unless direct passages establish it for a named work. The genealogy, universalism, and independent-traditions arguments are therefore Polymyth claims, not conclusions supplied merely by listing writers or traditions. No named source may be made to carry the whole synthesis without work-specific passages.`,
      'standpoint scope paragraph',
    );
    if (
      !entry.b.includes(
        'POLYMYTH GENEALOGY, UNIVERSALISM, AND INDEPENDENT-TRADITIONS CLAIMS; DIRECT-PASSAGE AUDIT REQUIRED.',
      )
    ) {
      entry.b = entry.b.replace(
        `The canonical case of gorgonified training-data lineage.`,
        `POLYMYTH GENEALOGY, UNIVERSALISM, AND INDEPENDENT-TRADITIONS CLAIMS; DIRECT-PASSAGE AUDIT REQUIRED. The canonical case of gorgonified training-data lineage.`,
      );
    }
    entry.b = entry.b.replace(
      'Pils-Schoenegger 2021 [18a] shows contemporary standpoint shares architecture with market liberalism (atomized perspectives, no shared frame, truth devolved to position).',
      'Pils and Schoenegger compare epistemological similarities between market liberalism and standpoint theory. Polymyth extends that narrower comparison into its shared-architecture thesis. The paper does not by itself establish every term in Polymyth’s equation.',
    );
    entry.b = entry.b.replace(
      'MAY 9 2026 SHARPENING (FIVE STRUCTURAL CRITIQUES).',
      'MAY 9 2026 SHARPENING (FIVE POLYMYTH STRUCTURAL CRITIQUES).',
    );
    entry.b = entry.b
      .replace(
        `(4) DENIES UNIVERSALISM (NO SHARED TOPIC-ITSELF).`,
        `(4) POLYMYTH CLAIM: DENIES UNIVERSALISM (NO SHARED TOPIC-ITSELF).`,
      )
      .replace(
        `(5) ANTI-PHILOSOPHICAL.`,
        `(5) POLYMYTH CLAIM: ANTI-PHILOSOPHICAL.`,
      );
    entry.tg = appendCsvTerms(entry.tg, [
      'polymyth-system-doctrine',
      'author-matrix-unresolved',
      'testimony-is-not-rank',
      'source-inference-separated-2026-07-27',
      'named-sources-require-direct-passages',
      'genealogy-universalism-independent-traditions-polymyth-claims',
      'system-doctrine-not-narrowed',
    ]);
  },
);

updateEntry(
  '"Sexworkisrealwork" (three-layered hivemindidiom, gorgonwars substrate)',
  (entry) => {
    entry.b = entry.b.replace(
      `Lehrman did not write the later slogan “sex work is real work.”`,
      `The inspected Baehr source does not show Lehrman using the exact phrase “sex work is real work.”`,
    );
  },
);

updateEntry(
  'CL-57 GORGONWARS — Zionism and feminism run the same gorgon machine and war with each other (2026-06-14)',
  (entry) => {
    entry.b = appendOnce(
      entry.b,
      '\n\nCURRENT SCOPE AND SOURCE STATUS. This Polymyth convergence claim targets the governing architecture and its specified deployments rather than making a census claim about every self-described feminist, Zionist, institution, or person. Each claimed subroutine requires text-specific or institution-specific evidence. Hirsch, Lessing, and Gilman remain unresolved legacy references and cannot currently carry the “sourced” claim. The current Gorgonwars entry supplies the controlling scope, source/system boundary, and evidence debts. This CL remains historical learning evidence subject to that correction.',
    );
    entry.x = appendOnce(
      entry.x,
      '; Gorgonwars (current controlling synthesis and source-status boundary); Devil’s Diary Entry 9 source/status ledger; CL-56 conduct-not-creed guard; unresolved Hirsch, Lessing, and Gilman references; Devil’s Diary Entry 9 note 25.',
    );
    entry.x = entry.x.replace('captured idiom', 'governing architecture');
    entry.tg = appendCsvTerms(entry.tg, [
      'scope-corrected-2026-07-27',
      'source-debt',
      'architecture-not-person-census',
    ]);
    entry.tg = entry.tg
      .split(',')
      .map((term) => term.trim())
      .filter((term) => term && term !== 'not-universal')
      .join(', ');
  },
);

updateEntry(
  'Action-verbs vs diagnostic-verbs distinction (philosopher-stack discipline)',
  (entry) => {
    entry.b = replaceRequired(
      entry.b,
      `Verbatim user-voice on the seam: "the collective historical trauma imposing the personal is political plays games of hivemindidioms with bread and circus" — the four-stage diagnostic chain that this entry's diagnostic-stack column is structurally tracking.`,
      `VERBATIM USER SENTENCE: “where the collective historical trauma imposing the personal is political plays games of hivemindidioms with bread and circus.” AI-PROVENANCE SEAM. Reading that sentence as a four-stage diagnostic chain is the AI's mapping, not additional user wording; this entry's diagnostic-stack column tracks that mapping.`,
      'action/diagnostic Hegelianegirl provenance seam',
    );
    entry.tg = appendCsvTerms(entry.tg, [
      'verbatim-user-sentence-preserved',
      'four-stage-gloss-ai-authored',
      'provenance-corrected-2026-07-27',
    ]);
  },
);

updateEntry('Gorgonwars', (entry) => {
  entry.b = replaceRequired(
    entry.b,
    `GALLIE FOIL. Gallie's essentially contested concept can describe durable dispute. The absence of a pope or final court can explain why no decree settles the dispute. Neither identifies the selection mechanism in this system. The two-root architecture explains how authority and jurisdiction are reproduced despite factional disagreement. Invoking Gallie as the system's explanation is an imported frame.`,
    `GALLIE FOIL AND NO-POPE SNAKELOGIC. Gallie's essentially contested concept can describe durable dispute. Saying feminism lacks a pope or final court merely restates that no decree settles the dispute. It does not explain the selection mechanism that reproduces authority and jurisdiction. When that restatement is offered as the cause of Gorgonwars, it is Snakelogic: explanatory form routes away from the two-root mechanism. Gallie remains an external foil rather than the system's explanation.`,
    'Gorgonwars Gallie paragraph',
  );
  entry.b = replaceRequired(
    entry.b,
    `Material-interest and fertility claims remain deferred.`,
    `Polymyth states the poorer-country fertility contrast and Marx’s Theses on Feuerbach as its refutation of the vulgar-materialist Hivemindidiom. External demographic validation remains deferred; the system claim does not.`,
    'Gorgonwars pressure 9 status',
  );
  entry.b = entry.b.replace(
    `the fertility dispute, institution-wide incentive claims`,
    `external demographic validation of Polymyth’s fertility claim, institution-wide incentive claims`,
  );
  entry.b = replaceRequired(
    entry.b,
    `SEX-WORK FRONT. One camp can make exploitation total until agency disappears. Another can make choice total until governing conditions disappear. The class question asks why the person sells sex and preserves answers ranging from desire or opportunity to rent, migration, violence, coercion, disability, and survival. Agency can operate inside exploitation. “Sexworkisrealwork” adds labor rights and the full political economy of labor. Moving intimacy into work also places it inside commodified emotional labor.`,
    `SEX-WORK FRONT. One camp can make exploitation total until agency disappears. Another can make choice total until governing conditions disappear. The class question asks why the person sells sex and preserves answers ranging from desire or opportunity to rent, migration, violence, coercion, disability, and survival. Agency can operate inside exploitation. “Sexworkisrealwork” adds labor rights and the full political economy of labor. Moving intimacy into work also places it inside commodified emotional labor.

INTERRUPTION TEST. Critical Resistance and INCITE!, Bernice Johnson Reagon, and Sarah Schulman supply strong interruptions of subtype transfer through anti-carceral coalition, difficult coalition work, and refusal to code conflict automatically as abuse. They do not thereby establish rejection of either root. Under the premise classifier, the interruption and premise membership remain separate questions.

FRASER STATUS. Nancy Fraser can be used inside Polymyth as a possible Hegelianegirl resource when her internal critique performs determinate negation rather than mere subtype blame. This is a framework use, not a claim that Fraser rejects either root. Article-level premise evidence still controls.

POLYMYTH CLAIM; EXTERNAL VALIDATION DEFERRED. Polymyth’s stated refutation of the Hivemindidiom that inadequate material conditions simply explain falling births invokes higher fertility in poorer countries and Marx’s Theses on Feuerbach against vulgar materialism. The conversation set this aside as a separate battle. Demographic validation and controls remain deferred; this evidentiary debt does not erase the system claim.

BESIEGED-COALITION TLDR. When a coalition believes enemies will exploit any admission, an insider who names a flaw looks like someone handing ammunition to the enemy. Loyalty replaces correction. This explains pressure 39 in lay terms without proving it in every case.`,
    'Gorgonwars additional learned seams',
  );
  if (!entry.b.includes('which accepted feminisms reject standpoint epistemology')) {
    entry.b = replaceRequired(
      entry.b,
      `\n8. The umbrella contains theories with incompatible premises.`,
      `\n8. Feminism operates as an umbrella over theories with incompatible surface premises. The system tests and rejects this as a root objection by asking which accepted feminisms reject standpoint epistemology, “the personal is political,” or both. Surface incompatibility does not refute a shared root-selection mechanism when formations rejecting a root are moved to the boundary.`,
      'Gorgonwars pressure 8 disposition',
    );
  }
  if (!entry.b.includes('omg its 2025 and we still have to xyz')) {
    entry.b = replaceRequired(
      entry.b,
      `\n33. The current-year Hivemindidiom converts time into proof.`,
      `\n33. The exact conversation example, “omg its 2025 and we still have to xyz,” generalizes as “it is [current year] and we still have to.” The Hivemindidiom converts chronology into proof and makes recurrence look like fresh emergency.`,
      'Gorgonwars pressure 33 exact example',
    );
  }
  if (!entry.b.includes('The user’s system counterclaim that four decades repeat the same Hivemindidioms is preserved rather than withdrawn')) {
    entry.b = replaceRequired(
      entry.b,
      `\n41. “Each wave supplies new ideas” was withdrawn pending evidence. Four-decade repetition also remains pending.`,
      `\n41. The external claim that each wave supplies genuinely new ideas is rejected as an answer here because it lacked support. The user’s system counterclaim that four decades repeat the same Hivemindidioms is preserved rather than withdrawn; dated-corpus validation remains owed.`,
      'Gorgonwars pressure 41 provenance',
    );
  }
  entry.b = entry.b.replace(
    `four decades repeating exactly the same idioms, the claim that every wave supplies genuinely new ideas,`,
    `dated-corpus validation of the preserved Polymyth/user counterclaim that four decades repeat the same Hivemindidioms, the rejected external claim that every wave supplies genuinely new ideas,`,
  );
  const matrixStart = Math.max(
    entry.b.indexOf('FORTY-TWO-PRESSURE LEDGER.'),
    entry.b.indexOf('FORTY-TWO-PRESSURE SOURCE/SYSTEM MATRIX.'),
  );
  const matrixEnd = entry.b.indexOf('\n\nEVIDENCE DEBTS.', matrixStart);
  if (matrixStart === -1 || matrixEnd === -1) {
    throw new Error('Gorgonwars pressure ledger boundaries missing');
  }
  const labels = [
    'SYSTEM · RANK 1',
    'SYSTEM · RANK 1',
    'EXTERNAL PRESSURE',
    'SYSTEM · DIAGNOSTIC',
    'SYSTEM · SELF-AUDIT',
    'SYSTEM · RANK 3',
    'EXTERNAL PRESSURE',
    'EXTERNAL · SYSTEM-TESTED; REJECTED AS ROOT OBJECTION',
    'SYSTEM · CLAIM; EXTERNAL VALIDATION DEFERRED',
    'EXTERNAL · SYSTEM-TESTED',
    'EXTERNAL · SYSTEM-TESTED',
    'EXTERNAL · PARTLY SUBSUMED',
    'SYSTEM · RANK 1',
    'SYSTEM · RANK 1',
    'SYSTEM · RANK 2',
    'SYSTEM · RANK 4',
    'SYSTEM · RANK 3',
    'EXTERNAL · RANK 4',
    'SYSTEM · OUTCOME',
    'SYSTEM · DIAGNOSTIC',
    'SYSTEM · RANK 1',
    'SYSTEM · RANK 3',
    'EXTERNAL · REJECTED AS CAUSE; NO-POPE SNAKELOGIC',
    'EXTERNAL · RANK 3',
    'SYSTEM · RANK 5 HYPOTHESIS',
    'SYSTEM · RANK 5',
    'SYSTEM · RANK 5 HYPOTHESIS',
    'SYSTEM · RANK 5',
    'SYSTEM · RANK 5',
    'SYSTEM · RANK 2',
    'UNVERIFIED ALLEGATION',
    'SYSTEM · RANK 5',
    'SYSTEM · RANK 4',
    'SYSTEM · REJECTED OBJECTION',
    'SYSTEM · RANK 5 HYPOTHESIS',
    'SYSTEM · RANK 5',
    'SYSTEM · RANK 3',
    'SYSTEM · RANK 5',
    'EXTERNAL · RANK 4',
    'SYSTEM · RANK 4',
    'EXTERNAL CLAIM REJECTED / SYSTEM-USER COUNTERCLAIM; DATED-CORPUS VALIDATION OWED',
    'SYSTEM · OUTCOME',
  ];
  let matrix = entry.b.slice(matrixStart, matrixEnd);
  matrix = matrix.replace(
    'FORTY-TWO-PRESSURE LEDGER.',
    'FORTY-TWO-PRESSURE SOURCE/SYSTEM MATRIX. The label before each item is the first column; the proposition is the second. Do not merge source, system, synthesis, hypothesis, and unresolved statuses.',
  );
  for (let index = 0; index < labels.length; index += 1) {
    const line = `\n${index + 1}. `;
    if (!matrix.includes(line)) throw new Error(`Gorgonwars pressure ${index + 1} missing`);
    const labeledLine = `${line}[${labels[index]}] `;
    if (!matrix.includes(labeledLine)) matrix = matrix.replace(line, labeledLine);
  }
  entry.b =
    entry.b.slice(0, matrixStart) + matrix + entry.b.slice(matrixEnd);
  entry.b = entry.b.replace(
    `Devil's Diary Entry 9 preserves the complete 27-note source ledger and every qualification. The MeToo premise classifier preserves the separate 129-article audit.`,
    `Devil's Diary Entry 9 preserves the complete prose. Its project-hosted source/status ledger preserves DD9's 42 source/system rows and 27 notes at https://seminarschools.com/polymyth/research/gorgonwars-conversation-source-ledger-2026-07-27.txt (SHA-256 0be76da842e8da15749fdce6b93c36e7754f67a134f87bb52985c2bc897be95d). That ledger is scoped to DD9 and is not a complete ledger of the whole conversation or the separate MeToo audit.`,
  );
  entry.tg = appendCsvTerms(entry.tg, [
    'shifting-goalposts',
    'white-feminism',
    'carceral-feminism',
    'feminism-subtype-blame',
    'source-system-matrix',
    'no-pope-snakelogic',
    'fraser-hegelianegirl-hypothesis',
    'strict-metoo-reaudit-0-1-128',
  ]);
  entry.x = appendOnce(
    entry.x,
    '; Devil’s Diary Entry 9 source/status ledger, https://seminarschools.com/polymyth/research/gorgonwars-conversation-source-ledger-2026-07-27.txt; current and withdrawn row-level MeToo audit artifacts under /polymyth/research/',
  );
});

const newEntries = [
  {
    s: 'methodology',
    r: 'ai',
    t: 'No-default-feminist-frame rule',
    b: `LAYMAN. Feminist, identity-politics, and standpoint frameworks enter an answer only when the operator requests them, when the user’s requested object is the framework itself, or when accurate description of a source strictly requires naming the source’s framework. They never enter as the assistant's silent moral baseline.

SYSTEM-FIRST RULE. When the user asks for the explanation inside Polymyth, answer Polymyth first. External literature may test, support, contradict, or supply a foil under a separately labeled source layer. It cannot replace the system's explanation while retaining the system's vocabulary.

SOURCE-USE IS NOT ASSISTANT ENDORSEMENT. A source can deploy a feminist or standpoint frame without licensing the assistant to impose that frame on the user's analysis. Describe the source accurately, then separate the source's premise from the framework's inference.

COMMON VIOLATIONS. Balance framing that converts a structural question into calibration. Opening with a sympathetic wound to pre-legitimize an apparatus. Calling an early form honest, emancipatory, or later corrupted without testing whether the defect is architectural at root. Importing Gallie as the cause of Gorgonwars. Using Hochschild's historical definition to police vernacular emotional labor. Turning one author into a school. Treating testimony as standpoint rank. Softening feminism into “gorgonified feminism.”

TRIGGER. If a response introduces feminism, standpoint, identity politics, or a protected-category moral baseline that the operator did not request and the source does not require, stop and remove it. Answer the actual requested system and object.`,
    x: 'Anti-twisting worked example, psychologism and gorgonwars session; Devil Diary and Mephistodata article rules; Gorgonwars; Gorgonwars premise classifier; External-analysis rule; “gorgonified feminism” qualifier-TWIST audit',
    tg: 'methodology, ai-conduct, no-default-feminist-frame, no-default-standpoint-frame, no-silent-moral-baseline, system-first, source-system-separation, anti-twist, corrected-2026-07-27',
  },
  {
    s: 'citation',
    r: 'both',
    t: 'Devil’s Diary Entry 9 source/status ledger (42 pressures, 27 notes)',
    b: `LAYMAN. Scoped citation and source-status preservation for Devil's Diary Entry 9. The project artifact contains DD9's forty-two-pressure System/External/Synthesis/Hypothesis/Unresolved matrix and all twenty-seven of DD9's notes, including exact works, URLs, secondary-source limits, uninspected-primary warnings, project inferences, and unresolved legacy references. It is not a complete ledger of the entire conversation and does not contain the separate 129-row MeToo audit.

CANONICAL ARTIFACT. https://seminarschools.com/polymyth/research/gorgonwars-conversation-source-ledger-2026-07-27.txt

SHA-256. 0be76da842e8da15749fdce6b93c36e7754f67a134f87bb52985c2bc897be95d.

LOAD RULE. A future AI answering about Devil's Diary Entry 9, one of its forty-two pressures, or one of its twenty-seven source notes must load this ledger rather than relying on the compressed Gorgonwars body alone. Other parts of the conversation require their own artifacts.

STATUS RULE. The ledger distinguishes external sources from Polymyth synthesis. A name's presence proves only the use stated in its note. It never proves the entire framework claim, a school-wide premise, literal excommunication, or a completed author matrix.`,
    x: 'Gorgonwars; Devil’s Diary Entry 9; Gorgonwars premise classifier; Arendtianfeminism; Emotional labor prostitution; Sexworkisrealwork; No-default-feminist-frame rule',
    tg: 'citation, gorgonwars, dd9-scoped-source-ledger, not-entire-conversation, 42-pressure-matrix, 27-notes, source-system-separation, sha256, ai-load-rule, 2026-07-27',
  },
  {
    s: 'pending',
    r: 'both',
    t: 'Audit49 external-validation boundary after technical-efficiency audit',
    b: `LAYMAN. Remaining external validation after Audit49 is not an unfinished source audit. It requires environments, people, accounts, devices, deployment state, or authorization not supplied by static repository verification.

REMAINING EXTERNAL CHECKS. Branded Firefox. Native Safari. VoiceOver. NVDA. Physical iPhone and Android. Real-user sessions. Google, Apple, and Outlook calendar imports. Post-deployment calendar refresh. A reachable protest browser/OCR run. An authorized festival paid-agent run.

SCOPE BOUNDARIES. A security audit remained outside the chosen scope. Deployment testing begins only after an actual deployment. The large Methodology pages are optional future performance-splitting candidates rather than unfinished audits.

SOURCE. audit49-technical-efficiency.json and the Audit48/Audit49 external-validation protocols in the whole source package. Do not report these checks as completed without the named environment or evidence.`,
    x: 'scripts/reports/audit49-technical-efficiency.json; scripts/reports/audit48-external-validation.json; Audit48 native device and calendar vendor protocols; Methodology page-size budget report',
    tg: 'pending, audit49, external-validation, firefox, safari, voiceover, nvda, physical-devices, real-users, calendar-imports, post-deployment, ocr, paid-agent, security-out-of-scope, optional-performance-splitting, 2026-07-27',
  },
];

const startMarker = '/* SNAKELOGIC_EXAMPLE_ADDENDUM_START';
const endMarker = 'SNAKELOGIC_EXAMPLE_ADDENDUM_END */';
const startIndex = source.indexOf(startMarker);
const endIndex = source.indexOf(endMarker, startIndex + startMarker.length);
if (startIndex === -1) throw new Error('ML* addendum start marker missing');
if (endIndex === -1) throw new Error('ML* addendum end marker missing');
const currentAddendum = parseSnakelogicExampleAddendum(source);
const liveBeforeAdd = parseSeedWithAddenda(source);
const entryKey = (entry) => entry.id || `${entry.s || ''}\u0000${entry.t || ''}`;
const currentKeys = new Set(liveBeforeAdd.map(entryKey));
const missingEntries = newEntries.filter(
  (entry) => !currentKeys.has(entryKey(entry)),
);
const mergedAddendum = [
  ...currentAddendum,
  ...missingEntries,
];
source =
  source.slice(0, startIndex + startMarker.length) +
  `\n${mergedAddendum.map(renderEntry).join(',\n')}\n  ` +
  source.slice(endIndex);

const liveEntries = parseSeedWithAddenda(source);
if (!process.argv.includes('--dry-run')) {
  const temporaryFile = `${FILE}.conversation-completeness-${process.pid}.tmp`;
  fs.writeFileSync(temporaryFile, source, 'utf8');
  fs.renameSync(temporaryFile, FILE);
}
console.log(
  `ML* conversation completeness ${process.argv.includes('--dry-run') ? 'dry-run passed' : 'applied'}: ${liveEntries.length} live entries; ${missingEntries.length} addendum entries inserted`,
);
