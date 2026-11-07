// src/game.ts
var SUITS = ["S", "H", "D", "C"];
var RANK_NAME = {
  6: "\u0448\u0435\u0441\u0442\u0451\u0440\u043A\u0430",
  7: "\u0441\u0435\u043C\u0451\u0440\u043A\u0430",
  8: "\u0432\u043E\u0441\u044C\u043C\u0451\u0440\u043A\u0430",
  9: "\u0434\u0435\u0432\u044F\u0442\u043A\u0430",
  10: "\u0434\u0435\u0441\u044F\u0442\u043A\u0430",
  11: "\u0432\u0430\u043B\u0435\u0442",
  12: "\u0434\u0430\u043C\u0430",
  13: "\u043A\u043E\u0440\u043E\u043B\u044C",
  14: "\u0442\u0443\u0437"
};
var RANK_SHORT = { 6: "6", 7: "7", 8: "8", 9: "9", 10: "10", 11: "\u0412", 12: "\u0414", 13: "\u041A", 14: "\u0422" };
var SUIT_GEN = { S: "\u043F\u0438\u043A", H: "\u0447\u0435\u0440\u0432\u0435\u0439", D: "\u0431\u0443\u0431\u0435\u043D", C: "\u0442\u0440\u0435\u0444" };
var SUIT_ACC = { S: "\u043F\u0438\u043A\u0438", H: "\u0447\u0435\u0440\u0432\u044B", D: "\u0431\u0443\u0431\u043D\u044B", C: "\u0442\u0440\u0435\u0444\u044B" };
var SUIT_SYM = { S: "\u2660", H: "\u2665", D: "\u2666", C: "\u2663" };
var cardId = (c) => `${c.r}${c.s}`;
function parseCard(id) {
  if (typeof id !== "string") return null;
  const m = /^(\d{1,2})([SHDC])$/.exec(id);
  if (!m) return null;
  const r = Number(m[1]);
  if (r < 6 || r > 14) return null;
  return { r, s: m[2] };
}
var cardName = (c) => `${RANK_NAME[c.r]} ${SUIT_GEN[c.s]}`;
function newDeck() {
  const d = [];
  for (const s of SUITS) for (let r = 6; r <= 14; r++) d.push({ r, s });
  return d;
}
function shuffle(a, rng) {
  const x = a.slice();
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}
var Game = class {
  names;
  mode;
  hands = [];
  deck = [];
  // deck[0] — открытый козырь внизу, берут с конца
  trump;
  table = [];
  attacker = 0;
  defender = 1;
  taking = false;
  passed = /* @__PURE__ */ new Set();
  phase = "play";
  durak = -1;
  outOrder = [];
  discarded = 0;
  // сколько карт ушло в отбой
  startEvents = [];
  rng;
  /** aceRedeal: если внизу колоды (открытый козырь) оказался туз, колода тасуется и раздаётся заново. С forceDeck не действует. */
  constructor(names, mode, rng = Math.random, forceDeck, aceRedeal = true) {
    if (names.length < 2 || names.length > 4) throw new Error("\u0418\u0433\u0440\u043E\u043A\u043E\u0432 \u0434\u043E\u043B\u0436\u043D\u043E \u0431\u044B\u0442\u044C \u043E\u0442 2 \u0434\u043E 4");
    this.names = names.slice();
    this.mode = mode;
    this.rng = rng;
    this.deck = forceDeck ? forceDeck.slice() : shuffle(newDeck(), rng);
    let redeals = 0;
    if (!forceDeck && aceRedeal) {
      while (this.deck[0].r === 14 && redeals < 100) {
        this.deck = shuffle(newDeck(), rng);
        redeals++;
      }
    }
    this.trump = this.deck[0].s;
    if (redeals > 0) this.startEvents.push(redeals === 1 ? "\u0412\u043D\u0438\u0437\u0443 \u043A\u043E\u043B\u043E\u0434\u044B \u0432\u044B\u043F\u0430\u043B \u0442\u0443\u0437: \u043A\u043E\u043B\u043E\u0434\u0443 \u043F\u0435\u0440\u0435\u0442\u0430\u0441\u043E\u0432\u0430\u043B\u0438 \u0438 \u0440\u0430\u0437\u0434\u0430\u043B\u0438 \u0437\u0430\u043D\u043E\u0432\u043E." : `\u0412\u043D\u0438\u0437\u0443 \u043A\u043E\u043B\u043E\u0434\u044B \u0432\u044B\u043F\u0430\u0434\u0430\u043B \u0442\u0443\u0437: \u043A\u043E\u043B\u043E\u0434\u0443 \u043F\u0435\u0440\u0435\u0442\u0430\u0441\u043E\u0432\u0430\u043B\u0438 \u0438 \u0440\u0430\u0437\u0434\u0430\u043B\u0438 \u0437\u0430\u043D\u043E\u0432\u043E, \u043F\u0435\u0440\u0435\u0441\u0434\u0430\u0447: ${redeals}.`);
    this.hands = names.map(() => []);
    for (let k = 0; k < 6; k++) for (let p = 0; p < names.length; p++) this.hands[p].push(this.deck.pop());
    let best = -1;
    let bestRank = 99;
    for (let p = 0; p < names.length; p++) {
      for (const c of this.hands[p]) if (c.s === this.trump && c.r < bestRank) {
        bestRank = c.r;
        best = p;
      }
    }
    if (best >= 0) {
      this.attacker = best;
      this.startEvents.push(`\u041A\u043E\u0437\u044B\u0440\u044C \u2014 ${SUIT_ACC[this.trump]}. \u041F\u0435\u0440\u0432\u044B\u043C \u0445\u043E\u0434\u0438\u0442 ${names[best]}: \u0443 \u043D\u0435\u0433\u043E \u043C\u043B\u0430\u0434\u0448\u0438\u0439 \u043A\u043E\u0437\u044B\u0440\u044C, ${cardName({ r: bestRank, s: this.trump })}.`);
    } else {
      this.attacker = 0;
      this.startEvents.push(`\u041A\u043E\u0437\u044B\u0440\u044C \u2014 ${SUIT_ACC[this.trump]}. \u041A\u043E\u0437\u044B\u0440\u0435\u0439 \u043D\u0430 \u0440\u0443\u043A\u0430\u0445 \u043D\u0435\u0442, \u043F\u0435\u0440\u0432\u044B\u043C \u0445\u043E\u0434\u0438\u0442 ${names[0]}.`);
    }
    this.defender = this.nextAfter(this.attacker);
  }
  // ---------- вспомогательное ----------
  nextAfter(seat) {
    const n = this.names.length;
    for (let i = 1; i < n; i++) {
      const s = (seat + i) % n;
      if (this.hands[s].length > 0) return s;
    }
    return seat;
  }
  beats(att, def) {
    if (def.s === att.s) return def.r > att.r;
    return def.s === this.trump && att.s !== this.trump;
  }
  unbeaten() {
    return this.table.filter((p) => !p.d).length;
  }
  ranksOnTable() {
    const s = /* @__PURE__ */ new Set();
    for (const p of this.table) {
      s.add(p.a.r);
      if (p.d) s.add(p.d.r);
    }
    return s;
  }
  has(seat, c) {
    return this.hands[seat].findIndex((x) => x.r === c.r && x.s === c.s);
  }
  settled() {
    return this.table.length > 0 && (this.taking || this.unbeaten() === 0);
  }
  /** Можно ли этой картой подкинуть/атаковать. null — можно, иначе причина. */
  checkAttack(seat, c) {
    if (this.phase !== "play") return "\u0418\u0433\u0440\u0430 \u0443\u0436\u0435 \u043E\u043A\u043E\u043D\u0447\u0435\u043D\u0430.";
    if (this.has(seat, c) < 0) return "\u042D\u0442\u043E\u0439 \u043A\u0430\u0440\u0442\u044B \u043D\u0435\u0442 \u0443 \u0442\u0435\u0431\u044F \u043D\u0430 \u0440\u0443\u043A\u0430\u0445.";
    if (seat === this.defender) return "\u0422\u044B \u0441\u0435\u0439\u0447\u0430\u0441 \u043E\u0442\u0431\u0438\u0432\u0430\u0435\u0448\u044C\u0441\u044F, \u043F\u043E\u0434\u043A\u0438\u0434\u044B\u0432\u0430\u0442\u044C \u043D\u0435\u043B\u044C\u0437\u044F.";
    if (this.table.length === 0) {
      if (seat !== this.attacker) return `\u041F\u0435\u0440\u0432\u044B\u043C \u0445\u043E\u0434\u0438\u0442 ${this.names[this.attacker]}.`;
      return null;
    }
    if (!this.ranksOnTable().has(c.r)) return "\u041F\u043E\u0434\u043A\u0438\u0434\u044B\u0432\u0430\u0442\u044C \u043C\u043E\u0436\u043D\u043E \u0442\u043E\u043B\u044C\u043A\u043E \u043A\u0430\u0440\u0442\u044B \u0442\u0435\u0445 \u0436\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0439, \u0447\u0442\u043E \u0443\u0436\u0435 \u043B\u0435\u0436\u0430\u0442 \u043D\u0430 \u0441\u0442\u043E\u043B\u0435.";
    if (this.table.length >= 6) return "\u041D\u0430 \u0441\u0442\u043E\u043B\u0435 \u0443\u0436\u0435 \u0448\u0435\u0441\u0442\u044C \u043A\u0430\u0440\u0442, \u0431\u043E\u043B\u044C\u0448\u0435 \u043F\u043E\u0434\u043A\u0438\u0434\u044B\u0432\u0430\u0442\u044C \u043D\u0435\u043B\u044C\u0437\u044F.";
    if (this.unbeaten() + 1 > this.hands[this.defender].length) return `\u0423 ${this.names[this.defender]} \u043D\u0435 \u0445\u0432\u0430\u0442\u0438\u0442 \u043A\u0430\u0440\u0442, \u0447\u0442\u043E\u0431\u044B \u043F\u043E\u0431\u0438\u0442\u044C \u0435\u0449\u0451 \u043E\u0434\u043D\u0443.`;
    return null;
  }
  checkDefend(seat, idx, c) {
    if (this.phase !== "play") return "\u0418\u0433\u0440\u0430 \u0443\u0436\u0435 \u043E\u043A\u043E\u043D\u0447\u0435\u043D\u0430.";
    if (seat !== this.defender) return "\u0421\u0435\u0439\u0447\u0430\u0441 \u0442\u044B \u043D\u0435 \u043E\u0442\u0431\u0438\u0432\u0430\u0435\u0448\u044C\u0441\u044F.";
    if (this.taking) return "\u0422\u044B \u0443\u0436\u0435 \u0431\u0435\u0440\u0451\u0448\u044C \u043A\u0430\u0440\u0442\u044B.";
    const p = this.table[idx];
    if (!p) return "\u0422\u0430\u043A\u043E\u0439 \u043A\u0430\u0440\u0442\u044B \u043D\u0430 \u0441\u0442\u043E\u043B\u0435 \u043D\u0435\u0442.";
    if (p.d) return "\u042D\u0442\u0430 \u043A\u0430\u0440\u0442\u0430 \u0443\u0436\u0435 \u043F\u043E\u0431\u0438\u0442\u0430.";
    if (this.has(seat, c) < 0) return "\u042D\u0442\u043E\u0439 \u043A\u0430\u0440\u0442\u044B \u043D\u0435\u0442 \u0443 \u0442\u0435\u0431\u044F \u043D\u0430 \u0440\u0443\u043A\u0430\u0445.";
    if (!this.beats(p.a, c)) return `${cap(cardName(c))} \u043D\u0435 \u0431\u044C\u0451\u0442 ${cardName(p.a)}.`;
    return null;
  }
  checkTransfer(seat, c) {
    if (this.phase !== "play") return "\u0418\u0433\u0440\u0430 \u0443\u0436\u0435 \u043E\u043A\u043E\u043D\u0447\u0435\u043D\u0430.";
    if (this.mode !== "perevodnoy") return "\u0412 \u044D\u0442\u043E\u0439 \u043A\u043E\u043C\u043D\u0430\u0442\u0435 \u0438\u0433\u0440\u0430\u044E\u0442 \u0432 \u043F\u043E\u0434\u043A\u0438\u0434\u043D\u043E\u0433\u043E, \u043F\u0435\u0440\u0435\u0432\u043E\u0434\u0438\u0442\u044C \u043D\u0435\u043B\u044C\u0437\u044F.";
    if (seat !== this.defender) return "\u041F\u0435\u0440\u0435\u0432\u043E\u0434\u0438\u0442\u044C \u043C\u043E\u0436\u0435\u0442 \u0442\u043E\u043B\u044C\u043A\u043E \u0442\u043E\u0442, \u043A\u0442\u043E \u043E\u0442\u0431\u0438\u0432\u0430\u0435\u0442\u0441\u044F.";
    if (this.taking) return "\u0422\u044B \u0443\u0436\u0435 \u0431\u0435\u0440\u0451\u0448\u044C \u043A\u0430\u0440\u0442\u044B.";
    if (this.has(seat, c) < 0) return "\u042D\u0442\u043E\u0439 \u043A\u0430\u0440\u0442\u044B \u043D\u0435\u0442 \u0443 \u0442\u0435\u0431\u044F \u043D\u0430 \u0440\u0443\u043A\u0430\u0445.";
    if (this.table.length === 0) return "\u041D\u0430 \u0441\u0442\u043E\u043B\u0435 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442 \u043A\u0430\u0440\u0442.";
    if (this.table.some((p) => p.d)) return "\u041F\u0435\u0440\u0435\u0432\u043E\u0434\u0438\u0442\u044C \u043D\u0435\u043B\u044C\u0437\u044F: \u043E\u0434\u043D\u0430 \u043A\u0430\u0440\u0442\u0430 \u0443\u0436\u0435 \u043F\u043E\u0431\u0438\u0442\u0430.";
    if (this.table.some((p) => p.a.r !== c.r)) return "\u041F\u0435\u0440\u0435\u0432\u043E\u0434\u0438\u0442\u044C \u043C\u043E\u0436\u043D\u043E \u0442\u043E\u043B\u044C\u043A\u043E \u043A\u0430\u0440\u0442\u043E\u0439 \u0442\u043E\u0433\u043E \u0436\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F.";
    const nx = this.nextAfter(seat);
    if (nx === seat) return "\u041F\u0435\u0440\u0435\u0432\u043E\u0434\u0438\u0442\u044C \u043D\u0435\u043A\u043E\u043C\u0443.";
    if (this.hands[nx].length < this.table.length + 1) return `\u0423 ${this.names[nx]} \u043C\u0430\u043B\u043E \u043A\u0430\u0440\u0442, \u043F\u0435\u0440\u0435\u0432\u0435\u0441\u0442\u0438 \u043D\u0435\u043B\u044C\u0437\u044F.`;
    if (this.table.length >= 6) return "\u041D\u0430 \u0441\u0442\u043E\u043B\u0435 \u0443\u0436\u0435 \u0448\u0435\u0441\u0442\u044C \u043A\u0430\u0440\u0442.";
    return null;
  }
  // ---------- действия ----------
  attack(seat, c) {
    const e = this.checkAttack(seat, c);
    if (e) return { ok: false, error: e };
    const ev = [];
    this.hands[seat].splice(this.has(seat, c), 1);
    const first = this.table.length === 0;
    this.table.push({ a: c, d: null });
    this.passed.clear();
    ev.push(first ? `${this.names[seat]} \u0445\u043E\u0434\u0438\u0442: ${cardName(c)}.` : `${this.names[seat]} \u043F\u043E\u0434\u043A\u0438\u0434\u044B\u0432\u0430\u0435\u0442: ${cardName(c)}.`);
    this.after(ev);
    return { ok: true, events: ev };
  }
  defend(seat, idx, c) {
    const e = this.checkDefend(seat, idx, c);
    if (e) return { ok: false, error: e };
    const ev = [];
    this.hands[seat].splice(this.has(seat, c), 1);
    const p = this.table[idx];
    p.d = c;
    this.passed.clear();
    ev.push(`${this.names[seat]} \u0431\u044C\u0451\u0442 ${cardName(p.a)} \u043A\u0430\u0440\u0442\u043E\u0439: ${cardName(c)}.`);
    if (this.unbeaten() === 0 && this.hands[seat].length === 0 && this.deck.length === 0) ev.push(`${this.names[seat]} \u043E\u0441\u0442\u0430\u043B\u0441\u044F \u0431\u0435\u0437 \u043A\u0430\u0440\u0442.`);
    this.after(ev);
    return { ok: true, events: ev };
  }
  transfer(seat, c) {
    const e = this.checkTransfer(seat, c);
    if (e) return { ok: false, error: e };
    const ev = [];
    const nx = this.nextAfter(seat);
    this.hands[seat].splice(this.has(seat, c), 1);
    this.table.push({ a: c, d: null });
    this.attacker = seat;
    this.defender = nx;
    this.passed.clear();
    ev.push(`${this.names[seat]} \u043F\u0435\u0440\u0435\u0432\u043E\u0434\u0438\u0442 \u043A\u0430\u0440\u0442\u043E\u0439: ${cardName(c)}. \u0422\u0435\u043F\u0435\u0440\u044C \u043E\u0442\u0431\u0438\u0432\u0430\u0435\u0442\u0441\u044F ${this.names[nx]}.`);
    this.after(ev);
    return { ok: true, events: ev };
  }
  take(seat) {
    if (this.phase !== "play") return { ok: false, error: "\u0418\u0433\u0440\u0430 \u0443\u0436\u0435 \u043E\u043A\u043E\u043D\u0447\u0435\u043D\u0430." };
    if (seat !== this.defender) return { ok: false, error: "\u0411\u0440\u0430\u0442\u044C \u043A\u0430\u0440\u0442\u044B \u043C\u043E\u0436\u0435\u0442 \u0442\u043E\u043B\u044C\u043A\u043E \u0442\u043E\u0442, \u043A\u0442\u043E \u043E\u0442\u0431\u0438\u0432\u0430\u0435\u0442\u0441\u044F." };
    if (this.taking) return { ok: false, error: "\u0422\u044B \u0443\u0436\u0435 \u0431\u0435\u0440\u0451\u0448\u044C \u043A\u0430\u0440\u0442\u044B." };
    if (this.unbeaten() === 0) return { ok: false, error: this.table.length ? "\u0412\u0441\u0451 \u043F\u043E\u0431\u0438\u0442\u043E, \u0431\u0440\u0430\u0442\u044C \u043D\u0435\u0447\u0435\u0433\u043E: \u0436\u0434\u0451\u043C, \u043F\u043E\u043A\u0430 \u043F\u043E\u0434\u043A\u0438\u043D\u0443\u0442 \u0438\u043B\u0438 \u0441\u043A\u0430\u0436\u0443\u0442 \xAB\u0431\u0438\u0442\u043E\xBB." : "\u041D\u0430 \u0441\u0442\u043E\u043B\u0435 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442 \u043A\u0430\u0440\u0442." };
    const ev = [];
    this.taking = true;
    this.passed.clear();
    ev.push(`${this.names[seat]} \u0431\u0435\u0440\u0451\u0442 \u043A\u0430\u0440\u0442\u044B. \u041C\u043E\u0436\u043D\u043E \u043F\u043E\u0434\u043A\u0438\u043D\u0443\u0442\u044C \u0435\u0449\u0451.`);
    this.after(ev);
    return { ok: true, events: ev };
  }
  pass(seat) {
    if (this.phase !== "play") return { ok: false, error: "\u0418\u0433\u0440\u0430 \u0443\u0436\u0435 \u043E\u043A\u043E\u043D\u0447\u0435\u043D\u0430." };
    if (seat === this.defender) return { ok: false, error: "\u041E\u0442\u0431\u0438\u0432\u0430\u044E\u0449\u0438\u0439\u0441\u044F \u043D\u0435 \u0433\u043E\u0432\u043E\u0440\u0438\u0442 \xAB\u0431\u0438\u0442\u043E\xBB." };
    if (this.hands[seat].length === 0) return { ok: false, error: "\u0423 \u0442\u0435\u0431\u044F \u043D\u0435\u0442 \u043A\u0430\u0440\u0442." };
    if (!this.settled()) return { ok: false, error: this.table.length ? "\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043D\u0443\u0436\u043D\u043E \u043F\u043E\u0431\u0438\u0442\u044C \u0432\u0441\u0435 \u043A\u0430\u0440\u0442\u044B \u0438\u043B\u0438 \u0432\u0437\u044F\u0442\u044C \u0438\u0445." : "\u041D\u0430 \u0441\u0442\u043E\u043B\u0435 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442 \u043A\u0430\u0440\u0442." };
    if (this.passed.has(seat)) return { ok: false, error: "\u0422\u044B \u0443\u0436\u0435 \u043E\u0442\u0432\u0435\u0442\u0438\u043B." };
    const ev = [];
    this.passed.add(seat);
    ev.push(this.taking ? `${this.names[seat]} \u0431\u043E\u043B\u044C\u0448\u0435 \u043D\u0435 \u043F\u043E\u0434\u043A\u0438\u0434\u044B\u0432\u0430\u0435\u0442.` : `${this.names[seat]} \u0433\u043E\u0432\u043E\u0440\u0438\u0442: \u0431\u0438\u0442\u043E.`);
    this.after(ev);
    return { ok: true, events: ev };
  }
  // ---------- конец раунда ----------
  canThrowAny(seat) {
    return this.hands[seat].some((c) => this.checkAttack(seat, c) === null);
  }
  after(ev) {
    if (this.phase !== "play" || !this.settled()) return;
    for (let s = 0; s < this.names.length; s++) {
      if (s === this.defender) continue;
      if (this.hands[s].length === 0) continue;
      if (this.passed.has(s)) continue;
      if (this.canThrowAny(s)) return;
    }
    this.resolve(ev);
  }
  resolve(ev) {
    const def = this.defender;
    const took = this.taking || this.unbeaten() > 0;
    if (took) {
      let n2 = 0;
      for (const p of this.table) {
        this.hands[def].push(p.a);
        n2++;
        if (p.d) {
          this.hands[def].push(p.d);
          n2++;
        }
      }
      ev.push(`${this.names[def]} \u0437\u0430\u0431\u0440\u0430\u043B \u043A\u0430\u0440\u0442\u044B: ${n2}.`);
    } else {
      for (const p of this.table) this.discarded += p.d ? 2 : 1;
      ev.push(`\u0411\u0438\u0442\u043E. \u041A\u0430\u0440\u0442\u044B \u0443\u0448\u043B\u0438 \u0432 \u043E\u0442\u0431\u043E\u0439.`);
    }
    this.table = [];
    this.taking = false;
    this.passed.clear();
    const n = this.names.length;
    const order = [];
    for (let i = 0; i < n; i++) {
      const s = (this.attacker + i) % n;
      if (s !== def) order.push(s);
    }
    order.push(def);
    const before = this.deck.length;
    for (const s of order) while (this.hands[s].length < 6 && this.deck.length > 0) this.hands[s].push(this.deck.pop());
    if (before > 0) {
      ev.push(this.deck.length === 0 ? "\u041A\u043E\u043B\u043E\u0434\u0430 \u043A\u043E\u043D\u0447\u0438\u043B\u0430\u0441\u044C." : `\u0412 \u043A\u043E\u043B\u043E\u0434\u0435 \u043E\u0441\u0442\u0430\u043B\u043E\u0441\u044C ${this.deck.length}.`);
    }
    for (let s = 0; s < n; s++) {
      if (this.hands[s].length === 0 && this.deck.length === 0 && !this.outOrder.includes(s)) {
        this.outOrder.push(s);
        ev.push(`${this.names[s]} \u0432\u044B\u0448\u0435\u043B \u0438\u0437 \u0438\u0433\u0440\u044B: \u043A\u0430\u0440\u0442 \u0431\u043E\u043B\u044C\u0448\u0435 \u043D\u0435\u0442.`);
      }
    }
    const left = [];
    for (let s = 0; s < n; s++) if (this.hands[s].length > 0) left.push(s);
    if (this.deck.length === 0 && left.length <= 1) {
      this.phase = "over";
      if (left.length === 1) {
        this.durak = left[0];
        ev.push(`\u0418\u0433\u0440\u0430 \u043E\u043A\u043E\u043D\u0447\u0435\u043D\u0430. \u0414\u0443\u0440\u0430\u043A \u2014 ${this.names[left[0]]}.`);
      } else {
        this.durak = -1;
        ev.push("\u0418\u0433\u0440\u0430 \u043E\u043A\u043E\u043D\u0447\u0435\u043D\u0430. \u041D\u0438\u0447\u044C\u044F: \u043A\u0430\u0440\u0442 \u043D\u0435 \u043E\u0441\u0442\u0430\u043B\u043E\u0441\u044C \u043D\u0438 \u0443 \u043A\u043E\u0433\u043E.");
      }
      return;
    }
    const nextAtt = !took && this.hands[def].length > 0 ? def : this.nextAfter(def);
    this.attacker = nextAtt;
    this.defender = this.nextAfter(nextAtt);
    ev.push(`\u0425\u043E\u0434\u0438\u0442 ${this.names[this.attacker]}, \u043E\u0442\u0431\u0438\u0432\u0430\u0435\u0442\u0441\u044F ${this.names[this.defender]}.`);
  }
  // ---------- вид для игрока ----------
  cv(c) {
    return {
      id: cardId(c),
      n: cardName(c),
      rs: RANK_SHORT[c.r],
      s: SUIT_SYM[c.s],
      red: c.s === "H" || c.s === "D",
      trump: c.s === this.trump
    };
  }
  sortedHand(seat) {
    const h = this.hands[seat].slice();
    const key = (c) => (c.s === this.trump ? 1e3 : SUITS.indexOf(c.s) * 20) + c.r;
    return h.sort((a, b) => key(a) - key(b));
  }
  view(seat) {
    const hand = this.sortedHand(seat);
    const attack = [];
    const transfer = [];
    const defend = {};
    for (const c of hand) {
      if (this.checkAttack(seat, c) === null) attack.push(cardId(c));
      if (this.checkTransfer(seat, c) === null) transfer.push(cardId(c));
    }
    this.table.forEach((p, i) => {
      if (p.d) return;
      const list = hand.filter((c) => this.checkDefend(seat, i, c) === null).map(cardId);
      defend[String(i)] = list;
    });
    const settled = this.settled();
    const canPass = settled && seat !== this.defender && this.hands[seat].length > 0 && !this.passed.has(seat);
    const canTake = this.phase === "play" && seat === this.defender && !this.taking && this.unbeaten() > 0;
    return {
      trump: SUIT_ACC[this.trump],
      trumpSym: SUIT_SYM[this.trump],
      trumpCard: this.deck.length > 0 ? this.cv(this.deck[0]) : null,
      deckCount: this.deck.length,
      attacker: this.attacker,
      defender: this.defender,
      taking: this.taking,
      table: this.table.map((p) => ({ a: this.cv(p.a), d: p.d ? this.cv(p.d) : null })),
      counts: this.hands.map((h) => h.length),
      out: this.outOrder.slice(),
      durak: this.durak,
      hand: hand.map((c) => this.cv(c)),
      hints: { attack, defend, transfer, canPass, canTake, passLabel: this.taking ? "\u041D\u0435 \u043F\u043E\u0434\u043A\u0438\u0434\u044B\u0432\u0430\u0442\u044C" : "\u0411\u0438\u0442\u043E" }
    };
  }
};
function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// src/room.ts
var PROTOCOL_VERSION = 2;
var rnd = () => {
  const a = "0123456789abcdefghijklmnopqrstuvwxyz";
  let s = "";
  for (let i = 0; i < 24; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
};
function cleanName(v) {
  if (typeof v !== "string") return null;
  const s = v.replace(/\s+/g, " ").trim();
  if (s.length < 1 || s.length > 20) return null;
  if (/[\u0000-\u001f<>]/.test(s)) return null;
  return s;
}
function cleanChat(v) {
  if (typeof v !== "string") return null;
  const s = v.replace(/[\u0000-\u0008\u000b-\u001f]/g, " ").replace(/[ \t]+/g, " ").trim();
  if (s.length < 1) return null;
  if (s.length > 200) return null;
  return s;
}
var Room = class {
  code;
  mode = "podkidnoy";
  max = 4;
  aceRedeal = true;
  // туз внизу колоды — пересдача
  listed = false;
  // показывать комнату в общем списке игр в интернете (по умолчанию нет)
  onChange = null;
  // вызывается после каждой рассылки состояния
  players = [];
  hostToken = "";
  phase = "empty";
  game = null;
  log = [];
  logN = 0;
  chat = [];
  chatN = 0;
  chatLast = /* @__PURE__ */ new Map();
  connPlayer = /* @__PURE__ */ new Map();
  rng;
  lastActivity = Date.now();
  constructor(code, rng = Math.random) {
    this.code = code;
    this.rng = rng;
  }
  // ---------- вход ----------
  handle(conn, raw) {
    this.lastActivity = Date.now();
    let m;
    try {
      m = JSON.parse(raw);
    } catch {
      return this.err(conn, "\u041D\u0435\u043F\u043E\u043D\u044F\u0442\u043D\u043E\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435.");
    }
    if (!m || typeof m.t !== "string") return this.err(conn, "\u041D\u0435\u043F\u043E\u043D\u044F\u0442\u043D\u043E\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435.");
    try {
      switch (m.t) {
        case "create":
          return this.onCreate(conn, m);
        case "join":
          return this.onJoin(conn, m);
        case "rejoin":
          return this.onRejoin(conn, m);
        case "ping":
          return conn.send(JSON.stringify({ t: "pong" }));
        default:
          break;
      }
      const p = this.connPlayer.get(conn);
      if (!p) return this.err(conn, "\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043D\u0443\u0436\u043D\u043E \u0432\u043E\u0439\u0442\u0438 \u0432 \u043A\u043E\u043C\u043D\u0430\u0442\u0443.", "nojoin");
      switch (m.t) {
        case "start":
          return this.onStart(conn, p);
        case "attack":
          return this.onGame(conn, p, (g) => {
            const c = parseCard(m.card);
            return c ? g.attack(this.seatOf(p), c) : bad();
          });
        case "defend":
          return this.onGame(conn, p, (g) => {
            const c = parseCard(m.card);
            return c && Number.isInteger(m.attack) ? g.defend(this.seatOf(p), m.attack, c) : bad();
          });
        case "transfer":
          return this.onGame(conn, p, (g) => {
            const c = parseCard(m.card);
            return c ? g.transfer(this.seatOf(p), c) : bad();
          });
        case "take":
          return this.onGame(conn, p, (g) => g.take(this.seatOf(p)));
        case "pass":
          return this.onGame(conn, p, (g) => g.pass(this.seatOf(p)));
        case "rematch":
          return this.onRematch(conn, p);
        case "leave":
          return this.onLeave(conn, p);
        case "chat":
          return this.onChat(conn, p, m);
        case "config":
          return this.onConfig(conn, p, m);
        case "sync":
          return this.sendState(conn);
        default:
          return this.err(conn, "\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F \u043A\u043E\u043C\u0430\u043D\u0434\u0430.");
      }
    } catch (e) {
      this.err(conn, "\u0412\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u044F\u044F \u043E\u0448\u0438\u0431\u043A\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0430.");
    }
  }
  disconnect(conn) {
    const p = this.connPlayer.get(conn);
    this.connPlayer.delete(conn);
    if (!p || p.conn !== conn) return;
    p.conn = null;
    this.say(`${p.name} \u043E\u0442\u043A\u043B\u044E\u0447\u0438\u043B\u0441\u044F. \u0415\u0441\u043B\u0438 \u043E\u043D \u0432\u0435\u0440\u043D\u0451\u0442\u0441\u044F, \u0442\u043E \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442 \u0441 \u0442\u043E\u0433\u043E \u0436\u0435 \u043C\u0435\u0441\u0442\u0430.`);
    this.broadcast();
  }
  // ---------- команды ----------
  onCreate(conn, m) {
    const name = cleanName(m.name);
    if (!name) return this.err(conn, "\u0418\u043C\u044F \u0434\u043E\u043B\u0436\u043D\u043E \u0431\u044B\u0442\u044C \u043E\u0442 1 \u0434\u043E 20 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432. \u041D\u0430\u043F\u0440\u0438\u043C\u0435\u0440: \u0410\u043D\u043D\u0430.", "name");
    if (this.phase !== "empty") return this.err(conn, "\u041A\u043E\u043C\u043D\u0430\u0442\u0430 \u0441 \u0442\u0430\u043A\u0438\u043C \u043A\u043E\u0434\u043E\u043C \u0443\u0436\u0435 \u0437\u0430\u043D\u044F\u0442\u0430. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439 \u0441\u043E\u0437\u0434\u0430\u0442\u044C \u0435\u0449\u0451 \u0440\u0430\u0437.", "taken");
    this.mode = m.mode === "perevodnoy" ? "perevodnoy" : "podkidnoy";
    const mx = Number(m.max);
    this.max = mx >= 2 && mx <= 4 ? Math.floor(mx) : 4;
    this.phase = "lobby";
    this.log = [];
    this.logN = 0;
    this.chat = [];
    this.chatN = 0;
    this.chatLast.clear();
    const p = this.addPlayer(conn, name);
    this.hostToken = p.token;
    this.say(`${name} \u0441\u043E\u0437\u0434\u0430\u043B \u043A\u043E\u043C\u043D\u0430\u0442\u0443 ${this.code}: ${this.mode === "perevodnoy" ? "\u043F\u0435\u0440\u0435\u0432\u043E\u0434\u043D\u043E\u0439" : "\u043F\u043E\u0434\u043A\u0438\u0434\u043D\u043E\u0439"} \u0434\u0443\u0440\u0430\u043A, \u0434\u043E ${this.max} \u0438\u0433\u0440\u043E\u043A\u043E\u0432.`);
    conn.send(JSON.stringify({ t: "joined", token: p.token, code: this.code }));
    this.broadcast();
  }
  onJoin(conn, m) {
    const name = cleanName(m.name);
    if (!name) return this.err(conn, "\u0418\u043C\u044F \u0434\u043E\u043B\u0436\u043D\u043E \u0431\u044B\u0442\u044C \u043E\u0442 1 \u0434\u043E 20 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432. \u041D\u0430\u043F\u0440\u0438\u043C\u0435\u0440: \u0410\u043D\u043D\u0430.", "name");
    if (this.phase === "empty") return this.err(conn, `\u041A\u043E\u043C\u043D\u0430\u0442\u044B \u0441 \u043A\u043E\u0434\u043E\u043C ${this.code} \u043D\u0435\u0442. \u041F\u0440\u043E\u0432\u0435\u0440\u044C \u043A\u043E\u0434.`, "noroom");
    if (this.phase !== "lobby") return this.err(conn, "\u0418\u0433\u0440\u0430 \u0443\u0436\u0435 \u0438\u0434\u0451\u0442, \u0432\u043E\u0439\u0442\u0438 \u043D\u0435\u043B\u044C\u0437\u044F.", "started");
    if (this.players.length >= this.max) return this.err(conn, "\u0412 \u043A\u043E\u043C\u043D\u0430\u0442\u0435 \u043D\u0435\u0442 \u043C\u0435\u0441\u0442.", "full");
    if (this.players.some((p2) => p2.name.toLowerCase() === name.toLowerCase())) return this.err(conn, "\u0422\u0430\u043A\u043E\u0435 \u0438\u043C\u044F \u0443\u0436\u0435 \u0435\u0441\u0442\u044C \u0432 \u043A\u043E\u043C\u043D\u0430\u0442\u0435. \u0412\u044B\u0431\u0435\u0440\u0438 \u0434\u0440\u0443\u0433\u043E\u0435.", "name");
    const p = this.addPlayer(conn, name);
    this.say(`${name} \u0432\u043E\u0448\u0451\u043B \u0432 \u043A\u043E\u043C\u043D\u0430\u0442\u0443. \u0418\u0433\u0440\u043E\u043A\u043E\u0432: ${this.players.length}.`);
    conn.send(JSON.stringify({ t: "joined", token: p.token, code: this.code }));
    this.broadcast();
  }
  onRejoin(conn, m) {
    const p = this.players.find((x) => x.token === m.token);
    if (!p || typeof m.token !== "string") return this.err(conn, "\u041F\u0440\u0435\u0436\u043D\u0435\u0435 \u043C\u0435\u0441\u0442\u043E \u0432 \u043A\u043E\u043C\u043D\u0430\u0442\u0435 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E.", "norejoin");
    if (p.conn && p.conn !== conn) {
      this.connPlayer.delete(p.conn);
      try {
        p.conn.close?.();
      } catch {
      }
    }
    p.conn = conn;
    this.connPlayer.set(conn, p);
    this.say(`${p.name} \u0432\u0435\u0440\u043D\u0443\u043B\u0441\u044F \u0432 \u0438\u0433\u0440\u0443.`);
    conn.send(JSON.stringify({ t: "joined", token: p.token, code: this.code }));
    this.broadcast();
  }
  onStart(conn, p) {
    if (p.token !== this.hostToken) return this.err(conn, "\u041D\u0430\u0447\u0430\u0442\u044C \u0438\u0433\u0440\u0443 \u043C\u043E\u0436\u0435\u0442 \u0442\u043E\u043B\u044C\u043A\u043E \u0445\u043E\u0437\u044F\u0438\u043D \u043A\u043E\u043C\u043D\u0430\u0442\u044B.");
    if (this.phase !== "lobby") return this.err(conn, "\u0418\u0433\u0440\u0430 \u0443\u0436\u0435 \u0438\u0434\u0451\u0442.");
    if (this.players.length < 2) return this.err(conn, "\u0414\u043B\u044F \u0438\u0433\u0440\u044B \u043D\u0443\u0436\u043D\u043E \u0445\u043E\u0442\u044F \u0431\u044B \u0434\u0432\u0430 \u0447\u0435\u043B\u043E\u0432\u0435\u043A\u0430.");
    this.game = new Game(this.players.map((x) => x.name), this.mode, this.rng, void 0, this.aceRedeal);
    this.phase = "play";
    this.say(`\u0418\u0433\u0440\u0430 \u043D\u0430\u0447\u0430\u043B\u0430\u0441\u044C. \u0418\u0433\u0440\u0430\u044E\u0442: ${this.players.map((x) => x.name).join(", ")}.`);
    for (const e of this.game.startEvents) this.say(e);
    this.broadcast();
  }
  onGame(conn, p, f) {
    if (this.phase !== "play" || !this.game) return this.err(conn, "\u0418\u0433\u0440\u0430 \u0441\u0435\u0439\u0447\u0430\u0441 \u043D\u0435 \u0438\u0434\u0451\u0442.");
    const r = f(this.game);
    if (!r.ok) return this.err(conn, r.error);
    for (const e of r.events) this.say(e);
    if (this.game.phase === "over") this.phase = "over";
    this.broadcast();
  }
  onRematch(conn, p) {
    if (p.token !== this.hostToken) return this.err(conn, "\u041D\u043E\u0432\u0443\u044E \u0438\u0433\u0440\u0443 \u043C\u043E\u0436\u0435\u0442 \u043D\u0430\u0447\u0430\u0442\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u0445\u043E\u0437\u044F\u0438\u043D \u043A\u043E\u043C\u043D\u0430\u0442\u044B.");
    if (this.phase !== "over") return this.err(conn, "\u0418\u0433\u0440\u0430 \u0435\u0449\u0451 \u043D\u0435 \u043E\u043A\u043E\u043D\u0447\u0435\u043D\u0430.");
    this.phase = "lobby";
    this.game = null;
    this.say("\u0412\u0441\u0435 \u0441\u043D\u043E\u0432\u0430 \u0432 \u043A\u043E\u043C\u043D\u0430\u0442\u0435. \u0425\u043E\u0437\u044F\u0438\u043D \u043C\u043E\u0436\u0435\u0442 \u043D\u0430\u0447\u0430\u0442\u044C \u043D\u043E\u0432\u0443\u044E \u0438\u0433\u0440\u0443.");
    this.broadcast();
  }
  /** Хозяин меняет вид игры и число мест в лобби, пока игра не началась. */
  onConfig(conn, p, m) {
    if (p.token !== this.hostToken) return this.err(conn, "\u041C\u0435\u043D\u044F\u0442\u044C \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u043A\u043E\u043C\u043D\u0430\u0442\u044B \u043C\u043E\u0436\u0435\u0442 \u0442\u043E\u043B\u044C\u043A\u043E \u0445\u043E\u0437\u044F\u0438\u043D.");
    if (this.phase !== "lobby") return this.err(conn, "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u043C\u043E\u0436\u043D\u043E \u043C\u0435\u043D\u044F\u0442\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u0434\u043E \u043D\u0430\u0447\u0430\u043B\u0430 \u0438\u0433\u0440\u044B.");
    if (m.mode !== void 0) {
      if (m.mode !== "podkidnoy" && m.mode !== "perevodnoy") return this.err(conn, "\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u0432\u0438\u0434 \u0438\u0433\u0440\u044B.");
      if (m.mode !== this.mode) {
        this.mode = m.mode;
        this.say(`\u0425\u043E\u0437\u044F\u0438\u043D \u0432\u044B\u0431\u0440\u0430\u043B: ${this.mode === "perevodnoy" ? "\u043F\u0435\u0440\u0435\u0432\u043E\u0434\u043D\u043E\u0439" : "\u043F\u043E\u0434\u043A\u0438\u0434\u043D\u043E\u0439"} \u0434\u0443\u0440\u0430\u043A.`);
      }
    }
    if (m.max !== void 0) {
      const mx = Number(m.max);
      if (!Number.isInteger(mx) || mx < 2 || mx > 4) return this.err(conn, "\u0427\u0438\u0441\u043B\u043E \u0438\u0433\u0440\u043E\u043A\u043E\u0432 \u0434\u043E\u043B\u0436\u043D\u043E \u0431\u044B\u0442\u044C \u043E\u0442 2 \u0434\u043E 4.");
      if (mx < this.players.length) return this.err(conn, `\u0423\u0436\u0435 ${this.players.length} \u0438\u0433\u0440\u043E\u043A\u0430 \u0432 \u043A\u043E\u043C\u043D\u0430\u0442\u0435, \u043C\u0435\u043D\u044C\u0448\u0435 \u043C\u0435\u0441\u0442 \u0441\u0434\u0435\u043B\u0430\u0442\u044C \u043D\u0435\u043B\u044C\u0437\u044F.`);
      if (mx !== this.max) {
        this.max = mx;
        this.say(`\u0425\u043E\u0437\u044F\u0438\u043D \u0432\u044B\u0431\u0440\u0430\u043B \u043C\u0435\u0441\u0442 \u0432 \u043A\u043E\u043C\u043D\u0430\u0442\u0435: ${mx}.`);
      }
    }
    if (m.aceRedeal !== void 0) {
      if (typeof m.aceRedeal !== "boolean") return this.err(conn, "\u041D\u0435\u043F\u043E\u043D\u044F\u0442\u043D\u0430\u044F \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430 \u043F\u0435\u0440\u0435\u0441\u0434\u0430\u0447\u0438.");
      if (m.aceRedeal !== this.aceRedeal) {
        this.aceRedeal = m.aceRedeal;
        this.say(this.aceRedeal ? "\u0425\u043E\u0437\u044F\u0438\u043D \u0432\u043A\u043B\u044E\u0447\u0438\u043B \u043F\u0435\u0440\u0435\u0441\u0434\u0430\u0447\u0443, \u0435\u0441\u043B\u0438 \u0432\u043D\u0438\u0437\u0443 \u043A\u043E\u043B\u043E\u0434\u044B \u0442\u0443\u0437." : "\u0425\u043E\u0437\u044F\u0438\u043D \u0432\u044B\u043A\u043B\u044E\u0447\u0438\u043B \u043F\u0435\u0440\u0435\u0441\u0434\u0430\u0447\u0443, \u0435\u0441\u043B\u0438 \u0432\u043D\u0438\u0437\u0443 \u043A\u043E\u043B\u043E\u0434\u044B \u0442\u0443\u0437.");
      }
    }
    if (m.listed !== void 0) {
      if (typeof m.listed !== "boolean") return this.err(conn, "\u041D\u0435\u043F\u043E\u043D\u044F\u0442\u043D\u0430\u044F \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430 \u0441\u043F\u0438\u0441\u043A\u0430 \u0438\u0433\u0440.");
      if (m.listed !== this.listed) {
        this.listed = m.listed;
        this.say(this.listed ? "\u0425\u043E\u0437\u044F\u0438\u043D \u043F\u043E\u043A\u0430\u0437\u0430\u043B \u043A\u043E\u043C\u043D\u0430\u0442\u0443 \u0432 \u043E\u0431\u0449\u0435\u043C \u0441\u043F\u0438\u0441\u043A\u0435 \u0438\u0433\u0440: \u0435\u0451 \u0443\u0432\u0438\u0434\u044F\u0442 \u0442\u0435, \u043A\u0442\u043E \u043D\u0430\u0436\u043C\u0451\u0442 \xAB\u041D\u0430\u0439\u0442\u0438 \u0438\u0433\u0440\u0443 \u0432 \u0438\u043D\u0442\u0435\u0440\u043D\u0435\u0442\u0435\xBB." : "\u0425\u043E\u0437\u044F\u0438\u043D \u0443\u0431\u0440\u0430\u043B \u043A\u043E\u043C\u043D\u0430\u0442\u0443 \u0438\u0437 \u043E\u0431\u0449\u0435\u0433\u043E \u0441\u043F\u0438\u0441\u043A\u0430 \u0438\u0433\u0440. \u0412\u043E\u0439\u0442\u0438 \u043C\u043E\u0436\u043D\u043E \u0442\u043E\u043B\u044C\u043A\u043E \u043F\u043E \u043A\u043E\u0434\u0443.");
      }
    }
    this.broadcast();
  }
  onChat(conn, p, m) {
    const text = cleanChat(m.text);
    if (!text) return this.err(conn, typeof m.text === "string" && m.text.trim().length > 200 ? "\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u0434\u043B\u0438\u043D\u043D\u0435\u0435 200 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432. \u0421\u043E\u043A\u0440\u0430\u0442\u0438 \u0435\u0433\u043E." : "\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u043F\u0443\u0441\u0442\u043E\u0435. \u041D\u0430\u043F\u0438\u0448\u0438 \u0445\u043E\u0442\u044F \u0431\u044B \u043E\u0434\u043D\u043E \u0441\u043B\u043E\u0432\u043E.", "chat");
    const now = Date.now();
    const last = this.chatLast.get(p) ?? 0;
    if (now - last < 500) return this.err(conn, "\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u0447\u0430\u0441\u0442\u043E. \u041F\u043E\u0434\u043E\u0436\u0434\u0438 \u0441\u0435\u043A\u0443\u043D\u0434\u0443.", "chat");
    this.chatLast.set(p, now);
    this.chat.push({ i: ++this.chatN, from: p.name, t: text });
    if (this.chat.length > 50) this.chat.shift();
    this.broadcast();
  }
  onLeave(conn, p) {
    this.connPlayer.delete(conn);
    p.conn = null;
    const idx = this.players.indexOf(p);
    if (idx >= 0) this.players.splice(idx, 1);
    conn.send(JSON.stringify({ t: "left" }));
    if (this.players.length === 0) {
      this.reset();
      return;
    }
    if (p.token === this.hostToken) {
      this.hostToken = this.players[0].token;
      this.say(`\u0425\u043E\u0437\u044F\u0438\u043D\u043E\u043C \u043A\u043E\u043C\u043D\u0430\u0442\u044B \u0442\u0435\u043F\u0435\u0440\u044C ${this.players[0].name}.`);
    }
    if (this.phase === "play" || this.phase === "over") {
      if (this.phase === "play") this.say(`${p.name} \u0432\u044B\u0448\u0435\u043B, \u0438\u0433\u0440\u0430 \u043F\u0440\u0435\u0440\u0432\u0430\u043D\u0430.`);
      else this.say(`${p.name} \u0432\u044B\u0448\u0435\u043B \u0438\u0437 \u043A\u043E\u043C\u043D\u0430\u0442\u044B.`);
      this.phase = "lobby";
      this.game = null;
    } else {
      this.say(`${p.name} \u0432\u044B\u0448\u0435\u043B \u0438\u0437 \u043A\u043E\u043C\u043D\u0430\u0442\u044B.`);
    }
    this.broadcast();
  }
  // ---------- служебное ----------
  reset() {
    this.players = [];
    this.game = null;
    this.phase = "empty";
    this.hostToken = "";
    this.log = [];
    this.logN = 0;
    this.chat = [];
    this.chatN = 0;
    this.chatLast.clear();
    this.connPlayer.clear();
  }
  /** Краткие сведения для поиска игр в сети: только комнаты, в которые ещё можно войти. null, если войти нельзя. */
  summary() {
    if (this.phase !== "lobby" || this.players.length === 0 || this.players.length >= this.max) return null;
    const h = this.players.find((p) => p.token === this.hostToken) || this.players[0];
    return { code: this.code, host: h.name, players: this.players.length, max: this.max, mode: this.mode };
  }
  /** Сведения для общего списка в интернете: только если хозяин разрешил, в лобби есть место и кто-то подключён. */
  publicSummary() {
    if (!this.listed || this.nobodyConnected()) return null;
    return this.summary();
  }
  isEmpty() {
    return this.phase === "empty";
  }
  /** Нет ни одного подключённого игрока. */
  nobodyConnected() {
    return this.players.every((p) => !p.conn);
  }
  addPlayer(conn, name) {
    const p = { token: rnd(), name, conn };
    this.players.push(p);
    this.connPlayer.set(conn, p);
    return p;
  }
  seatOf(p) {
    return this.players.indexOf(p);
  }
  say(t) {
    this.log.push({ i: ++this.logN, t });
    if (this.log.length > 60) this.log.shift();
  }
  err(conn, text, code) {
    conn.send(JSON.stringify({ t: "error", text, code: code ?? "rule" }));
  }
  broadcast() {
    for (const p of this.players) if (p.conn) this.sendState(p.conn);
    if (this.onChange) {
      try {
        this.onChange();
      } catch {
      }
    }
  }
  stateFor(p) {
    const seat = this.seatOf(p);
    return {
      v: PROTOCOL_VERSION,
      code: this.code,
      phase: this.phase,
      mode: this.mode,
      max: this.max,
      aceRedeal: this.aceRedeal,
      listed: this.listed,
      me: seat,
      host: p.token === this.hostToken,
      players: this.players.map((x) => ({ name: x.name, connected: !!x.conn, host: x.token === this.hostToken })),
      log: this.log.slice(-30),
      chat: this.chat.slice(-30),
      game: this.game ? this.game.view(seat) : null
    };
  }
  sendState(conn) {
    const p = this.connPlayer.get(conn);
    if (!p) return;
    conn.send(JSON.stringify({ t: "state", s: this.stateFor(p) }));
  }
};
function bad() {
  return { ok: false, error: "\u041D\u0435\u043F\u043E\u043D\u044F\u0442\u043D\u0430\u044F \u043A\u0430\u0440\u0442\u0430 \u0432 \u043A\u043E\u043C\u0430\u043D\u0434\u0435." };
}

// src/worker.ts
var RoomDO = class {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }
  room = null;
  lastKey = "null";
  lastReport = 0;
  /** Сообщает общему списку, видна ли эта комната. Не чаще раза в минуту, если ничего не менялось. */
  report() {
    const room = this.room;
    if (!room || !this.env.LOBBY) return;
    const sum = room.publicSummary();
    const key = JSON.stringify(sum);
    const now = Date.now();
    if (key === this.lastKey && (sum === null || now - this.lastReport < 6e4)) return;
    this.lastKey = key;
    this.lastReport = now;
    try {
      const stub = this.env.LOBBY.get(this.env.LOBBY.idFromName("main"));
      const job = stub.fetch("https://lobby/report", { method: "POST", body: JSON.stringify({ code: room.code, room: sum }) }).catch(() => void 0);
      if (this.state && typeof this.state.waitUntil === "function") this.state.waitUntil(job);
    } catch {
    }
  }
  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") return new Response("\u041E\u0436\u0438\u0434\u0430\u0435\u0442\u0441\u044F WebSocket", { status: 426 });
    const url = new URL(request.url);
    const m = /^\/ws\/(\d{4})$/.exec(url.pathname);
    if (!m) return new Response("\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0430\u0434\u0440\u0435\u0441", { status: 400 });
    if (!this.room) {
      this.room = new Room(m[1]);
      this.room.onChange = () => this.report();
    }
    const room = this.room;
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();
    const conn = {
      send: (t) => {
        try {
          server.send(t);
        } catch {
        }
      },
      close: () => {
        try {
          server.close();
        } catch {
        }
      }
    };
    server.addEventListener("message", (e) => {
      room.handle(conn, typeof e.data === "string" ? e.data : "");
      this.report();
    });
    server.addEventListener("close", () => room.disconnect(conn));
    server.addEventListener("error", () => room.disconnect(conn));
    return new Response(null, { status: 101, webSocket: client });
  }
};
var LOBBY_TTL_MS = 15 * 60 * 1e3;
var LobbyDO = class {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }
  async fetch(input) {
    const request = typeof input === "string" ? null : input;
    const url = new URL(typeof input === "string" ? input : input.url);
    if (request && request.method === "POST" && url.pathname === "/report") {
      let b;
      try {
        b = await request.json();
      } catch {
        return new Response("bad", { status: 400 });
      }
      if (!b || typeof b.code !== "string" || !/^\d{4}$/.test(b.code)) return new Response("bad", { status: 400 });
      const r = b.room;
      if (r && typeof r === "object" && typeof r.host === "string") {
        await this.state.storage.put("r" + b.code, {
          code: b.code,
          host: String(r.host).slice(0, 20),
          players: Number(r.players) || 0,
          max: Number(r.max) || 4,
          mode: r.mode === "perevodnoy" ? "perevodnoy" : "podkidnoy",
          ts: Date.now()
        });
      } else {
        await this.state.storage.delete("r" + b.code);
      }
      return new Response("ok");
    }
    if (url.pathname === "/list") {
      const all = await this.state.storage.list({ prefix: "r" });
      const now = Date.now();
      const rooms = [];
      for (const [k, v] of all) {
        if (!v || now - v.ts > LOBBY_TTL_MS) {
          await this.state.storage.delete(k);
          continue;
        }
        rooms.push({ code: v.code, host: v.host, players: v.players, max: v.max, mode: v.mode });
      }
      rooms.sort((a, c) => a.host.localeCompare(c.host));
      return new Response(JSON.stringify({ app: "durak", rooms }), {
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
      });
    }
    return new Response("not found", { status: 404 });
  }
};
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/rooms") {
      if (!env.LOBBY) return new Response(JSON.stringify({ app: "durak", rooms: [] }), { headers: { "content-type": "application/json; charset=utf-8" } });
      return env.LOBBY.get(env.LOBBY.idFromName("main")).fetch("https://lobby/list");
    }
    const m = /^\/ws\/(\d{4})$/.exec(url.pathname);
    if (!m) return new Response("Durak server ok\n", { headers: { "content-type": "text/plain; charset=utf-8" } });
    const id = env.ROOMS.idFromName(m[1]);
    return env.ROOMS.get(id).fetch(request);
  }
};
export {
  LobbyDO,
  RoomDO,
  worker_default as default
};
