import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const checkout = resolve(import.meta.dirname, "..");
const isManagedCheckout = existsSync(resolve(checkout, "app/globals.css"));
const packagedInput = resolve(
  checkout,
  isManagedCheckout ? "source-site-greenpeace-base/data" : "data",
  "polymyth-commons-book-backbone.xlsx.inspect.ndjson",
);
const input =
  process.argv[2] ??
  packagedInput;
const sourceSite = resolve(
  checkout,
  process.argv[3] ?? (isManagedCheckout ? "source-site-greenpeace-base" : "."),
);

const tableLines = readFileSync(input, "utf8")
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line))
  .filter((entry) => entry.kind === "table");

const tables = new Map(tableLines.map((table) => [table.sheet, table.values]));

function rowsFor(sheet) {
  const values = tables.get(sheet);
  if (!values) throw new Error(`Missing workbook table: ${sheet}`);
  const headers = values[4].map((value) => String(value ?? "").trim());
  return values.slice(5).map((row) =>
    Object.fromEntries(
      headers.map((header, index) => [header, String(row[index] ?? "").trim()]),
    ),
  );
}

function splitPipe(value) {
  return value
    ? value
        .split(/\s*(?:\||;)\s*/)
        .map((part) => part.trim())
        .filter(Boolean)
    : [];
}

