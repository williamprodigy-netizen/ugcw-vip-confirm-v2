/* =============================================================================
   UGC WORLD — REVIEW LAYER
   Drop-in annotation tool for funnel mockups.

   Usage: add one line before </body> on any mockup page.
       <script src="assets/annotate.js"></script>

   What it does
     - Adds a "Add comments" button, bottom right. Off by default, so the page
       behaves normally until you turn it on.
     - In comment mode, click any element on the page to attach a note to it.
     - Tag each note: Copy, Design, Structure, or Question.
     - Notes save to this browser and survive a refresh.
     - Numbered pins sit on the page so you can see what you have marked.
     - "Copy all notes" puts the whole set on your clipboard as markdown,
       ready to paste straight back into Claude Code.

   Nothing here touches the page's own styles or scripts. It uses its own
   namespace and a shadow-free overlay with high z-index only.
   ============================================================================= */
(function () {
  "use strict";
  if (window.__UGCW_REVIEW__) return;
  window.__UGCW_REVIEW__ = true;

  var PAGE = (location.pathname.split("/").pop() || "index.html");
  var KEY = "ugcw_notes_" + PAGE;
  var TYPES = [
    { id: "copy", label: "Copy", c: "#c2410c" },
    { id: "design", label: "Design", c: "#7c3aed" },
    { id: "structure", label: "Structure", c: "#0f7a52" },
    { id: "question", label: "Question", c: "#0d6efd" }
  ];

  var notes = [];
  try { notes = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { notes = []; }

  var on = false, picking = false;

  /* ---------- styles ----------------------------------------------------- */
  var css = document.createElement("style");
  css.textContent = [
    '#rvBtn{position:fixed;right:16px;bottom:16px;z-index:2147483000;display:flex;align-items:center;gap:9px;',
    'background:#111827;color:#fff;border:0;border-radius:999px;padding:13px 19px;cursor:pointer;',
    'font:700 15px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;',
    'box-shadow:0 4px 14px rgba(0,0,0,.28)}',
    '#rvBtn:hover{background:#1f2937}',
    '#rvBtn.on{background:#c2410c}',
    '#rvBtn .ct{background:rgba(255,255,255,.22);border-radius:999px;padding:2px 8px;font-size:13px}',

    '#rvPanel{position:fixed;right:16px;bottom:74px;z-index:2147483000;width:min(370px,calc(100vw - 32px));',
    'max-height:min(70vh,620px);background:#fff;border:1px solid #e3e7ee;border-radius:14px;display:none;',
    'flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,.22);overflow:hidden;',
    'font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#111827}',
    '#rvPanel.on{display:flex}',
    '#rvPanel .hd{padding:14px 16px;border-bottom:1px solid #eef1f5;display:flex;justify-content:space-between;align-items:center;gap:10px}',
    '#rvPanel .hd b{font-size:15.5px}',
    '#rvPanel .hd .x{background:none;border:0;font-size:21px;cursor:pointer;color:#6b7280;line-height:1;padding:2px 6px}',
    '#rvPanel .hint{padding:11px 16px;background:#fff7ed;color:#7c2d12;font-size:13.5px;border-bottom:1px solid #fde3c8}',
    '#rvList{overflow:auto;padding:8px;flex:1}',
    '#rvList .n{border:1px solid #eef1f5;border-radius:10px;padding:11px 12px;margin-bottom:8px;background:#fbfcfd}',
    '#rvList .n .t{display:flex;align-items:center;gap:8px;margin-bottom:6px}',
    '#rvList .n .num{width:21px;height:21px;border-radius:50%;color:#fff;font:800 11px/21px sans-serif;text-align:center;flex:0 0 21px}',
    '#rvList .n .tag{font:800 9.5px/1 sans-serif;letter-spacing:.1em;text-transform:uppercase;padding:4px 7px;border-radius:4px}',
    '#rvList .n .where{font-size:11.5px;color:#9ca3af;margin-left:auto;max-width:44%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '#rvList .n .body{font-size:14.5px;color:#374151;white-space:pre-wrap;word-break:break-word}',
    '#rvList .n .quote{font-size:12.5px;color:#9ca3af;font-style:italic;margin-top:5px;border-left:2px solid #e5e7eb;padding-left:8px}',
    '#rvList .n .acts{display:flex;gap:8px;margin-top:8px}',
    '#rvList .n button{background:none;border:0;color:#6b7280;font-size:12.5px;cursor:pointer;padding:2px 0;text-decoration:underline}',
    '#rvList .empty{padding:26px 16px;text-align:center;color:#9ca3af;font-size:14px}',
    '#rvPanel .ft{padding:11px;border-top:1px solid #eef1f5;display:flex;gap:8px}',
    '#rvPanel .ft button{flex:1;border:1px solid #e3e7ee;background:#fff;border-radius:9px;padding:11px;cursor:pointer;',
    'font:700 14px/1 -apple-system,sans-serif;color:#111827;min-height:42px}',
    '#rvPanel .ft button.pri{background:#111827;color:#fff;border-color:#111827}',
    '#rvPanel .ft button:hover{border-color:#9ca3af}',

    '.rv-hot{outline:2px dashed #c2410c !important;outline-offset:2px !important;cursor:crosshair !important}',
    '.rv-has{outline:2px solid rgba(194,65,12,.4) !important;outline-offset:2px !important}',

    '.rv-pin{position:absolute;z-index:2147482000;width:23px;height:23px;border-radius:50%;color:#fff;',
    'font:800 12px/23px sans-serif;text-align:center;cursor:pointer;box-shadow:0 2px 7px rgba(0,0,0,.3);',
    'border:2px solid #fff}',

    '#rvForm{position:fixed;z-index:2147483600;width:min(330px,calc(100vw - 24px));background:#fff;',
    'border:1px solid #e3e7ee;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.26);padding:14px;display:none;',
    'font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}',
    '#rvForm.on{display:block}',
    '#rvForm .q{font-size:12.5px;color:#9ca3af;font-style:italic;margin:0 0 9px;max-height:44px;overflow:hidden}',
    '#rvForm .types{display:flex;gap:6px;margin-bottom:9px;flex-wrap:wrap}',
    '#rvForm .types button{border:1px solid #e3e7ee;background:#fff;border-radius:7px;padding:7px 10px;cursor:pointer;',
    'font:700 12px/1 sans-serif;color:#6b7280;min-height:34px}',
    '#rvForm .types button.sel{color:#fff}',
    '#rvForm textarea{width:100%;min-height:88px;border:1px solid #e3e7ee;border-radius:9px;padding:10px;',
    'font:15px/1.45 inherit;resize:vertical;color:#111827}',
    '#rvForm textarea:focus{outline:2px solid #111827;outline-offset:-1px}',
    '#rvForm .acts{display:flex;gap:8px;margin-top:9px}',
    '#rvForm .acts button{flex:1;border-radius:9px;padding:10px;cursor:pointer;font:700 14px/1 sans-serif;min-height:40px}',
    '#rvForm .acts .save{background:#111827;color:#fff;border:0}',
    '#rvForm .acts .cancel{background:#fff;color:#6b7280;border:1px solid #e3e7ee}',

    '#rvToast{position:fixed;left:50%;bottom:88px;transform:translateX(-50%);z-index:2147483600;',
    'background:#111827;color:#fff;padding:11px 17px;border-radius:9px;font:700 14px/1 sans-serif;display:none}',
    '#rvToast.on{display:block}',
    '@media print{#rvBtn,#rvPanel,#rvForm,.rv-pin,#rvToast{display:none !important}}'
  ].join("");
  document.head.appendChild(css);

  /* ---------- element addressing ------------------------------------------
     A stable-enough path so a pin lands back on the same element after a
     refresh. Uses id when present, otherwise nth-of-type down from body.
  ------------------------------------------------------------------------- */
  function pathOf(el) {
    if (el.id) return "#" + CSS.escape(el.id);
    var parts = [];
    while (el && el.nodeType === 1 && el !== document.body) {
      var t = el.tagName.toLowerCase();
      var p = el.parentNode;
      if (!p) break;
      var same = [].filter.call(p.children, function (c) { return c.tagName === el.tagName; });
      parts.unshift(same.length > 1 ? t + ":nth-of-type(" + (same.indexOf(el) + 1) + ")" : t);
      el = p;
    }
    return "body > " + parts.join(" > ");
  }
  function find(sel) {
    try { return document.querySelector(sel); } catch (e) { return null; }
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(notes)); } catch (e) {}
  }
  function typeOf(id) {
    for (var i = 0; i < TYPES.length; i++) if (TYPES[i].id === id) return TYPES[i];
    return TYPES[0];
  }

  /* ---------- chrome ------------------------------------------------------ */
  var btn = document.createElement("button");
  btn.id = "rvBtn";
  btn.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.9 8.9 0 0 1-3.9-.9L3 21l1.9-4.6A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z"/></svg><span id="rvLbl">Add comments</span><span class="ct" id="rvCt">0</span>';
  document.body.appendChild(btn);

  var panel = document.createElement("div");
  panel.id = "rvPanel";
  panel.innerHTML =
    '<div class="hd"><b>Your notes on this page</b><button class="x" id="rvClose" aria-label="Close">&times;</button></div>' +
    '<div class="hint" id="rvHint">Click anything on the page to leave a note on it.</div>' +
    '<div id="rvList"></div>' +
    '<div class="ft"><button id="rvCopy" class="pri">Copy all notes</button><button id="rvClear">Clear all</button></div>';
  document.body.appendChild(panel);

  var form = document.createElement("div");
  form.id = "rvForm";
  form.innerHTML =
    '<p class="q" id="rvQuote"></p>' +
    '<div class="types" id="rvTypes"></div>' +
    '<textarea id="rvText" placeholder="What should change here?"></textarea>' +
    '<div class="acts"><button class="save" id="rvSave">Save note</button><button class="cancel" id="rvCancel">Cancel</button></div>';
  document.body.appendChild(form);

  var toast = document.createElement("div");
  toast.id = "rvToast";
  document.body.appendChild(toast);

  form.querySelector("#rvTypes").innerHTML = TYPES.map(function (t, i) {
    return '<button data-t="' + t.id + '"' + (i === 0 ? ' class="sel" style="background:' + t.c + ';border-color:' + t.c + '"' : "") + ">" + t.label + "</button>";
  }).join("");

  var chosen = TYPES[0].id;
  form.querySelector("#rvTypes").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    chosen = b.getAttribute("data-t");
    [].forEach.call(this.children, function (c) {
      var t = typeOf(c.getAttribute("data-t"));
      var sel = c === b;
      c.className = sel ? "sel" : "";
      c.style.background = sel ? t.c : "#fff";
      c.style.borderColor = sel ? t.c : "#e3e7ee";
    });
  });

  function say(msg) {
    toast.textContent = msg;
    toast.classList.add("on");
    clearTimeout(say.t);
    say.t = setTimeout(function () { toast.classList.remove("on"); }, 1800);
  }

  /* ---------- pins -------------------------------------------------------- */
  function clearPins() {
    [].forEach.call(document.querySelectorAll(".rv-pin"), function (p) { p.remove(); });
    [].forEach.call(document.querySelectorAll(".rv-has"), function (p) { p.classList.remove("rv-has"); });
  }

  function drawPins() {
    clearPins();
    if (!on) return;
    notes.forEach(function (n, i) {
      var el = find(n.sel);
      if (!el) return;
      el.classList.add("rv-has");
      var r = el.getBoundingClientRect();
      var pin = document.createElement("div");
      pin.className = "rv-pin";
      pin.textContent = i + 1;
      pin.style.background = typeOf(n.type).c;
      pin.style.left = (r.left + window.scrollX - 11) + "px";
      pin.style.top = (r.top + window.scrollY - 11) + "px";
      pin.title = n.text;
      pin.addEventListener("click", function (ev) {
        ev.stopPropagation();
        panel.classList.add("on");
        var row = document.getElementById("rvN" + n.id);
        if (row) row.scrollIntoView({ block: "center" });
      });
      document.body.appendChild(pin);
    });
  }

  var rp;
  window.addEventListener("scroll", function () {
    if (!on) return;
    clearTimeout(rp); rp = setTimeout(drawPins, 90);
  }, { passive: true });
  window.addEventListener("resize", function () {
    if (!on) return;
    clearTimeout(rp); rp = setTimeout(drawPins, 120);
  });

  /* ---------- list -------------------------------------------------------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function renderList() {
    var host = document.getElementById("rvList");
    document.getElementById("rvCt").textContent = notes.length;
    if (!notes.length) {
      host.innerHTML = '<div class="empty">No notes yet.<br>Turn on comment mode and click anything on the page.</div>';
      return;
    }
    host.innerHTML = notes.map(function (n, i) {
      var t = typeOf(n.type);
      return '<div class="n" id="rvN' + n.id + '">' +
        '<div class="t">' +
          '<span class="num" style="background:' + t.c + '">' + (i + 1) + "</span>" +
          '<span class="tag" style="background:' + t.c + '22;color:' + t.c + '">' + t.label + "</span>" +
          '<span class="where">' + esc(n.tag) + "</span>" +
        "</div>" +
        '<div class="body">' + esc(n.text) + "</div>" +
        (n.quote ? '<div class="quote">' + esc(n.quote) + "</div>" : "") +
        '<div class="acts"><button data-ed="' + n.id + '">Edit</button><button data-del="' + n.id + '">Delete</button></div>' +
      "</div>";
    }).join("");
  }

  document.getElementById("rvList").addEventListener("click", function (e) {
    var d = e.target.getAttribute("data-del"), ed = e.target.getAttribute("data-ed");
    if (d) {
      notes = notes.filter(function (n) { return String(n.id) !== d; });
      save(); renderList(); drawPins(); say("Deleted");
    }
    if (ed) {
      var n = notes.filter(function (x) { return String(x.id) === ed; })[0];
      if (!n) return;
      openForm(find(n.sel), n);
    }
  });

  /* ---------- the form ---------------------------------------------------- */
  var target = null, editing = null;

  function openForm(el, existing) {
    target = el; editing = existing || null;
    var q = (el && el.textContent ? el.textContent.trim().replace(/\s+/g, " ").slice(0, 140) : "");
    document.getElementById("rvQuote").textContent = q ? '"' + q + '"' : "(no text in this element)";
    var ta = document.getElementById("rvText");
    ta.value = existing ? existing.text : "";
    chosen = existing ? existing.type : TYPES[0].id;
    [].forEach.call(document.getElementById("rvTypes").children, function (c) {
      var t = typeOf(c.getAttribute("data-t"));
      var sel = t.id === chosen;
      c.className = sel ? "sel" : "";
      c.style.background = sel ? t.c : "#fff";
      c.style.borderColor = sel ? t.c : "#e3e7ee";
    });

    form.classList.add("on");
    var r = el ? el.getBoundingClientRect() : { left: 40, bottom: 120 };
    var w = form.offsetWidth, h = form.offsetHeight;
    var left = Math.min(Math.max(12, r.left), window.innerWidth - w - 12);
    var top = r.bottom + 10;
    if (top + h > window.innerHeight - 12) top = Math.max(12, r.top - h - 10);
    form.style.left = left + "px";
    form.style.top = top + "px";
    ta.focus();
  }

  function closeForm() {
    form.classList.remove("on");
    target = null; editing = null;
  }

  document.getElementById("rvCancel").addEventListener("click", closeForm);
  document.getElementById("rvSave").addEventListener("click", function () {
    var txt = document.getElementById("rvText").value.trim();
    if (!txt) { say("Type a note first"); return; }
    if (editing) {
      editing.text = txt; editing.type = chosen;
    } else {
      notes.push({
        id: Date.now() + "" + Math.round(performance.now()),
        sel: pathOf(target),
        tag: (target.tagName || "").toLowerCase() + (target.id ? "#" + target.id : ""),
        quote: (target.textContent || "").trim().replace(/\s+/g, " ").slice(0, 160),
        type: chosen,
        text: txt
      });
    }
    save(); renderList(); drawPins(); closeForm(); say("Note saved");
  });
  document.getElementById("rvText").addEventListener("keydown", function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") document.getElementById("rvSave").click();
    if (e.key === "Escape") closeForm();
  });

  /* ---------- comment mode ------------------------------------------------ */
  var hot = null;

  function mine(t) {
    // anything belonging to either tool layer is off limits
    return panel.contains(t) || btn.contains(t) || form.contains(t) ||
           (t.closest && t.closest("#ecBtn,#ecPanel,#ecOut,#ecToast"));
  }

  function onOver(e) {
    if (!on || form.classList.contains("on")) return;
    if (mine(e.target)) return;
    if (e.target.classList.contains("rv-pin")) return;
    if (hot) hot.classList.remove("rv-hot");
    hot = e.target;
    hot.classList.add("rv-hot");
  }

  function onClick(e) {
    if (!on) return;
    if (mine(e.target)) return;
    if (e.target.classList.contains("rv-pin")) return;
    e.preventDefault();
    e.stopPropagation();
    openForm(e.target, null);
  }

  function setMode(v) {
    // only one layer can own the page's clicks at a time
    if (v && window.UGCW_LAYERS && window.UGCW_LAYERS.edit) window.UGCW_LAYERS.edit(false);
    on = v;
    btn.classList.toggle("on", on);
    document.getElementById("rvLbl").textContent = on ? "Done commenting" : "Add comments";
    panel.classList.toggle("on", on);
    if (on) {
      document.addEventListener("mouseover", onOver, true);
      document.addEventListener("click", onClick, true);
      renderList(); drawPins();
    } else {
      document.removeEventListener("mouseover", onOver, true);
      document.removeEventListener("click", onClick, true);
      if (hot) { hot.classList.remove("rv-hot"); hot = null; }
      closeForm(); clearPins();
    }
  }

  btn.addEventListener("click", function () { setMode(!on); });
  document.getElementById("rvClose").addEventListener("click", function () { setMode(false); });

  /* ---------- export ------------------------------------------------------ */
  function markdown() {
    if (!notes.length) return "";
    var out = ["# Notes on " + PAGE, "", "URL: " + location.href, ""];
    TYPES.forEach(function (t) {
      var mine = notes.filter(function (n) { return n.type === t.id; });
      if (!mine.length) return;
      out.push("## " + t.label);
      out.push("");
      mine.forEach(function (n) {
        var i = notes.indexOf(n) + 1;
        out.push(i + ". **" + n.text + "**");
        if (n.quote) out.push("   - On: “" + n.quote.slice(0, 120) + "”");
        out.push("   - Element: `" + n.sel + "`");
        out.push("");
      });
    });
    return out.join("\n");
  }

  document.getElementById("rvCopy").addEventListener("click", function () {
    var md = markdown();
    if (!md) { say("No notes yet"); return; }
    var done = function () { say("Copied. Paste it back to Claude."); };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(md).then(done, function () { fallback(md); });
    } else fallback(md);
    function fallback(t) {
      var ta = document.createElement("textarea");
      ta.value = t;
      ta.style.cssText = "position:fixed;left:-9999px";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { say("Copy failed"); }
      ta.remove();
    }
  });

  document.getElementById("rvClear").addEventListener("click", function () {
    if (!notes.length) return;
    if (!confirm("Delete all " + notes.length + " notes on this page?")) return;
    notes = []; save(); renderList(); drawPins(); say("Cleared");
  });

  renderList();

  // Read them from the console too, if that is easier.
  window.UGCW_LAYERS = window.UGCW_LAYERS || {};
  window.UGCW_LAYERS.comment = setMode;

  window.UGCW_NOTES = { all: function () { return notes; }, markdown: markdown };
})();
