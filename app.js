(() => {
  "use strict";

  // ---------- Configuración ----------
  const EXAM_N = 20;
  const EXAM_SECONDS = 17 * 60;
  const LETTERS = ["A", "B", "C", "D"];
  const NS = "scp1:";

  // ---------- Datos ----------
  const TEMAS = (window.QBANK || []).slice().sort((a, b) => a.tema - b.tema);
  const ALL = [];
  TEMAS.forEach(t => {
    t.preguntas.forEach((p, i) => {
      ALL.push({
        id: `t${t.tema}-${i + 1}`,
        tema: t.tema,
        q: p[0],
        opts: [p[1], p[2], p[3], p[4]], // índice 0 = correcta
        exp: p[5],
        hard: p[6] === 1
      });
    });
  });
  const TEMA_TITLE = Object.fromEntries(TEMAS.map(t => [t.tema, t.titulo]));

  // ---------- Almacenamiento ----------
  const store = {
    get(k, d) {
      try { const v = localStorage.getItem(NS + k); return v ? JSON.parse(v) : d; } catch (e) { return d; }
    },
    set(k, v) {
      try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ }
    },
    del(k) { try { localStorage.removeItem(NS + k); } catch (e) { } }
  };
  let stats = store.get("stats", {});        // id -> {c, w, last}
  let history = store.get("history", []);    // simulacros [{date, grade, ok, ko, blank, secs, penalty}]
  let settings = Object.assign({ penalty: 0, allOrder: "random" }, store.get("settings", {}));

  function record(id, ok) {
    const s = stats[id] || { c: 0, w: 0, last: null };
    if (ok) s.c++; else s.w++;
    s.last = ok ? 1 : 0;
    stats[id] = s;
    store.set("stats", stats);
  }
  const isFailed = q => stats[q.id] && stats[q.id].last === 0;
  const isMastered = q => stats[q.id] && stats[q.id].last === 1;

  // ---------- Utilidades ----------
  const $app = document.getElementById("app");
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function shuffle(a) {
    const r = a.slice();
    for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
    return r;
  }
  const fmtTime = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const fmtNum = n => (Math.round(n * 100) / 100).toLocaleString("es-ES", { maximumFractionDigits: 2 });
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

  const ICONS = {
    exam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5V5a2 2 0 0 1 2-2h14v16H6.5a2.5 2.5 0 0 0 0 5H20"/></svg>',
    sliders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/></svg>',
    redo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
    stack: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    flag: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22V4M4 4h13l-2 4 2 4H4"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
  };

  // ---------- Tema claro/oscuro ----------
  function applyTheme() {
    const t = store.get("theme", null);
    if (t) document.documentElement.setAttribute("data-theme", t);
    else document.documentElement.removeAttribute("data-theme");
  }
  function isDark() {
    const t = document.documentElement.getAttribute("data-theme");
    if (t) return t === "dark";
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function toggleTheme() {
    store.set("theme", isDark() ? "light" : "dark");
    applyTheme();
    render();
  }
  applyTheme();

  // ---------- Estado ----------
  let view = "home";   // home | quiz | exam | results
  let session = null;
  let timerId = null;
  let modal = null;

  function makeSession(mode, title, questions) {
    return {
      mode, title,
      items: questions.map(q => ({ q, order: shuffle([0, 1, 2, 3]), sel: null, checked: false, flag: false })),
      idx: 0,
      started: Date.now(),
      ended: null
    };
  }

  // Selección de preguntas
  function pickExam() {
    // 20 preguntas repartidas entre los 6 temas (3 por tema + 2 extra en temas aleatorios)
    const temas = TEMAS.map(t => t.tema);
    const per = Math.floor(EXAM_N / temas.length);
    const extra = EXAM_N - per * temas.length;
    const extraTemas = new Set(shuffle(temas).slice(0, extra));
    let chosen = [];
    temas.forEach(t => {
      const n = per + (extraTemas.has(t) ? 1 : 0);
      chosen = chosen.concat(shuffle(ALL.filter(q => q.tema === t)).slice(0, n));
    });
    return shuffle(chosen);
  }

  // ---------- Acciones ----------
  function start(mode, opts = {}) {
    let qs = [], title = "";
    if (mode === "tema") {
      qs = shuffle(ALL.filter(q => q.tema === opts.tema));
      title = `Tema ${opts.tema} · ${TEMA_TITLE[opts.tema]}`;
    } else if (mode === "failed") {
      qs = shuffle(ALL.filter(q => isFailed(q) && (!opts.tema || q.tema === opts.tema)));
      title = opts.tema ? `Falladas · Tema ${opts.tema}` : "Preguntas falladas";
    } else if (mode === "all") {
      qs = settings.allOrder === "tema" ? ALL.slice() : shuffle(ALL);
      title = "Todas las preguntas";
    } else if (mode === "custom") {
      const pool = ALL.filter(q => opts.temas.includes(q.tema) && (!opts.hard || q.hard));
      qs = shuffle(pool).slice(0, Math.max(1, Math.min(opts.n, pool.length)));
      title = `Test personalizado${opts.hard ? " (difíciles)" : ""} · ${qs.length} preguntas`;
    } else if (mode === "retry") {
      qs = shuffle(opts.questions);
      title = "Repaso de los fallos";
    } else if (mode === "exam") {
      qs = pickExam();
      title = "Simulacro de examen";
    }
    if (!qs.length) return;
    session = makeSession(mode, title, qs);
    if (mode === "exam") {
      session.penalty = settings.penalty;
      session.deadline = Date.now() + EXAM_SECONDS * 1000;
      view = "exam";
      startTimer();
    } else {
      view = "quiz";
    }
    render();
    window.scrollTo(0, 0);
  }

  function goHome() {
    stopTimer();
    session = null;
    view = "home";
    render();
    window.scrollTo(0, 0);
  }

  function confirmBox(title, text, okLabel, onOk, danger) {
    modal = { title, text, okLabel, onOk, danger };
    render();
  }

  // ---------- Temporizador ----------
  function startTimer() {
    stopTimer();
    timerId = setInterval(tickTimer, 250);
    tickTimer();
  }
  function stopTimer() { if (timerId) clearInterval(timerId); timerId = null; }
  function remaining() { return Math.max(0, Math.ceil((session.deadline - Date.now()) / 1000)); }
  function tickTimer() {
    if (!session || view !== "exam") return stopTimer();
    const r = remaining();
    const el = document.getElementById("timer");
    if (el) {
      el.querySelector("span").textContent = fmtTime(r);
      el.classList.toggle("warn", r <= 180 && r > 60);
      el.classList.toggle("danger", r <= 60);
    }
    if (r <= 0) { modal = null; submitExam(true); }
  }

  function submitExam(auto) {
    stopTimer();
    const s = session;
    s.ended = Date.now();
    s.auto = !!auto;
    let ok = 0, ko = 0, blank = 0;
    s.items.forEach(it => {
      it.checked = true;
      if (it.sel === null) { blank++; return; }
      const good = it.order[it.sel] === 0;
      if (good) ok++; else ko++;
      record(it.q.id, good);
    });
    const raw = ok - ko * s.penalty;
    const grade = Math.max(0, raw) / s.items.length * 10;
    s.result = { ok, ko, blank, raw, grade, secs: Math.min(EXAM_SECONDS, Math.round((s.ended - s.started) / 1000)) };
    history.unshift({ date: s.ended, grade, ok, ko, blank, secs: s.result.secs, penalty: s.penalty });
    history = history.slice(0, 30);
    store.set("history", history);
    view = "results";
    s.filter = "all";
    render();
    window.scrollTo(0, 0);
  }

  function finishQuiz() {
    session.ended = Date.now();
    session.filter = "all";
    view = "results";
    render();
    window.scrollTo(0, 0);
  }

  // ---------- Render ----------
  function render() {
    let html = "";
    if (view === "home") html = renderHome();
    else if (view === "quiz") html = renderQuiz();
    else if (view === "exam") html = renderExam();
    else if (view === "results") html = renderResults();
    if (modal) html += renderModal();
    $app.innerHTML = html;
    if (view === "exam") tickTimer();
    if (modal) { const b = document.querySelector("[data-act=modal-ok]"); if (b) b.focus(); }
  }

  function themeBtn() {
    return `<button class="btn theme-toggle" data-act="theme" aria-label="Cambiar tema claro/oscuro" title="Cambiar tema">${isDark() ? ICONS.sun : ICONS.moon}</button>`;
  }

  function renderHome() {
    const total = ALL.length;
    const answered = ALL.filter(q => stats[q.id]).length;
    let c = 0, w = 0;
    Object.values(stats).forEach(s => { c += s.c; w += s.w; });
    const failed = ALL.filter(isFailed);
    const best = history.length ? Math.max(...history.map(h => h.grade)) : null;

    const temaRows = TEMAS.map(t => {
      const qs = ALL.filter(q => q.tema === t.tema);
      const m = qs.filter(isMastered).length, f = qs.filter(isFailed).length;
      return `
        <button class="tema-row" data-act="tema" data-tema="${t.tema}">
          <span class="tema-num">${t.tema}</span>
          <span>
            <span class="tema-title">${esc(t.titulo)}</span>
            <span class="tema-sub">${qs.length} preguntas · ${m} acertadas · ${f} falladas</span>
            <span class="meter" aria-hidden="true"><i class="m-ok" style="width:${pct(m, qs.length)}%"></i><i class="m-ko" style="width:${pct(f, qs.length)}%"></i></span>
          </span>
          <span class="muted" aria-hidden="true">›</span>
        </button>`;
    }).join("");

    const failedByTema = TEMAS.map(t => {
      const n = failed.filter(q => q.tema === t.tema).length;
      return `<button class="btn sm" data-act="failed" data-tema="${t.tema}" ${n ? "" : "disabled"}>T${t.tema} · ${n}</button>`;
    }).join("");

    const customChecks = TEMAS.map(t => `
      <label class="check"><input type="checkbox" name="ct" value="${t.tema}" checked> Tema ${t.tema}</label>`).join("");

    const hist = history.slice(0, 6).map(h => {
      const d = new Date(h.date);
      return `<li><span>${d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })} ${d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</span>
        <span class="muted small">${h.ok}✓ ${h.ko}✗ ${h.blank}○ · ${fmtTime(h.secs)}</span>
        <b style="color:var(--${h.grade >= 5 ? "ok" : "ko"})">${fmtNum(h.grade)}</b></li>`;
    }).join("");

    return `
      <header class="hero">
        <div class="spacer">
          <h1>Seguridad en las Comunicaciones</h1>
          <p class="muted">Parcial 1 · ${total} preguntas de ${TEMAS.length} temas · 4 opciones con explicación</p>
        </div>
        ${themeBtn()}
      </header>

      <section class="stats" aria-label="Tu progreso">
        <div class="stat"><b>${answered}/${total}</b><span>Preguntas vistas</span></div>
        <div class="stat"><b>${c + w ? pct(c, c + w) + "%" : "—"}</b><span>Acierto global</span></div>
        <div class="stat"><b>${failed.length}</b><span>Falladas pendientes</span></div>
        <div class="stat"><b>${best === null ? "—" : fmtNum(best)}</b><span>Mejor simulacro</span></div>
      </section>

      <div class="grid">
        <section class="card mode exam-card span2">
          <div class="mode-head"><span class="icon">${ICONS.exam}</span>
            <div><h2>Simulacro de examen</h2>
            <p class="muted">Como en Moodle: no verás si aciertas hasta entregar. Puedes moverte entre preguntas, cambiar respuestas y marcarlas para revisar.</p></div>
          </div>
          <div class="exam-facts">
            <span class="chip">${EXAM_N} preguntas</span>
            <span class="chip">${EXAM_SECONDS / 60} minutos</span>
            <span class="chip">Repartidas entre los ${TEMAS.length} temas</span>
          </div>
          <div class="row">
            <div class="field" style="margin:0;min-width:220px;flex:1">
              <label for="penalty">Penalización por fallo</label>
              <select id="penalty" data-act="penalty">
                <option value="0" ${settings.penalty === 0 ? "selected" : ""}>Sin penalización</option>
                <option value="0.3333333333" ${settings.penalty > 0.3 && settings.penalty < 0.34 ? "selected" : ""}>−1/3 por fallo (cada 3 fallos restan 1 acierto)</option>
                <option value="0.25" ${settings.penalty === 0.25 ? "selected" : ""}>−1/4 por fallo</option>
              </select>
            </div>
            <button class="btn primary" data-act="exam" style="align-self:flex-end">Empezar simulacro</button>
          </div>
        </section>

        <section class="card mode span2">
          <div class="mode-head"><span class="icon">${ICONS.book}</span>
            <div><h2>Test por tema</h2><p class="muted">Todas las preguntas de un tema en orden aleatorio, con corrección y explicación al momento.</p></div>
          </div>
          <div class="temas">${temaRows}</div>
        </section>

        <section class="card mode">
          <div class="mode-head"><span class="icon">${ICONS.sliders}</span>
            <div><h2>Test personalizado</h2><p class="muted">Elige cuántas preguntas y de qué temas.</p></div>
          </div>
          <div class="field">
            <label for="cn">Número de preguntas</label>
            <input id="cn" type="number" min="1" max="${total}" value="${store.get("customN", 30)}" inputmode="numeric">
          </div>
          <div class="field">
            <label>Temas</label>
            <div class="checks">${customChecks}</div>
          </div>
          <div class="field">
            <label class="check"><input type="checkbox" id="chard" ${store.get("customHard", false) ? "checked" : ""}> Solo preguntas difíciles (${ALL.filter(q => q.hard).length})</label>
          </div>
          <button class="btn primary block" data-act="custom">Generar test</button>
        </section>

        <section class="card mode">
          <div class="mode-head"><span class="icon">${ICONS.redo}</span>
            <div><h2>Preguntas falladas</h2><p class="muted">Las que fallaste la última vez que te salieron. Al acertarlas desaparecen de aquí.</p></div>
          </div>
          <p><b style="font-size:1.6rem">${failed.length}</b> <span class="muted">pendientes</span></p>
          <div class="row" style="margin-bottom:14px">${failedByTema}</div>
          <button class="btn primary block" data-act="failed" ${failed.length ? "" : "disabled"}>Repasar todas las falladas</button>
        </section>

        <section class="card mode">
          <div class="mode-head"><span class="icon">${ICONS.stack}</span>
            <div><h2>Todas las preguntas</h2><p class="muted">El banco completo: ${total} preguntas seguidas.</p></div>
          </div>
          <div class="field">
            <label for="allorder">Orden</label>
            <select id="allorder" data-act="allorder">
              <option value="random" ${settings.allOrder === "random" ? "selected" : ""}>Aleatorio (mezcla todos los temas)</option>
              <option value="tema" ${settings.allOrder === "tema" ? "selected" : ""}>Agrupadas por tema (1 → 6)</option>
            </select>
          </div>
          <button class="btn primary block" data-act="all">Empezar</button>
        </section>

        <section class="card mode">
          <div class="mode-head"><span class="icon">${ICONS.clock}</span>
            <div><h2>Historial de simulacros</h2><p class="muted">Últimos intentos (nota sobre 10).</p></div>
          </div>
          ${hist ? `<ul class="history">${hist}</ul>` : `<p class="muted small">Todavía no has hecho ningún simulacro.</p>`}
        </section>
      </div>

      <footer class="footer">
        <span class="muted small">El progreso se guarda solo en este navegador.</span>
        <button class="btn sm danger" data-act="reset">Borrar progreso</button>
      </footer>`;
  }

  function optionsHTML(it, mode) {
    // mode: "quiz" | "exam" | "review"
    return it.order.map((oi, pos) => {
      const isSel = it.sel === pos;
      const isRight = oi === 0;
      let cls = "opt", tag = "";
      if (mode === "quiz" && it.checked || mode === "review") {
        if (isRight) { cls += " correct"; tag = isSel ? "Tu respuesta ✓" : "Correcta"; }
        else if (isSel) { cls += " incorrect"; tag = "Tu respuesta ✗"; }
        else cls += " dim";
      } else if (isSel) cls += " selected";
      const disabled = (mode === "quiz" && it.checked) || mode === "review";
      return `<button class="${cls}" data-act="pick" data-pos="${pos}" ${disabled ? "disabled" : ""} role="radio" aria-checked="${isSel}">
          <span class="letter">${LETTERS[pos]}</span><span>${esc(it.q.opts[oi])}</span>${tag ? `<span class="tag">${tag}</span>` : ""}
        </button>`;
    }).join("");
  }

  function renderQuiz() {
    const s = session, it = s.items[s.idx], n = s.items.length;
    const done = s.items.filter(x => x.checked);
    const ok = done.filter(x => x.order[x.sel] === 0).length;
    const ko = done.length - ok;
    const isLast = s.idx === n - 1;
    let feedback = "";
    if (it.checked) {
      const good = it.order[it.sel] === 0;
      const correctPos = it.order.indexOf(0);
      feedback = `
        <div class="feedback ${good ? "ok" : "ko"}">
          <h3>${good ? "¡Correcto!" : "Incorrecto"}</h3>
          ${good ? "" : `<p>La respuesta correcta es la <b>${LETTERS[correctPos]}</b>: ${esc(it.q.opts[0])}</p>`}
          <div class="explain"><b>Explicación</b>${esc(it.q.exp)}</div>
        </div>`;
    }
    let primary;
    if (!it.checked) primary = `<button class="btn primary" data-act="check" ${it.sel === null ? "disabled" : ""}>Comprobar</button>`;
    else if (!isLast) primary = `<button class="btn primary" data-act="next">Siguiente →</button>`;
    else primary = `<button class="btn primary" data-act="finish">Ver resultados</button>`;

    return `
      <div class="qbar">
        <button class="btn sm" data-act="quit">✕ Salir</button>
        <div class="progress" aria-hidden="true"><i style="width:${pct(done.length, n)}%"></i></div>
        <span class="count">${s.idx + 1}/${n}</span>
        <span class="score"><span class="chip ok">✓ ${ok}</span><span class="chip ko">✗ ${ko}</span></span>
      </div>
      <article class="card">
        <div class="meta">
          <span class="row" style="gap:6px"><span class="chip">Tema ${it.q.tema} · ${esc(TEMA_TITLE[it.q.tema])}</span>${it.q.hard ? `<span class="chip warn">Difícil</span>` : ""}</span>
          ${s.mode === "tema" ? "" : `<span class="muted small">${esc(s.title)}</span>`}
        </div>
        <h2 class="question">${esc(it.q.q)}</h2>
        <div class="options" role="radiogroup">${optionsHTML(it, "quiz")}</div>
        ${feedback}
        <div class="actions">
          <button class="btn" data-act="prev" ${s.idx === 0 ? "disabled" : ""}>← Anterior</button>
          ${it.checked ? "" : `<button class="btn ghost" data-act="skip" ${isLast ? "disabled" : ""}>Saltar</button>`}
          <span class="spacer"></span>
          <span class="kbd-hint"><kbd>A</kbd>–<kbd>D</kbd> elegir · <kbd>Enter</kbd> ${it.checked ? "seguir" : "comprobar"}</span>
          ${primary}
        </div>
      </article>`;
  }

  function renderExam() {
    const s = session, it = s.items[s.idx], n = s.items.length;
    const answered = s.items.filter(x => x.sel !== null).length;
    const nav = s.items.map((x, i) => `<button class="navbtn ${x.sel !== null ? "answered" : ""} ${x.flag ? "flagged" : ""} ${i === s.idx ? "current" : ""}" data-act="goto" data-i="${i}" aria-label="Pregunta ${i + 1}${x.sel !== null ? ", respondida" : ""}${x.flag ? ", marcada" : ""}">${i + 1}</button>`).join("");
    return `
      <div class="qbar">
        <button class="btn sm" data-act="quit">✕</button>
        <div id="timer" class="timer" role="timer" aria-label="Tiempo restante">${ICONS.clock}<span>${fmtTime(remaining())}</span></div>
        <span class="count">${answered}/${n} respondidas</span>
        <span class="spacer"></span>
        <button class="btn sm primary" data-act="submit">Entregar</button>
      </div>
      <article class="card">
        <div class="meta">
          <span class="chip neutral">Pregunta ${s.idx + 1} de ${n}</span>
          <button class="btn sm flag ${it.flag ? "on" : ""}" data-act="flag" aria-pressed="${it.flag}">${ICONS.flag} ${it.flag ? "Marcada" : "Marcar para revisar"}</button>
        </div>
        <h2 class="question">${esc(it.q.q)}</h2>
        <div class="options" role="radiogroup">${optionsHTML(it, "exam")}</div>
        <div class="actions">
          <button class="btn" data-act="prev" ${s.idx === 0 ? "disabled" : ""}>← Anterior</button>
          ${it.sel !== null ? `<button class="btn ghost sm" data-act="clear">Quitar mi elección</button>` : ""}
          <span class="spacer"></span>
          ${s.idx < n - 1 ? `<button class="btn primary" data-act="next">Siguiente →</button>` : `<button class="btn primary" data-act="submit">Terminar y entregar</button>`}
        </div>
        <div class="navgrid" aria-label="Navegación del examen">${nav}</div>
      </article>`;
  }

  function renderResults() {
    const s = session, isExam = s.mode === "exam";
    let ok, ko, blank, hero;
    if (isExam) {
      ({ ok, ko, blank } = s.result);
      const g = s.result.grade;
      hero = `
        <div class="muted small">${s.auto ? "Tiempo agotado: entregado automáticamente" : "Simulacro entregado"}</div>
        <div class="grade ${g >= 5 ? "pass" : "fail"}">${fmtNum(g)}<small> / 10</small></div>
        <div class="result-facts">
          <span class="chip ok">✓ ${ok} aciertos</span>
          <span class="chip ko">✗ ${ko} fallos</span>
          <span class="chip neutral">○ ${blank} en blanco</span>
          <span class="chip neutral">⏱ ${fmtTime(s.result.secs)}</span>
          ${s.penalty ? `<span class="chip warn">Penalización −${s.penalty > 0.3 ? "1/3" : "1/4"}</span>` : ""}
        </div>`;
    } else {
      const done = s.items.filter(x => x.checked);
      ok = done.filter(x => x.order[x.sel] === 0).length;
      ko = done.length - ok;
      blank = s.items.length - done.length;
      const p = pct(ok, done.length);
      hero = `
        <div class="muted small">${esc(s.title)}</div>
        <div class="grade ${p >= 50 ? "pass" : "fail"}">${done.length ? p : 0}<small> %</small></div>
        <div class="result-facts">
          <span class="chip ok">✓ ${ok} aciertos</span>
          <span class="chip ko">✗ ${ko} fallos</span>
          ${blank ? `<span class="chip neutral">○ ${blank} sin responder</span>` : ""}
        </div>`;
    }
    const wrongQs = s.items.filter(x => x.sel !== null && x.order[x.sel] !== 0).map(x => x.q);
    const filters = [["all", `Todas (${s.items.length})`], ["ko", `Falladas (${ko})`], ["blank", `En blanco (${blank})`], ["ok", `Acertadas (${ok})`]];
    const list = s.items.map((it, i) => ({ it, i })).filter(({ it }) => {
      const st = it.sel === null || !it.checked ? "blank" : (it.order[it.sel] === 0 ? "ok" : "ko");
      return s.filter === "all" || s.filter === st;
    }).map(({ it, i }) => {
      const answeredNow = it.sel !== null && it.checked;
      const good = answeredNow && it.order[it.sel] === 0;
      const yours = answeredNow ? it.q.opts[it.order[it.sel]] : null;
      return `
        <article class="card ritem">
          <div class="row">
            <span class="chip neutral">${i + 1}</span>
            <span class="chip">Tema ${it.q.tema}</span>
            ${it.q.hard ? `<span class="chip warn">Difícil</span>` : ""}
            <span class="spacer"></span>
            ${!answeredNow ? `<span class="chip neutral">En blanco</span>` : good ? `<span class="chip ok">Correcta</span>` : `<span class="chip ko">Fallada</span>`}
          </div>
          <div class="rq">${esc(it.q.q)}</div>
          ${answeredNow && !good ? `<div class="ans ko"><span class="mark">✗</span><span>Tu respuesta: ${esc(yours)}</span></div>` : ""}
          ${!answeredNow ? `<div class="ans blank"><span class="mark">○</span><span>Sin responder</span></div>` : ""}
          <div class="ans ok"><span class="mark">✓</span><span>${esc(it.q.opts[0])}</span></div>
          <div class="explain"><b>Explicación</b>${esc(it.q.exp)}</div>
        </article>`;
    }).join("");

    return `
      <section class="card result-hero">
        ${hero}
        <div class="result-actions">
          ${wrongQs.length ? `<button class="btn primary" data-act="retry">${wrongQs.length === 1 ? "Repetir el fallo" : `Repetir los ${wrongQs.length} fallos`}</button>` : ""}
          ${isExam ? `<button class="btn ${wrongQs.length ? "" : "primary"}" data-act="exam">Nuevo simulacro</button>` : ""}
          <button class="btn" data-act="home">Volver al inicio</button>
        </div>
      </section>
      <div class="tabs" role="tablist">
        ${filters.map(([k, l]) => `<button class="tab ${s.filter === k ? "on" : ""}" data-act="filter" data-f="${k}" role="tab" aria-selected="${s.filter === k}">${l}</button>`).join("")}
      </div>
      <div class="review">${list || `<div class="card empty muted">No hay preguntas en este filtro.</div>`}</div>`;
  }

  function renderModal() {
    return `
      <div class="modal-back" data-act="modal-cancel">
        <div class="card modal" role="dialog" aria-modal="true" aria-labelledby="mt" data-stop="1">
          <h3 id="mt">${esc(modal.title)}</h3>
          <p class="muted">${esc(modal.text)}</p>
          <div class="row" style="justify-content:flex-end">
            <button class="btn" data-act="modal-cancel">Cancelar</button>
            <button class="btn ${modal.danger ? "danger" : "primary"}" data-act="modal-ok">${esc(modal.okLabel)}</button>
          </div>
        </div>
      </div>`;
  }

  // ---------- Eventos ----------
  function pick(pos) {
    const it = session.items[session.idx];
    if (view === "quiz") {
      if (it.checked) return;
      it.sel = pos;
    } else if (view === "exam") {
      it.sel = it.sel === pos ? null : pos;
    }
    render();
  }
  function check() {
    const it = session.items[session.idx];
    if (it.sel === null || it.checked) return;
    it.checked = true;
    record(it.q.id, it.order[it.sel] === 0);
    render();
  }
  function move(d) {
    const n = session.items.length;
    const i = session.idx + d;
    if (i < 0 || i >= n) return;
    session.idx = i;
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  $app.addEventListener("click", e => {
    const el = e.target.closest("[data-act]");
    if (!el) return;
    if (el.classList.contains("modal-back") && e.target.closest("[data-stop]")) return;
    const act = el.dataset.act;
    switch (act) {
      case "theme": toggleTheme(); break;
      case "tema": start("tema", { tema: +el.dataset.tema }); break;
      case "failed": start("failed", { tema: el.dataset.tema ? +el.dataset.tema : null }); break;
      case "all": start("all"); break;
      case "exam": start("exam"); break;
      case "custom": {
        const n = parseInt(document.getElementById("cn").value, 10) || 0;
        const temas = [...document.querySelectorAll("input[name=ct]:checked")].map(x => +x.value);
        if (!temas.length) { confirmBox("Elige algún tema", "Marca al menos un tema para generar el test.", "Entendido", () => { }); break; }
        if (n < 1) { confirmBox("Número no válido", "Indica cuántas preguntas quieres (mínimo 1).", "Entendido", () => { }); break; }
        const hard = document.getElementById("chard").checked;
        store.set("customN", n);
        store.set("customHard", hard);
        start("custom", { n, temas, hard });
        break;
      }
      case "retry": {
        const qs = session.items.filter(x => x.sel !== null && x.order[x.sel] !== 0).map(x => x.q);
        start("retry", { questions: qs });
        break;
      }
      case "home": goHome(); break;
      case "pick": pick(+el.dataset.pos); break;
      case "check": check(); break;
      case "next": move(1); break;
      case "prev": move(-1); break;
      case "skip": move(1); break;
      case "goto": session.idx = +el.dataset.i; render(); break;
      case "flag": { const it = session.items[session.idx]; it.flag = !it.flag; render(); break; }
      case "clear": session.items[session.idx].sel = null; render(); break;
      case "finish": finishQuiz(); break;
      case "filter": session.filter = el.dataset.f; render(); break;
      case "submit": {
        const blank = session.items.filter(x => x.sel === null).length;
        const flagged = session.items.filter(x => x.flag).length;
        let txt = "Una vez entregado no podrás cambiar las respuestas.";
        if (blank) txt = `Tienes ${blank} pregunta${blank > 1 ? "s" : ""} sin responder. ` + txt;
        if (flagged) txt += ` (${flagged} marcada${flagged > 1 ? "s" : ""} para revisar)`;
        confirmBox("¿Entregar el simulacro?", txt, "Entregar", () => submitExam(false));
        break;
      }
      case "quit": {
        if (view === "exam") confirmBox("¿Abandonar el simulacro?", "Se perderá este intento y no contará en el historial.", "Abandonar", goHome, true);
        else {
          const done = session.items.filter(x => x.checked).length;
          if (done) confirmBox("¿Salir del test?", "Las respuestas ya comprobadas quedan guardadas en tus estadísticas.", "Ver resultados", finishQuiz);
          else goHome();
        }
        break;
      }
      case "reset":
        confirmBox("¿Borrar todo el progreso?", "Se eliminarán tus estadísticas, las preguntas falladas y el historial de simulacros. No se puede deshacer.", "Borrar", () => {
          stats = {}; history = [];
          store.del("stats"); store.del("history");
          render();
        }, true);
        break;
      case "modal-ok": { const f = modal.onOk; modal = null; f(); if (modal === null && view !== "results") render(); break; }
      case "modal-cancel": modal = null; render(); break;
    }
  });

  $app.addEventListener("change", e => {
    const el = e.target;
    if (el.dataset.act === "penalty") { settings.penalty = parseFloat(el.value); store.set("settings", settings); }
    if (el.dataset.act === "allorder") { settings.allOrder = el.value; store.set("settings", settings); }
  });

  document.addEventListener("keydown", e => {
    if (e.target.matches("input, select, textarea")) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (modal) {
      if (e.key === "Escape") { modal = null; render(); }
      return;
    }
    if (view !== "quiz" && view !== "exam") return;
    const k = e.key.toLowerCase();
    const idx = ["a", "b", "c", "d"].indexOf(k) !== -1 ? ["a", "b", "c", "d"].indexOf(k) : ["1", "2", "3", "4"].indexOf(k);
    if (idx !== -1) { e.preventDefault(); pick(idx); return; }
    if (e.key === "ArrowRight") { e.preventDefault(); move(1); return; }
    if (e.key === "ArrowLeft") { e.preventDefault(); move(-1); return; }
    if (e.key === "Enter" && view === "quiz") {
      if (e.target.closest && e.target.closest("button") && !e.target.closest(".opt")) return; // deja que el botón enfocado actúe
      e.preventDefault();
      const it = session.items[session.idx];
      if (!it.checked) check();
      else if (session.idx < session.items.length - 1) move(1);
      else finishQuiz();
    }
  });

  window.addEventListener("beforeunload", e => {
    if (view === "exam") { e.preventDefault(); e.returnValue = ""; }
  });

  render();
})();
