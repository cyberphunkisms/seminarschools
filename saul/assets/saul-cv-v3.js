
(() => {
  "use strict";
  const root = document.querySelector(".cv-v3");
  if (!root) return;
  const dataNode = document.getElementById("cv-v3-data");
  if (!dataNode) return;
  const data = JSON.parse(dataNode.textContent || "{}");
  const focusInputs = [...root.querySelectorAll('input[name="cv-focus"]')];
  const optionInputs = [...root.querySelectorAll('[data-cv-option]')];
  const nameNode = root.querySelector("[data-cv-name]");
  const roleNode = root.querySelector("[data-cv-role]");
  const profileNode = root.querySelector("[data-cv-profile]");
  const skillsNode = root.querySelector("[data-cv-skills]");
  const jobsNode = root.querySelector("[data-cv-jobs]");
  const trainingNode = root.querySelector('[data-cv-support="training"]');
  const languagesNode = root.querySelector('[data-cv-support="languages"]');
  const educationNode = root.querySelector('[data-cv-support="education"]');
  const fullArchiveNode = root.querySelector(".cv-v3__archive");
  const designed = root.querySelector("[data-cv-designed]");
  const ats = root.querySelector("[data-cv-ats]");
  const text = root.querySelector("[data-cv-text]");
  const route = root.querySelector("[data-cv-route]");
  const selectedLabel = root.querySelector("[data-cv-selected-label]");

  const esc = (value) => String(value || "").replace(/[&<>\"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;","'":"&#39;"}[ch]));
  const currentFocus = () => (focusInputs.find(input => input.checked) || focusInputs[0]).value;
  const option = key => Boolean(root.querySelector(`[data-cv-option="${key}"]`)?.checked);

  function render() {
    const slug = currentFocus();
    const item = data.modules[slug];
    if (!item) return;
    const education = option("education") || slug === "education";
    nameNode.textContent = education ? `${data.contact.name}, MA` : data.contact.name;
    roleNode.textContent = item.label;
    selectedLabel.textContent = item.label;
    profileNode.textContent = item.profile;
    skillsNode.innerHTML = item.skills.map(skill => `<li>${esc(skill)}</li>`).join("");
    jobsNode.innerHTML = item.records.map(record => {
      const org = record.organization ? ` — ${esc(record.organization)}` : "";
      const place = record.location ? `, ${esc(record.location)}` : "";
      const meta = [record.dates].filter(Boolean).map(esc).join(" · ");
      const bullets = (record.bullets || []).slice(0, 3).map(b => `<li>${esc(b)}</li>`).join("");
      return `<article class="cv-v3__job"><h4>${esc(record.title)}${org}${place}</h4>${meta ? `<p class="cv-v3__job-meta">${meta}</p>` : ""}${bullets ? `<ul>${bullets}</ul>` : ""}</article>`;
    }).join("") || "<p>Selected experience is available in the complete career archive.</p>";
    trainingNode.hidden = !option("training");
    languagesNode.hidden = !option("languages");
    educationNode.hidden = !education;
    if (fullArchiveNode) fullArchiveNode.open = option("archive");
    designed.href = item.downloads.designed;
    ats.href = item.downloads.ats;
    text.href = item.downloads.text;
    route.href = item.route;
    const modules = optionInputs.filter(input => input.checked).map(input => input.value);
    const query = new URLSearchParams();
    query.set("focus", slug);
    if (modules.length) query.set("modules", modules.join(","));
    history.replaceState(null, "", `${location.pathname}?${query.toString()}${location.hash}`);
  }

  const params = new URLSearchParams(location.search);
  const requestedFocus = params.get("focus");
  if (requestedFocus) {
    const requested = root.querySelector(`input[name="cv-focus"][value="${CSS.escape(requestedFocus)}"]`);
    if (requested) requested.checked = true;
  }
  const requestedModules = new Set((params.get("modules") || "").split(",").filter(Boolean));
  optionInputs.forEach(input => { if (requestedModules.has(input.value)) input.checked = true; });
  focusInputs.forEach(input => input.addEventListener("change", render));
  optionInputs.forEach(input => input.addEventListener("change", render));
  root.querySelector("[data-cv-print]")?.addEventListener("click", () => { render(); window.print(); });
  root.querySelector("[data-cv-copy]")?.addEventListener("click", async event => {
    render();
    const preview = root.querySelector(".cv-v3__preview");
    const output = `${nameNode.textContent}\n${data.contact.location} · ${data.contact.phone} · ${data.contact.email}\n\n${preview.innerText.trim()}`;
    try {
      await navigator.clipboard.writeText(output);
      const button = event.currentTarget;
      const old = button.textContent;
      button.textContent = "Copied";
      setTimeout(() => button.textContent = old, 1400);
    } catch {
      const area = document.createElement("textarea");
      area.value = output;
      document.body.append(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
  });
  render();
})();
