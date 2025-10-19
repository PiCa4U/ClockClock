import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

/*
  MillionTimesClock — single-file React component for CRA
  -------------------------------------------------------
  - Grid of tiny two-hand clocks that arrange into HHMM once per minute (без двоеточия)
  - Между минутами мини-часы красиво вращаются в idle-хореографии
  - Без зависимостей; чистый React + SVG + инлайн CSS

  Обновление по запросу:
  - Размер цифры 4x6 клетки
  - Общая область 17x6 клеток
  - 4 цифры, разделённые на пары HH и MM, между парами один зазор в 1 клетку
*/

// ---------- Конфиг ----------
const DIGIT_W = 4;           // ширина цифры в клетках
const DIGIT_H = 6;           // высота цифры в клетках
const SEG_THICK = 1;         // толщина сегмента (в клетках)
const GAP_INNER = 0;         // зазор внутри пары (между H1-H2 и M1-M2)
const GAP_PAIR = 1;          // зазор между парами HH и MM (ровно 1, чтобы всего было 17)

const FORM_IN_MS = 10000;   // длительность плавного входа в порядок (~10с)   // плавный доворот при формировании времени
const HOLD_FORM_MS = 5000;   // держим цифры + фон 5 секунд
const FORM_OUT_MS = 10000;  // длительность плавного выхода обратно в хаос (~10с)
const IDLE_SPIN_S = 48;      // резерв, если вдруг вернём общий спин

const HAND_WIDTH_REL = 0.01; // толщина стрелок относительно клетки
const RIM_WIDTH_REL = 0.02;  // толщина ободка

// Цвета
const COLOR_RIM = "#E6E6E6";
const COLOR_HAND = "#111";
const COLOR_BG = "#FAFAFA";

// Easing для формирования
const EASE = "cubic-bezier(.2,.8,.2,1)";
// плавная функция для RAF-переходов (гамма-кривая)
const easeInOut = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2));

// Размер всей доски в клетках (должно получиться 17x6)
const TOTAL_COLS = 4 * DIGIT_W + 2 * GAP_INNER + GAP_PAIR; // 4*4 + 0 + 1 = 17
const TOTAL_ROWS = DIGIT_H;                                 // 6

// ---------- Таймер по минутам ----------
function useMinuteTicker(onTick: () => void) {
  useEffect(() => {
    const align = () => {
      const now = new Date();
      const ms = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
      const t = setTimeout(() => {
        onTick();
        align();
      }, ms);
      return t;
    };
    const t = align();
    return () => clearTimeout(t);
  }, [onTick]);
}

// ---------- Описание цифр: 2 подхода ----------
// 1) Явные шаблоны 4x6 (24 клетки), где каждая клетка задаёт две стрелки в формате "H:M".
//    null/"bg" означает фон 45°/225°.
// 2) Фолбек — классическая 7‑сегментная раскладка на 4x6 (углы 0°/90°).

// === 1) Явные шаблоны ===
// helper для краткой записи
const BG: null = null;

