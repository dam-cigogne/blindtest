/* Mini-générateur de PDF (A4, police Helvetica, rectangles, QR codes) pour les impressions du blind test.
   Fonctionne partout, y compris dans l'appli installée sur l'écran d'accueil de l'iPhone (où « Imprimer » est bloqué). */
(function () {
  "use strict";
  const WR = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, 750, 556, 500, 222, 556, 333, 1000, 556, 556, 333, 1000, 667, 333, 1000, 500, 611, 500, 500, 222, 222, 333, 333, 350, 556, 1000, 333, 1000, 500, 333, 944, 500, 500, 667, 278, 333, 556, 556, 556, 556, 260, 556, 333, 737, 370, 556, 584, 0, 737, 552, 400, 549, 333, 333, 333, 576, 537, 333, 333, 333, 365, 556, 834, 834, 834, 611, 667, 667, 667, 667, 667, 667, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278, 722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611, 556, 556, 556, 556, 556, 556, 889, 500, 556, 556, 556, 556, 278, 278, 278, 278, 556, 556, 556, 556, 556, 556, 556, 549, 611, 556, 556, 556, 556, 500, 556, 500], WB = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584, 750, 556, 500, 278, 556, 500, 1000, 556, 556, 333, 1000, 667, 333, 1000, 500, 611, 500, 500, 278, 278, 500, 500, 350, 556, 1000, 333, 1000, 556, 333, 944, 500, 500, 667, 278, 333, 556, 556, 556, 556, 280, 556, 333, 737, 370, 556, 584, 0, 737, 552, 400, 549, 333, 333, 333, 576, 556, 333, 333, 333, 365, 556, 834, 834, 834, 611, 722, 722, 722, 722, 722, 722, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278, 722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611, 556, 556, 556, 556, 556, 556, 889, 556, 556, 556, 556, 556, 278, 278, 278, 278, 611, 611, 611, 611, 611, 611, 611, 549, 611, 611, 611, 611, 611, 556, 611, 556];
  const SPEC = { "€": 128, "‚": 130, "„": 132, "…": 133, "‘": 145, "’": 146, "“": 147, "”": 148, "•": 149, "–": 150, "—": 151, "™": 153, "œ": 156, "Œ": 140, "Ÿ": 159, "✓": 0, "✔": 0 };
  const SPECV = new Set(Object.values(SPEC).filter(Boolean));
  // Texte → octets WinAnsi (les emojis et caractères inconnus sont retirés)
  function enc(s) {
    let o = "";
    for (const ch of String(s == null ? "" : s).normalize("NFC")) {
      const c = ch.codePointAt(0);
      if ((c >= 32 && c <= 126) || (c >= 160 && c <= 255)) o += ch === " " ? " " : ch;
      else if (SPEC[ch]) o += String.fromCharCode(SPEC[ch]);
      else if (c >= 128 && c <= 159 && SPECV.has(c)) o += ch; // déjà converti (texte réduit / coupé)
      else if (ch === " " || ch === " ") o += " ";
      else if (ch === "\n" || ch === "\t") o += " ";
    }
    return o.replace(/ {2,}/g, " ");
  }
  const esc = (s) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const n2 = (v) => (Math.round(v * 100) / 100).toString();
  const col = (c) => c.map((v) => n2(v)).join(" ");

  class Doc {
    constructor() { this.W = 595.28; this.H = 841.89; this.M = 36; this.pages = []; this.c = null; this.imgs = []; }
    // Cercle (chemin) : centre x,y (y depuis le haut), rayon r
    circ(x, y, r) { const k = r * 0.5523, X = x, Y = this.H - y; return n2(X + r) + " " + n2(Y) + " m " + n2(X + r) + " " + n2(Y + k) + " " + n2(X + k) + " " + n2(Y + r) + " " + n2(X) + " " + n2(Y + r) + " c " + n2(X - k) + " " + n2(Y + r) + " " + n2(X - r) + " " + n2(Y + k) + " " + n2(X - r) + " " + n2(Y) + " c " + n2(X - r) + " " + n2(Y - k) + " " + n2(X - k) + " " + n2(Y - r) + " " + n2(X) + " " + n2(Y - r) + " c " + n2(X + k) + " " + n2(Y - r) + " " + n2(X + r) + " " + n2(Y - k) + " " + n2(X + r) + " " + n2(Y) + " c h "; }
    disc(x, y, r, o) { o = o || {}; this.c.push("q " + (o.fill ? col(o.fill) + " rg " : "") + (o.stroke ? col(o.stroke) + " RG " + n2(o.lw || 1) + " w " : "") + this.circ(x, y, r) + (o.fill && o.stroke ? "B" : o.fill ? "f" : "S") + " Q"); }
    // Photo JPEG (data:image/jpeg;base64,…) découpée en rond, centre x,y, rayon r
    photo(x, y, r, dataUrl) {
      const bin = atob(String(dataUrl).split(",")[1] || ""); let w = 0, h = 0;
      for (let i = 2; i < bin.length - 9;) { // taille de l'image (marqueur SOF)
        if (bin.charCodeAt(i) !== 0xff) { i++; continue; }
        const m = bin.charCodeAt(i + 1), len = (bin.charCodeAt(i + 2) << 8) | bin.charCodeAt(i + 3);
        if (m >= 0xc0 && m <= 0xc3) { h = (bin.charCodeAt(i + 5) << 8) | bin.charCodeAt(i + 6); w = (bin.charCodeAt(i + 7) << 8) | bin.charCodeAt(i + 8); break; }
        i += 2 + len;
      }
      if (!w || !h) return false;
      this.imgs.push({ bin, w, h }); const name = "Im" + this.imgs.length;
      const sc = Math.max(2 * r / w, 2 * r / h), dw = w * sc, dh = h * sc;
      this.c.push("q " + this.circ(x, y, r) + "W n " + n2(dw) + " 0 0 " + n2(dh) + " " + n2(x - dw / 2) + " " + n2(this.H - y - dh / 2) + " cm /" + name + " Do Q");
      return true;
    }
    page() { this.c = []; this.pages.push(this.c); this.y = this.M; return this; }
    tw(s, size, bold) { const t = enc(s), w = bold ? WB : WR; let n = 0; for (let i = 0; i < t.length; i++) { const k = t.charCodeAt(i) - 32; n += w[k] != null ? w[k] : 500; } return (n * size) / 1000; }
    text(x, y, s, size, o) {
      o = o || {}; const t = enc(s); if (!t.trim()) return;
      let xx = x; const w = this.tw(t, size, o.bold);
      if (o.align === "center") xx = x - w / 2; else if (o.align === "right") xx = x - w;
      this.c.push("BT /" + (o.bold ? "F2" : "F1") + " " + n2(size) + " Tf " + col(o.color || [0.1, 0.1, 0.15]) + " rg " + n2(xx) + " " + n2(this.H - y) + " Td (" + esc(t) + ") Tj ET");
    }
    // Texte réduit (puis coupé avec …) pour tenir dans une largeur
    fit(x, y, s, size, maxW, o) {
      o = o || {}; let sz = size, t = enc(s); const min = o.min || size * 0.75;
      while (sz > min && this.tw(t, sz, o.bold) > maxW) sz -= 0.25;
      if (this.tw(t, sz, o.bold) > maxW) { while (t.length > 1 && this.tw(t + "…", sz, o.bold) > maxW) t = t.slice(0, -1); t += "…"; }
      this.text(x, y, t, sz, o);
    }
    wrap(s, size, maxW, bold) {
      const out = []; String(s).split("\n").forEach((par) => {
        const words = enc(par).split(" "); let line = "";
        words.forEach((wd) => { const tryL = line ? line + " " + wd : wd; if (this.tw(tryL, size, bold) <= maxW || !line) line = tryL; else { out.push(line); line = wd; } });
        out.push(line);
      });
      return out;
    }
    para(x, y, s, size, maxW, o) { o = o || {}; const lh = o.lh || size * 1.32; this.wrap(s, size, maxW, o.bold).forEach((l, i) => this.text(o.align === "center" ? x + maxW / 2 : x, y + i * lh, l, size, Object.assign({}, o, { align: o.align }))); return y + this.wrap(s, size, maxW, o.bold).length * lh; }
    rect(x, y, w, h, o) {
      o = o || {}; let s = "";
      if (o.fill) s += col(o.fill) + " rg ";
      if (o.stroke) s += col(o.stroke) + " RG " + n2(o.lw || 0.6) + " w ";
      if (o.dash) s += "[" + o.dash.join(" ") + "] 0 d ";
      const r = o.r || 0, X = x, Y = this.H - y - h;
      if (r) { const k = r * 0.5523; s += n2(X + r) + " " + n2(Y) + " m " + n2(X + w - r) + " " + n2(Y) + " l " + n2(X + w - r + k) + " " + n2(Y) + " " + n2(X + w) + " " + n2(Y + r - k) + " " + n2(X + w) + " " + n2(Y + r) + " c " + n2(X + w) + " " + n2(Y + h - r) + " l " + n2(X + w) + " " + n2(Y + h - r + k) + " " + n2(X + w - r + k) + " " + n2(Y + h) + " " + n2(X + w - r) + " " + n2(Y + h) + " c " + n2(X + r) + " " + n2(Y + h) + " l " + n2(X + r - k) + " " + n2(Y + h) + " " + n2(X) + " " + n2(Y + h - r + k) + " " + n2(X) + " " + n2(Y + h - r) + " c " + n2(X) + " " + n2(Y + r) + " l " + n2(X) + " " + n2(Y + r - k) + " " + n2(X + r - k) + " " + n2(Y) + " " + n2(X + r) + " " + n2(Y) + " c h ";
      } else s += n2(X) + " " + n2(Y) + " " + n2(w) + " " + n2(h) + " re ";
      s += o.fill && o.stroke ? "B" : o.fill ? "f" : "S";
      if (o.dash) s += " [] 0 d";
      this.c.push("q " + s + " Q");
    }
    line(x1, y1, x2, y2, o) { o = o || {}; this.c.push("q " + col(o.color || [0.6, 0.6, 0.65]) + " RG " + n2(o.lw || 0.6) + " w " + (o.dash ? "[" + o.dash.join(" ") + "] 0 d " : "") + n2(x1) + " " + n2(this.H - y1) + " m " + n2(x2) + " " + n2(this.H - y2) + " l S Q"); }
    qr(x, y, size, text) {
      const q = window.qrcode(0, "M"); q.addData(text); q.make();
      const n = q.getModuleCount(), m = size / (n + 8), ox = x + 4 * m, oy = y + 4 * m;
      let s = "q 1 1 1 rg " + n2(x) + " " + n2(this.H - y - size) + " " + n2(size) + " " + n2(size) + " re f 0 0 0 rg ";
      for (let r = 0; r < n; r++) { let c = 0; while (c < n) { if (q.isDark(r, c)) { let e = c; while (e < n && q.isDark(r, e)) e++; s += n2(ox + c * m) + " " + n2(this.H - (oy + (r + 1) * m)) + " " + n2((e - c) * m + 0.02) + " " + n2(m + 0.02) + " re "; c = e; } else c++; } }
      this.c.push(s + "f Q");
    }
    // Fabrique le fichier PDF
    bytes() {
      const objs = [], add = (s) => { objs.push(s); return objs.length; };
      add("<< /Type /Catalog /Pages 2 0 R >>"); add(""); add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"); add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
      const kids = [];
      const xo = this.imgs.map((im, i) => "/Im" + (i + 1) + " " + add("<< /Type /XObject /Subtype /Image /Width " + im.w + " /Height " + im.h + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + im.bin.length + " >>\nstream\n" + im.bin + "\nendstream") + " 0 R").join(" ");
      this.pages.forEach((c) => { const body = c.join("\n"); const ci = add("<< /Length " + body.length + " >>\nstream\n" + body + "\nendstream"); kids.push(add("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + n2(this.W) + " " + n2(this.H) + "] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>" + (xo ? " /XObject << " + xo + " >>" : "") + " >> /Contents " + ci + " 0 R >>")); });
      objs[1] = "<< /Type /Pages /Kids [" + kids.map((k) => k + " 0 R").join(" ") + "] /Count " + kids.length + " >>";
      let out = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"; const off = [];
      objs.forEach((o, i) => { off.push(out.length); out += (i + 1) + " 0 obj\n" + o + "\nendobj\n"; });
      const x = out.length;
      out += "xref\n0 " + (objs.length + 1) + "\n0000000000 65535 f \n" + off.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("") + "trailer\n<< /Size " + (objs.length + 1) + " /Root 1 0 R >>\nstartxref\n" + x + "\n%%EOF";
      const b = new Uint8Array(out.length); for (let i = 0; i < out.length; i++) b[i] = out.charCodeAt(i) & 255; return b;
    }
  }

  /* ---------- Les documents ---------- */
  const PINK = [0.86, 0.22, 0.5], INK = [0.1, 0.1, 0.15], GREY = [0.45, 0.45, 0.5], LIGHT = [0.94, 0.94, 0.96], LINE = [0.65, 0.65, 0.7], BAND = [0.99, 0.91, 0.95];
  const pts = (n) => n + " point" + (n > 1 ? "s" : "");
  function footer(d, ctx) { d.line(d.M, d.H - 30, d.W - d.M, d.H - 30, { color: [0.85, 0.85, 0.88], lw: 0.5 }); d.text(d.M, d.H - 18, ctx.st.name || "Blind test", 8, { color: GREY }); d.text(d.W - d.M, d.H - 18, ctx.addr, 8, { color: GREY, align: "right" }); }
  function head(d, ctx, title, sub) {
    d.text(d.W / 2, 50, ctx.st.name || "Blind test", 11, { align: "center", color: GREY });
    d.text(d.W / 2, 80, title, 22, { align: "center", bold: true });
    if (sub) d.para(d.M + 20, 102, sub, 10, d.W - 2 * d.M - 40, { align: "center", color: GREY });
    return sub ? 102 + d.wrap(sub, 10, d.W - 2 * d.M - 40).length * 13.2 + 12 : 104;
  }

  // 1 page par équipe : grand numéro, QR code, code de secours, membres
  function teamSheets(d, ctx) {
    const st = ctx.st;
    st.teams.forEach((t) => {
      d.page(); const W = d.W, cx = W / 2;
      d.rect(d.M, d.M, W - 2 * d.M, d.H - 2 * d.M - 20, { stroke: [0.85, 0.85, 0.9], lw: 1, r: 14 });
      d.text(cx, 74, st.name || "Blind test", 13, { align: "center", color: GREY });
      d.text(cx, 128, "ÉQUIPE " + t.id, 50, { align: "center", bold: true, color: PINK });
      const own = st.teamNames !== false && /^Équipe \d+$/.test(t.name);
      d.fit(cx, 160, own ? "Nom de l'équipe : à choisir sur votre téléphone" : t.name, own ? 15 : 22, W - 2 * d.M - 40, { align: "center", bold: !own, color: own ? GREY : INK });
      const q = 250; d.qr(cx - q / 2, 182, q, ctx.teamUrl(t));
      d.text(cx, 456, "Scannez ce QR code avec l'appareil photo de votre téléphone.", 13, { align: "center", bold: true });
      d.text(cx, 476, "Code de secours : " + t.code + "   ·   " + ctx.addr, 11, { align: "center", color: GREY });
      d.line(d.M + 30, 498, W - d.M - 30, 498, { dash: [3, 3], color: [0.75, 0.75, 0.8] });
      d.text(d.M + 34, 524, "Membres de l'équipe (" + t.members.length + ")", 13, { bold: true });
      const per = Math.ceil(t.members.length / 2) || 1, lh = Math.min(18, 230 / Math.max(per, 1)), cw = (W - 2 * d.M - 80) / 2;
      t.members.forEach((m, k) => { const c = k < per ? 0 : 1, r = k < per ? k : k - per; d.fit(d.M + 40 + c * (cw + 10), 548 + r * lh, "•  " + m, Math.min(12, lh * 0.7), cw); });
      footer(d, ctx);
    });
  }
  // Liste des équipes (pour l'annonce)
  function teamList(d, ctx) {
    const st = ctx.st; d.page(); let y = head(d, ctx, "Les équipes", st.teams.length + " équipes · " + st.teams.reduce((a, t) => a + t.members.length, 0) + " personnes");
    const w = d.W - 2 * d.M;
    st.teams.forEach((t) => {
      const lines = d.wrap(t.members.join(", ") || "—", 10, w - 20);
      const h = 22 + lines.length * 13 + 8;
      if (y + h > d.H - 44) { footer(d, ctx); d.page(); y = d.M + 10; }
      d.rect(d.M, y, w, h, { fill: [0.98, 0.98, 0.99], stroke: [0.85, 0.85, 0.9], r: 6 });
      d.text(d.M + 10, y + 16, "N°" + t.id + "  " + t.name, 12, { bold: true, color: PINK });
      d.text(d.M + w - 10, y + 16, "code " + t.code + " · " + t.members.length + " pers.", 9, { align: "right", color: GREY });
      lines.forEach((l, i) => d.text(d.M + 10, y + 32 + i * 13, l, 10));
      y += h + 6;
    });
    footer(d, ctx);
  }
  // Fiche DJ + playlist
  function djSheet(d, ctx) {
    const st = ctx.st;
    if (ctx.djUrl) {
      d.page(); d.text(d.W / 2, 90, st.name || "Blind test", 13, { align: "center", color: GREY }); d.text(d.W / 2, 150, "DJ", 60, { align: "center", bold: true, color: PINK });
      d.qr(d.W / 2 - 120, 190, 240, ctx.djUrl); d.text(d.W / 2, 470, "Code DJ : " + st.codes.dj, 18, { align: "center", bold: true });
      d.para(d.M + 60, 500, "Scannez le QR code avec le téléphone branché à la sono. Le bouton vert lance la musique et le chrono. Cochez « Ce téléphone est branché à la sono » pour que l'animateur puisse aussi lancer la musique.", 11, d.W - 2 * d.M - 120, { align: "center", color: GREY });
      footer(d, ctx);
    }
    d.page(); let y = head(d, ctx, "Playlist dans l'ordre", "Extraits de " + st.extractSec + " s, puis " + st.answerSec + " s de silence pour répondre.");
    const w = d.W - 2 * d.M;
    st.manches.forEach((m, i) => {
      if (y + 24 + 18 * Math.min(m.songs.length, 3) > d.H - 44) { footer(d, ctx); d.page(); y = d.M + 6; }
      d.rect(d.M, y, w, 20, { fill: BAND, r: 4 }); d.text(d.M + 8, y + 14, "Manche " + (i + 1) + " – " + m.title + (m.mult > 1 ? "  (points ×" + m.mult + ")" : ""), 11, { bold: true, color: PINK }); y += 26;
      m.songs.forEach((s, j) => {
        if (y + 18 > d.H - 44) { footer(d, ctx); d.page(); y = d.M + 6; }
        d.text(d.M + 8, y + 10, (j + 1) + ".", 10, { bold: true, color: GREY });
        d.fit(d.M + 28, y + 10, s.t, 10.5, w * 0.45, { bold: true }); d.fit(d.M + 28 + w * 0.47, y + 10, s.a, 10, w * 0.3);
        d.fit(d.M + w - 6, y + 10, s.o || s.d ? "de " + (s.o || 0) + " s à " + ((s.o || 0) + (s.d || st.extractSec)) + " s" : s.h || "", 8.5, w * 0.18, { align: "right", color: GREY });
        d.line(d.M + 4, y + 15, d.M + w - 4, y + 15, { color: [0.9, 0.9, 0.92], lw: 0.4 }); y += 18;
      });
      y += 8;
    });
    footer(d, ctx);
  }
  // Grille de manches sur 2 colonnes (feuilles de réponses et corrigé)
  function mancheGrid(d, ctx, y0, fillRow, title, newPage) {
    const st = ctx.st, gap = 14, cw = (d.W - 2 * d.M - gap) / 2, rh = 19, bottom = d.H - 44;
    let colI = 0, y = y0, top = y0;
    st.manches.forEach((m, i) => {
      const h = 20 + 16 + m.songs.length * rh + (fillRow ? 0 : rh) + 10;
      if (y + h > bottom) { if (colI === 0) { colI = 1; y = top; } else { newPage(); colI = 0; top = y = d.M + 30; } }
      const x = d.M + colI * (cw + gap);
      d.rect(x, y, cw, 20, { fill: BAND, r: 4 }); d.fit(x + 6, y + 14, "Manche " + (i + 1) + " – " + m.title + (m.mult > 1 ? " (×" + m.mult + ")" : ""), 10, cw - 12, { bold: true, color: PINK });
      let yy = y + 22; const c0 = 16, c3 = fillRow ? 0 : 34, c1 = (cw - c0 - c3) * 0.56, c2 = cw - c0 - c1 - c3;
      d.rect(x, yy, cw, 16, { fill: LIGHT }); d.text(x + c0 + 4, yy + 11, "Titre", 8.5, { bold: true, color: GREY }); d.text(x + c0 + c1 + 4, yy + 11, m.label2 || "Artiste", 8.5, { bold: true, color: GREY }); if (c3) d.text(x + cw - c3 / 2, yy + 11, "Pts", 8.5, { bold: true, color: GREY, align: "center" });
      yy += 16;
      m.songs.forEach((s, j) => {
        d.rect(x, yy, cw, rh, { stroke: LINE, lw: 0.5 }); d.line(x + c0, yy, x + c0, yy + rh, { color: LINE, lw: 0.5 }); d.line(x + c0 + c1, yy, x + c0 + c1, yy + rh, { color: LINE, lw: 0.5 }); if (c3) d.line(x + cw - c3, yy, x + cw - c3, yy + rh, { color: LINE, lw: 0.5 });
        d.text(x + c0 / 2, yy + 13, String(j + 1), 9, { align: "center", bold: true, color: GREY });
        if (fillRow) { d.fit(x + c0 + 4, yy + 13, s.t, 9.5, c1 - 8, { bold: true }); d.fit(x + c0 + c1 + 4, yy + 13, s.a, 9, c2 - 8); }
        yy += rh;
      });
      if (!fillRow) { d.rect(x, yy, cw, rh, { fill: [0.97, 0.97, 0.98], stroke: LINE, lw: 0.5 }); d.text(x + cw - c3 - 6, yy + 13, "Total manche " + (i + 1), 9, { bold: true, align: "right" }); d.line(x + cw - c3, yy, x + cw - c3, yy + rh, { color: LINE, lw: 0.5 }); yy += rh; }
      y = yy + 10;
    });
    return { y: colI === 0 ? y : Math.max(y, top), colI };
  }
  function answerSheet(d, ctx, t) {
    const st = ctx.st, sc = st.scoring, both = sc.title + sc.artist;
    d.page();
    const neutral = t && /^Équipe \d+$/.test(t.name);
    d.text(d.M, 50, st.name || "Blind test", 10, { color: GREY });
    d.fit(d.M, 78, t ? "Équipe " + t.id + (neutral ? "   Nom : ______________________" : " – " + t.name) : "Équipe n° _____   Nom : ______________________", t && !neutral ? 19 : 15, d.W - 2 * d.M - 140, { bold: true });
    d.rect(d.W - d.M - 128, 40, 128, 48, { stroke: INK, lw: 1.2, r: 6 }); d.text(d.W - d.M - 64, 54, "TOTAL GÉNÉRAL", 9, { bold: true, align: "center", color: GREY });
    d.para(d.M + 20, 98, "Écrivez le titre et l'artiste de chaque morceau. Titre = " + pts(sc.title) + ", artiste = " + pts(sc.artist) + ", les deux = " + pts(both) + ". Rendez la feuille à l'animateur à la fin de la partie.", 9.5, d.W - 2 * d.M - 40, { align: "center", color: GREY });
    mancheGrid(d, ctx, 128, false, "", () => { footer(d, ctx); d.page(); d.text(d.M, d.M + 12, (t ? "Équipe " + t.id + (neutral ? "" : " – " + t.name) : "Feuille de réponses") + " (suite)", 10, { bold: true, color: GREY }); });
    footer(d, ctx);
  }
  function answerSheets(d, ctx) { ctx.st.teams.forEach((t) => answerSheet(d, ctx, t)); }
  function blankSheet(d, ctx) { answerSheet(d, ctx, null); }
  function keySheet(d, ctx) {
    const st = ctx.st, sc = st.scoring, both = sc.title + sc.artist;
    d.page(); const y = head(d, ctx, "Corrigé", "Titre = " + pts(sc.title) + ", artiste = " + pts(sc.artist) + ", les deux = " + pts(both) + ". Fautes de frappe tolérées.");
    mancheGrid(d, ctx, y, true, "", () => { footer(d, ctx); d.page(); d.text(d.M, d.M + 12, "Corrigé (suite)", 10, { bold: true, color: GREY }); });
    footer(d, ctx);
  }
  function scoreSheet(d, ctx) {
    const st = ctx.st, M = st.manches.length, w = d.W - 2 * d.M;
    d.page(); let y = head(d, ctx, "Tableau des scores", "Reportez le total de chaque manche. Maximum possible : " + pts(ctx.max) + ".");
    const cN = 24, cT = Math.min(150, w * 0.28), cTot = 46, cR = 36, cm = (w - cN - cT - cTot - cR) / Math.max(M, 1), rh = Math.max(20, Math.min(28, (d.H - 60 - y) / (st.teams.length + 1)));
    const cols = [cN, cT].concat(Array(M).fill(cm), [cTot, cR]);
    const hdr = ["N°", "Équipe"].concat(st.manches.map((m, i) => "M" + (i + 1) + (m.mult > 1 ? " ×" + m.mult : "")), ["Total", "Rang"]);
    const row = (cells, yy, isH) => { let x = d.M; cells.forEach((c, k) => { d.rect(x, yy, cols[k], rh, isH ? { fill: LIGHT, stroke: LINE, lw: 0.5 } : { stroke: LINE, lw: 0.5 }); if (c) (k === 1 ? d.fit(x + 5, yy + rh / 2 + 4, c, isH ? 9 : 10, cols[k] - 10, { bold: isH }) : d.fit(x + cols[k] / 2, yy + rh / 2 + 4, c, isH ? 8.5 : 10, cols[k] - 4, { bold: isH, align: "center", color: isH ? GREY : INK })); x += cols[k]; }); };
    row(hdr, y, true); y += rh;
    st.teams.forEach((t) => { if (y + rh > d.H - 44) { footer(d, ctx); d.page(); y = d.M + 10; row(hdr, y, true); y += rh; } row([String(t.id), t.name].concat(Array(M + 2).fill("")), y, false); y += rh; });
    footer(d, ctx);
  }
  function rulesSheet(d, ctx) {
    d.page(); let y = head(d, ctx, ctx.rules.title || "Les règles du jeu", "");
    const w = d.W - 2 * d.M - 30;
    ctx.rules.items.forEach((it, i) => {
      const lines = d.wrap(it, 11.5, w - 10);
      if (y + lines.length * 16 > d.H - 50) { footer(d, ctx); d.page(); y = d.M + 10; }
      d.rect(d.M + 4, y - 4, 22, 22, { fill: PINK, r: 11 }); d.text(d.M + 15, y + 11, String(i + 1), 11, { bold: true, align: "center", color: [1, 1, 1] });
      lines.forEach((l, k) => d.text(d.M + 36, y + 11 + k * 16, l, 11.5)); y += lines.length * 16 + 14;
    });
    if (ctx.rules.end) { y += 6; d.para(d.M + 20, y, ctx.rules.end, 13, d.W - 2 * d.M - 40, { bold: true, align: "center", color: PINK }); }
    footer(d, ctx);
  }

  // 🏆 Affiche A4 des vainqueurs (à afficher au travail) – ctx : { e: entrée du palmarès, photos: [dataUrl|null ×3], title, sub, foot }
  function poster(d, ctx) {
    const e = ctx.e, W = d.W, H = d.H, cx = W / 2, GOLD = [0.85, 0.65, 0.13], GOLD2 = [0.99, 0.84, 0.35], NAVY = [0.1, 0.07, 0.24];
    d.page();
    // cadre doré + confettis
    d.rect(14, 14, W - 28, H - 28, { stroke: GOLD, lw: 3 }); d.rect(22, 22, W - 44, H - 44, { stroke: GOLD2, lw: 1 });
    let sd = 7; const rnd = () => ((sd = (sd * 9301 + 49297) % 233280) / 233280);
    const CC = [[1, 0.36, 0.66], [0.36, 0.55, 1], [1, 0.81, 0.29], [0.18, 0.8, 0.56], [0.69, 0.42, 1]];
    for (let i = 0; i < 90; i++) { // confettis dans les coins, jamais sur les textes
      const left = i % 2 === 0, x = left ? 30 + rnd() * 95 : W - 125 + rnd() * 95, top = i % 4 < 2, y = top ? 30 + Math.pow(rnd(), 1.4) * 260 : H - 230 - Math.pow(rnd(), 1.4) * 150;
      if (top && y > 50 && y < 150 && (left ? x > 62 : x < W - 62)) continue; // laisse le titre libre
      if (!top && (y > H - 235 || (left ? x > 100 : x < W - 100))) continue;
      d.rect(x, y, 5 + rnd() * 6, 3 + rnd() * 3, { fill: CC[i % 5], r: 1 });
    }
    // titres
    let y = 62;
    d.fit(cx, y, (e.title || "Blind test").toUpperCase(), 12, W - 120, { bold: true, align: "center", color: [0.45, 0.45, 0.55] }); y += 46;
    d.fit(cx, y, ctx.title || "Les grands vainqueurs", 40, W - 100, { bold: true, align: "center", color: [0.86, 0.22, 0.5], min: 24 }); y += 26;
    d.fit(cx, y, ctx.sub || "", 14, W - 120, { align: "center", color: [0.35, 0.35, 0.42] }); y += 22;
    // photo du vainqueur
    const R0 = 138, py = y + R0 + 10, w = e.podium[0];
    d.disc(cx, py, R0 + 12, { fill: GOLD2 }); d.disc(cx, py, R0 + 12, { stroke: GOLD, lw: 3 });
    if (!(ctx.photos[0] && d.photo(cx, py, R0, ctx.photos[0]))) { d.disc(cx, py, R0, { fill: NAVY }); d.text(cx, py + 40, "1", 120, { bold: true, align: "center", color: GOLD2 }); }
    // médaille « 1er »
    d.disc(cx + R0 * 0.78, py - R0 * 0.78, 34, { fill: GOLD, stroke: [1, 1, 1], lw: 3 }); d.text(cx + R0 * 0.78, py - R0 * 0.78 + 9, "1er", 24, { bold: true, align: "center", color: [1, 1, 1] });
    y = py + R0 + 58;
    d.fit(cx, y, w.name, 42, W - 90, { bold: true, align: "center", color: NAVY, min: 22 }); y += 30;
    d.text(cx, y, "avec " + pts(w.total), 17, { bold: true, align: "center", color: GOLD }); y += 24;
    if (w.members && w.members.length) y = d.para(60, y, w.members.join("  ·  "), 11.5, W - 120, { align: "center", color: [0.3, 0.3, 0.38] }) + 4;
    // 2e et 3e
    const oth = e.podium.slice(1, 3);
    if (oth.length) {
      const by = Math.max(y + 10, H - 222); d.line(90, by, W - 90, by, { color: [0.85, 0.85, 0.88] });
      d.text(cx, by + 22, "SUR LE PODIUM", 10, { bold: true, align: "center", color: [0.5, 0.5, 0.58] });
      const r2 = 34, slot = (W - 120) / oth.length;
      oth.forEach((t, k) => {
        const x0 = 60 + slot * k + slot / 2, yy = by + 72, c = t.rank === 2 ? [0.7, 0.7, 0.78] : [0.8, 0.5, 0.25];
        d.disc(x0, yy, r2 + 4, { fill: c });
        if (!(ctx.photos[k + 1] && d.photo(x0, yy, r2, ctx.photos[k + 1]))) { d.disc(x0, yy, r2, { fill: NAVY }); d.text(x0, yy + 11, String(t.rank), 30, { bold: true, align: "center", color: [1, 1, 1] }); }
        d.fit(x0, yy + r2 + 22, t.rank + "e – " + t.name, 13, slot - 16, { bold: true, align: "center", color: NAVY });
        d.text(x0, yy + r2 + 38, pts(t.total), 10.5, { align: "center", color: [0.45, 0.45, 0.5] });
      });
    }
    d.fit(cx, H - 38, ctx.foot || "Bravo à toutes les équipes et merci à tous !", 12, W - 100, { bold: true, align: "center", color: [0.86, 0.22, 0.5] });
  }

  const DOCS = { poster, teams: teamSheets, list: teamList, dj: djSheet, ans: answerSheets, blank: blankSheet, key: keySheet, score: scoreSheet, rules: rulesSheet };
  window.BTPDF = {
    // kinds : liste de documents dans l'ordre ; renvoie les octets du PDF
    make(kinds, ctx) { const d = new Doc(); kinds.forEach((k) => DOCS[k] && DOCS[k](d, ctx)); return { bytes: d.bytes(), pages: d.pages.length }; },
    Doc,
  };
})();
