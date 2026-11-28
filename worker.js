// Blind test: serveur (Cloudflare Worker + Durable Object)
import { DurableObject } from "cloudflare:workers";
import { judgeSong } from "./matcher.js";

const json = (o, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const defaultSetup = () => ({
  name: "Blind test",
  codes: { anim: null, dj: null },
  baseUrl: "",
  scoring: { title: 1, artist: 2 },
  extractSec: 10,
  defs2: true,
  answerSec: 10,
  teamNames: true,
  teams: [],
  manches: [],
});
const defaultGame = () => ({ status: "setup", runId: 0, m: 0, k: 0, started: false, phaseStart: 0, states: [], showRanking: false });

// ---- Extraits musicaux (30 s) : Apple (iTunes) puis Deezer en secours
const UA = { "user-agent": "Mozilla/5.0 (blindtest amicale)" };
async function getJson(u, ttl) {
  const r = await fetch(u, { headers: UA, cf: ttl === 0 ? { cacheTtl: 0, cacheEverything: false } : { cacheTtl: ttl || 3600, cacheEverything: true } });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}
// L'adresse de lecture passe par notre serveur (/api/audio) : les liens Deezer expirent vite,
// le serveur va chercher un lien neuf à chaque lecture.
const audioPath = (s, id) => "/api/audio?s=" + s + "&id=" + id;
const itItem = (x) => x && x.previewUrl ? { s: "it", id: String(x.trackId), t: x.trackName, a: x.artistName, img: (x.artworkUrl100 || "").replace("100x100", "200x200"), url: audioPath("it", x.trackId) } : null;
const dzItem = (x) => x && x.preview ? { s: "dz", id: String(x.id), t: x.title, a: (x.artist || {}).name || "", img: (x.album || {}).cover_medium || "", url: audioPath("dz", x.id) } : null;
async function audio(request, url) {
  const s = url.searchParams.get("s"), id = (url.searchParams.get("id") || "").replace(/[^0-9]/g, "");
  if (!id || (s !== "dz" && s !== "it")) return new Response("introuvable", { status: 404 });
  let src = "";
  try {
    if (s === "dz") src = (await getJson("https://api.deezer.com/track/" + id, 0)).preview || "";
    else src = (((await getJson("https://itunes.apple.com/lookup?country=FR&id=" + id)).results || [])[0] || {}).previewUrl || "";
  } catch (e) { src = ""; }
  if (!/^https?:\/\//.test(src)) return new Response("extrait indisponible", { status: 404 });
  const h = { "user-agent": UA["user-agent"] }; const range = request.headers.get("range"); if (range) h.range = range;
  const up = await fetch(src, { headers: h });
  if (!up.ok && up.status !== 206) return new Response("extrait indisponible", { status: 502 });
  const out = new Headers();
  ["content-type", "content-length", "content-range", "accept-ranges"].forEach((k) => { const v = up.headers.get(k); if (v) out.set(k, v); });
  if (!out.get("content-type")) out.set("content-type", "audio/mpeg");
  if (!out.get("accept-ranges")) out.set("accept-ranges", "bytes");
  out.set("cache-control", "private, max-age=600");
  return new Response(up.body, { status: up.status, headers: out });
}
// Versions à éviter dans un blind test : karaoké, instrumentales, reprises « à la manière de »…
const JUNK = /karaok|instrumental|originally performed|made famous|in the style of|as made famous|tribute|backing track|hit the button|sing ?along|playback|lullab|berceuse|8[- ]?bit|piano version|music box|boîte à musique|cover version|version piano|minus one|re-?recorded/i;
const isJunk = (it) => JUNK.test(it.t + " " + it.a);
const nrm = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
// Classe les résultats : jamais de karaoké en premier, et priorité au bon artiste
function rank(items, t, a) {
  const T = nrm(t), A = nrm(a);
  const sc = (it) => {
    let n = 0; const it_t = nrm(it.t), it_a = nrm(it.a);
    if (isJunk(it)) n -= 10;
    if (A && it_a && (it_a.includes(A) || A.includes(it_a))) n += 3;
    if (T && it_t && (it_t.includes(T) || T.includes(it_t))) n += 2;
    if (/\blive\b|en concert|\(live/i.test(it.t)) n -= 1;
    return n;
  };
  return items.map((it, i) => ({ it, s: sc(it), i })).sort((x, y) => y.s - x.s || x.i - y.i).map((x) => x.it);
}
async function itSearch(q, n) {
  const j = await getJson("https://itunes.apple.com/search?country=FR&media=music&entity=song&limit=" + n + "&term=" + encodeURIComponent(q));
  return (j.results || []).map(itItem).filter(Boolean);
}
async function dzSearch(q, n) {
  const j = await getJson("https://api.deezer.com/search?limit=" + n + "&q=" + encodeURIComponent(q));
  return (j.data || []).map(dzItem).filter(Boolean);
}
async function preview(url) {
  const src = url.searchParams.get("src"), id = (url.searchParams.get("id") || "").replace(/[^0-9]/g, "");
  const q = clip(url.searchParams.get("q"), 200).trim();
  const qt = clip(url.searchParams.get("t"), 100), qa = clip(url.searchParams.get("a"), 100);
  const many = url.searchParams.get("all") === "1";
  let items = [];
  const tries = [];
  if (src && id) {
    if (src === "it") tries.push(async () => { const j = await getJson("https://itunes.apple.com/lookup?country=FR&id=" + id); return (j.results || []).map(itItem).filter(Boolean); });
    if (src === "dz") tries.push(async () => [dzItem(await getJson("https://api.deezer.com/track/" + id))].filter(Boolean));
  }
  if (q) {
    if (many) tries.push(async () => {
      const [a, b] = await Promise.allSettled([itSearch(q, 5), dzSearch(q, 5)]);
      return rank([...(a.value || []), ...(b.value || [])], qt, qa);
    });
    else {
      // on prend 10 résultats et on garde le meilleur (pas de karaoké, bon artiste)
      const best = async (f) => { const r = rank(await f(q, 10), qt, qa); return r.length && !isJunk(r[0]) ? [r[0]] : []; };
      tries.push(() => best(itSearch)); tries.push(() => best(dzSearch));
      tries.push(async () => rank(await dzSearch(q, 10), qt, qa).slice(0, 1)); // en dernier recours seulement
    }
  }
  for (const f of tries) {
    try { items = await f(); } catch (e) { items = []; }
    if (items.length) break;
  }
  return json({ ok: items.length > 0, items });
}

// ---- Playlists Deezer (sources de morceaux illimitées, sans compte)
const cleanTitle = (t) => String(t || "")
  .replace(/\s*[-–]\s*(\d{4}\s*)?(remaster|remastered|radio edit|single version|album version|version|live|edit|mono|stereo|original mix|extended|from ).*$/i, "")
  .replace(/\s*[\(\[](feat\.?|ft\.?|with|avec|remaster|remastered|radio edit|single|album version|version|live|edit|mono|stereo|original|extended|from |de |du |tir|bande originale|b\.o\.|bof|\d{4})[^\)\]]*[\)\]]/gi, "")
  .replace(/\s+/g, " ").trim();
async function dzPlaylists(url) {
  const id = (url.searchParams.get("id") || "").replace(/[^0-9]/g, "");
  if (id) {
    const tracks = []; let next = "https://api.deezer.com/playlist/" + id + "/tracks?limit=400";
    try {
      for (let n = 0; n < 4 && next; n++) {
        const j = await getJson(next);
        (j.data || []).forEach((x) => {
          if (!x || !x.preview || x.readable === false) return;
          if (JUNK.test((x.title || "") + " " + ((x.artist || {}).name || ""))) return;
          const full = x.title || "", t = cleanTitle(x.title_short || full) || full, a = (x.artist || {}).name || "";
          const at = []; if (full && full !== t) at.push(clip(full, 80));
          tracks.push({ t: clip(t, 100), a: clip(a, 100), h: "Extrait", at, aa: [], pv: { s: "dz", id: String(x.id), t: clip(t, 100), a: clip(a, 100) } });
        });
        next = j.next && /^https:\/\/api\.deezer\.com\//.test(j.next) ? j.next : null;
      }
    } catch (e) { return json({ ok: false, error: "Deezer ne répond pas", tracks: [] }); }
    const seen = new Set();
    return json({ ok: true, tracks: tracks.filter((x) => { const k = (x.t + "|" + x.a).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }) });
  }
  const q = clip(url.searchParams.get("q"), 100).trim();
  if (!q) return json({ ok: false, items: [] });
  try {
    const j = await getJson("https://api.deezer.com/search/playlist?limit=15&q=" + encodeURIComponent(q));
    return json({ ok: true, items: (j.data || []).filter((x) => x.nb_tracks >= 5).map((x) => ({ id: String(x.id), title: x.title, n: x.nb_tracks, img: x.picture_medium || "", by: (x.user || {}).name || "" })) });
  } catch (e) { return json({ ok: false, items: [], error: "Deezer ne répond pas" }); }
}

// Durée estimée d'une partie, en minutes (même calcul que dans l'appli : estDuration)
function estMinutes(st) {
  const ex = Number(st.extractSec) || 15, an = Number(st.answerSec) || 15, T = (st.teams || []).length;
  let songs = 0; (st.manches || []).forEach((m) => m.songs.forEach((x) => (songs += (x.d || ex) + an + 12)));
  return Math.round(songs / 60 + (st.manches || []).length * 4 + 3 + T * 0.5);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Adresses courtes : /ecran (écran géant) et /ecran-essai (écran du mode essai)
    const short = url.pathname.toLowerCase().replace(/\/+$/, "");
    if (["/ecran", "/écran", "/%c3%a9cran", "/tv", "/ecran-essai", "/essai-ecran"].includes(short)) {
      const essai = short.includes("essai") || url.searchParams.has("essai");
      return Response.redirect(url.origin + "/?r=screen" + (essai ? "&essai=1" : ""), 302);
    }
    if (url.pathname === "/api/preview") return preview(url);
    if (url.pathname === "/api/audio") return audio(request, url);
    if (url.pathname === "/api/dzpl") return dzPlaylists(url);
    if (url.pathname.startsWith("/api/")) {
      // Mode essai : une partie séparée, la vraie soirée n'est jamais touchée
      const name = request.headers.get("x-essai") === "1" || (url.pathname === "/api/photo" && url.searchParams.get("essai") === "1") ? "essai" : "main";
      const stub = env.SOIREE.get(env.SOIREE.idFromName(name));
      return stub.fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};

const clip = (s, n) => String(s == null ? "" : s).slice(0, n);
const cleanPv = (p) => (p && (p.s === "it" || p.s === "dz") && /^\d{1,15}$/.test(String(p.id)) ? { s: p.s, id: String(p.id), t: clip(p.t, 100), a: clip(p.a, 100) } : undefined);
const cleanList = (a) => (Array.isArray(a) ? a.map((x) => clip(x, 80)).filter(Boolean).slice(0, 12) : []);

export class Soiree extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.ready = ctx.blockConcurrencyWhile(async () => {
      const d = await ctx.storage.get(["setup", "game", "answers", "results", "adjust", "played", "seen", "photos"]);
      this.photos = d.get("photos") || {}; // photo d'équipe : clé = code d'équipe, valeur = version
      this.seen = d.get("seen") || {}; // équipes qui ont déjà ouvert leur QR code (clé = code d'équipe)
      this.played = d.get("played") || [];
      this.setup = d.get("setup") || defaultSetup();
      // nouveaux réglages par défaut (nov. 2026) : extrait 10 s, titre 1 pt / artiste 2 pts – appliqués une seule fois aux réglages encore « d'origine »
      if (!this.setup.defs2) {
        if (Number(this.setup.extractSec) === 15) this.setup.extractSec = 10;
        if (this.setup.scoring && this.setup.scoring.title === 1 && this.setup.scoring.artist === 1) this.setup.scoring = { title: 1, artist: 2 };
        this.setup.defs2 = true;
      }
      this.game = d.get("game") || defaultGame();
      this.answers = d.get("answers") || {};
      this.results = d.get("results") || {};
      this.adjust = d.get("adjust") || {};
    });
  }

  async save(...keys) {
    const o = {};
    for (const k of keys) o[k] = this[k];
    await this.ctx.storage.put(o);
  }

  auth(role, code, teamId) {
    const c = this.setup.codes;
    if (role === "anim") return c.anim && code === c.anim ? "anim" : null;
    if (role === "dj") {
      if (c.anim && code === c.anim) return "anim";
      return c.dj && code === c.dj ? "dj" : null;
    }
    if (role === "team") {
      const t = this.setup.teams.find((x) => x.id === teamId);
      return t && String(t.code).toUpperCase() === code.toUpperCase() ? "team" : null;
    }
    return null;
  }

  // skip = numéro d'une manche à ne pas compter (pour le classement « avant cette manche »)
  ranking(skip) {
    const sc = this.setup.scoring;
    const rows = this.setup.teams.map((t) => ({ id: t.id, name: t.name, total: 0, perManche: [] }));
    this.setup.manches.forEach((m, i) => {
      if (this.game.states[i] !== "published" || i === skip) return;
      rows.forEach((r) => {
        const items = (this.results[i] || {})[r.id] || [];
        let pts = 0;
        items.forEach((it) => {
          pts += (it.t === "ok" ? sc.title : 0) + (it.a === "ok" ? sc.artist : 0);
        });
        pts *= m.mult || 1;
        r.perManche[i] = pts;
        r.total += pts;
      });
    });
    rows.forEach((r) => {
      r.total += Number(this.adjust[r.id] || 0);
    });
    // départage (fin de partie) : à égalité de points, les équipes désignées gagnantes passent devant, dans l'ordre choisi
    const tb = (skip === undefined && Array.isArray(this.game.tb)) ? this.game.tb : [];
    const ti = (r) => { const k = tb.indexOf(r.id); return k < 0 ? 1e6 : k; };
    rows.sort((a, b) => b.total - a.total || ti(a) - ti(b) || a.name.localeCompare(b.name));
    let rank = 0;
    rows.forEach((r, i) => {
      const p = rows[i - 1];
      if (!p || r.total !== p.total || ti(p) < 1e6) rank = i + 1; // ex æquo seulement si personne n'a été départagé
      r.rank = rank;
      if (ti(r) < 1e6 && ((p && p.total === r.total) || (rows[i + 1] && rows[i + 1].total === r.total))) r.tb = true;
    });
    return rows;
  }

  // Garde le podium de la soirée (avec les photos) dès que tout le classement est révélé, sans égalité pour la 1re place
  async archive() {
    const g = this.game, R = this.ranking(), T = R.length;
    if (!T || (g.reveal || 0) < T || R.filter((r) => r.rank === 1).length !== 1) return;
    const id = g.runId || 1;
    const podium = R.filter((r) => r.rank <= 3).slice(0, 3).map((r) => {
      const t = this.setup.teams.find((x) => x.id === r.id) || {};
      return { rank: r.rank, name: r.name, total: r.total, members: t.members || [], code: t.code };
    });
    const list = ((await this.ctx.storage.get("hof")) || []).filter((x) => x.id !== id);
    list.unshift({ id, at: Date.now(), title: this.setup.name || "Blind test", teams: T, podium: podium.map(({ code, ...x }) => x) });
    const keep = list.slice(0, 30), gone = list.slice(30);
    const put = { hof: keep };
    for (let i = 0; i < podium.length; i++) {
      const d = podium[i].code && this.photos[podium[i].code] ? await this.ctx.storage.get("photo:" + podium[i].code) : null;
      if (d) put["hofph:" + id + ":" + i] = d; else await this.ctx.storage.delete("hofph:" + id + ":" + i);
    }
    await this.ctx.storage.put(put);
    for (const x of gone) await this.ctx.storage.delete([0, 1, 2].map((i) => "hofph:" + x.id + ":" + i));
  }

  revealed() {
    const all = this.ranking(), T = all.length, n = Math.min(T, this.game.reveal || 0);
    return all.map((r, k) => (k >= T - n ? r : { rank: r.rank, hidden: true }));
  }

  doubtCount(m) {
    let n = 0;
    const res = this.results[m] || {};
    Object.values(res).forEach((arr) => arr.forEach((it) => { if (it.t === "doubt") n++; if (it.a === "doubt") n++; }));
    return n;
  }

  pub() {
    const { setup, game } = this;
    const vm = this.env && this.env.CF_VERSION_METADATA;
    return {
      now: Date.now(),
      v: vm && vm.id ? String(vm.id) : "",
      name: setup.name,
      needInit: !setup.codes.anim,
      djReady: !!setup.codes.dj,
      // joined = l'équipe a scanné son QR code ; named = elle a choisi son nom (prête)
      teams: setup.teams.map((t) => ({ id: t.id, name: t.name, members: t.members, joined: !!this.seen[t.code], ph: this.photos[t.code] || 0, named: setup.teamNames === false || !/^Équipe \d+$/.test(t.name) })),
      status: game.status,
      runId: game.runId || 0,
      m: game.m,
      k: game.k,
      started: game.started,
      phaseStart: game.phaseStart,
      // durée de l'extrait : celle réglée pour le morceau en cours, sinon celle par défaut
      extractSec: (() => { const c = game.status === "running" && setup.manches[game.m] && setup.manches[game.m].songs[game.k]; return (c && c.d) || setup.extractSec; })(),
      extractBase: setup.extractSec,
      answerSec: setup.answerSec,
      showRanking: !!game.showRanking,
      showRules: !!game.showRules,
      // équipes à l'écran : toutes, ou une par une (pour appeler chaque personne)
      showTeams: game.showTeams ? (game.showTeams === true ? { mode: "all", i: 0 } : game.showTeams) : null,
      cutAt: game.cutAt || 0,
      // QR codes affichés sur l'écran géant (seulement quand l'animateur le demande)
      showQr: game.showQr ? {
        mode: game.showQr.mode, i: game.showQr.i || 0,
        teams: setup.teams.map((t) => ({ id: t.id, name: t.name, code: t.code, url: (setup.baseUrl || this.origin || "") + "/?t=" + t.id + "&c=" + encodeURIComponent(t.code) + (this.essai ? "&essai=1" : "") })),
      } : null,
      teamNames: setup.teamNames !== false,
      service: setup.service || "",
      scoring: setup.scoring,
      manches: setup.manches.map((m, i) => ({
        title: m.title,
        mult: m.mult || 1,
        n: m.songs.length,
        label2: m.label2 || "Artiste",
        state: game.states[i] || "pending",
        reveal: game.states[i] === "published" ? m.songs.map((s) => ({ t: s.t, a: s.a })) : null,
      })),
      // fin de partie : seules les places déjà révélées (en partant de la dernière) sont envoyées
      ranking: game.showRanking ? (game.status === "finished" ? this.revealed() : this.ranking()) : null,
      reveal: game.reveal || 0,
      finView: game.status === "finished" ? game.finView || null : null,
      showPhoto: game.showPhoto || null,
      podStep: game.podStep || 0,
      podLand: game.podLand || 0,
      sfx: game.sfx || null,
      bgm: game.bgm || { on: false, vol: 0.35 },
      tbShow: game.tbShow ? { place: game.tbShow.place, hand: game.tbShow.hand ?? null, teams: game.tbShow.ids.map((id) => (setup.teams.find((t) => t.id === id) || {}).name || "?") } : null,
      // classement d'avant la dernière manche publiée, pour l'animation de l'écran géant
      rankPrev: game.showRanking && game.status === "running" ? this.ranking(game.m) : null,
      rankAt: game.rankAt || 0,
    };
  }

  async fetch(request) {
    await this.ready;
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api/, "");
    const method = request.method;
    let body = {};
    if (method !== "GET") {
      try { body = await request.json(); } catch { body = {}; }
    }
    this.origin = url.origin; this.essai = request.headers.get("x-essai") === "1";
    const role = request.headers.get("x-role") || "";
    const code = (request.headers.get("x-code") || "").trim();
    const teamId = Number(request.headers.get("x-team") || 0);
    if (request.headers.get("x-essai") === "1" && !this.setup.codes.anim) {
      this.setup.codes = { anim: "1234", dj: "5678" };
      this.setup.name = "Blind test – ESSAI";
      await this.save("setup");
    }
    const who = this.auth(role, code, teamId);

    // ---- public
    if (path === "/public" && method === "GET") return json({ pub: this.pub() });

    if (path === "/login" && method === "POST") {
      const r = this.auth(body.role, String(body.code || "").trim(), Number(body.teamId || 0));
      return json({ ok: !!r, pub: this.pub() });
    }

    if (path === "/init" && method === "POST") {
      if (this.setup.codes.anim) return json({ error: "déjà initialisé" }, 409);
      const c = clip(body.code, 12).trim();
      if (c.length < 3) return json({ error: "code trop court (3 caractères minimum)" }, 400);
      this.setup.codes.anim = c;
      await this.save("setup");
      return json({ ok: true });
    }

    // ---- équipe
    if (path === "/team" && method === "GET") {
      if (who !== "team") return json({ error: "non autorisé" }, 401);
      const t = this.setup.teams.find((x) => x.id === teamId);
      if (!this.seen[t.code]) {
        this.seen[t.code] = Date.now();
        const codes = new Set(this.setup.teams.map((x) => x.code)); // on oublie les anciennes équipes
        Object.keys(this.seen).forEach((c) => { if (!codes.has(c)) delete this.seen[c]; });
        await this.save("seen");
      }
      const mine = {};
      Object.keys(this.answers).forEach((m) => { if (this.answers[m][teamId]) mine[m] = this.answers[m][teamId]; });
      const rk = this.game.showRanking ? (this.game.status === "finished" ? this.revealed() : this.ranking()).find((r) => r.id === teamId) || null : null;
      return json({
        pub: this.pub(),
        team: { id: t.id, name: t.name, members: t.members },
        answers: mine,
        me: rk || null,
      });
    }

    // ---- photos d'équipe (prise sur le téléphone de l'équipe, ou par l'animateur)
    if (path === "/photo" && method === "GET") {
      const t = this.setup.teams.find((x) => x.id === Number(url.searchParams.get("id")));
      const data = t && this.photos[t.code] ? await this.ctx.storage.get("photo:" + t.code) : null;
      if (!data) return new Response("", { status: 404 });
      const bin = Uint8Array.from(atob(data.split(",")[1] || ""), (c) => c.charCodeAt(0));
      return new Response(bin, { headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=604800" } });
    }
    if (path === "/photo" && method === "POST") {
      const id = who === "team" ? teamId : who === "anim" ? Number(body.teamId) : 0;
      const t = id && this.setup.teams.find((x) => x.id === id);
      if (!t) return json({ error: "non autorisé" }, 401);
      if (body.remove) {
        delete this.photos[t.code]; await this.ctx.storage.delete("photo:" + t.code);
      } else {
        const data = String(body.data || "");
        if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(data) || data.length > 122000) return json({ error: "photo invalide ou trop lourde" }, 400);
        await this.ctx.storage.put("photo:" + t.code, data);
        this.photos[t.code] = Date.now();
      }
      const codes = new Set(this.setup.teams.map((x) => x.code)); // on oublie les photos des anciennes équipes
      for (const c of Object.keys(this.photos)) if (!codes.has(c)) { delete this.photos[c]; await this.ctx.storage.delete("photo:" + c); }
      await this.save("photos");
      return json({ ok: true });
    }

    if (path === "/team/name" && method === "POST") {
      if (who !== "team") return json({ error: "non autorisé" }, 401);
      if (this.setup.teamNames === false) return json({ error: "l'animateur a fixé les noms d'équipe" }, 409);
      if (this.game.status !== "setup") return json({ error: "la partie a commencé : nom verrouillé" }, 409);
      const name = clip(body.name, 30).replace(/\s+/g, " ").trim();
      if (name.length < 2) return json({ error: "nom trop court" }, 400);
      if (this.setup.teams.some((x) => x.id !== teamId && x.name.toLowerCase() === name.toLowerCase())) return json({ error: "ce nom est déjà pris" }, 409);
      this.setup.teams.find((x) => x.id === teamId).name = name;
      await this.save("setup");
      return json({ ok: true });
    }

    if (path === "/team/answers" && method === "PUT") {
      if (who !== "team") return json({ error: "non autorisé" }, 401);
      const m = Number(body.m);
      if (this.game.status !== "running" || m !== this.game.m || this.game.states[m] !== "open") {
        return json({ error: "manche fermée" }, 409);
      }
      const n = this.setup.manches[m].songs.length;
      const arr = [];
      for (let i = 0; i < n; i++) {
        const x = (body.answers || [])[i] || {};
        arr.push({ t: clip(x.t, 100), a: clip(x.a, 100) });
      }
      this.answers[m] = this.answers[m] || {};
      this.answers[m][teamId] = arr;
      await this.save("answers");
      return json({ ok: true });
    }

    // ---- DJ
    if (path === "/dj" && method === "GET") {
      if (who !== "dj" && who !== "anim") return json({ error: "non autorisé" }, 401);
      const mm = this.setup.manches[this.game.m];
      const nxt = this.setup.manches[this.game.m + 1];
      return json({
        pub: this.pub(),
        songs: mm ? mm.songs.map((s) => ({ t: s.t, a: s.a, h: s.h, pv: s.pv, o: s.o, d: s.d })) : [],
        nextManche: nxt ? nxt.title : null,
        all: this.setup.manches.map((x) => ({ title: x.title, mult: x.mult || 1, label2: x.label2 || "Artiste", songs: x.songs.map((s) => ({ t: s.t, a: s.a, h: s.h, pv: s.pv, o: s.o, d: s.d })) })),
        label2: mm ? mm.label2 || "Artiste" : "Artiste",
      });
    }

    // ---- animateur
    if (path === "/anim" && method === "GET") {
      if (who !== "anim") return json({ error: "non autorisé" }, 401);
      return json({
        pub: this.pub(),
        setup: this.setup,
        game: this.game,
        answers: this.answers,
        results: this.results,
        ranking: this.ranking(),
        adjust: this.adjust,
        doubts: this.setup.manches.map((_, i) => this.doubtCount(i)),
        played: this.played,
      });
    }

    if (path === "/setup" && method === "POST") {
      if (who !== "anim") return json({ error: "non autorisé" }, 401);
      const s = body.setup || {};
      const partial = !!body.partial;
      if (this.game.status === "running" && !partial) return json({ error: "jeu en cours: modifications verrouillées" }, 409);
      if (typeof s.name === "string") this.setup.name = clip(s.name, 60);
      if (typeof s.baseUrl === "string") this.setup.baseUrl = clip(s.baseUrl, 200).replace(/\/+$/, "");
      if (s.codes) {
        if (typeof s.codes.anim === "string" && s.codes.anim.trim().length >= 3) this.setup.codes.anim = clip(s.codes.anim.trim(), 12);
        if (typeof s.codes.dj === "string") this.setup.codes.dj = s.codes.dj.trim() ? clip(s.codes.dj.trim(), 12) : null;
      }
      if (s.scoring) {
        this.setup.scoring = {
          title: Math.max(0, Math.min(10, Number(s.scoring.title) || 0)),
          artist: Math.max(0, Math.min(10, Number(s.scoring.artist) || 0)),
        };
      }
      if (typeof s.teamNames === "boolean") this.setup.teamNames = s.teamNames;
      if (typeof s.service === "string" && ["", "am", "sp", "dz", "yt"].includes(s.service)) this.setup.service = s.service;
      if (s.extractSec) this.setup.extractSec = Math.max(5, Math.min(90, Number(s.extractSec) || 15));
      if (s.answerSec) this.setup.answerSec = Math.max(3, Math.min(90, Number(s.answerSec) || 10));
      if (!partial || this.game.status !== "running") {
        if (typeof s.teamsLocked === "boolean") this.setup.teamsLocked = s.teamsLocked;
        // équipes verrouillées : on refuse tout changement de numéros / codes (QR codes déjà imprimés)
        const sameCodes = (a, b) => a.length === b.length && a.every((t, i) => String(t.code).toUpperCase() === String((b[i] || {}).code || "").toUpperCase());
        if (Array.isArray(s.teams) && this.setup.teamsLocked && s.teamsLocked !== false && !sameCodes(s.teams, this.setup.teams)) return json({ error: "Équipes verrouillées : déverrouillez-les d'abord (onglet Équipes)" }, 409);
        if (Array.isArray(s.teams)) {
          this.setup.teams = s.teams.slice(0, 60).map((t, i) => ({
            id: Number(t.id) || i + 1,
            name: clip(t.name, 40) || "Équipe " + (i + 1),
            code: clip(t.code, 8).toUpperCase() || "AAAA",
            members: (Array.isArray(t.members) ? t.members : []).slice(0, 40).map((x) => clip(x, 80)).filter(Boolean),
          }));
        }
        if (Array.isArray(s.manches)) {
          this.setup.manches = s.manches.slice(0, 30).map((m, i) => ({
            title: clip(m.title, 60) || "Manche " + (i + 1),
            mult: Math.max(1, Math.min(5, Number(m.mult) || 1)),
            label2: clip(m.label2, 40) || "Artiste",
            theme: clip(m.theme, 24),
            dz: clip(m.dz, 80),
            songs: (m.songs || []).slice(0, 20).map((x) => ({
              t: clip(x.t, 100),
              a: clip(x.a, 100),
              h: clip(x.h, 80),
              at: cleanList(x.at),
              aa: cleanList(x.aa),
              pv: cleanPv(x.pv),
              o: Math.max(0, Math.min(28, Math.round(Number(x.o) || 0))) || undefined,
              d: x.d ? Math.max(3, Math.min(30, Math.round(Number(x.d)))) : undefined,
            })),
          }));
        }
      }
      await this.save("setup");
      return json({ ok: true });
    }

    if (path === "/game" && method === "POST") {
      if (who !== "anim" && who !== "dj") return json({ error: "non autorisé" }, 401);
      const act = body.action;
      const g = this.game;
      const djOk = ["play", "next", "prev", "cut"];
      if (who === "dj" && !djOk.includes(act)) return json({ error: "réservé à l'animateur" }, 403);
      const mans = this.setup.manches;
      const cur = mans[g.m];
      if (act === "start") {
        if (!this.setup.teams.length || !mans.length) return json({ error: "il faut des équipes et des manches" }, 400);
        this.game = { status: "running", runId: Date.now(), m: 0, k: 0, started: false, phaseStart: 0, states: mans.map((_, i) => (i === 0 ? "open" : "pending")), showRanking: false };
        this.answers = {}; this.results = {}; this.adjust = {};
        await this.save("game", "answers", "results", "adjust");
      } else if (g.status !== "running" && act !== "showRanking" && act !== "showRules" && act !== "showTeams" && act !== "showQr" && act !== "reveal" && act !== "tbShow" && act !== "tbWin" && act !== "tbUndo" && act !== "finView" && act !== "showPhoto" && act !== "sfx" && act !== "bgm" && act !== "podStep" && act !== "podLand") {
        return json({ error: "jeu non démarré" }, 409);
      } else if (act === "play") {
        g.started = true; g.phaseStart = Date.now(); g.showRanking = false; g.showPhoto = null; if (g.bgm) g.bgm.on = false; // la musique reprend : l'écran revient au jeu
      } else if (act === "next") {
        if (cur && g.k < cur.songs.length - 1) { g.k++; g.started = false; g.phaseStart = 0; }
      } else if (act === "prev") {
        if (g.k > 0) { g.k--; g.started = false; g.phaseStart = 0; }
      } else if (act === "close") {
        if (g.states[g.m] !== "open") return json({ error: "manche déjà close" }, 409);
        g.states[g.m] = "closed";
        const res = {};
        this.setup.teams.forEach((t) => {
          const ans = (this.answers[g.m] || {})[t.id] || [];
          res[t.id] = cur.songs.map((s, i) => judgeSong(ans[i], s));
        });
        this.results[g.m] = res;
        await this.save("results");
      } else if (act === "publish") {
        if (g.states[g.m] !== "closed") return json({ error: "clore la manche d'abord" }, 409);
        g.states[g.m] = "published";
        // mémoire des morceaux joués (pour ne pas les retirer au sort lors des prochaines soirées)
        const set = new Set(this.played);
        cur.songs.forEach((x) => set.add((x.t + "|" + x.a).toLowerCase()));
        this.played = [...set].slice(-5000);
        await this.save("played");
      } else if (act === "nextManche") {
        if (g.states[g.m] !== "published") return json({ error: "publier la manche d'abord" }, 409);
        g.showRanking = false;
        if (g.m < mans.length - 1) { g.m++; g.k = 0; g.started = false; g.phaseStart = 0; g.states[g.m] = "open"; }
        else g.status = "finished";
      } else if (act === "finish") {
        g.status = "finished";
      } else if (act === "showRules") {
        g.showRules = !!body.show;
        if (g.showRules) { g.showTeams = false; g.showQr = null; }
      } else if (act === "cut") {
        g.cutAt = Date.now(); // demande à la sono du DJ de couper la musique
      } else if (act === "showQr") {
        const n = this.setup.teams.length;
        if (!body.mode || !n) g.showQr = null;
        else { g.showQr = { mode: body.mode === "one" ? "one" : "all", i: Math.max(0, Math.min(n - 1, Number(body.i) || 0)) }; g.showTeams = false; g.showRules = false; }
      } else if (act === "showTeams") {
        const n = this.setup.teams.length;
        if (!body.show || !n) g.showTeams = false;
        else { g.showTeams = { mode: body.mode === "one" ? "one" : "all", i: Math.max(0, Math.min(n - 1, Number(body.i) || 0)) }; g.showRules = false; g.showQr = null; }
      } else if (act === "reveal") {
        // révélation finale, une place à la fois (de la dernière à la première)
        g.reveal = Math.max(0, Math.min(this.setup.teams.length, Number(body.n) || 0));
        g.showRanking = true;
      } else if (act === "sfx") {
        // bruitage joué par le téléphone branché à la sono
        const k = String(body.k || "");
        if (!/^[a-z]{2,10}$/.test(k)) return json({ error: "bruitage inconnu" }, 400);
        const n = ((g.sfx && g.sfx.n) || 0) + 1;
        g.sfx = { k, n, q: (((g.sfx && g.sfx.q) || []).concat([{ k, n }])).slice(-6) }; // les derniers, pour ne rien rater entre deux rafraîchissements
      } else if (act === "bgm") {
        g.bgm = { on: !!body.on, vol: Math.max(0.05, Math.min(1, Number(body.vol) || 0.35)), k: ["tubes", "fete", "electro", "latino", "doux"].includes(body.k) ? body.k : "tubes" };
      } else if (act === "showPhoto") {
        // une photo d'équipe en plein écran sur l'écran géant (à tout moment)
        const t = this.setup.teams.find((x) => x.id === Number(body.id));
        g.showPhoto = t && this.photos[t.code] ? t.id : null;
      } else if (act === "finView") {
        // fin de partie sur l'écran géant : classement, podium avec photos, ou grande affiche du vainqueur
        g.finView = ["podium", "poster"].includes(body.v) ? body.v : null;
        if (g.finView) { g.showRanking = true; g.tbShow = null; }
        if (g.finView === "podium") { g.podStep = 0; g.podLand = 0; }
      } else if (act === "podStep") {
        g.podStep = Math.max(0, Math.min(3, Number(body.n) || 0)); g.podLand = 0;
      } else if (act === "podLand") {
        g.podLand = g.podStep || 0;
      } else if (act === "tbShow") {
        // écran géant : annonce du morceau de départage pour les équipes à égalité
        const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter((id) => this.setup.teams.some((t) => t.id === id)) : [];
        g.tbShow = body.show && ids.length > 1 ? { ids, place: Math.max(1, Number(body.place) || 1), hand: ids.indexOf(Number(body.hand)) >= 0 ? ids.indexOf(Number(body.hand)) : null } : null;
        if (g.tbShow) { g.showTeams = false; g.showRules = false; g.showQr = null; }
      } else if (act === "tbWin") {
        const id = Number(body.id);
        if (!this.setup.teams.some((t) => t.id === id)) return json({ error: "équipe inconnue" }, 400);
        g.tb = (g.tb || []).filter((x) => x !== id).concat([id]);
        g.tbShow = null;
      } else if (act === "tbUndo") {
        g.tb = []; g.tbShow = null;
      } else if (act === "showRanking") {
        g.showRanking = !!body.show;
        if (g.showRanking) { g.rankAt = Date.now(); g.showTeams = false; g.showRules = false; g.showQr = null; } // relance l'animation
      } else if (act === "setk") {
        if (cur) { g.k = Math.max(0, Math.min(cur.songs.length - 1, Number(body.k) || 0)); g.started = false; g.phaseStart = 0; }
      } else {
        return json({ error: "action inconnue" }, 400);
      }
      await this.save("game");
      if (g.status === "finished") await this.archive();
      return json({ ok: true });
    }

    // ---- palmarès : les vainqueurs de chaque soirée restent gardés (même après une remise à zéro)
    if (path === "/hof" && method === "GET") {
      if (who !== "anim") return json({ error: "non autorisé" }, 401);
      return json({ list: (await this.ctx.storage.get("hof")) || [] });
    }
    if (path === "/hof/get" && method === "POST") {
      if (who !== "anim") return json({ error: "non autorisé" }, 401);
      const list = (await this.ctx.storage.get("hof")) || [], e = list.find((x) => x.id === Number(body.id));
      if (!e) return json({ error: "introuvable" }, 404);
      const ph = await this.ctx.storage.get(e.podium.map((_, i) => "hofph:" + e.id + ":" + i));
      return json({ entry: e, photos: e.podium.map((_, i) => ph.get("hofph:" + e.id + ":" + i) || null) });
    }
    if (path === "/hof/delete" && method === "POST") {
      if (who !== "anim") return json({ error: "non autorisé" }, 401);
      const list = (await this.ctx.storage.get("hof")) || [], id = Number(body.id);
      await this.ctx.storage.put("hof", list.filter((x) => x.id !== id));
      await this.ctx.storage.delete([0, 1, 2].map((i) => "hofph:" + id + ":" + i));
      return json({ ok: true });
    }

    if (path === "/review" && method === "POST") {
      if (who !== "anim") return json({ error: "non autorisé" }, 401);
      const it = ((this.results[body.m] || {})[body.teamId] || [])[body.i];
      if (!it || !["t", "a"].includes(body.field) || !["ok", "ko", "doubt"].includes(body.status)) return json({ error: "invalide" }, 400);
      it[body.field] = body.status;
      await this.save("results");
      return json({ ok: true });
    }

    if (path === "/adjust" && method === "POST") {
      if (who !== "anim") return json({ error: "non autorisé" }, 401);
      this.adjust[body.teamId] = Math.max(-100, Math.min(100, Number(body.value) || 0));
      await this.save("adjust");
      if (this.game.status === "finished") await this.archive();
      return json({ ok: true });
    }

    // ---- parties enregistrées
    if (path === "/saves" && method === "GET") {
      if (who !== "anim") return json({ error: "non autorisé" }, 401);
      const idx = (await this.ctx.storage.get("savesIndex")) || [];
      // anciennes sauvegardes : on calcule leur durée une fois
      let changed = false;
      for (const x of idx) if (x.min == null) { const sv = await this.ctx.storage.get("save:" + x.id); if (sv) { x.min = estMinutes(sv); changed = true; } }
      if (changed) await this.ctx.storage.put("savesIndex", idx);
      return json({ saves: idx, current: this.setup.loadedFrom || null });
    }
    if (path === "/saves" && method === "POST") {
      if (who !== "anim") return json({ error: "non autorisé" }, 401);
      const idx = (await this.ctx.storage.get("savesIndex")) || [];
      const name = clip(body.name, 60).trim() || this.setup.name || "Partie";
      let id = body.id && idx.find((x) => x.id === body.id) ? body.id : null;
      if (!id) {
        if (idx.length >= 30) return json({ error: "30 parties maximum : supprimez-en une" }, 409);
        id = "p" + Date.now().toString(36);
      }
      const { codes, ...rest } = this.setup;
      const snap = JSON.parse(JSON.stringify(rest));
      delete snap.loadedFrom;
      await this.ctx.storage.put("save:" + id, snap);
      const info = { id, name, savedAt: Date.now(), teams: this.setup.teams.length, manches: this.setup.manches.length, songs: this.setup.manches.reduce((a, m) => a + m.songs.length, 0), min: estMinutes(this.setup) };
      const i = idx.findIndex((x) => x.id === id);
      if (i >= 0) idx[i] = info; else idx.unshift(info);
      await this.ctx.storage.put("savesIndex", idx);
      this.setup.loadedFrom = { id, name };
      await this.save("setup");
      return json({ ok: true, id });
    }
    if (path === "/saves/load" && method === "POST") {
      if (who !== "anim") return json({ error: "non autorisé" }, 401);
      if (this.game.status === "running") return json({ error: "une partie est en cours : remettez-la à zéro d'abord" }, 409);
      const idx = (await this.ctx.storage.get("savesIndex")) || [];
      const info = idx.find((x) => x.id === body.id);
      const snap = info && (await this.ctx.storage.get("save:" + body.id));
      if (!snap) return json({ error: "partie introuvable" }, 404);
      this.setup = Object.assign(defaultSetup(), snap, { codes: this.setup.codes, baseUrl: this.setup.baseUrl, loadedFrom: { id: info.id, name: info.name } });
      if (!snap.defs2) { // partie enregistrée avant les nouveaux réglages par défaut
        if (Number(this.setup.extractSec) === 15) this.setup.extractSec = 10;
        if (this.setup.scoring && this.setup.scoring.title === 1 && this.setup.scoring.artist === 1) this.setup.scoring = { title: 1, artist: 2 };
      }
      this.game = defaultGame();
      this.answers = {}; this.results = {}; this.adjust = {};
      await this.save("setup", "game", "answers", "results", "adjust");
      return json({ ok: true });
    }
    if (path === "/saves/delete" && method === "POST") {
      if (who !== "anim") return json({ error: "non autorisé" }, 401);
      const idx = ((await this.ctx.storage.get("savesIndex")) || []).filter((x) => x.id !== body.id);
      await this.ctx.storage.put("savesIndex", idx);
      await this.ctx.storage.delete("save:" + body.id);
      if (this.setup.loadedFrom && this.setup.loadedFrom.id === body.id) { delete this.setup.loadedFrom; await this.save("setup"); }
      return json({ ok: true });
    }

    if (path === "/testfill" && method === "POST") {
      if (who !== "anim") return json({ error: "non autorisé" }, 401);
      const g = this.game;
      if (g.status !== "running" || g.states[g.m] !== "open") return json({ error: "aucune manche ouverte" }, 409);
      const cur = this.setup.manches[g.m];
      const typo = (s) => (s.length > 4 ? s.slice(0, 2) + s.slice(3) : s + "x");
      this.answers[g.m] = this.answers[g.m] || {};
      this.setup.teams.forEach((t) => {
        this.answers[g.m][t.id] = cur.songs.map((s) => {
          const r = Math.random();
          if (r < 0.35) return { t: s.t, a: s.a };
          if (r < 0.6) return { t: typo(s.t), a: typo(s.a.split(" ").pop()) };
          if (r < 0.75) return { t: s.t, a: "" };
          if (r < 0.88) return { t: "", a: s.a };
          return { t: "je ne sais pas", a: "inconnu" };
        });
      });
      await this.save("answers");
      return json({ ok: true });
    }

    if (path === "/played/reset" && method === "POST") {
      if (who !== "anim") return json({ error: "non autorisé" }, 401);
      this.played = [];
      await this.save("played");
      return json({ ok: true });
    }

    if (path === "/reset" && method === "POST") {
      if (who !== "anim") return json({ error: "non autorisé" }, 401);
      this.game = defaultGame();
      this.answers = {}; this.results = {}; this.adjust = {};
      if (body.mode === "soiree") this.setup.teams = [];
      await this.save("game", "answers", "results", "adjust", "setup");
      return json({ ok: true });
    }

    return json({ error: "introuvable" }, 404);
  }
}