// Пример: цифра '1' по твоей схеме (нумерация слева-направо, сверху-вниз, 1..24)
// 1)3:30 2)3:45 3)9:30 4)bg 5)0:15 6)6:45 7)6:00 8)bg 9)bg 10)6:00 11)6:00 12)bg
// 13)bg 14)6:00 15)6:00 16)bg 17)6:15 18)9:00 19)3:00 20)6:45 21)3:00 22)3:45 23)3:45 24)9:00
const DIGIT_PATTERNS: Record<string, (string | null)[]> = {
  "0": [
    "6:15", "3:45", "3:45", "6:45",
    "6:00", "6:15", "6:45", "6:00",
    "6:00", "6:00", "6:00", "6:00",
    "6:00", "6:00", "6:00", "6:00",
    "6:00", "3:00", "9:00", "6:00",
    "3:00", "3:45", "3:45", "9:00",
  ],
  "1": [
    "3:30","3:45","9:30",BG,
    "0:15","6:45","6:00",BG,
    BG,"6:00","6:00",BG,
    BG,"6:00","6:00",BG,
    "6:15","9:00","3:00","6:45",
    "3:00","3:45","3:45","9:00",
  ],
  "2": [
    "3:30", "3:45", "3:45", "6:45",
    "3:00", "3:45", "6:45", "6:00",
    "3:30", "3:45", "9:00", "6:00",
    "6:00", "3:30", "3:45", "9:00",
    "6:00", "3:00", "3:45", "6:45",
    "3:00", "3:45", "3:45", "9:00",
  ],
  "3": [
    "3:30","3:45","3:45","6:45",
    "3:00", "3:45", "6:45","6:00",
    "3:30","3:45","9:00","6:00",
    "3:00", "3:45", "6:45","6:00",
    "3:30", "3:45", "9:00","6:00",
    "3:00","3:45","3:45","9:00",
  ],
  "4": [
    "3:30", "6:45", "3:30", "6:45",
    "6:00", "6:00", "6:00", "6:00",
    "6:00","3:00","9:00","6:00",
    "3:00", "3:45", "6:45", "6:00",
    BG, BG, "6:00", "6:00",
    BG, BG, "3:00", "9:00",
  ],
  "5": [
    "3:30","3:45","3:45","6:45",
    "6:00","3:30", "3:45", "9:00",
    "6:00","3:00","3:45","6:45",
    "3:00", "3:45", "6:45","6:00",
    "3:30", "3:45", "9:00", "6:00",
    "3:00","3:45","3:45","9:00",
  ],
  "6": [
    "3:30","3:45","3:45","6:45",
    "6:00","3:30", "3:45", "9:00",
    "6:00","3:00","3:45", "6:45",
    "6:00", "3:30", "6:45","6:00",
    "6:00", "3:00", "9:00", "6:00",
    "3:00","3:45","3:45","9:00",
  ],
  "7": [
    "3:30","3:45","3:45","6:45",
    "3:00", "3:45", "6:45","6:00",
    BG, BG, "7.5:00", "7.5:00",
    BG, "1.5:30", "1.5:30", BG,
    BG, "6:00", "6:00", BG,
    BG, "3:00", "9:00", BG,
  ],
  "8": [
    "3:30","3:45","3:45","6:45",
    "6:00","3:30","6:45","6:00",
    "4.5:00","3:00","9:00","7.5:00",
    "1.5:30","3:30","6:45","10.5:30",
    "6:00","3:00","9:00","6:00",
    "3:00","3:45","3:45","9:00",
  ],
  "9": [
    "3:30","3:45","3:45","6:45",
    "6:00","3:30","6:45","6:00",
    "6:00", "3:00","9:00","6:00",
    "3:00", "3:45", "9:30","6:00",
    "3:30", "3:45", "9:00", "6:00",
    "3:00","3:45","3:45","9:00",
  ],
};

const segLetters = ["a","b","c","d","e","f","g"] as const;
type Seg = typeof segLetters[number];

const digitToSegs: Record<string, Seg[]> = {
  "0": ["a","b","c","d","e","f"],
  "1": ["b","c"],
  "2": ["a","b","g","e","d"],
  "3": ["a","b","g","c","d"],
  "4": ["f","g","b","c"],
  "5": ["a","f","g","c","d"],
  "6": ["a","f","g","c","d","e"],
  "7": ["a","b","c"],
  "8": ["a","b","c","d","e","f","g"],
  "9": ["a","b","c","d","f","g"],
};

function buildSegments() {
  const midY = Math.floor(DIGIT_H / 2);
  const cells: Record<Seg, Array<{x:number;y:number;angle:number}>> = { a:[],b:[],c:[],d:[],e:[],f:[],g:[] };
  const addH = (seg: Seg, y: number, fromX = 1, toX = DIGIT_W - 2) => {
    for (let t = 0; t < SEG_THICK; t++) {
      for (let x = fromX; x <= toX; x++) cells[seg].push({ x, y: y + t, angle: 0 });
    }
  };
  const addV = (seg: Seg, x: number, fromY: number, toY: number) => {
    for (let t = 0; t < SEG_THICK; t++) {
      for (let y = fromY; y <= toY; y++) cells[seg].push({ x: x + t, y, angle: 90 });
    }
  };
  addH("a", 0);
  addH("g", midY);
  addH("d", DIGIT_H - 1);
  addV("b", DIGIT_W - 1, 1, midY - 1);
  addV("c", DIGIT_W - 1, midY + 1, DIGIT_H - 2);
  addV("f", 0, 1, midY - 1);
  addV("e", 0, midY + 1, DIGIT_H - 2);
  return cells;
}