function splitLines(value) {
  return value
    ? value
        .split(/\r?\n/)
        .map((part) => part.trim())
        .filter(Boolean)
    : [];
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function scopeFor(candidateTier) {
  if (candidateTier === "Support node") return "Supporting Ecosystem";
  if (candidateTier === "Context / analogy")
    return "Concepts and Comparisons";
  return "Commons Projects";
}

const mentions = rowsFor("Book Mentions").map((row) => ({
  id: row["Record ID"],
  canonicalName: row["Canonical Name"],
  aliases: splitPipe(row["Aliases as Printed"]),
  category: row["Category"],
  relation: row["Relation Status"],
  bookPortrayal: row["Book Portrayal"],
  printedPages: row["Printed Pages"],
  chapterNumber: row["Chapter No."],
  chapterTitle: row["Chapter Title"],
  evidenceLocation: row["Evidence Location"],
  sourceGroundedRole: row["Source-Grounded Role"],
  bookPrintedUrl: row["Book-Printed URL"],
}));

const mentionsByName = Map.groupBy(mentions, (mention) => mention.canonicalName);

const projects = rowsFor("Project Index").map((row) => ({
  id: row["Project ID"],
  canonicalName: row["Canonical Name"],
  aliases: splitPipe(row["Aliases as Printed"]),
  candidateTier: row["Candidate Tier"],
  scope: scopeFor(row["Candidate Tier"]),
  bookRelations: splitPipe(row["Book Relation(s)"]),
  bookCategories: splitPipe(row["Book Category/Categories"]),
  bookPortrayal: row["Book Portrayal"],
  mentionCount: number(row["Mention Count"]),
  chapters: splitPipe(row["Chapters"]),
  printedPageReferences: row["Printed Page References"],
  bookPrintedUrls: splitLines(row["Book-Printed URL(s)"]),
  sourceGroundedRoles: splitPipe(row["Source-Grounded Role(s)"]),
  currentStatusGroup: row["Current Status Group"],
  detailedStatus: row["Detailed 2026 Status"],
  currentCanonicalUrl: row["Current Canonical URL"],
  currentOperator: row["Current Operator / Parent"],
  currentStatusEvidence: row["Current Status Evidence"],
  verified: row["Verified"],
  confidence: row["Confidence"],
  verificationSourceUrls: splitLines(row["Verification Source URL(s)"]),
  discoveryGeneration: row["Discovery Generation"] || "0",
  directoryDecision: row["Directory Decision"],
  editorialNotes: row["Editorial Notes"],
  mentions: mentionsByName.get(row["Canonical Name"]) ?? [],
}));

function normalizedName(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const projectIdByName = new Map();
for (const project of projects) {
  projectIdByName.set(normalizedName(project.canonicalName), project.id);
}
for (const project of projects) {
  for (const alias of project.aliases) {
    const normalizedAlias = normalizedName(alias);
    if (!projectIdByName.has(normalizedAlias)) {
      projectIdByName.set(normalizedAlias, project.id);
    }
  }
}
for (const mention of mentions) {
  mention.projectId = projectIdByName.get(normalizedName(mention.canonicalName)) ?? "";
}

const bookLinks = rowsFor("Book Links").map((row) => ({
  id: row["Link ID"],
  printed: row["Printed URL / Domain"],
  normalized: row["Normalized URL / Domain"],
  host: row["Host"],
  nearbyProject: row["Nearby Project / Organization"],
  contextClassifications: splitPipe(row["Context Classification"]),
  occurrenceCount: number(row["Occurrence Count"]),
  printedPages: row["Printed Page(s)"],
  pdfPages: row["PDF Page(s)"],
  chapters: splitPipe(row["Chapter(s)"]),
  representativeText: row["Representative Nearby Text"],
  extractionStatus: row["Extraction Status"],
  directoryDecision: row["Directory Decision"],
  currentResolutionStatus: row["Current Resolution Status"],
  currentUrl: row["Current URL"],
  editorialNotes: row["Editorial Notes"],
}));

const linkOccurrences = rowsFor("Link Occurrences").map((row) => ({
  id: row["Occurrence ID"],
  printed: row["Printed URL / Domain"],
  normalized: row["Normalized URL / Domain"],
  host: row["Host"],
  pdfPageStart: row["PDF Page Start"],
  pdfPageEnd: row["PDF Page End"],
  printedPage: row["Printed Page"],
  chapter: row["Chapter"],
  nearbyProject: row["Nearby Project / Organization"],
  contextClassification: row["Context Classification"],
  nearbyText: row["Nearby Text"],
  sourceLineIndex: row["Source Line Index"],
}));

const commonsForms = rowsFor("Commons Forms").map((row) => ({
  id: row["Type ID"],
  family: row["Type Family"],
  name: row["Type Name"],
  directoryRole: row["Directory Role"],
  definition: row["Definition"],
  bookChapters: row["Book Chapter(s)"],
  printedPages: row["Printed Page(s)"],
}));

const projectTypes = rowsFor("Book Project Types").map((row) => ({
  id: row["Type ID"],
  name: row["Canonical Type"],
  family: row["Type Family"],
  bookFunction: row["Book Function"],
  printedPages: row["Printed Pages"],
  chapters: row["Chapters"],
  sourceGroundedScope: row["Source-Grounded Scope"],
  representativeEntries: splitPipe(row["Representative Named Entries"]),
}));

const currentStatuses = rowsFor("Current Status").map((row) => ({
  id: row["Status ID"],
  projectId: projectIdByName.get(normalizedName(row["Book Seed"])) ?? "",
  bookSeed: row["Book Seed"],
  bookEraUrl: row["Book-Era URL"],
  statusGroup: row["Status Group"],
  detailedStatus: row["Detailed Status"],
  currentCanonicalUrl: row["Current Canonical URL"],
  operator: row["Operator / Parent"],
  statusDetail: row["Status Detail"],
  continuityNote: row["Move / Successor / Archive Note"],
  officialSourceUrls: splitLines(row["Official Source URL(s)"]),
  verified: row["Verified"],
  confidence: row["Confidence"],
}));

const relationships = rowsFor("Relationships").map((row) => ({
  id: row["Relationship ID"],
  type: row["Relationship Type"],
  family: row["Family"],
  bookBasis: row["Book Basis"],
}));

const collectionBlueprints = [
  {
    id: "ostrom-seeds",
    eyebrow: "Closest to the backbone",
    label: "Ostrom direct seeds",
    title: "Ostrom direct seeds",
    description:
      "Records marked as core directory candidates during the chapter-by-chapter audit.",
    href:
      "/polymythlib?scope=All%20Book%20Records&tier=Core%20candidate&research=1",
    selection: {
      kind: "field",
      rule: "Candidate tier equals Core candidate.",
      field: "candidateTier",
      value: "Core candidate",
    },
  },
  {
    id: "library",
    eyebrow: "Find a place to search",
    label: "Libraries and repositories",
    title: "Libraries, archives, repositories, and portals",
    description:
      "Discovery and stewardship projects across scholarly, civic, cultural, and disciplinary knowledge.",
    href: "/polymythlib?scope=All%20Book%20Records&quick=library",
    showAsQuick: true,
    selection: {
      kind: "terms",
      rule:
        "A library, archive, repository, portal, catalogue, collection, registry, bibliography, or directory appears in the project name, normalized book type, or source-grounded role.",
      fields: [
        "canonicalName",
        "aliases",
        "bookCategories",
        "sourceGroundedRoles",
      ],
      pattern:
        "\\b(?:libraries?|librarians?|archives?|archival|repositories?|portal(?:s)?|catalog(?:ue)?s?|collections?|registr(?:y|ies)|bibliograph(?:y|ies|ic)|directories?)\\b",
      anchorProjectIds: ["PC-0083", "PC-0171", "PC-0207"],
    },
  },
  {
    id: "open-access",
    eyebrow: "Scholarly communication",
    label: "Open access",
    title: "Open access, journals, and self-archiving",
    description:
      "Projects, declarations, policies, publishers, and institutions that changed how scholarship circulates.",
    href: "/polymythlib?scope=All%20Book%20Records&quick=open-access",
    showAsQuick: true,
    selection: {
      kind: "terms",
      rule:
        "Open access, self-archiving, scholarly communication, journal, publisher, or repository language appears in the project name, normalized book type, or source-grounded role.",
      fields: [
        "canonicalName",
        "aliases",
        "bookCategories",
        "sourceGroundedRoles",
      ],
      pattern:
        "\\b(?:open[\\s-]?access|self[\\s-]?archiv(?:e|ing)|scholarly communication|journals?|publishers?|repositories?)\\b",
      anchorProjectIds: ["PC-0022", "PC-0039", "PC-0263"],
    },
  },
  {
    id: "preservation",
    eyebrow: "Long memory",
    label: "Archives and preservation",
    title: "Archives and preservation",
    description:
      "Projects concerned with repositories, durable access, deposits, archives, and continuity of the record.",
    href: "/polymythlib?scope=All%20Book%20Records&quick=preservation",
    showAsQuick: true,
    selection: {
      kind: "terms",
      rule:
        "Archive, preservation, repository, deposit, durable-access, mirror, or read-only language appears in the project name, normalized book type, or source-grounded role.",
      fields: [
        "canonicalName",
        "aliases",
        "bookCategories",
        "sourceGroundedRoles",
      ],
      pattern:
        "\\b(?:archives?|archival|preserv(?:e|es|ed|ing|ation)|repositories?|deposits?|durable access|mirrors?|read[\\s-]?only)\\b",
      anchorProjectIds: ["PC-0179", "PC-0251", "PC-0174"],
    },
  },
  {
    id: "community",
    eyebrow: "Public knowledge",
    label: "Community and civic knowledge",
    title: "Community, civic, and participatory commons",
    description:
      "Public information, local knowledge, citizen contribution, media, and community-governed work.",
    href: "/polymythlib?scope=All%20Book%20Records&quick=community",
    showAsQuick: true,
    selection: {
      kind: "terms",
      rule:
        "Community, civic, citizen, participatory, public-information, local-knowledge, or deliberative language appears in the project name, normalized book type, or source-grounded role.",
      fields: [
        "canonicalName",
        "aliases",
        "bookCategories",
        "sourceGroundedRoles",
      ],
      pattern:
        "\\b(?:communit(?:y|ies)|civic|citizen(?:s)?|participatory|public information|local knowledge|deliberative|public-interest|university-community)\\b",
      anchorProjectIds: ["PC-0254", "PC-0300", "PC-0265"],
    },
  },
  {
    id: "infrastructure",
    eyebrow: "What makes sharing possible",
    label: "Standards and infrastructure",
    title: "Standards, software, protocols, and infrastructure",
    description:
      "Technical and institutional systems that help separate projects discover, exchange, and preserve knowledge.",
    href: "/polymythlib?scope=All%20Book%20Records&quick=infrastructure",
    showAsQuick: true,
    selection: {
      kind: "terms",
      rule:
        "Standard, protocol, interoperability, metadata, software, API, harvesting, federation, platform, or infrastructure language appears in the project name, normalized book type, or source-grounded role.",
      fields: [
        "canonicalName",
        "aliases",
        "bookCategories",
        "sourceGroundedRoles",
      ],
      pattern:
        "\\b(?:standards?|protocols?|interoperab(?:ility|le)|metadata|software|application programming interface|api|harvest(?:ing|er)?|federat(?:ed|ion)|platforms?|infrastructure)\\b",
      anchorProjectIds: ["PC-0090", "PC-0227", "PC-0095"],
    },
  },
  {
    id: "concepts",
    eyebrow: "Book boundaries",
    label: "Concepts and comparisons",
    title: "Concepts, comparisons, and enclosure cases",
    description:
      "Commercial systems, legal disputes, and natural-resource analogies used to clarify the boundary of a knowledge commons.",
    href: "/polymythlib?scope=Concepts%20and%20Comparisons",
    selection: {
      kind: "field",
      rule: "Directory scope equals Concepts and Comparisons.",
      field: "scope",
      value: "Concepts and Comparisons",
    },
  },
  {
    id: "verified",
    eyebrow: "Verification sample",
    label: "Current state checked",
    title: "Current state checked",
    description:
      "A bounded group with a reviewed destination, verification date, evidence, and confidence field.",
    href:
      "/polymythlib?scope=All%20Book%20Records&status=verified",
    selection: {
      kind: "present",
      rule: "The current-state verification date field is present.",
      field: "verified",
    },
  },
];

function collectionText(project, fields) {
  return fields
    .flatMap((field) => {
      const value = project[field];
      return Array.isArray(value) ? value : [value];
    })
    .filter(Boolean)
    .join(" ");
}

const collections = collectionBlueprints.map((collection) => {
  const { selection } = collection;
  const matcher =
    selection.kind === "terms"
      ? new RegExp(selection.pattern, "i")
      : null;
  const anchors = new Set(selection.anchorProjectIds ?? []);
  const members = projects
    .filter((project) => {
      if (selection.kind === "field") {
        return project[selection.field] === selection.value;
      }
      if (selection.kind === "present") {
        return Boolean(project[selection.field]);
      }
      return (
        anchors.has(project.id) ||
        matcher.test(collectionText(project, selection.fields))
      );
    })
    .map((project) => project.id);
  return {
    ...collection,
    version: "2026-07-28.g0.3",
    count: members.length,
    members,
  };
});

const expansionValues = tables.get("Expansion Logic");
const expansionStages = expansionValues
  .slice(5, 12)
  .filter((row) => String(row[0] ?? "").startsWith("Round "))
  .map((row) => ({
    stage: String(row[0] ?? ""),
    focus: String(row[1] ?? ""),
    rule: String(row[2] ?? ""),
  }));

const expansionEvidence = expansionValues
  .slice(5, 11)
  .filter((row) => row[4] && row[5])
  .map((row) => ({
    rank: number(row[4]),
    evidenceSource: String(row[5]),
  }));

const nodeClasses = expansionValues
  .slice(15, 25)
  .filter((row) => row[0] && row[1])
  .map((row) => ({
    nodeClass: String(row[0]),
    purpose: String(row[1]),
    requiredProvenance: String(row[2] ?? ""),
  }));

const discoveryGenerations = expansionValues
  .slice(15, 19)
  .filter((row) => row[4] !== null && row[5] && row[6])
  .map((row) => ({
    generation: String(row[4]),
    layer: String(row[5]),
    meaning: String(row[6]),
  }));

const countsByTier = Object.fromEntries(
  Object.entries(Object.groupBy(projects, (project) => project.candidateTier)).map(
    ([tier, entries]) => [tier, entries.length],
  ),
);

const payload = {
  schemaVersion: "1.0.0",
  release: "2026-07-28.g0.3",
  generated: "2026-07-28",
  title: "Polymyth Commons — Ostrom Book Backbone",
  description:
    "A link-only library of libraries. External projects keep their content; Polymyth Commons keeps pointers, classifications, relationships, provenance, and editorial state.",
  source: {
    shortCitation:
      "Charlotte Hess and Elinor Ostrom, eds., Understanding Knowledge as a Commons: From Theory to Practice",
    publisher: "MIT Press",
    publicationYear: 2007,
    suppliedEditionNote: "Supplied 2011 MIT Press paperback PDF",
    bookUrl:
      "https://mitpress.mit.edu/9780262516037/understanding-knowledge-as-a-commons/",
    extractionDate: "2026-07-28",
  },
  counts: {
    projects: projects.length,
    projectMentions: mentions.length,
    coreCandidates: projects.filter(
      (project) => project.candidateTier === "Core candidate",
    ).length,
    commonsProjects: projects.filter(
      (project) => project.scope === "Commons Projects",
    ).length,
    supportingEcosystem: projects.filter(
      (project) => project.scope === "Supporting Ecosystem",
    ).length,
    conceptsAndComparisons: projects.filter(
      (project) => project.scope === "Concepts and Comparisons",
    ).length,
    printedLinks: bookLinks.length,
    linkOccurrences: linkOccurrences.length,
    linkHosts: new Set(bookLinks.map((link) => link.host).filter(Boolean)).size,
    commonsForms: commonsForms.length,
    projectTypes: projectTypes.length,
    currentStatusSeeds: currentStatuses.length,
    relationshipTypes: relationships.length,
    pdfPagesInspected: 383,
    embeddedPdfHyperlinks: 0,
  },
  countsByTier,
  projects,
  mentions,
  bookLinks,
  linkOccurrences,
  commonsForms,
  projectTypes,
  currentStatuses,
  relationships,
  collections,
  expansion: {
    stages: expansionStages,
    evidencePriority: expansionEvidence,
    nodeClasses,
    discoveryGenerations,
    breadthControl:
      "Add a new public-facing record when an official source establishes a qualifying relationship and the entity itself offers a commons, library, directory, repository, archive, portal, journal, collaboratory, preservation network, learning commons, civic information commons, or shared knowledge infrastructure. Keep generic news, individual content items, and unrelated departments as evidence endpoints rather than projects.",
  },
};

const directoryProjects = projects.map((project) => ({
  id: project.id,
  canonicalName: project.canonicalName,
  aliases: project.aliases,
  candidateTier: project.candidateTier,
  scope: project.scope,
  bookRelations: project.bookRelations,
  bookCategories: project.bookCategories,
  bookPortrayal: project.bookPortrayal,
  mentionCount: project.mentionCount,
  chapters: project.chapters,
  printedPageReferences: project.printedPageReferences,
  bookPrintedUrls: project.bookPrintedUrls,
  sourceGroundedRoles: project.sourceGroundedRoles,
  currentStatusGroup: project.currentStatusGroup,
  currentCanonicalUrl: project.currentCanonicalUrl,
  currentOperator: project.currentOperator,
  currentStatusEvidence: project.currentStatusEvidence,
  verified: project.verified,
}));

const directoryPayload = {
  release: payload.release,
  generated: payload.generated,
  counts: {
    projects: payload.counts.projects,
    commonsProjects: payload.counts.commonsProjects,
    supportingEcosystem: payload.counts.supportingEcosystem,
    conceptsAndComparisons: payload.counts.conceptsAndComparisons,
  },
  collections,
  projects: directoryProjects,
};

const backbonePayload = {
  release: payload.release,
  generated: payload.generated,
  projects: directoryProjects,
  bookLinks,
  commonsForms,
  projectTypes,
  relationships,
};

function csvEscape(value) {
  const text =
    value == null
      ? ""
      : Array.isArray(value)
        ? value.some((item) => item && typeof item === "object")
          ? JSON.stringify(value)
          : value.join(" | ")
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return [
    headers.map(csvEscape).join(","),
    ...rows.map((row) =>
      headers.map((header) => csvEscape(row[header])).join(","),
    ),
  ].join("\n");
}

const sourceDataDirectory = resolve(sourceSite, "polymythlib/data");
const managedPublicDataDirectory = resolve(checkout, "public/data");
const dataDirectories = [
  ...(isManagedCheckout
    ? [resolve(checkout, "app/data"), managedPublicDataDirectory]
    : []),
  sourceDataDirectory,
];
for (const directory of dataDirectories) {
  mkdirSync(directory, { recursive: true });
}

const json = `${JSON.stringify(payload, null, 2)}\n`;
for (const target of new Set(
  dataDirectories.map((directory) => resolve(directory, "polymyth-data.json")),
)) {
  writeFileSync(target, json);
}

for (const [name, value] of [
  ["directory-index.json", directoryPayload],
  ["backbone-index.json", backbonePayload],
  [
    "collections.json",
    {
      release: payload.release,
      generated: payload.generated,
      schemaVersion: payload.schemaVersion,
      collections,
    },
  ],
]) {
  const contents = `${JSON.stringify(value)}\n`;
  for (const directory of new Set([
    ...(isManagedCheckout ? [managedPublicDataDirectory] : []),
    sourceDataDirectory,
  ])) {
    writeFileSync(resolve(directory, name), contents);
  }
}

const projectCsvRows = projects.map(({ mentions: projectMentions, ...project }) => ({
  ...project,
  mentionIds: projectMentions.map((mention) => mention.id),
}));

for (const [name, rows] of [
  ["projects.csv", projectCsvRows],
  ["book-mentions.csv", mentions],
  ["book-links.csv", bookLinks],
  ["link-occurrences.csv", linkOccurrences],
  ["commons-forms.csv", commonsForms],
  ["book-project-types.csv", projectTypes],
  ["current-status.csv", currentStatuses],
  ["relationship-vocabulary.csv", relationships],
]) {
  const csv = `${toCsv(rows)}\n`;
  for (const directory of new Set([
    ...(isManagedCheckout ? [managedPublicDataDirectory] : []),
    sourceDataDirectory,
  ])) {
    writeFileSync(resolve(directory, name), csv);
  }
}

const dataFiles = [
  "polymyth-data.json",
  "directory-index.json",
  "backbone-index.json",
  "collections.json",
  "projects.csv",
  "book-mentions.csv",
  "book-links.csv",
  "link-occurrences.csv",
  "commons-forms.csv",
  "book-project-types.csv",
  "current-status.csv",
  "relationship-vocabulary.csv",
  "CHANGELOG.md",
];
const publicDataDirectory = isManagedCheckout
  ? managedPublicDataDirectory
  : sourceDataDirectory;
const sourceChangelog = resolve(sourceDataDirectory, "CHANGELOG.md");
if (existsSync(sourceChangelog)) {
  writeFileSync(
    resolve(publicDataDirectory, "CHANGELOG.md"),
    readFileSync(sourceChangelog),
  );
}

function fileDigest(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

const fileEntries = dataFiles
  .filter((name) => existsSync(resolve(sourceDataDirectory, name)))
  .map((name) => ({
    path: name,
    sha256: fileDigest(resolve(sourceDataDirectory, name)),
  }));
const manifest = `${JSON.stringify(
  {
    release: payload.release,
    generated: payload.generated,
    schema: {
      name: "Polymyth Commons Generation 0",
      version: payload.schemaVersion,
      documentation: "https://seminarschools.com/polymythlib/method/#record-model",
    },
    rights: {
      metadata:
        "Polymyth-authored metadata may be reused with attribution to Polymyth Commons.",
      source:
        "Book-derived citations and source-grounded summaries remain subject to the rights of their source. The dataset does not reproduce book chapters.",
      externalLinks:
        "Linked projects and documents retain their own terms and rights.",
    },
    source: payload.source,
    counts: payload.counts,
    files: fileEntries,
  },
  null,
  2,
)}\n`;

writeFileSync(resolve(publicDataDirectory, "data-manifest.json"), manifest);
writeFileSync(resolve(sourceDataDirectory, "data-manifest.json"), manifest);

if (isManagedCheckout) {
  const staticCss = readFileSync(
    resolve(checkout, "app/globals.css"),
    "utf8",
  ).replace(/^@import "tailwindcss";\s*/u, "");
  writeFileSync(
    resolve(sourceSite, "css/polymyth-commons.css"),
    staticCss,
  );
}

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function externalHref(value) {
  if (!value) return "";
  return /^https?:\/\//i.test(value)
    ? value
    : `https://${String(value).replace(/^\/+/, "")}`;
}

function visibleUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(externalHref(value));
    const host = url.hostname.replace(/^www\./i, "");
    const path = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
    return `www.${host}${path}`;
  } catch {
    return String(value).replace(/^https?:\/\//i, "");
  }
}

function statusLabel(value) {
  if (!value || value === "STATUS_UNRESOLVED") return "Current review pending";
  const text = value
    .replace(/^STATUS_/, "")
    .replaceAll("_", " ")
    .toLowerCase();
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

function endpointPresentation(project) {
  if (!project.verified || !project.currentCanonicalUrl) return null;
  if (
    project.currentStatusGroup === "ACTIVE" ||
    project.currentStatusGroup === "ACTIVE_AT_NEW_URL"
  ) {
    return {
      action: "Visit current site ↗",
      heading: "Current home",
      signal: "Current home URL",
    };
  }
  if (project.currentStatusGroup === "ABSORBED") {
    return {
      action: "Visit continuing service ↗",
      heading: "Continuing service",
      signal: "Continuing-service URL",
    };
  }
  if (project.currentStatusGroup === "ARCHIVED_READ_ONLY") {
    return {
      action: "Open surviving archive ↗",
      heading: "Surviving archive",
      signal: "Surviving archive URL",
    };
  }
  if (project.currentStatusGroup === "BOOK_ONLY_HISTORICAL") {
    return {
      action: "Open surviving documentation ↗",
      heading: "Surviving documentation",
      signal: "Surviving-documentation URL",
    };
  }
  return {
    action: "Open reviewed destination ↗",
    heading: "Reviewed destination",
    signal: "Reviewed destination URL",
  };
}

function entityPage(project) {
  const primaryCategory = project.bookCategories[0] ?? "";
  const related = projects
    .filter(
      (candidate) =>
        candidate.id !== project.id &&
        primaryCategory &&
        candidate.bookCategories.includes(primaryCategory),
    )
    .slice(0, 6);
  const currentUrl = project.currentCanonicalUrl;
  const endpoint = endpointPresentation(project);
  const preservationLanguage = [
    ...project.bookCategories,
    ...project.sourceGroundedRoles,
  ]
    .join(" ")
    .match(/\b(archiv|preserv|repository|deposit|library)\b/i);
  const signals = [
    ["Book entity and page evidence", true],
    ["Book-printed pointer", Boolean(project.bookPrintedUrls.length)],
    [endpoint?.signal ?? "Reviewed destination URL", Boolean(endpoint)],
    ["Current-state review", Boolean(project.verified)],
    ["Current operator or parent", Boolean(project.currentOperator)],
    ["Current verification sources", Boolean(project.verificationSourceUrls.length)],
  ];

  const categories = project.bookCategories
    .map((category) => `<span class="badge">${htmlEscape(category)}</span>`)
    .join("");
  const actions = endpoint
    ? `<a class="button primary" href="${htmlEscape(
        externalHref(currentUrl),
      )}" rel="noreferrer">${htmlEscape(endpoint.action)}</a>`
    : "";
  const currentState = project.verified
    ? `<p><strong>${htmlEscape(
        statusLabel(project.currentStatusGroup),
      )}.</strong> ${htmlEscape(
        project.currentStatusEvidence ||
          project.detailedStatus ||
          "The current official destination was checked.",
      )}</p>${
        endpoint
          ? `<h3>${htmlEscape(endpoint.heading)}</h3><p><a href="${htmlEscape(
              externalHref(currentUrl),
            )}" rel="noreferrer">${htmlEscape(visibleUrl(currentUrl))} ↗</a></p>`
          : ""
      }${
        project.currentOperator
          ? `<h3>Operator or parent</h3><p>${htmlEscape(
              project.currentOperator,
            )}</p>`
          : ""
      }<p class="source-note">Verification basis · ${htmlEscape(
        project.confidence || "confidence not set",
      )} · checked ${htmlEscape(project.verified)}</p>`
    : `<p>Current status has not yet been verified. The historical book evidence remains available below.</p><a class="button small" href="/polymythlib/contribute/?record=${encodeURIComponent(
        project.id,
      )}&amp;kind=status">Propose current evidence</a>`;
  const mentionsHtml = project.mentions.length
    ? project.mentions
        .map(
          (mention) =>
            `<article><h3>Chapter ${htmlEscape(
              mention.chapterNumber,
            )} · ${htmlEscape(mention.chapterTitle)}</h3><p>${htmlEscape(
              mention.sourceGroundedRole,
            )}</p><p class="source-note">Printed pages ${htmlEscape(
              mention.printedPages,
            )} · ${htmlEscape(mention.relation)} · ${htmlEscape(
              mention.category,
            )} · evidence in ${htmlEscape(
              mention.evidenceLocation,
            )}</p></article>`,
        )
        .join("")
    : `<p>The consolidated project index records this entity at ${htmlEscape(
        project.printedPageReferences,
      )}.</p>`;
  const sourcesHtml = [
    `<li><a href="${htmlEscape(payload.source.bookUrl)}">${htmlEscape(
      payload.source.shortCitation,
    )} ↗</a><span class="source-note">Generation-0 source · ${htmlEscape(
      project.printedPageReferences,
    )}</span></li>`,
    ...project.bookPrintedUrls.map(
      (url) =>
        `<li><a href="${htmlEscape(
          externalHref(url),
        )}" rel="noreferrer">${htmlEscape(
          visibleUrl(url),
        )} ↗</a><span class="source-note">Exact book-printed pointer. Historical layer.</span></li>`,
    ),
    ...project.verificationSourceUrls.map(
      (url) =>
        `<li><a href="${htmlEscape(
          externalHref(url),
        )}" rel="noreferrer">${htmlEscape(
          visibleUrl(url),
        )} ↗</a><span class="source-note">Current verification source · checked ${htmlEscape(
          project.verified,
        )}</span></li>`,
    ),
  ].join("");
  const relatedHtml = related.length
    ? `<ul class="related-list">${related
        .map(
          (candidate) =>
            `<li><a href="/polymythlib/projects/${htmlEscape(
              candidate.id,
            )}/">${htmlEscape(
              candidate.canonicalName,
            )}</a><span>${htmlEscape(candidate.id)} · ${htmlEscape(
              candidate.scope,
            )} · shared type ${htmlEscape(primaryCategory)}</span></li>`,
        )
        .join("")}</ul>`
    : "<p>No related entries are recorded yet.</p>";
  const signalHtml = signals
    .map(
      ([label, on]) =>
        `<li class="signal ${on ? "on" : "off"}"><strong>${on ? "Recorded" : "Open field"}</strong><span>${htmlEscape(label)}</span></li>`,
    )
    .join("");
  const metadataDescription = `${project.canonicalName}: ${
    project.sourceGroundedRoles[0] ||
    "a named record in the Polymyth Commons Ostrom book backbone."
  }`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <script src="/js/theme-init.js?v=20260723-steady"></script>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${htmlEscape(project.canonicalName)} | Polymyth Commons</title>
  <meta name="description" content="${htmlEscape(metadataDescription)}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${htmlEscape(project.canonicalName)} | Polymyth Commons">
  <meta property="og:description" content="${htmlEscape(metadataDescription)}">
  <meta property="og:url" content="https://seminarschools.com/polymythlib/projects/${htmlEscape(
    project.id,
  )}/">
  <meta property="og:image" content="https://seminarschools.com/og-image.png">
  <meta property="og:site_name" content="Seminar Schools">
  <meta name="twitter:card" content="summary">
  <link rel="canonical" href="https://seminarschools.com/polymythlib/projects/${htmlEscape(
    project.id,
  )}/">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/css/polymyth-commons.css?v=20260728-g0-3">
  <link rel="stylesheet" href="/css/alive.css?v=20260806-front-facing-geometry">
  <link rel="stylesheet" href="/css/site-wide-type-zoom.css?v=20260725-audit45" data-site-wide-type-zoom="20260725-audit45">
  <link rel="stylesheet" href="/css/calm-ux.css?v=20260723-steady">
