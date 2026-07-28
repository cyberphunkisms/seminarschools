(() => {
  "use strict";

  const root = document.querySelector("[data-cv-ultimate]");
  const focusPanel = root?.querySelector("[data-cv-focus]");
  const dataNode = root?.querySelector("#cvFocusData");
  if (!root || !focusPanel || !dataNode) return;

  let modules;
  try {
    modules = JSON.parse(dataNode.textContent || "[]");
  } catch {
    return;
  }

  const inputs = [...focusPanel.querySelectorAll("[data-focus-input]")];
  const moduleOrder = modules.map((module) => module.id);
  const moduleById = new Map(modules.map((module) => [module.id, module]));
  const validIds = new Set(moduleOrder);
  const reset = focusPanel.querySelector("[data-focus-reset]");
  const visibleCount = focusPanel.querySelector("[data-visible-count]");
  const summary = focusPanel.querySelector("[data-focus-summary]");
  const copyButton = focusPanel.querySelector("[data-copy-focus]");
  const focusPdf = focusPanel.querySelector("[data-focus-pdf]");
  const focusPrint = focusPanel.querySelector("[data-focus-print]");
  const rows = [...root.querySelectorAll("[data-experience-id]")];
  const sections = [...root.querySelectorAll("[data-experience-section]")];
  const skillItems = [...root.querySelectorAll("[data-core-skill]")];
  const skillHeading = root.querySelector("#coreSkillsHeading");

  const orderedSelection = () =>
    moduleOrder.filter((id) =>
      inputs.some((input) => input.value === id && input.checked),
    );

  const readLocation = () => {
    const query = new URL(location.href).searchParams.get("focus") || "";
    const selected = new Set(
      query
        .split(",")
        .map((value) => value.trim())
        .filter((value) => validIds.has(value)),
    );
    inputs.forEach((input) => {
      input.checked = selected.has(input.value);
    });
  };

  const setFilteredOut = (element, filteredOut) => {
    if (filteredOut) {
      element.dataset.filteredOut = "true";
      element.setAttribute("aria-hidden", "true");
    } else {
      delete element.dataset.filteredOut;
      element.removeAttribute("aria-hidden");
    }
  };

  const applyFocus = (pushHistory = false) => {
    const selected = orderedSelection();
    const selectedSet = new Set(selected);
    let count = 0;

    rows.forEach((row) => {
      const tags = (row.dataset.focus || "").split(/\s+/).filter(Boolean);
      const matches =
        selected.length === 0 || tags.some((tag) => selectedSet.has(tag));
      setFilteredOut(row, !matches);
      if (matches) count += 1;
    });

    sections.forEach((section) => {
      const sectionRows = [...section.querySelectorAll("[data-experience-id]")];
      const shown = sectionRows.filter(
        (row) => row.dataset.filteredOut !== "true",
      ).length;
      setFilteredOut(section, shown === 0);
      const counter = section.querySelector("[data-section-count]");
      if (counter) {
        const full = Number(counter.dataset.sectionCount || sectionRows.length);
        counter.textContent = selected.length
          ? `${shown} of ${full} experiences`
          : `${full} experiences`;
      }
    });

    const selectedSkills = new Set(
      selected.flatMap((id) => moduleById.get(id)?.skills || []),
    );
    skillItems.forEach((item) => {
      const matches =
        selected.length === 0 || selectedSkills.has(item.dataset.coreSkill);
      setFilteredOut(item, !matches);
    });

    if (skillHeading) {
      skillHeading.textContent = selected.length
        ? "Key Skills for This Focus"
        : "Key Skills";
    }
    if (reset) {
      reset.setAttribute("aria-pressed", String(selected.length === 0));
    }
    if (visibleCount) visibleCount.textContent = String(count);
    if (summary) {
      if (selected.length === 0) {
        summary.textContent =
          "Complete application CV with every verified experience row visible.";
      } else if (selected.length === 1) {
        summary.textContent = moduleById.get(selected[0])?.summary || "";
      } else {
        summary.textContent = `Combined focus: ${selected
          .map((id) => moduleById.get(id)?.short_label || id)
          .join(" + ")}.`;
      }
    }
    if (focusPdf && focusPrint) {
      if (selected.length <= 1) {
        const focusId = selected[0] || "general";
        const module = moduleById.get(focusId);
        focusPdf.href =
          module?.pdf ||
          `/saul/downloads/saul-karim-nassau-${focusId}-cv.pdf`;
        focusPdf.textContent = selected.length
          ? `Download ${module?.short_label || focusId} PDF`
          : "Download complete modular PDF";
        focusPdf.hidden = false;
        focusPrint.hidden = true;
      } else {
        focusPdf.hidden = true;
        focusPrint.hidden = false;
      }
    }

    if (pushHistory) {
      const url = new URL(location.href);
      if (selected.length) url.searchParams.set("focus", selected.join(","));
      else url.searchParams.delete("focus");
      history.pushState({}, "", url);
    }
  };

  inputs.forEach((input) => {
    input.addEventListener("change", () => applyFocus(true));
  });

  reset?.addEventListener("click", () => {
    inputs.forEach((input) => {
      input.checked = false;
    });
    applyFocus(true);
  });

  copyButton?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      copyButton.textContent = "Link copied";
      window.setTimeout(() => {
        copyButton.textContent = "Copy focused-view link";
      }, 1800);
    } catch {
      copyButton.textContent = "Copy unavailable";
    }
  });

  focusPrint?.addEventListener("click", () => {
    window.print();
  });

  addEventListener("popstate", () => {
    readLocation();
    applyFocus(false);
  });

  readLocation();
  applyFocus(false);
})();
