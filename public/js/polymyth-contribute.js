(function () {
  "use strict";
  const form = document.getElementById("contribution-composer");
  if (!form) return;
  const kind = document.getElementById("contribution-kind");
  const record = document.getElementById("contribution-record");
  const note = document.getElementById("contribution-note");
  const evidence = document.getElementById("contribution-evidence");
  const openEmail = document.getElementById("contribution-email");

  const params = new URLSearchParams(location.search);
  if (params.get("record")) record.value = params.get("record");
  const kinds = {
    status: "Correct a record",
    correction: "Correct a record",
    "broken-link": "Report a broken link",
    relationship: "Propose a relationship",
    representative: "Project representative submission",
    preservation: "Add a preservation route",
  };
  if (kinds[params.get("kind")]) kind.value = kinds[params.get("kind")];

  function update() {
    const subject =
      "Polymyth Commons — " +
      kind.value +
      (record.value ? " — " + record.value : "");
    const body = [
      "Contribution type: " + kind.value,
      "Record ID or project name: " + (record.value || "[add here]"),
      "",
      "What should change or be added:",
      note.value || "[add here]",
      "",
      "Direct evidence URLs:",
      evidence.value || "[add one URL per line]",
      "",
      "Your relationship to the project, if relevant:",
      "[add here]",
    ].join("\n");
    openEmail.href =
      "mailto:saulnassau@protonmail.com?subject=" +
      encodeURIComponent(subject) +
      "&body=" +
      encodeURIComponent(body);
  }

  form.addEventListener("input", update);
  form.addEventListener("change", update);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    location.href = openEmail.href;
  });
  update();
})();
