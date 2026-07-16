
(() => {
  "use strict";
  const root = document.getElementById("ss-cv-upgrade");
  if (!root) return;

  const modulePatterns = {
    education: ["education", "academic"],
    research: ["research + evaluation", "research and evaluation", "research"],
    teaching: ["teaching + education", "teaching and education", "teaching"],
    programs: ["program + event coordination", "program coordination", "event coordination"],
    arts: ["arts + culture", "arts and culture"],
    performance: ["performance"],
    portfolio: ["portfolio"]
  };

  const normalize = (value) => (value || "").replace(/\s+/g, " ").trim().toLowerCase();
  const checkboxes = [...root.querySelectorAll("[data-ss-module]")];
  const panels = [...root.querySelectorAll("[data-ss-module-panel]")];
  const ownName = root.querySelector("#ss-cv-name");

  function existingEducationSelected() {
    const candidates = [...document.querySelectorAll("input,button,[role='tab'],[aria-selected],.active,.selected")]
      .filter(el => !root.contains(el) && normalize(el.textContent + " " + (el.getAttribute("aria-label") || "")).includes("education"));
    return candidates.some(el =>
      (el.matches("input") && el.checked) ||
      el.getAttribute("aria-selected") === "true" ||
      el.getAttribute("aria-pressed") === "true" ||
      el.classList.contains("active") ||
      el.classList.contains("selected")
    );
  }

  function educationSelected() {
    const own = root.querySelector('[data-ss-module="education"]');
    return Boolean(own && own.checked) || existingEducationSelected() ||
      /(?:[?&#/]|^)education(?:[=&/#]|$)/i.test(location.href);
  }

  function updateNames() {
    const withMA = educationSelected();
    if (ownName) ownName.textContent = withMA ? "Saul Karim Nassau" : "Saul Karim Nassau";
    const nodes = [...document.querySelectorAll("h1,h2,.name,.cv-name,[data-name]")].filter(el => !root.contains(el));
    nodes.forEach(el => {
      const t = (el.textContent || "").trim();
      if (/^saul(?:\s+karim)?\s+nassau(?:\s*,?\s*M\.?A\.?)?$/i.test(t)) {
        el.textContent = withMA ? t.replace(/\s*,?\s*M\.?A\.?$/i, "") + ", MA" : t.replace(/\s*,?\s*M\.?A\.?$/i, "");
      }
    });
  }

  function findArchiveSection(slug) {
    const patterns = modulePatterns[slug] || [];
    const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,legend,summary,[role='heading']")]
      .filter(el => !root.contains(el));
    const heading = headings.find(el => patterns.some(p => normalize(el.textContent).includes(p)));
    if (!heading) return null;
    let node = heading.closest("section,article,details,[data-module],.card,.panel,.module");
    if (!node) {
      node = heading.parentElement;
      while (node && node !== document.body && normalize(node.textContent).length < 120) node = node.parentElement;
    }
    return node && node !== document.body ? node : null;
  }

  function cloneArchiveModule(slug) {
    const holder = root.querySelector(`[data-ss-archive-clone="${slug}"]`);
    if (!holder || holder.dataset.populated === "true") return;
    const source = findArchiveSection(slug);
    if (source) {
      const clone = source.cloneNode(true);
      clone.querySelectorAll("script,style,button,input,select,textarea").forEach(el => el.remove());
      clone.querySelectorAll("[id]").forEach(el => el.removeAttribute("id"));
      holder.replaceChildren(clone);
    }
    holder.dataset.populated = "true";
  }

  function syncPanels() {
    checkboxes.forEach(box => {
      const slug = box.dataset.ssModule;
      const panel = root.querySelector(`[data-ss-module-panel="${slug}"]`);
      if (panel) panel.hidden = !box.checked;
      if (box.checked && !["hospitality","training","languages"].includes(slug)) cloneArchiveModule(slug);
    });
    updateNames();
  }

  function replaceText(node, find, replacement) {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    const items = [];
    while (walker.nextNode()) items.push(walker.currentNode);
    items.forEach(textNode => {
      if (find.test(textNode.nodeValue || "")) textNode.nodeValue = (textNode.nodeValue || "").replace(find, replacement);
    });
  }

  // Corrections that belong across the full Saul archive.
  replaceText(document.body, /\bBJMI\b/gi, "BUMI");
  replaceText(document.body, /basic\s+French\s*,?\s*Farsi\s*(?:,|and)\s*Mandarin/gi, "Farsi (advanced); French and Mandarin (basic)");
  replaceText(document.body, /French\s*,\s*Farsi\s*(?:,|and)\s*Mandarin\s*—?\s*basic/gi, "Farsi — advanced; French and Mandarin — basic");

  // Remove an unsupported Café 23 item if an old generated surface contains it.
  [...document.querySelectorAll("li,article,tr,.card,.entry")].forEach(el => {
    const t = normalize(el.textContent);
    if ((t.includes("café 23") || t.includes("cafe 23")) && t.length < 650) el.remove();
  });

  checkboxes.forEach(box => box.addEventListener("change", syncPanels));
  document.addEventListener("click", () => setTimeout(updateNames, 0), true);
  document.addEventListener("change", () => setTimeout(updateNames, 0), true);

  const observer = new MutationObserver(() => updateNames());
  observer.observe(document.documentElement, {subtree: true, attributes: true, attributeFilter: ["class","aria-selected","aria-pressed","checked"]});

  const printButton = root.querySelector("[data-ss-print]");
  if (printButton) printButton.addEventListener("click", () => {
    syncPanels();
    window.print();
  });

  const copyButton = root.querySelector("[data-ss-copy]");
  if (copyButton) copyButton.addEventListener("click", async () => {
    syncPanels();
    const selected = panels.filter(panel => !panel.hidden).map(panel => panel.innerText.trim()).join("\n\n");
    const header = `${ownName.textContent}\nToronto, Ontario · 416-771-0382 · saulnassau@protonmail.com\n\n`;
    try {
      await navigator.clipboard.writeText(header + selected);
      const old = copyButton.textContent;
      copyButton.textContent = "Copied";
      setTimeout(() => copyButton.textContent = old, 1500);
    } catch {
      const area = document.createElement("textarea");
      area.value = header + selected;
      document.body.append(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
  });

  syncPanels();
})();