</head>
<body data-geometry="indra-web" data-indra-intensity="0.070" data-route-type="commons-record" data-geometry-role="relation return">
  <a class="skip-link" href="#main-content">Skip to main content</a>
  <header class="site-header"><div class="site-header-inner"><a class="site-brand" href="/polymythcommons/"><span class="brand-seal" aria-hidden="true"></span><span>Polymyth <i>Commons</i></span></a><nav class="primary-nav" aria-label="Polymyth Commons"><a href="/polymythlib/">Directory</a><a href="/polymythlib/collections/">Collections</a><a href="/polymythlib/book-backbone/">Book backbone</a><a href="/polymythlib/method/">Method</a><a href="/polymythlib/contribute/">Contribute</a></nav><a class="seminar-link" href="/">Seminar Schools ↗</a></div></header>
  <main class="page entity-page" id="main-content">
    <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/polymythcommons/">Polymyth Commons</a><span>/</span><a href="/polymythlib/">Polymythlib</a><span>/</span><span aria-current="page">${htmlEscape(
      project.id,
    )}</span></nav>
    <header class="entity-hero">
      <div><p class="record-id">${htmlEscape(
        project.id,
      )} · ${htmlEscape(project.scope)}</p><h1>${htmlEscape(
        project.canonicalName,
      )}</h1><p class="entity-summary">${htmlEscape(
        project.sourceGroundedRoles[0] ||
          "A named record in the Hess and Ostrom knowledge-commons backbone.",
      )}</p><div class="badges">${categories}<span class="badge book">Book evidence</span>${
        project.verified
          ? `<span class="badge verified">Checked ${htmlEscape(
              project.verified,
            )}</span>`
          : ""
      }</div></div>
      <div class="entity-actions">${actions}<a class="button" href="/polymythlib/contribute/?record=${encodeURIComponent(
        project.id,
      )}&amp;kind=correction">Correct this record</a></div>
    </header>
    <div class="entity-grid">
      <div>
        <section class="entity-section" id="at-a-glance"><h2>At a glance</h2><dl class="fact-grid">
          <div class="fact"><dt>Directory scope</dt><dd>${htmlEscape(
            project.scope,
          )}</dd></div><div class="fact"><dt>Candidate tier</dt><dd>${htmlEscape(
            project.candidateTier,
          )}</dd></div><div class="fact"><dt>Role in the book</dt><dd>${htmlEscape(
            project.bookRelations.join(", ") || "Named record",
          )}</dd></div><div class="fact"><dt>Book portrayal</dt><dd>${htmlEscape(
            project.bookPortrayal || "See chapter evidence",
          )}</dd></div><div class="fact"><dt>Book evidence</dt><dd>${htmlEscape(
            project.printedPageReferences,
          )}</dd></div><div class="fact"><dt>Current verification</dt><dd>${
            project.verified
              ? `${htmlEscape(
                  statusLabel(project.currentStatusGroup),
                )} · checked ${htmlEscape(project.verified)}`
              : "Book evidence only · current review pending"
          }</dd></div>
        </dl></section>
        <section class="entity-section" id="current-state"><h2>Current evidence state</h2>${currentState}</section>
        <section class="entity-section" id="commons-anatomy"><h2>Commons anatomy</h2><h3>What kind of work is this?</h3><p>${htmlEscape(
          project.bookCategories.join(", ") ||
            "The book names the project without a more specific normalized type.",
        )}</p><h3>What did it provide?</h3><p>${htmlEscape(
          project.sourceGroundedRoles.join(" ") ||
            "The book evidence establishes the named record; its service description remains to be expanded.",
        )}</p><h3>Governance and sustainability</h3><p>${
          project.currentOperator
            ? `${htmlEscape(
                project.currentOperator,
              )} is recorded as the current operator or parent.`
            : "Current organization, funding, and governance details have not yet been verified."
        }</p><h3>Preservation</h3><p>${
          preservationLanguage
            ? "The book record contains archive, library, repository, or preservation language. No current preservation endpoint has been verified."
            : "No current preservation information has been verified. Historical access links remain below."
        }</p></section>
        <section class="entity-section" id="book"><h2>As documented in the book</h2><p>This section presents source-grounded summaries with the book’s chapter and pagination. Present-day status appears in its own evidence layer.</p>${mentionsHtml}</section>
        <section class="entity-section" id="sources"><h2>Sources and pointers</h2><ul class="source-list">${sourcesHtml}</ul></section>
        <section class="entity-section" id="connections"><h2>Related by book type</h2><p>These entries share the book type <strong>${htmlEscape(
          primaryCategory || "unclassified",
        )}</strong>. No direct relationship has been verified.</p>${relatedHtml}</section>
      </div>
      <aside class="record-aside"><section class="record-card"><h2>Record signals</h2><p>These describe Polymyth’s evidence and review coverage for this record.</p><ul class="signal-list">${signalHtml}</ul></section><section class="record-card"><h2>Record history</h2><ol class="timeline"><li><strong>2007 book layer</strong><span>Named at ${htmlEscape(
        project.printedPageReferences || "the cited pages",
      )}.</span></li><li><strong>28 July 2026</strong><span>Book record published.</span></li>${
        project.verified
          ? `<li><strong>${htmlEscape(
              project.verified,
            )}</strong><span>Current-state seed check recorded.</span></li>`
          : ""
      }</ol></section></aside>
    </div>
  </main>
  <footer class="site-footer"><div class="footer-grid"><div><p class="footer-name">Polymyth Commons</p><p>A directory of libraries, commons projects, and the systems that help shared knowledge live.</p></div><nav aria-label="Commons sections"><a href="/polymythlib/">Polymythlib</a><a href="/polymythlib/book-backbone/">Book backbone</a><a href="/polymythlib/method/">Method and governance</a><a href="/polymythlib/contribute/">Suggest or correct a record</a></nav><nav aria-label="Seminar Schools collections"><a href="/teacherresources/">Teacher Resources ↗</a><a href="/polymythseminars/">Polymythcal ↗</a><a href="/polymyth/">polymorphousmythology ↗</a></nav></div><div class="footer-base"><span>Published 28 July 2026</span><span>Facts, verification, and curation remain separate.</span></div></footer>
  <script src="/js/site-keyboard-enhancements.js?v=20260725-audit45" defer></script>
  <script src="/js/mandala.js?v=20260806-front-facing-geometry" defer></script>
  <script src="/js/indra.js?v=20260806-front-facing-geometry" defer></script>
</body>
</html>
`;
}

for (const project of projects) {
  const directory = resolve(
    sourceSite,
    "polymythlib/projects",
    project.id,
  );
  mkdirSync(directory, { recursive: true });
  writeFileSync(resolve(directory, "index.html"), entityPage(project));
}

console.log(
  JSON.stringify(
    {
      release: payload.release,
      projectCount: projects.length,
      linkCount: bookLinks.length,
      output: Array.from(
        new Set(
          dataDirectories.map((directory) =>
            resolve(directory, "polymyth-data.json"),
          ),
        ),
      ),
    },
    null,
    2,
  ),
);
