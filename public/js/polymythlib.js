(function () {
  "use strict";

  const EXPECTED_RELEASE = "2026-07-28.g0.3";
  const state = {
    query: "",
    scope: "Commons Projects",
    category: "",
    relation: "",
    status: "",
    tier: "",
    chapter: "",
    quick: "",
    research: false,
    view: "list",
    sort: "name",
    visible: 40,
  };

  const quickIds = new Set([
    "library",
    "open-access",
    "preservation",
    "community",
    "infrastructure",
  ]);

  let data = null;

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
    if (/^https?:\/\//i.test(value)) return value;
    return "https://" + String(value).replace(/^\/+/, "");
  }

  function displayUrl(value) {
    if (!value) return "";
    try {
      const url = new URL(externalHref(value));
      const host = url.hostname.replace(/^www\./i, "");
      const path =
        url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
      return "www." + host + path;
    } catch (_error) {
      return String(value).replace(/^https?:\/\//i, "");
    }
  }

  function cleanStatus(value) {
    if (!value || value === "STATUS_UNRESOLVED") return "Current review pending";
    const text = value
      .replace(/^STATUS_/, "")
      .replaceAll("_", " ")
      .toLowerCase();
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function endpointPresentation(project) {
    if (!project.verified || !project.currentCanonicalUrl) return null;
    if (
      project.currentStatusGroup === "ACTIVE" ||
      project.currentStatusGroup === "ACTIVE_AT_NEW_URL"
    ) {
      return { action: "Visit current site ↗", heading: "Current home" };
    }
    if (project.currentStatusGroup === "ABSORBED") {
      return {
        action: "Visit continuing service ↗",
        heading: "Continuing service",
      };
    }
    if (project.currentStatusGroup === "ARCHIVED_READ_ONLY") {
      return {
        action: "Open surviving archive ↗",
        heading: "Surviving archive",
      };
    }
    if (project.currentStatusGroup === "BOOK_ONLY_HISTORICAL") {
      return {
        action: "Open surviving documentation ↗",
        heading: "Surviving documentation",
      };
    }
    return {
      action: "Open reviewed destination ↗",
      heading: "Reviewed destination",
    };
  }

  function projectText(project) {
    return [
      project.id,
      project.canonicalName,
      project.aliases.join(" "),
      project.bookCategories.join(" "),
      project.bookRelations.join(" "),
      project.sourceGroundedRoles.join(" "),
      project.bookPortrayal,
      project.currentOperator,
      project.currentStatusEvidence,
      project.printedPageReferences,
    ]
      .join(" ")
      .toLowerCase();
  }

  function readUrl() {
    const params = new URLSearchParams(location.search);
    const scope = params.get("scope");
    if (
      [
        "Commons Projects",
        "Supporting Ecosystem",
        "Concepts and Comparisons",
        "All Book Records",
      ].includes(scope)
    ) {
      state.scope = scope;
    }
    state.query = params.get("q") || "";
    const quick = params.get("quick") || "";
    state.quick = quickIds.has(quick) ? quick : "";
    state.category = params.get("category") || "";
    state.relation = params.get("relation") || "";
    state.status = params.get("status") || "";
    state.tier = params.get("tier") || "";
    state.chapter = params.get("chapter") || "";
    const sort = params.get("sort") || "";
    state.sort = ["name", "book-order", "mentions", "verified"].includes(sort)
      ? sort
      : "name";
    state.view = params.get("view") === "table" ? "table" : "list";
    state.research =
      Boolean(state.tier || state.chapter) || params.get("research") === "1";
  }

  function writeUrl() {
    const params = new URLSearchParams();
    if (state.query) params.set("q", state.query);
    if (state.scope !== "Commons Projects") params.set("scope", state.scope);
    if (state.quick) params.set("quick", state.quick);
    if (state.category) params.set("category", state.category);
    if (state.relation) params.set("relation", state.relation);
    if (state.status) params.set("status", state.status);
    if (state.tier) params.set("tier", state.tier);
    if (state.chapter) params.set("chapter", state.chapter);
    if (state.sort !== "name") params.set("sort", state.sort);
    if (state.view !== "list") params.set("view", state.view);
    if (state.research && !state.tier && !state.chapter) {
      params.set("research", "1");
    }
    const query = params.toString();
    history.replaceState(
      null,
      "",
      location.pathname + (query ? "?" + query : ""),
    );
  }

  function setSelectOptions(id, values, firstLabel) {
    const select = byId(id);
    const selected = state[
      id === "pm-category"
        ? "category"
        : id === "pm-relation"
          ? "relation"
          : "chapter"
    ];
    select.innerHTML =
      '<option value="">' +
      esc(firstLabel) +
      "</option>" +
      values
        .map(
          (value) =>
            '<option value="' +
            esc(value) +
            '"' +
            (value === selected ? " selected" : "") +
            ">" +
            esc(id === "pm-chapter" ? "Chapter " + value : value) +
            "</option>",
        )
        .join("");
  }

  function syncControls() {
    byId("pm-search").value = state.query;
    byId("pm-category").value = state.category;
    byId("pm-relation").value = state.relation;
    byId("pm-status").value = state.status;
    byId("pm-tier").value = state.tier;
    byId("pm-chapter").value = state.chapter;
    byId("pm-sort").value = state.sort;
    byId("pm-research-fields").hidden = !state.research;
    byId("pm-research-toggle").setAttribute(
      "aria-expanded",
      String(state.research),
    );
    byId("pm-research-toggle").querySelector("[aria-hidden]").textContent =
      state.research ? "−" : "+";
    document.querySelectorAll("[data-scope]").forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.scope === state.scope),
      );
    });
    document.querySelectorAll("[data-quick]").forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.quick === state.quick),
      );
    });
    document.querySelectorAll("[data-view]").forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.view === state.view),
      );
    });
  }

  function filteredProjects() {
    const words = state.query
      .toLowerCase()
      .split(/\s+/)
      .map((word) => word.trim())
      .filter(Boolean);
    const collection = (data.collections || []).find(
      (item) => item.id === state.quick,
    );
    const quickMembers = new Set(collection ? collection.members : []);
    return data.projects
      .filter((project) => {
        if (
          state.scope !== "All Book Records" &&
          project.scope !== state.scope
        ) {
          return false;
        }
        const text = projectText(project);
        if (words.some((word) => !text.includes(word))) return false;
        if (collection && !quickMembers.has(project.id)) return false;
        if (
          state.category &&
          !project.bookCategories.includes(state.category)
        ) {
          return false;
        }
        if (
          state.relation &&
          !project.bookRelations.includes(state.relation)
        ) {
          return false;
        }
        if (state.status === "verified" && !project.verified) return false;
        if (state.status === "current-url" && !project.currentCanonicalUrl) {
          return false;
        }
        if (state.status === "book-only" && project.verified) return false;
        if (state.tier && project.candidateTier !== state.tier) return false;
        if (state.chapter && !project.chapters.includes(state.chapter)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (state.sort === "book-order") return a.id.localeCompare(b.id);
        if (state.sort === "mentions") {
          return (
            b.mentionCount - a.mentionCount ||
            a.canonicalName.localeCompare(b.canonicalName)
          );
        }
        if (state.sort === "verified") {
          return (
            Number(Boolean(b.verified)) -
              Number(Boolean(a.verified)) ||
            a.canonicalName.localeCompare(b.canonicalName)
          );
        }
        return a.canonicalName.localeCompare(b.canonicalName);
      });
  }

  function badge(value, className) {
    return (
      '<span class="badge ' +
      (className || "") +
      '">' +
      esc(value) +
      "</span>"
    );
  }

  function renderList(projects) {
    return (
      '<div class="result-list">' +
      projects
        .slice(0, state.visible)
        .map((project, index) => {
          const endpoint = endpointPresentation(project);
          const role =
            project.sourceGroundedRoles[0] ||
            project.bookPortrayal ||
            "Named in the book backbone.";
          return (
            '<article class="result-row">' +
            '<span class="result-index">' +
            String(index + 1).padStart(2, "0") +
            "</span>" +
            '<div class="result-main"><h2><a href="/polymythlib/projects/' +
            esc(project.id) +
            '/">' +
            esc(project.canonicalName) +
            "</a></h2>" +
            '<p class="result-role">' +
            esc(role) +
            "</p><div class=\"badges\">" +
            (project.bookCategories[0]
              ? badge(project.bookCategories[0], "")
              : "") +
            (project.candidateTier === "Core candidate"
              ? badge("Ostrom seed", "")
              : "") +
            (project.verified
              ? badge("Checked " + project.verified, "verified")
              : badge("Book evidence", "book")) +
            "</div></div>" +
            '<div class="result-meta"><strong>' +
            esc(project.scope) +
            "</strong><span>" +
            esc(project.printedPageReferences) +
            "</span><span>" +
            esc(
              project.verified
                ? cleanStatus(project.currentStatusGroup)
                : "Book evidence only · current review pending",
            ) +
            "</span></div>" +
            '<div class="result-actions"><a class="button small" href="/polymythlib/projects/' +
            esc(project.id) +
            '/">Open record</a>' +
            (endpoint
              ? '<a class="button small" rel="noreferrer" href="' +
                esc(externalHref(project.currentCanonicalUrl)) +
                '">' +
                esc(endpoint.action) +
                "</a>"
              : "") +
            "</div></article>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function renderTable(projects) {
    return (
      '<div class="data-table-wrap"><table class="data-table"><caption class="sr-only">Polymythlib directory results</caption><thead><tr>' +
      '<th scope="col">ID</th><th scope="col">Name</th><th scope="col">Type</th><th scope="col">Scope</th><th scope="col">Book pages</th><th scope="col">Current check</th>' +
      "</tr></thead><tbody>" +
      projects
        .slice(0, state.visible)
        .map(
          (project) =>
            "<tr><td>" +
            esc(project.id) +
            '</td><td><a href="/polymythlib/projects/' +
            esc(project.id) +
            '/">' +
            esc(project.canonicalName) +
            "</a></td><td>" +
            esc(project.bookCategories.join(", ")) +
            "</td><td>" +
            esc(project.scope) +
            "</td><td>" +
            esc(project.printedPageReferences) +
            "</td><td>" +
            esc(project.verified || "Current review pending") +
            "</td></tr>",
        )
        .join("") +
      "</tbody></table></div>"
    );
  }

  function render() {
    if (!data) return;
    syncControls();
    writeUrl();
    const projects = filteredProjects();
    byId("pm-result-count").innerHTML =
      "<strong>" +
      projects.length +
      "</strong> " +
      (projects.length === 1 ? "record" : "records");
    byId("pm-jump").textContent = "View " + projects.length + " results";

    const active = [
      state.query ? "Search: " + state.query : "",
      state.quick
        ? (
            document.querySelector(
              '[data-quick="' + CSS.escape(state.quick) + '"]',
            ) || {}
          ).textContent || state.quick
        : "",
      state.category,
      state.relation,
      state.status === "verified"
        ? "Current state checked"
        : state.status === "current-url"
          ? "Reviewed destination recorded"
          : state.status === "book-only"
            ? "Book evidence only"
            : "",
      state.tier,
      state.chapter ? "Chapter " + state.chapter : "",
    ].filter(Boolean);
    byId("pm-active").innerHTML = active
      .map((value) => '<span class="active-chip">' + esc(value) + "</span>")
      .join("");

    const container = byId("pm-results");
    if (!projects.length) {
      container.innerHTML =
        '<div class="empty-state"><h2>No records match this combination.</h2><p>Clear a filter or search a broader term.</p><button class="button" id="pm-empty-clear" type="button">Clear filters</button></div>';
      byId("pm-empty-clear").addEventListener("click", resetAll);
    } else {
      container.innerHTML =
        state.view === "table"
          ? renderTable(projects)
          : renderList(projects);
    }

    byId("pm-load").hidden = state.visible >= projects.length;
  }

  function resetAll() {
    Object.assign(state, {
      query: "",
      scope: "Commons Projects",
      category: "",
      relation: "",
      status: "",
      tier: "",
      chapter: "",
      quick: "",
      research: false,
      visible: 40,
    });
    render();
  }

  function bind() {
    byId("pm-search").addEventListener("input", (event) => {
      state.query = event.target.value;
      if (state.query) state.quick = "";
      state.visible = 40;
      render();
    });
    byId("pm-jump").addEventListener("click", () => {
      byId("directory-results").scrollIntoView({ behavior: "auto" });
    });
    byId("pm-clear").addEventListener("click", resetAll);
    byId("pm-category").addEventListener("change", (event) => {
      state.category = event.target.value;
      state.visible = 40;
      render();
    });
    byId("pm-relation").addEventListener("change", (event) => {
      state.relation = event.target.value;
      state.visible = 40;
      render();
    });
    byId("pm-status").addEventListener("change", (event) => {
      state.status = event.target.value;
      state.visible = 40;
      render();
    });
    byId("pm-tier").addEventListener("change", (event) => {
      state.tier = event.target.value;
      state.visible = 40;
      render();
    });
    byId("pm-chapter").addEventListener("change", (event) => {
      state.chapter = event.target.value;
      state.visible = 40;
      render();
    });
    byId("pm-sort").addEventListener("change", (event) => {
      state.sort = event.target.value;
      render();
    });
    byId("pm-research-toggle").addEventListener("click", () => {
      state.research = !state.research;
      render();
    });
    byId("pm-load").addEventListener("click", () => {
      state.visible += 40;
      render();
    });
    document.querySelectorAll("[data-scope]").forEach((button) => {
      button.addEventListener("click", () => {
        state.scope = button.dataset.scope;
        state.visible = 40;
        render();
      });
    });
    document.querySelectorAll("[data-quick]").forEach((button) => {
      button.addEventListener("click", () => {
        state.quick =
          state.quick === button.dataset.quick ? "" : button.dataset.quick;
        state.category = "";
        state.visible = 40;
        render();
      });
    });
    document.querySelectorAll("[data-view]").forEach((button) => {
      button.addEventListener("click", () => {
        state.view = button.dataset.view;
        render();
      });
    });
    document.addEventListener("keydown", (event) => {
      if (
        event.key === "/" &&
        !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)
      ) {
        event.preventDefault();
        byId("pm-search").focus();
      }
      if (event.key === "Escape" && document.activeElement === byId("pm-search")) {
        state.query = "";
        render();
      }
    });
  }

  async function init() {
    readUrl();
    try {
      const response = await fetch(
        "/polymythlib/data/directory-index.json?v=20260728-g0-3",
        { cache: "force-cache" },
      );
      if (!response.ok) throw new Error("Data request failed");
      data = await response.json();
      if (data.release !== EXPECTED_RELEASE) {
        throw new Error("Directory data release mismatch");
      }
      const categories = Array.from(
        new Set(data.projects.flatMap((project) => project.bookCategories)),
      ).sort((a, b) => a.localeCompare(b));
      const relations = Array.from(
        new Set(data.projects.flatMap((project) => project.bookRelations)),
      ).sort((a, b) => a.localeCompare(b));
      const chapters = Array.from(
        new Set(data.projects.flatMap((project) => project.chapters)),
      ).sort((a, b) => Number(a) - Number(b));
      if (state.category && !categories.includes(state.category)) state.category = "";
      if (state.relation && !relations.includes(state.relation)) state.relation = "";
      if (state.chapter && !chapters.includes(state.chapter)) state.chapter = "";
      if (
        state.tier &&
        !["Core candidate", "Example candidate", "Support node", "Context / analogy"].includes(
          state.tier,
        )
      ) {
        state.tier = "";
      }
      if (
        state.status &&
        !["verified", "current-url", "book-only"].includes(state.status)
      ) {
        state.status = "";
      }
      setSelectOptions("pm-category", categories, "All types");
      setSelectOptions("pm-relation", relations, "All roles");
      setSelectOptions("pm-chapter", chapters, "All chapters");
      bind();
      render();
    } catch (error) {
      byId("pm-results").innerHTML =
        '<div class="empty-state"><h2>The directory data did not load.</h2><p>Use the Book Backbone downloads while this route is repaired.</p><a class="button" href="/polymythlib/data/projects.csv">Download projects CSV</a></div>';
      byId("pm-result-count").textContent = "Data unavailable";
      console.error(error);
    }
  }

  init();
})();
