(function () {
  const $ = (s) => document.querySelector(s);
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const params = new URLSearchParams(location.search);
  const pairId = params.get("pair");
  const LIST = window.OC_PAIR_LIST || [];
  const SITE_INFO = window.OC_SITE || { title: "OC PAIRS", subtitle: "" };
  const validId = (id) => /^[a-z0-9_-]+$/i.test(id || "");

  // pairs/<id>.js 불러오기
  const loadPair = (id) => new Promise((resolve) => {
    if (!validId(id)) return resolve(null);
    if (window.OC_PAIRS?.[id]) return resolve(window.OC_PAIRS[id]);
    const s = document.createElement("script");
    s.src = `pairs/${id}.js`;
    s.onload = () => resolve(window.OC_PAIRS?.[id] || null);
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });

  // 이미지가 없을 때 대신 보여줄 실루엣
  const fallback = (kind) =>
    `this.onerror=null;this.classList.add('missing');this.src='data:image/svg+xml;utf8,${encodeURIComponent(
      kind === "full"
        ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 500"><g fill="#8885"><circle cx="100" cy="60" r="38"/><path d="M45 130q55-30 110 0l15 170h-30l-5 190h-30l-5-150-5 150h-30l-5-190h-30z"/></g></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g fill="#8885"><circle cx="50" cy="40" r="22"/><path d="M12 100q38-50 76 0z"/></g></svg>`
    )}'`;

  // 드래그·선택 막기
  ["dragstart", "selectstart"].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault()));

  if (pairId) showPair(pairId); else showHome();

  // ───────── 첫 화면: 페어 목록 ─────────
  async function showHome() {
    document.title = SITE_INFO.title;
    $("#site-title").textContent = SITE_INFO.title;
    $("#site-sub").textContent = SITE_INFO.subtitle || "";
    $("#tabs").hidden = true;
    $("#home").hidden = false;

    const pairs = await Promise.all(LIST.map(async (id) => [id, await loadPair(id)]));
    $("#pair-grid").innerHTML = pairs.filter(([, P]) => P).map(([id, P]) => {
      const [A, B] = P.characters;
      return `
      <a class="pair-card" href="?pair=${encodeURIComponent(id)}" style="--ca:${esc(A.color)};--cb:${esc(B.color)}">
        <div class="pair-faces">
          <img src="${esc(A.portrait)}" alt="" style="--c:${esc(A.color)}" onerror="${fallback("head")}">
          <img src="${esc(B.portrait)}" alt="" style="--c:${esc(B.color)}" onerror="${fallback("head")}">
        </div>
        <div class="pair-text">
          <p class="eyebrow">${esc(P.site.subtitle)}</p>
          <h2>${esc(P.site.title)}</h2>
          <p class="pair-names"><span style="--c:${esc(A.color)}">${esc(A.codename)}</span> × <span style="--c:${esc(B.color)}">${esc(B.codename)}</span></p>
        </div>
      </a>`;
    }).join("") || `<p class="not-found">pairs.js에 등록된 페어가 없습니다.</p>`;
  }

  // ───────── 페어 페이지 ─────────
  async function showPair(id) {
    $("#back").hidden = false;
    $("#editor-link").href = `editor.html?pair=${encodeURIComponent(id)}`;

    let D = await loadPair(id);
    // 편집기에서 "미리보기"로 열었을 때는 임시 저장본을 사용
    if (params.has("preview")) {
      try {
        const draft = JSON.parse(localStorage.getItem("oc-draft-" + id));
        if (draft) {
          D = draft;
          const bar = document.createElement("div");
          bar.className = "preview-bar";
          bar.innerHTML = `편집기 미리보기 중 (아직 파일에 저장되지 않음) · <a href="editor.html?pair=${encodeURIComponent(id)}">편집기로 돌아가기</a>`;
          document.body.prepend(bar);
        }
      } catch (e) {}
    }
    if (!D) {
      $("#site-title").textContent = SITE_INFO.title;
      $("#tabs").hidden = true;
      $("#not-found").hidden = false;
      return;
    }
    $("#pair-view").hidden = false;
    renderPair(D);
  }

  function renderPair(D) {
    const SITE = D.site, CHARACTERS = D.characters, RELATIONSHIP = D.relationship, HISTORY = D.history;

    document.title = SITE.title;
    $("#site-title").textContent = SITE.title;
    $("#site-sub").textContent = SITE.subtitle;

    // 세계관 (내용이 있을 때만 표시)
    const W = D.world || {};
    const worldParas = (W.paragraphs || []).filter(Boolean);
    const hasWorld = worldParas.length > 0;
    if (hasWorld) {
      $("#world").hidden = false;
      $("#world-title").textContent = W.title || "세계관";
      $("#world-body").innerHTML = worldParas.map((p) => `<p>${esc(p)}</p>`).join("");
    }

    // 탭(바로가기)
    const links = hasWorld ? [`<a href="#world">${esc(W.title || "세계관")}</a>`] : [];
    links.push(...CHARACTERS.map((c) => `<a href="#char-${c.id}" style="--c:${c.color}">${esc(c.codename)}</a>`));
    links.push(`<a href="#relationship">관계성</a>`, `<a href="#history">과거사</a>`);
    $("#tabs").innerHTML = links.join("");

    $("#characters").innerHTML = CHARACTERS.map((c, i) => `
      <section class="char ${i % 2 ? "flip" : ""}" id="char-${c.id}" style="--c:${c.color}">
        <div class="char-visual">
          <div class="char-bg-text" aria-hidden="true">${esc(c.codename)}</div>
          <img class="full" src="${esc(c.fullBody)}" alt="${esc(c.codename)} 전신" onerror="${fallback("full")}">
        </div>

        <div class="char-info">
          <div class="char-head">
            <img class="portrait" src="${esc(c.portrait)}" alt="${esc(c.codename)} 두상" onerror="${fallback("head")}">
            <div>
              <p class="eyebrow">${esc(c.position)}</p>
              <h2 class="codename">${esc(c.codename)}</h2>
              <p class="realname">${esc(c.realName)}</p>
            </div>
          </div>

          <dl class="stats">
            <div><dt>직책</dt><dd>${esc(c.position)}</dd></div>
            <div><dt>성별</dt><dd>${esc(c.gender)}</dd></div>
            <div><dt>키</dt><dd>${esc(c.height)}</dd></div>
            <div><dt>나이</dt><dd>${esc(c.age)}</dd></div>
          </dl>

          <h3 class="label">성격 키워드</h3>
          <ul class="chips">${(c.keywords || []).map((k) => `<li>#${esc(k)}</li>`).join("")}</ul>

          <h3 class="label">특징</h3>
          <ul class="traits">${(c.traits || []).map((t) => `<li>${esc(t)}</li>`).join("")}</ul>

          <h3 class="label">대사</h3>
          ${(c.quotes || []).map((q, qi) => {
            const v = (c.voices || [])[qi];
            if (!q) return "";
            return v
              ? `<button type="button" class="quote voiced" data-voice="${esc(v)}" aria-label="보이스 재생: ${esc(q)}"><span class="q">${esc(q)}</span><span class="vicon" aria-hidden="true"></span></button>`
              : `<blockquote class="quote"><span class="q">${esc(q)}</span></blockquote>`;
          }).join("")}
        </div>
      </section>`).join("");

    // 보이스 재생 (한 번에 하나만, 다시 누르면 정지)
    let player = null, playingBtn = null;
    const stop = () => {
      if (player) { player.pause(); player = null; }
      if (playingBtn) { playingBtn.classList.remove("playing"); playingBtn = null; }
    };
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".voiced"); if (!btn) return;
      const same = btn === playingBtn;
      stop();
      if (same) return;
      player = new Audio(btn.dataset.voice);
      playingBtn = btn;
      btn.classList.add("playing");
      player.addEventListener("ended", stop);
      player.play().catch(() => { stop(); btn.classList.add("error"); setTimeout(() => btn.classList.remove("error"), 1500); });
    });

    // 관계성
    const [A, B] = CHARACTERS;
    const sum = $("#rel-summary");
    sum.textContent = RELATIONSHIP.summary || "";
    sum.hidden = !RELATIONSHIP.summary;
    $("#rel-table").innerHTML = `
      <thead><tr><th></th>
        <th style="--c:${A.color}">${esc(A.codename)} → ${esc(B.codename)}</th>
        <th style="--c:${B.color}">${esc(B.codename)} → ${esc(A.codename)}</th></tr></thead>
      <tbody>${RELATIONSHIP.rows.map((r) => `<tr><th>${esc(r.label)}</th><td>${esc(r.ab)}</td><td>${esc(r.ba)}</td></tr>`).join("")}</tbody>`;
    $("#rel-detail").innerHTML = (RELATIONSHIP.detail || []).filter(Boolean).map((p) => `<p>${esc(p)}</p>`).join("");

    // 과거사
    $("#timeline").innerHTML = HISTORY.filter((h) => h.when || h.title || h.text).map((h) => `
      <li><span class="when">${esc(h.when)}</span>
        <div><h3>${esc(h.title)}</h3><p>${esc(h.text)}</p></div></li>`).join("");
  }
})();
