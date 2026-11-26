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
  scoring: { title: 1, artist: 1 },
  extractSec: 15,
  answerSec: 10,
  teams: [],
  manches: [],
});
const defaultGame = () => ({ status: "setup", runId: 0, m: 0, k: 0, started: false, phaseStart: 0, states: [], showRanking: false });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      const stub = env.SOIREE.get(env.SOIREE.idFromName("main"));
      return stub.fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};

const clip = (s, n) => String(s == null ? "" : s).slice(0, n);
const cleanList = (a) => (Array.isArray(a) ? a.map((x) => clip(x, 80)).filter(Boolean).slice(0, 12) : []);

export class Soiree extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.ready = ctx.blockConcurrencyWhile(async () => {
      const d = await ctx.storage.get(["setup", "game", "answers", "results", "adjust"]);
      this.setup = d.get("setup") || defaultSetup();
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

  ranking() {
    const sc = this.setup.scoring;
    const rows = this.setup.teams.map((t) => ({ id: t.id, name: t.name, total: 0, perManche: [] }));
    this.setup.manches.forEach((m, i) => {
      if (this.game.states[i] !== "published") return;
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
    rows.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
    let rank = 0;
    let last = null;
    rows.forEach((r, i) => {
      if (r.total !== last) { rank = i + 1; last = r.total; }
      r.rank = rank;
    });
    return rows;
  }

  doubtCount(m) {
    let n = 0;
    const res = this.results[m] || {};
    Object.values(res).forEach((arr) => arr.forEach((it) => { if (it.t === "doubt") n++; if (it.a === "doubt") n++; }));
    return n;
  }

  pub() {
    const { setup, game } = this;
    return {
      now: Date.now(),
      name: setup.name,
      needInit: !setup.codes.anim,
      djReady: !!setup.codes.dj,
      teams: setup.teams.map((t) => ({ id: t.id, name: t.name, members: t.members })),
      status: game.status,
      runId: game.runId || 0,
      m: game.m,
      k: game.k,
      started: game.started,
      phaseStart: game.phaseStart,
      extractSec: setup.extractSec,
      answerSec: setup.answerSec,
      showRanking: !!game.showRanking,
      showRules: !!game.showRules,
      scoring: setup.scoring,
      manches: setup.manches.map((m, i) => ({
        title: m.title,
        mult: m.mult || 1,
        n: m.songs.length,
        label2: m.label2 || "Artiste",
        state: game.states[i] || "pending",
        reveal: game.states[i] === "published" ? m.songs.map((s) => ({ t: s.t, a: s.a })) : null,
      })),
      ranking: game.showRanking ? this.ranking() : null,
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
    const role = request.headers.get("x-role") || "";
    const code = (request.headers.get("x-code") || "").trim();
    const teamId = Number(request.headers.get("x-team") || 0);
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
      const mine = {};
      Object.keys(this.answers).forEach((m) => { if (this.answers[m][teamId]) mine[m] = this.answers[m][teamId]; });
      const rk = this.game.showRanking ? this.ranking().find((r) => r.id === teamId) : null;
      return json({
        pub: this.pub(),
        team: { id: t.id, name: t.name, members: t.members },
        answers: mine,
        me: rk || null,
      });
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
        songs: mm ? mm.songs.map((s) => ({ t: s.t, a: s.a, h: s.h })) : [],
        nextManche: nxt ? nxt.title : null,
        all: this.setup.manches.map((x) => ({ title: x.title, mult: x.mult || 1, label2: x.label2 || "Artiste", songs: x.songs.map((s) => ({ t: s.t, a: s.a, h: s.h })) })),
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
      if (s.extractSec) this.setup.extractSec = Math.max(5, Math.min(90, Number(s.extractSec) || 15));
      if (s.answerSec) this.setup.answerSec = Math.max(3, Math.min(90, Number(s.answerSec) || 10));
      if (!partial || this.game.status !== "running") {
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
            theme: clip(m.theme, 20),
            songs: (m.songs || []).slice(0, 20).map((x) => ({
              t: clip(x.t, 100),
              a: clip(x.a, 100),
              h: clip(x.h, 80),
              at: cleanList(x.at),
              aa: cleanList(x.aa),
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
      const djOk = ["play", "next", "prev"];
      if (who === "dj" && !djOk.includes(act)) return json({ error: "réservé à l'animateur" }, 403);
      const mans = this.setup.manches;
      const cur = mans[g.m];
      if (act === "start") {
        if (!this.setup.teams.length || !mans.length) return json({ error: "il faut des équipes et des manches" }, 400);
        this.game = { status: "running", runId: Date.now(), m: 0, k: 0, started: false, phaseStart: 0, states: mans.map((_, i) => (i === 0 ? "open" : "pending")), showRanking: false };
        this.answers = {}; this.results = {}; this.adjust = {};
        await this.save("game", "answers", "results", "adjust");
      } else if (g.status !== "running" && act !== "showRanking" && act !== "showRules") {
        return json({ error: "jeu non démarré" }, 409);
      } else if (act === "play") {
        g.started = true; g.phaseStart = Date.now();
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
      } else if (act === "nextManche") {
        if (g.states[g.m] !== "published") return json({ error: "publier la manche d'abord" }, 409);
        if (g.m < mans.length - 1) { g.m++; g.k = 0; g.started = false; g.phaseStart = 0; g.states[g.m] = "open"; }
        else g.status = "finished";
      } else if (act === "finish") {
        g.status = "finished";
      } else if (act === "showRules") {
        g.showRules = !!body.show;
      } else if (act === "showRanking") {
        g.showRanking = !!body.show;
      } else if (act === "setk") {
        if (cur) { g.k = Math.max(0, Math.min(cur.songs.length - 1, Number(body.k) || 0)); g.started = false; g.phaseStart = 0; }
      } else {
        return json({ error: "action inconnue" }, 400);
      }
      await this.save("game");
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
      return json({ ok: true });
    }

    // ---- parties enregistrées
    if (path === "/saves" && method === "GET") {
      if (who !== "anim") return json({ error: "non autorisé" }, 401);
      const idx = (await this.ctx.storage.get("savesIndex")) || [];
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
      const info = { id, name, savedAt: Date.now(), teams: this.setup.teams.length, manches: this.setup.manches.length, songs: this.setup.manches.reduce((a, m) => a + m.songs.length, 0) };
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

