(function () {
  "use strict";
  const EXPECTED_RELEASE = "2026-07-28.g0.3";
  let data = null;
  let tab = "projects";
  let query = "";
  let visible = 80;

  const tables = {
    projects: {
      label: "Named records",
      csv: "projects.csv",
      count: () => data.projects.length,
    },
    links: {
      label: "Printed links",
      csv: "book-links.csv",
      count: () => data.bookLinks.length,
    },
    forms: {
      label: "Commons forms",
      csv: "commons-forms.csv",
      count: () => data.commonsForms.length,
    },
    types: {
      label: "Book project types",
      csv: "book-project-types.csv",
      count: () => data.projectTypes.length,
    },
    relationships: {
      label: "Relationship vocabulary",
      csv: "relationship-vocabulary.csv",
      count: () => data.relationships.length,
    },
  };

  const byId = (id) => document.getElementById(id);
  const esc = (value) =>
    String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  function externalHref(value) {
    if (!value) return "";
    return /^https?:\/\//i.test(value)
      ? value
      : "https://" + String(value).replace(/^\/+/, "");
  }

  function displayUrl(value) {
    try {
      const url = new URL(externalHref(value));
      const path =
        url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
      return "www." + url.hostname.replace(/^www\./i, "") + path;
    } catch (_error) {
      return String(value).replace(/^https?:\/\//i, "");
    }
  }

  function match(values) {
    if (!query) return true;
    const words = query
      .toLowerCase()
      .split(/\s+/)
      .map((word) => word.trim())
      .filter(Boolean);
    const text = values.flat(Infinity).join(" ").toLowerCase();
    return words.every((word) => text.includes(word));
  }

  function rows() {
    if (tab === "projects") {
      return data.projects.filter((project) =>
        match([
          project.id,
          project.canonicalName,
          project.bookCategories,
          project.sourceGroundedRoles,
          project.printedPageReferences,
        ]),
      );
    }
    if (tab === "links") {
      return data.bookLinks.filter((link) =>
        match([
          link.id,
          link.printed,
          link.host,
          link.nearbyProject,
          link.contextClassifications,
          link.chapters,
        ]),
      );
    }
    if (tab === "forms") {
      return data.commonsForms.filter((form) =>
        match([
          form.id,
          form.family,
          form.name,
          form.definition,
          form.printedPages,
        ]),
      );
    }
    if (tab === "types") {
      return data.projectTypes.filter((type) =>
        match([
          type.id,
          type.name,
          type.family,
          type.bookFunction,
          type.sourceGroundedScope,
          type.representativeEntries,
        ]),
      );
    }
    return data.relationships.filter((relationship) =>
      match([
        relationship.id,
        relationship.type,
        relationship.family,
        relationship.bookBasis,
      ]),
    );
  }

  function projectRows(items) {
    return items
      .map(
        (project) =>
          "<tr><td>" +
          esc(project.id) +
          '</td><td><a href="/polymythlib/projects/' +
          esc(project.id) +
          '/">' +
          esc(project.canonicalName) +
          "</a></td><td>" +
          esc(project.candidateTier) +
          "</td><td>" +
          esc(project.bookCategories.join(", ")) +
          "</td><td>" +
          esc(project.printedPageReferences) +
          "</td><td>" +
          esc(project.verified || "Current review pending") +
          "</td></tr>",
      )
      .join("");
  }

  function linkRows(items) {
    return items
      .map((link) => {
        const url = link.normalized || link.printed;
        return (
          "<tr><td>" +
          esc(link.id) +
          '</td><td class="url-cell"><a rel="noreferrer" href="' +
          esc(externalHref(url)) +
          '">' +
          esc(displayUrl(url)) +
          " ↗</a></td><td>" +
          esc(link.nearbyProject) +
          "</td><td>" +
          esc(link.contextClassifications.join(", ")) +
          "</td><td>" +
          esc(link.printedPages || "PDF " + link.pdfPages) +
          "</td><td>" +
          esc(link.occurrenceCount) +
          "</td></tr>"
        );
      })
      .join("");
  }

  function formRows(items) {
    return items
      .map(
        (form) =>
          "<tr><td>" +
          esc(form.id) +
          "</td><td>" +
          esc(form.name) +
          "</td><td>" +
          esc(form.family) +
          '</td><td class="definition-cell">' +
          esc(form.definition) +
          "</td><td>" +
          esc(form.printedPages) +
          "</td></tr>",
      )
      .join("");
  }

  function typeRows(items) {
    return items
      .map(
        (type) =>
          "<tr><td>" +
          esc(type.id) +
          "</td><td>" +
          esc(type.name) +
          "</td><td>" +
          esc(type.family) +
          "</td><td>" +
          esc(type.bookFunction) +
          '</td><td class="definition-cell">' +
          esc(type.sourceGroundedScope) +
          "</td><td>" +
          esc(type.printedPages) +
          "</td></tr>",
      )
      .join("");
  }

  function relationshipRows(items) {
    return items
      .map(
        (relationship) =>
          "<tr><td>" +
          esc(relationship.id) +
          "</td><td>" +
          esc(relationship.type) +
          "</td><td>" +
          esc(relationship.family) +
          "</td><td>" +
          esc(relationship.bookBasis) +
          "</td></tr>",
      )
      .join("");
  }

  function renderTable(items) {
    let header = "";
    let body = "";
    if (tab === "projects") {
      header =
        "<th>ID</th><th>Name</th><th>Candidate tier</th><th>Book type</th><th>Pages</th><th>Current check</th>";
      body = projectRows(items);
    } else if (tab === "links") {
      header =
        "<th>ID</th><th>Printed pointer</th><th>Nearby project</th><th>Context</th><th>Printed pages</th><th>Occurrences</th>";
      body = linkRows(items);
    } else if (tab === "forms") {
      header =
        "<th>ID</th><th>Commons form</th><th>Family</th><th>Definition</th><th>Book pages</th>";
      body = formRows(items);
    } else if (tab === "types") {
      header =
        "<th>ID</th><th>Project type</th><th>Family</th><th>Book function</th><th>Scope</th><th>Book pages</th>";
      body = typeRows(items);
    } else {
      header =
        "<th>ID</th><th>Relationship</th><th>Family</th><th>Book basis</th>";
      body = relationshipRows(items);
    }
    byId("backbone-table").innerHTML =
      '<table class="data-table"><caption class="sr-only">' +
      esc(tables[tab].label) +
      '</caption><thead><tr>' +
      header +
      "</tr></thead><tbody>" +
      body +
      "</tbody></table>";
  }

  function render() {
    if (!data) return;
    const matching = rows();
    document.querySelectorAll("[data-tab]").forEach((button) => {
      const selected = button.dataset.tab === tab;
      button.setAttribute("aria-pressed", String(selected));
      button.textContent =
        tables[button.dataset.tab].label +
        " · " +
        tables[button.dataset.tab].count();
    });
    byId("backbone-search").placeholder =
      "Search " + tables[tab].label.toLowerCase();
    byId("backbone-count").innerHTML =
      "<strong>" + matching.length + "</strong> matching rows";
    byId("backbone-download").href =
      "/polymythlib/data/" + tables[tab].csv;
    const params = new URLSearchParams();
    if (tab !== "projects") params.set("table", tab);
    if (query) params.set("q", query);
    const suffix = params.toString();
    history.replaceState(
      null,
      "",
      location.pathname + (suffix ? "?" + suffix : ""),
    );
    renderTable(matching.slice(0, visible));
    byId("backbone-load").hidden = visible >= matching.length;
  }

  async function init() {
    try {
      const params = new URLSearchParams(location.search);
      const requestedTab = params.get("table");
      if (Object.hasOwn(tables, requestedTab)) tab = requestedTab;
      query = params.get("q") || "";
      const response = await fetch(
        "/polymythlib/data/backbone-index.json?v=20260728-g0-3",
        { cache: "force-cache" },
      );
      if (!response.ok) throw new Error("Data request failed");
      data = await response.json();
      if (data.release !== EXPECTED_RELEASE) {
        throw new Error("Backbone data release mismatch");
      }
      byId("backbone-search").value = query;
      document.querySelectorAll("[data-tab]").forEach((button) => {
        button.addEventListener("click", () => {
          tab = button.dataset.tab;
          query = "";
          visible = 80;
          byId("backbone-search").value = "";
          render();
        });
      });
      byId("backbone-search").addEventListener("input", (event) => {
        query = event.target.value;
        visible = 80;
        render();
      });
      byId("backbone-load").addEventListener("click", () => {
        visible += 80;
        render();
      });
      render();
    } catch (error) {
      byId("backbone-table").innerHTML =
        '<div class="empty-state"><h2>The explorer data did not load.</h2><a class="button" href="/polymythlib/data/projects.csv">Download projects CSV</a></div>';
      console.error(error);
    }
  }

  init();
})();
