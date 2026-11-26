// Correction tolérante aux fautes de frappe (titres et artistes)

const ARTICLES = new Set(["le", "la", "les", "l", "un", "une", "the", "a", "an", "du", "de", "des", "d"]);
const STOP = new Set(["the", "and", "feat", "ft", "featuring", "et", "avec", "le", "la", "les", "des", "du", "de", "un", "une", "a", "an", "l", "d"]);

export function norm(s) {
  return String(s == null ? "" : s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/&/g, " et ")
    .replace(/\b([ldjnmstc]|qu)['’`´]/g, "$1 ")
    .replace(/['’`´]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function core(s) {
  let t = norm(s).split(" ").filter(Boolean);
  while (t.length > 1 && ARTICLES.has(t[0])) t.shift();
  return t.join(" ");
}

export function lev(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

export function sim(a, b) {
  const m = Math.max(a.length, b.length);
  return m === 0 ? 1 : 1 - lev(a, b) / m;
}

function hasWords(text, v) {
  return (" " + text + " ").includes(" " + v + " ");
}

function titleVariants(title, aliases) {
  const set = new Set();
  const add = (x) => { const c = core(x); if (c) set.add(c); };
  add(title);
  add(String(title).replace(/\(.*?\)/g, " "));
  add(String(title).split(/\s[-:]\s|:/)[0]);
  (aliases || []).forEach(add);
  return [...set];
}

function artistVariants(artist, aliases) {
  const set = new Set();
  const add = (x) => { const c = core(x); if (c) set.add(c); };
  add(artist);
  const parts = String(artist).split(/\s+(?:feat\.?|ft\.?|featuring|&|,|et|and|avec)\s+|,\s*/i);
  parts.forEach(add);
  (aliases || []).forEach(add);
  return [...set];
}

function tokensOf(variants) {
  const set = new Set();
  variants.forEach((v) => v.split(" ").forEach((tk) => { if (tk.length >= 3 && !STOP.has(tk)) set.add(tk); }));
  return set;
}

export function judgeTitle(typed, title, aliases) {
  const t = core(typed);
  if (!t) return "ko";
  const vs = titleVariants(title, aliases);
  let best = 0;
  let doubt = false;
  for (const v of vs) {
    if (t === v) return "ok";
    const l = lev(t, v);
    const m = Math.max(t.length, v.length);
    if (l <= 1 && m >= 5) return "ok";
    const s = 1 - l / m;
    if (s > best) best = s;
    if (v.length >= 5 && hasWords(t, v)) return "ok";
    if (t.length >= 5 && hasWords(v, t)) doubt = true;
  }
  if (best >= (t.length >= 9 ? 0.8 : 0.84)) return "ok";
  if (best >= 0.68 || doubt) return "doubt";
  return "ko";
}

export function judgeArtist(typed, artist, aliases) {
  const t = core(typed);
  if (!t) return "ko";
  const vs = artistVariants(artist, aliases);
  const toks = tokensOf(vs);
  if (vs.includes(t)) return "ok";
  if (toks.has(t)) return "ok";
  const tt = t.split(" ").filter((x) => !STOP.has(x));
  if (tt.length && tt.every((x) => toks.has(x))) return "ok";
  for (const v of vs) {
    if (v.length >= 3 && hasWords(t, v)) return "ok";
  }
  let best = 0;
  for (const v of vs) best = Math.max(best, sim(t, v));
  if (best >= 0.84) return "ok";
  // mot unique proche d'un mot de l'artiste
  let bestTok = 0;
  if (tt.length === 1) {
    for (const k of toks) {
      const l = lev(tt[0], k);
      if (l <= 1 && Math.max(tt[0].length, k.length) >= 5) return "ok";
      bestTok = Math.max(bestTok, 1 - l / Math.max(tt[0].length, k.length));
    }
  }
  if (best >= 0.68 || bestTok >= 0.7) return "doubt";
  return "ko";
}

// Jugement d'un morceau: ans = {t, a}, song = {t, a, at:[], aa:[]}
export function judgeSong(ans, song) {
  const a = ans || {};
  const res = {
    t: judgeTitle(a.t || "", song.t, song.at),
    a: judgeArtist(a.a || "", song.a, song.aa),
  };
  // "Titre - Artiste" écrit dans une seule case
  if (res.a === "ko" && !String(a.a || "").trim() && a.t) {
    const tt = core(a.t);
    const vs = artistVariants(song.a, song.aa);
    if (vs.some((v) => v.length >= 4 && hasWords(tt, v))) res.a = "ok";
  }
  return res;
}
