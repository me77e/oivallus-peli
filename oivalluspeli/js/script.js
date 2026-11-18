(() => {
  "use strict";
  const root = document;
  const board = root.getElementById("board"),
    ruleEl = root.getElementById("rule"),
    feedback = root.getElementById("feedback"),
    roundEl = root.getElementById("round"),
    pairsEl = root.getElementById("pairs"),
    scoreEl = root.getElementById("score");
  const colors = [
    "#e35b64",
    "#4386dc",
    "#e9a638",
    "#36a886",
    "#995dcb",
    "#e979ad",
  ];
  const shapes = ["circle", "square", "triangle", "star", "heart", "diamond"];
  let activeSetId = null,
    editingSetId = null,
    db = null;
  let customMode = false,
    customPictures = Array(30).fill(null),
    customLabel = "Etsi yhteen kuuluvat kuvat 🧩";
  const gridSizes = {
    "4x4": { cols: 4, count: 16 },
    "4x6": { cols: 4, count: 24 },
    "3x10": { cols: 3, count: 30 },
  };
  let gridSize = "4x4";
  const rules = [
    { key: "color", label: "Etsi sama väri 🎨" },
    { key: "count", label: "Etsi sama lukumäärä 🔢" },
    { key: "shape", label: "Etsi sama muoto 🔷" },
  ];
  let round = 0,
    score = 0,
    found = 0,
    selected = [],
    locked = false,
    cards = [],
    current = null,
    waitTimer = null;
  const shuffle = (a) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  function shapeSvg(shape, x, y, color, size) {
    let content = "";
    const base = `fill="${color}" stroke="#293747" stroke-width="1.4" stroke-linejoin="round"`;
    if (shape === "circle")
      content = `<circle cx="${x}" cy="${y}" r="${size * 0.39}" ${base}/>`;
    if (shape === "square")
      content = `<rect x="${x - size * 0.37}" y="${y - size * 0.37}" width="${size * 0.74}" height="${size * 0.74}" rx="3" ${base}/>`;
    if (shape === "triangle")
      content = `<polygon points="${x},${y - size * 0.46} ${x - size * 0.45},${y + size * 0.39} ${x + size * 0.45},${y + size * 0.39}" ${base}/>`;
    if (shape === "diamond")
      content = `<polygon points="${x},${y - size * 0.48} ${x + size * 0.43},${y} ${x},${y + size * 0.48} ${x - size * 0.43},${y}" ${base}/>`;
    if (shape === "heart")
      content = `<path d="M ${x} ${y + size * 0.4} C ${x - size * 0.9} ${y - size * 0.05},${x - size * 0.42} ${y - size * 0.6},${x} ${y - size * 0.22} C ${x + size * 0.42} ${y - size * 0.6},${x + size * 0.9} ${y - size * 0.05},${x} ${y + size * 0.4} Z" ${base}/>`;
    if (shape === "star") {
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5,
          r = i % 2 ? size * 0.21 : size * 0.48;
        pts.push(`${x + Math.cos(a) * r},${y + Math.sin(a) * r}`);
      }
      content = `<polygon points="${pts.join(" ")}" ${base}/>`;
    }
    return content;
  }
  function picture(c) {
    const pos = [
      [50, 50],
      [31, 50],
      [69, 50],
      [31, 30],
      [69, 30],
      [31, 70],
      [69, 70],
    ];
    const positions =
      c.count === 1
        ? [[50, 50]]
        : c.count === 2
          ? [
              [32, 50],
              [68, 50],
            ]
          : c.count === 3
            ? [
                [50, 29],
                [29, 68],
                [71, 68],
              ]
            : c.count === 4
              ? [
                  [31, 31],
                  [69, 31],
                  [31, 69],
                  [69, 69],
                ]
              : c.count === 5
                ? [
                    [30, 30],
                    [70, 30],
                    [50, 50],
                    [30, 70],
                    [70, 70],
                  ]
                : [
                    [27, 27],
                    [50, 27],
                    [73, 27],
                    [27, 73],
                    [50, 73],
                    [73, 73],
                  ];
    const size =
      c.count <= 2 ? 35 : c.count === 3 ? 30 : c.count === 4 ? 27 : 24;
    return `<svg viewBox="0 0 100 100" role="img" aria-label="${c.count} kappaletta, ${c.colorName}, ${c.shapeName}"><rect x="1" y="1" width="98" height="98" rx="13" fill="#fff"/>${positions.map(([x, y]) => shapeSvg(c.shape, x, y, c.color, size)).join("")}</svg>`;
  }
  const colorNames = [
      "punainen",
      "sininen",
      "keltainen",
      "vihreä",
      "violetti",
      "vaaleanpunainen",
    ],
    shapeNames = ["ympyrä", "neliö", "kolmio", "tähti", "sydän", "vinoneliö"];
  function makeCards(key) {
    const out = [];
    for (let p = 0; p < gridSizes[gridSize].count / 2; p++) {
      for (let j = 0; j < 2; j++) {
        const idx = p * 2 + j;
        let ci = (p * 3 + j * 2) % 6,
          si = (p * 2 + j * 3) % 6,
          n = ((p + j * 2) % 6) + 1;
        if (key === "color") ci = p % 6;
        if (key === "shape") si = p % 6;
        if (key === "count") n = (p % 6) + 1;
        out.push({
          id: idx,
          color: colors[ci],
          colorName: colorNames[ci],
          shape: shapes[si],
          shapeName: shapeNames[si],
          count: n,
          matched: false,
        });
      }
    }
    return shuffle(out);
  }
  function render() {
    const total = gridSizes[gridSize].count;
    board.dataset.cols = gridSizes[gridSize].cols;
    board.setAttribute("aria-label", total + " kuvakorttia");
    board.innerHTML = "";
    cards.forEach((c, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className =
        "card" +
        (c.matched ? " matched" : "") +
        (selected.includes(i) ? " selected" : "");
      b.setAttribute(
        "aria-label",
        c.matched || selected.includes(i)
          ? customMode
            ? `Kortti ${i + 1}, kuva näkyvissä`
            : `Kortti ${i + 1}: ${c.count} ${c.shapeName}, väri ${c.colorName}`
          : `Kortti ${i + 1}, kuvapuoli alaspäin`,
      );
      b.setAttribute("aria-pressed", selected.includes(i) ? "true" : "false");
      b.disabled = c.matched || selected.includes(i);
      b.innerHTML = c.image
        ? `<img src="${c.image}" alt="Kuvakortti">`
        : picture(c);
      b.addEventListener("click", () => pick(i));
      board.appendChild(b);
    });
    roundEl.textContent = `Kierros ${round}`;
    pairsEl.textContent = `Avattu ${selected.length} / ${total}`;
    scoreEl.textContent = `Kortteja ${total}`;
  }
  function start() {
    if (waitTimer) clearTimeout(waitTimer);
    waitTimer = null;
    round++;
    found = 0;
    selected = [];
    locked = false;
    current = rules[(round - 1) % 3];
    cards = customMode
      ? shuffle(
          customPictures
            .slice(0, gridSizes[gridSize].count)
            .map((image, id) => ({
              id,
              image,
              group: Math.floor(id / 2),
              matched: false,
            })),
        )
      : makeCards(current.key);
    ruleEl.textContent = customMode ? customLabel : current.label;
    feedback.className = "feedback";
    feedback.textContent =
      "Avaa kortteja yksi kerrallaan. Jokainen kortti jää näkyviin.";
    render();
  }
  function pick(i) {
    if (selected.includes(i)) return;
    selected.push(i);
    if (selected.length === gridSizes[gridSize].count) {
      feedback.textContent =
        "🎉 Kaikki kortit ovat nyt auki! Tutki kuvia rauhassa tai aloita uusi kierros.";
      feedback.className = "feedback complete";
    } else {
      feedback.textContent = `Kortti ${selected.length}/${gridSizes[gridSize].count} avattu. Avaa seuraava kortti!`;
    }
    render();
  }
  const uploadInputs = [],
    previews = [];
  function updateRows() {
    const count = gridSizes[gridSize].count;
    rows
      .querySelectorAll(".pairrow")
      .forEach((row) => (row.hidden = Number(row.dataset.pair) >= count / 2));
    root.getElementById("uploadStatus").textContent =
      "Lisää " + count + " kuvaa (" + count / 2 + " paria).";
  }
  const rows = root.getElementById("uploadRows");
  for (let pair = 0; pair < 15; pair++) {
    const row = document.createElement("div");
    row.className = "pairrow";
    row.dataset.pair = pair;
    const heading = document.createElement("strong");
    heading.textContent = `Pari ${pair + 1}`;
    row.appendChild(heading);
    for (let side = 0; side < 2; side++) {
      const id = pair * 2 + side;
      const label = document.createElement("label");
      label.textContent = `Kuva ${side + 1}`;
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.setAttribute("aria-label", `Pari ${pair + 1}, kuva ${side + 1}`);
      uploadInputs[id] = input;
      const preview = document.createElement("img");
      preview.hidden = true;
      previews[id] = preview;
      input.addEventListener("change", () => {
        const file = input.files && input.files[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
          root.getElementById("uploadStatus").textContent =
            "Valitse kuvatiedosto.";
          return;
        }
        resizeImage(file)
          .then((data) => {
            customPictures[id] = data;
            preview.src = data;
            preview.hidden = false;
            root.getElementById("uploadStatus").textContent =
              `Lisätty ${customPictures.slice(0, gridSizes[gridSize].count).filter(Boolean).length}/${gridSizes[gridSize].count} kuvaa.`;
          })
          .catch(
            () =>
              (root.getElementById("uploadStatus").textContent =
                "Kuvan lukeminen epäonnistui."),
          );
      });
      label.append(input, preview);
      row.appendChild(label);
    }
    rows.appendChild(row);
  }
  function resizeImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image(),
        url = URL.createObjectURL(file);
      img.onload = () => {
        try {
          const scale = Math.min(1, 600 / Math.max(img.width, img.height)),
            canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          canvas
            .getContext("2d")
            .drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.78));
        } catch (e) {
          reject(e);
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Kuva ei avaudu"));
      };
      img.src = url;
    });
  }
  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("oivallus-pelit", 1);
      req.onupgradeneeded = () =>
        req.result.createObjectStore("games", { keyPath: "id" });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function store(method, value) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction("games", "readwrite"),
        req = tx.objectStore("games")[method](value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function listSets() {
    return new Promise((resolve, reject) => {
      const req = db
        .transaction("games", "readonly")
        .objectStore("games")
        .getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  const saved = root.getElementById("savedGames");
  async function renderSaved() {
    if (!db) return;
    const games = await listSets();
    saved.innerHTML = "";
    if (!games.length) {
      saved.textContent = "Tallennettuja pelejä ei vielä ole.";
      return;
    }
    games
      .sort((a, b) => b.created - a.created)
      .forEach((game) => {
        const row = document.createElement("div");
        row.className = "saved-item";
        const open = document.createElement("button");
        open.type = "button";
        open.className =
          "saved-open" + (activeSetId === game.id ? " active-set" : "");
        open.textContent = "🃏 " + game.name;
        open.addEventListener("click", () => loadGame(game));
        const del = document.createElement("button");
        del.type = "button";
        del.className = "saved-delete";
        del.textContent = "✕";
        del.setAttribute("aria-label", "Poista peli " + game.name);
        del.addEventListener("click", async () => {
          if (
            !confirm(
              "Poistetaanko peli " + game.name + " pysyvästi tästä selaimesta?",
            )
          )
            return;
          await store("delete", game.id);
          if (activeSetId === game.id) {
            activeSetId = null;
            customMode = false;
            round = 0;
            score = 0;
            start();
          }
          if (editingSetId === game.id) editingSetId = null;
          await renderSaved();
        });
        row.append(open, del);
        saved.appendChild(row);
      });
  }
  function loadGame(game) {
    activeSetId = game.id;
    editingSetId = game.id;
    gridSize = gridSizes[game.gridSize]
      ? game.gridSize
      : game.images.length === 12
        ? "4x4"
        : "4x4";
    root.getElementById("gridSize").value = gridSize;
    customPictures = Array(30).fill(null);
    game.images.forEach((img, i) => (customPictures[i] = img));
    updateRows();
    customLabel = game.rule;
    root.getElementById("setName").value = game.name;
    root.getElementById("customRule").value = game.rule;
    customPictures.forEach((img, i) => {
      if (img) {
        previews[i].src = img;
        previews[i].hidden = false;
      } else {
        previews[i].removeAttribute("src");
        previews[i].hidden = true;
      }
      uploadInputs[i].value = "";
    });
    customMode = true;
    round = 0;
    score = 0;
    start();
    root.getElementById("editor").open = false;
    renderSaved();
  }
  function newSet() {
    editingSetId = null;
    activeSetId = null;
    customPictures = Array(30).fill(null);
    root.getElementById("setName").value = "Oma kuvapeli";
    root.getElementById("customRule").value = "Etsi yhteen kuuluvat kuvat 🧩";
    previews.forEach((p, i) => {
      p.removeAttribute("src");
      p.hidden = true;
      uploadInputs[i].value = "";
    });
    updateRows();
    root.getElementById("editor").open = true;
    root.getElementById("setName").focus();
    renderSaved();
  }
  root.getElementById("gridSize").addEventListener("change", (e) => {
    gridSize = e.target.value;
    updateRows();
    if (
      customMode &&
      customPictures.slice(0, gridSizes[gridSize].count).some((x) => !x)
    ) {
      customMode = false;
      activeSetId = null;
    }
    round = 0;
    start();
  });
  updateRows();
  root.getElementById("newSet").addEventListener("click", newSet);
  root.getElementById("useCustom").addEventListener("click", async () => {
    const status = root.getElementById("uploadStatus");
    if (customPictures.slice(0, gridSizes[gridSize].count).some((x) => !x)) {
      status.textContent =
        "Lisää ensin kaikki " + gridSizes[gridSize].count + " kuvaa.";
      return;
    }
    if (!db) {
      status.textContent =
        "Tallennus ei ole käytettävissä tässä selaimessa. Kokeile avata peli tavallisessa selaimessa.";
      return;
    }
    customLabel =
      root.getElementById("customRule").value.trim() ||
      "Etsi yhteen kuuluvat kuvat 🧩";
    const name = root.getElementById("setName").value.trim() || "Oma kuvapeli",
      id =
        editingSetId ||
        "peli-" + Date.now() + "-" + Math.random().toString(36).slice(2);
    try {
      await store("put", {
        id,
        name,
        rule: customLabel,
        images: customPictures.slice(0, gridSizes[gridSize].count),
        gridSize,
        created: Date.now(),
      });
      editingSetId = id;
      activeSetId = id;
      customMode = true;
      round = 0;
      score = 0;
      start();
      await renderSaved();
      status.textContent = "Peli tallennettu!";
      root.getElementById("editor").open = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      status.textContent =
        "Tallennus epäonnistui. Selaimen tallennustila voi olla täynnä.";
    }
  });
  root.getElementById("useDemo").addEventListener("click", () => {
    activeSetId = null;
    customMode = false;
    round = 0;
    score = 0;
    start();
    root.getElementById("editor").open = false;
    renderSaved();
  });
  if ("indexedDB" in window) {
    openDb()
      .then((database) => {
        db = database;
        renderSaved();
      })
      .catch(
        () =>
          (saved.textContent =
            "Tallennus ei ole käytettävissä tässä selaimessa."),
      );
  } else saved.textContent = "Tallennus ei ole käytettävissä tässä selaimessa.";
  root.getElementById("next").addEventListener("click", start);
  root.getElementById("reset").addEventListener("click", () => {
    round = 0;
    score = 0;
    start();
  });
  gridSize = "4x4";
  root.getElementById("gridSize").value = "4x4";
  updateRows();
  start();
})();

/* Oivallus-pelin juhla-animaatio */

const celebrateBtn = document.getElementById("celebrateBtn");

if (celebrateBtn) {
  celebrateBtn.addEventListener("click", () => {
    // Luodaan juhla-animaation kerros
    const celebration = document.createElement("div");
    celebration.className = "celebration-overlay";

    // Onnitteluteksti
    const message = document.createElement("div");
    message.className = "celebration-message";
    message.textContent = "🎉 HIENOSTI OIVALLETTU! 🎉";

    celebration.appendChild(message);
    document.body.appendChild(celebration);

    // Luodaan 180 putoavaa konfettia ja serpentiiniä
    const colors = [
      "#ff4081",
      "#ffeb3b",
      "#4caf50",
      "#2196f3",
      "#ff9800",
      "#9c27b0",
      "#00bcd4",
    ];

    for (let i = 0; i < 180; i++) {
      const confetti = document.createElement("span");
      confetti.className = "confetti";

      const color = colors[Math.floor(Math.random() * colors.length)];

      confetti.style.backgroundColor = color;
      confetti.style.left = Math.random() * 100 + "%";
      confetti.style.animationDelay = Math.random() * 3 + "s";
      confetti.style.animationDuration = 3 + Math.random() * 3 + "s";

      // Osa konfeteista on pitkiä serpentiinejä
      if (i % 4 === 0) {
        confetti.classList.add("streamer");
      }

      celebration.appendChild(confetti);
    }

    // Suljetaan juhla klikkaamalla
    celebration.addEventListener("click", () => {
      celebration.remove();
    });

    // Suljetaan automaattisesti 8 sekunnin jälkeen
    setTimeout(() => {
      celebration.remove();
    }, 8000);
  });
}

