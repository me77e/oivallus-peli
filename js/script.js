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
    customLabel = "Vapaa päättely";
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
  // Kiintea looginen esimerkki: rivi = muoto ja vari, sarake = lukumaara.
  function makeCards() {
    const { cols, count } = gridSizes[gridSize];
    const examples = [
      { shape: "heart", color: "#e979ad", shapeName: "sydän", colorName: "vaaleanpunainen" },
      { shape: "star", color: "#e9a638", shapeName: "tähti", colorName: "keltainen" },
      { shape: "circle", color: "#4386dc", shapeName: "ympyrä", colorName: "sininen" },
      { shape: "triangle", color: "#36a886", shapeName: "kolmio", colorName: "vihreä" },
      { shape: "square", color: "#995dcb", shapeName: "neliö", colorName: "violetti" },
      { shape: "diamond", color: "#e35b64", shapeName: "vinoneliö", colorName: "punainen" },
      { shape: "heart", color: "#4386dc", shapeName: "sydän", colorName: "sininen" },
      { shape: "star", color: "#36a886", shapeName: "tähti", colorName: "vihreä" },
      { shape: "circle", color: "#e979ad", shapeName: "ympyrä", colorName: "vaaleanpunainen" },
      { shape: "triangle", color: "#e9a638", shapeName: "kolmio", colorName: "keltainen" }
    ];
    return Array.from({ length: count }, (_, id) => {
      const row = Math.floor(id / cols);
      const column = id % cols;
      return { id, ...examples[row % examples.length], count: column + 1 };
    });
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
      if (selected.includes(i)) {
        if (c.image) {
          const img = document.createElement("img");
          img.src = c.image;
          img.alt = "Kuva " + (i + 1);
          b.appendChild(img);
        } else if (c.text) {
          const span = document.createElement("span");
          span.className = "symbol-card";
          span.textContent = c.text;
          b.appendChild(span);
        } else if (c.fill) {
          const dot = document.createElement("span");
          dot.className = "color-card";
          dot.style.backgroundColor = c.fill;
          b.appendChild(dot);
        } else {
          b.innerHTML = picture(c);
        }
      }
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
    selected = [];
    cards = customMode
      ? customPictures.slice(0, gridSizes[gridSize].count)
          .map((item, id) => ({ id, ...(typeof item === "string" ? {image:item} : item) }))
      : makeCards();
    ruleEl.textContent = "Mitä yhteistä huomaat kuvissa? 🔎";
    feedback.className = "feedback";
    feedback.textContent = "Avaa kortteja yksi kerrallaan ja keksi itse, mitä yhteistä kuvissa on. Kuvien paikat eivät vaihdu.";
    render();
  }
  function pick(i) {
    if (selected.includes(i)) return;
    selected.push(i);
    if (selected.length === gridSizes[gridSize].count) {
      feedback.textContent =
        "🎉 Kaikki kortit ovat auki! Kerro oma oivalluksesi. Voit juhlia onnistumista tai aloittaa uuden kierroksen.";
      feedback.className = "feedback complete";
    } else {
      feedback.textContent = `Kortti ${selected.length}/${gridSizes[gridSize].count} avattu. Avaa seuraava kortti!`;
    }
    render();
  }
  const rows = root.getElementById("uploadRows");
  const itemType = root.getElementById("itemType"), itemValue = root.getElementById("itemValue"), itemColor = root.getElementById("itemColor"), itemFile = root.getElementById("itemFile");
  let selectedImage = null;
  itemFile.addEventListener("change", async () => {
    if (!itemFile.files?.[0]) return;
    try { selectedImage = await resizeImage(itemFile.files[0]); root.getElementById("uploadStatus").textContent = "Kuva valittu. Napsauta ruutuja, joihin haluat sijoittaa sen."; }
    catch { root.getElementById("uploadStatus").textContent = "Kuvan lataus epäonnistui."; }
  });
  function currentItem() {
    if (itemType.value === "image") return selectedImage ? {image:selectedImage} : null;
    if (itemType.value === "color") return {fill:itemColor.value};
    return {text:itemValue.value.trim() || (itemType.value === "number" ? "1" : "A")};
  }
  function updateRows() {
    const {cols,count} = gridSizes[gridSize];
    rows.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    rows.innerHTML = "";
    for (let i=0;i<count;i++) {
      const btn=document.createElement("button"); btn.type="button"; btn.className="editor-cell";
      btn.draggable=!!customPictures[i]; btn.dataset.index=i;
      const item=customPictures[i];
      if(item?.image || typeof item === "string") { const img=document.createElement("img"); img.src=typeof item === "string" ? item : item.image; img.alt=`Kuva ${i+1}`; btn.appendChild(img); }
      else if(item?.text) { const el=document.createElement("strong"); el.textContent=item.text; btn.appendChild(el); }
      else if(item?.fill) { const dot=document.createElement("span"); dot.className="color-card"; dot.style.backgroundColor=item.fill; btn.appendChild(dot); }
      else btn.textContent="+";
      btn.title=`Ruutu ${i+1}. Napsauta sijoittaaksesi, oikea klikkaus tyhjentää.`;
      btn.setAttribute("aria-label",`Ruutu ${i+1}`);
      btn.addEventListener("click",()=>{const chosen=currentItem(); if(!chosen){root.getElementById("uploadStatus").textContent="Valitse ensin kuvatiedosto.";return;} customPictures[i]={...chosen};updateRows();});
      btn.addEventListener("contextmenu",e=>{e.preventDefault();customPictures[i]=null;updateRows();});
      btn.addEventListener("dragstart",e=>e.dataTransfer.setData("text/plain",String(i)));
      btn.addEventListener("dragover",e=>e.preventDefault());
      btn.addEventListener("drop",e=>{e.preventDefault();const from=Number(e.dataTransfer.getData("text/plain"));if(Number.isInteger(from)&&from>=0&&from<count&&customPictures[from]){customPictures[i]={...customPictures[from]};updateRows();}});
      rows.appendChild(btn);
    }
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
    customLabel = game.rule || "Vapaa päättely";
    root.getElementById("setName").value = game.name;
    root.getElementById("customRule").value = customLabel;
    updateRows();
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
    root.getElementById("customRule").value = "Vapaa päättely";
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
    const chosenImages = customPictures.slice(0, gridSizes[gridSize].count);
    if (chosenImages.some((x) => !x)) {
      status.textContent =
        "Täytä ensin kaikki " + gridSizes[gridSize].count + " ruutua.";
      return;
    }
    if (!db) {
      status.textContent =
        "Tallennus ei ole käytettävissä tässä selaimessa. Kokeile avata peli tavallisessa selaimessa.";
      return;
    }
    customLabel =
      root.getElementById("customRule").value.trim() ||
      "Vapaa päättely";
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