const SEG_CELLS = buildSegments();

// ---------- Размётка времени "HHMM" (без двоеточия) ----------
export type Cell = { x:number; y:number; a:number; b:number };

function angleFromHour(h: number) {
  // Поддержка дробных часов (например, 1.5, 4.5, 7.5, 10.5): 360° / 12 = 30° на час
  // 1.5 → 45°, 4.5 → 135°, 7.5 → 225°, 10.5 → 315° и т.д.
  const deg = ((h % 12 + 12) % 12) * 30;
  return deg;
}
function angleFromMinute(m: number) {
  // Минуты трактуем как на часах (0..59, можно дробные): 360° / 60 = 6° на минуту
  // 0 → 0°, 15 → 90°, 30 → 180°, 45 → 270°
  const deg = ((m % 60 + 60) % 60) * 6;
  return deg;
}
function parseSpec(spec: string | null | undefined): {a:number;b:number} | null {
  if (!spec || spec === "bg") return null;
  const parts = spec.split(":");
  if (parts.length !== 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return { a: angleFromHour(h), b: angleFromMinute(m) };
}

function boardSizeForTime(): { cols: number; rows: number } {
  return { cols: TOTAL_COLS, rows: TOTAL_ROWS };
}

function layoutForTimeString(hhmm: string): { cells: Cell[]; cols: number; rows: number } {
  const { cols, rows } = boardSizeForTime();
  const cells: Cell[] = [];

  let curX = 0;
  for (let i = 0; i < 4; i++) {
    const char = hhmm[i];
    const explicit = DIGIT_PATTERNS[char];
    if (explicit && explicit.length === DIGIT_W * DIGIT_H) {
      // Явный шаблон: превращаем индекс [0..23] в (x,y)
      for (let k = 0; k < explicit.length; k++) {
        const spec = parseSpec(explicit[k]);
        if (!spec) continue; // фон — оставим базовый 45/225
        const x = k % DIGIT_W;
        const y = Math.floor(k / DIGIT_W);
        cells.push({ x: curX + x, y, a: spec.a, b: spec.b });
      }
    } else {
      // Фолбек: 7-сегментная цифра
      const segs = digitToSegs[char];
      if (segs) {
        for (const s of segs) {
          for (const c of SEG_CELLS[s]) {
            cells.push({ x: curX + c.x, y: c.y, a: c.angle, b: c.angle });
          }
        }
      }
    }

    if (i < 3) {
      if (i === 1) curX += DIGIT_W + GAP_PAIR;    // между HH и MM
      else         curX += DIGIT_W + GAP_INNER;   // внутри пары
    }
  }

  return { cells, cols, rows };
}

// ---------- Логика непрерывного вращения ----------
function toAbsCW(prevAbs: number, target: number) {
  const base = Math.floor(prevAbs / 360) * 360;
  let next = base + (target % 360 + 360) % 360;
  if (next <= prevAbs) next += 360;
  return next;
}

// Направленный вариант: сохраняем текущую траекторию (dir>0 — по часовой, dir<0 — против)
function toAbsDirected(prevAbs: number, target: number, dir: number) {
  const t = (target % 360 + 360) % 360;
  let base = Math.floor(prevAbs / 360) * 360 + t;
  if (dir >= 0) {
    if (base <= prevAbs) base += 360;
  } else {
    if (base >= prevAbs) base -= 360;
  }
  return base;
}

// простая детерминированная псевдослучайность по индексу
function seeded(i: number, salt: number) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const MiniClock: React.FC<{
  size: number;
  targetA: number;
  targetB: number;
  forming: boolean;
  index: number;
}> = ({ size, targetA, targetB, forming, index }) => {
  // абсолютные углы (накапливаются бесконечно)
  const absARef = useRef(360 * seeded(index, 11));
  const absBRef = useRef(360 * seeded(index, 22));

  // линии
  const lineARef = useRef<SVGLineElement | null>(null);
  const lineBRef = useRef<SVGLineElement | null>(null);

  // параметры хаоса: скорости, направления, шум
  const dirA = useRef(seeded(index, 1) < 0.5 ? 1 : -1);
  const dirB = useRef(seeded(index, 2) < 0.5 ? 1 : -1);
  const baseWA = useRef(20 + seeded(index, 3) * 70);   // deg/s
  const baseWB = useRef(30 + seeded(index, 4) * 110);  // deg/s
  const ampA = useRef(10 + seeded(index, 5) * 30);     // шум амплитуда (deg)
  const ampB = useRef(10 + seeded(index, 6) * 45);
  const freqA = useRef(0.2 + seeded(index, 7) * 0.8);  // Гц
  const freqB = useRef(0.2 + seeded(index, 8) * 1.2);
  const phaseA = useRef(seeded(index, 9) * Math.PI * 2);
  const phaseB = useRef(seeded(index, 10) * Math.PI * 2);

  // запомним последние мгновенные угловые скорости, чтобы на входе в порядок не менять направление
  const lastWARef = useRef(0);
  const lastWBRef = useRef(0);

  // RAF управление и плавный выход в хаос
  const rafId = useRef<number | null>(null);
  const lastTs = useRef<number>(0);
  const chaosStartTs = useRef<number>(0);
  const chaosGainRef = useRef<number>(1); // 0..1

  const applyTransforms = (a: number, b: number) => {
    if (lineARef.current) lineARef.current.style.transform = `rotate(${a}deg)`;
    if (lineBRef.current) lineBRef.current.style.transform = `rotate(${b}deg)`;
  };

  const tick = (ts: number) => {
    if (!lastTs.current) lastTs.current = ts;
    const dt = (ts - lastTs.current) / 1000; // seconds
    lastTs.current = ts;

    // плавный вход в хаос: наращиваем множитель скорости 0→1 за FORM_OUT_MS
    if (chaosGainRef.current < 1) {
      if (!chaosStartTs.current) chaosStartTs.current = ts;
      const p = Math.min(1, (ts - chaosStartTs.current) / FORM_OUT_MS);
      chaosGainRef.current = easeInOut(p);
    }

    const t = ts / 1000;
    const wA0 = baseWA.current * dirA.current + ampA.current * Math.sin(2 * Math.PI * freqA.current * t + phaseA.current) * 0.5;
    const wB0 = baseWB.current * dirB.current + ampB.current * Math.sin(2 * Math.PI * freqB.current * t + phaseB.current) * 0.5;
    const wA = wA0 * chaosGainRef.current;
    const wB = wB0 * chaosGainRef.current;

    // сохраняем знак текущего движения
    lastWARef.current = wA;
    lastWBRef.current = wB;

    absARef.current += wA * dt;
    absBRef.current += wB * dt;

    applyTransforms(absARef.current, absBRef.current);
    rafId.current = requestAnimationFrame(tick);
  };

  // включаем/выключаем хаос в зависимости от forming
  useEffect(() => {
    const la = lineARef.current;
    const lb = lineBRef.current;
    if (!la || !lb) return;

    if (forming) {
      // останавливаем RAF и сбрасываем усиление хаоса
      if (rafId.current) cancelAnimationFrame(rafId.current);
      rafId.current = null;
      chaosGainRef.current = 0;

      // длинный плавный доворот к целям (10с) по абсолютным углам (всегда по часовой)
      la.style.transition = `transform ${FORM_IN_MS}ms ${EASE}`;
      lb.style.transition = `transform ${FORM_IN_MS}ms ${EASE}`;

      const sA = lastWARef.current === 0 ? (dirA.current >= 0 ? 1 : -1) : (lastWARef.current > 0 ? 1 : -1);
      const sB = lastWBRef.current === 0 ? (dirB.current >= 0 ? 1 : -1) : (lastWBRef.current > 0 ? 1 : -1);
      const nextA = toAbsDirected(absARef.current, targetA, sA);
      const nextB = toAbsDirected(absBRef.current, targetB, sB);
      absARef.current = nextA;
      absBRef.current = nextB;
      applyTransforms(nextA, nextB);
    } else {
      // снимаем transition и плавно выводим в хаос: скорость с 0 → 1 за 10с
      la.style.transition = "";
      lb.style.transition = "";
      lastTs.current = 0;
      chaosStartTs.current = 0;
      chaosGainRef.current = 0;
      rafId.current = requestAnimationFrame(tick);
    }

    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      rafId.current = null;
    };
  }, [forming, targetA, targetB]);

  const s = size;
  const stroke = Math.max(2, Math.round(s * HAND_WIDTH_REL));
  const rim = Math.max(1, Math.round(s * RIM_WIDTH_REL));

  return (
      <div className="mc" style={{ width: s, height: s }}>
        <svg viewBox="0 0 100 100" width={s} height={s}>
          <circle cx="50" cy="50" r={50 - rim} fill={COLOR_BG} stroke={COLOR_RIM} strokeWidth={rim} />
          <g>
            <line ref={lineARef} x1="50" y1="50" x2="50" y2="14" stroke={COLOR_HAND} strokeWidth={stroke}
                  strokeLinecap="round" style={{ transformOrigin: "50px 50px" }} />
            <line ref={lineBRef} x1="50" y1="50" x2="50" y2="20" stroke={COLOR_HAND} strokeWidth={stroke}
                  strokeLinecap="round" style={{ transformOrigin: "50px 50px" }} />
          </g>
        </svg>
      </div>
  );
};

