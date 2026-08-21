(function () {
  "use strict";
  const EXPECTED_RELEASE = "2026-07-28.g0.3";
  let data = null;
  let tab = "projects";
  let query = "";
  let visible = 80;

  const tables = {
    projects: {
      label: "Projects named in the book",
      csv: "projects.csv",
      count: () => data.projects.length,
    },
    links: {
      label: "Links printed in the book",
      csv: "book-links.csv",
      count: () => data.bookLinks.length,
    },
    forms: {
      label: "Forms of knowledge sharing",
      csv: "commons-forms.csv",
      count: () => data.commonsForms.length,
    },
    types: {
      label: "Kinds of projects",
      csv: "book-project-types.csv",
      count: () => data.projectTypes.length,
    },
    relationships: {
      label: "Ways projects connect",
      csv: "relationship-vocabulary.csv",
      count: () => data.relationships.length,
    },
  };

  const byId = (id) => document.getElementById(id);
  const tierLabels = {
    "Core candidate": "Main directory record",
    "Example candidate": "Example record",
    "Support node": "Supporting record",
    "Context / analogy": "Context or comparison",
  };
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
          esc(tierLabels[project.candidateTier] || project.candidateTier) +
          "</td><td>" +
          esc(project.bookCategories.join(", ")) +
          "</td><td>" +
          esc(project.printedPageReferences) +
          "</td><td>" +
          esc(project.verified || "Current status not yet reviewed") +
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
        "<th>ID</th><th>Name</th><th>Directory status</th><th>Type in the book</th><th>Book citation</th><th>Last checked</th>";
      body = projectRows(items);
    } else if (tab === "links") {
      header =
        "<th>ID</th><th>Link printed in the book</th><th>Project named nearby</th><th>How it appears</th><th>Book citation</th><th>Times printed</th>";
      body = linkRows(items);
    } else if (tab === "forms") {
      header =
        "<th>ID</th><th>Form of knowledge sharing</th><th>Group</th><th>Description</th><th>Book citation</th>";
      body = formRows(items);
    } else if (tab === "types") {
      header =
        "<th>ID</th><th>Kind of project</th><th>Group</th><th>How the book uses it</th><th>What it includes</th><th>Book citation</th>";
      body = typeRows(items);
    } else {
      header =
        "<th>ID</th><th>Connection</th><th>Group</th><th>How the book describes it</th>";
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
      "<strong>" + matching.length + "</strong> matching entries";
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