// ---------- Сетка мини-часов ----------
type RefLike<T extends HTMLElement> = { current: T | null };

const useSize = <T extends HTMLElement>(ref: RefLike<T>): { w:number; h:number } => {
  const [s, setS] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setS({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setS({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [ref]);
  return s;
};

const Board: React.FC<{ time: string }> = ({ time }) => {
  const { cells, cols, rows } = useMemo(() => layoutForTimeString(time), [time]);
  const boardRef = useRef<HTMLDivElement>(null);
  const { w, h } = useSize(boardRef);

  const cellSize = useMemo(() => {
    if (!w || !h) return 36;
    const gap = 8; // px
    return Math.floor(Math.min((w - gap * (cols - 1)) / cols, (h - gap * (rows - 1)) / rows));
  }, [w, h, cols, rows]);

  const gridDefault = useMemo(() => {
    const N = rows * cols;
    return new Array(N).fill(0).map(() => ({ a: 45, b: 225 }));
  }, [rows, cols]);

  const gridTargets = useMemo(() => {
    const data = gridDefault.slice();
    for (const c of cells) {
      const idx = c.y * cols + c.x;
      if (data[idx]) data[idx] = { a: c.a, b: c.b };
    }
    return data;
  }, [cells, gridDefault, cols]);

  const [forming, setForming] = useState(true);
  useEffect(() => {
    setForming(true);
    const t = setTimeout(() => setForming(false), FORM_IN_MS + HOLD_FORM_MS);
    return () => clearTimeout(t);
  }, [time]);

  return (
      <div
          ref={boardRef}
          className="board"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
            gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
            gap: 8,
            placeContent: "center",
            width: "100%",
            height: "100%",
          }}
      >
        {gridTargets.map((g, i) => (
            <MiniClock key={i} size={cellSize} targetA={g.a} targetB={g.b} forming={forming} index={i} />
        ))}
      </div>
  );
};

// ---------- Верхний уровень ----------
const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);

const MillionTimesClockApp: React.FC = () => {
  const [time, setTime] = useState(() => {
    const d = new Date();
    return `${pad2(d.getHours())}${pad2(d.getMinutes())}`; // HHMM
  });

  const refresh = () => {
    const d = new Date();
    setTime(`${pad2(d.getHours())}${pad2(d.getMinutes())}`);
  };

  useMinuteTicker(refresh);

  useEffect(() => { refresh(); }, []);

  return (
      <div className="wrap">
        <Board time={time} />
        <div className="overlay">
          <div className="label">{time.slice(0,2)}:{time.slice(2)}</div>
        </div>
        <style>{globalStyles}</style>
      </div>
  );
};

export default MillionTimesClockApp;

// ---------- Стили ----------
const globalStyles = `
  * { box-sizing: border-box; }
  html, body, #root { height: 100%; }
  body { margin: 0; background: ${COLOR_BG}; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji"; }
  .wrap { position: relative; width: 100%; height: 100%; display: grid; place-items: center; }
  .board { width: min(94vw, 1400px); height: min(86vh, 900px); }

  .mc { will-change: transform; }
  .mc.idle { /* legacy: not used now, chaos is handled via RAF per hand */ }
  @keyframes mc_spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }

  .overlay { position: absolute; inset: 0; display: grid; place-items: end center; pointer-events: none; padding: 18px; }
  .label { opacity: .16; font-weight: 700; letter-spacing: .06em; font-size: clamp(24px, 6vw, 56px); }
`;
