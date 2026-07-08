'use strict';

// ─── Nota tabulky ────────────────────────────────────────────────────────────

const NOTES_INTERNATIONAL = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const NOTES_CZECH_SHARP   = ['C','Cis','D','Dis','E','F','Fis','G','Gis','A','Ais','H'];
const NOTES_CZECH_FLAT    = ['C','Des','D','Es', 'E','F','Ges','G','As', 'A','B',  'H'];

// Béčkové tóniny: F(5), B/Bes(10), Es(3), As(8), Des(1)
// Chroma 6 (Fis/Ges) je enharmonické — výchozí: Fis (křížková strana CoF)
const FLAT_KEYS = new Set([1, 3, 5, 8, 10]);

function prefersFlats(rootChroma) {
  return FLAT_KEYS.has(rootChroma);
}

function chromaToName(chroma, notation, useFlats) {
  if (notation === 'czech') {
    return useFlats ? NOTES_CZECH_FLAT[chroma] : NOTES_CZECH_SHARP[chroma];
  }
  if (useFlats) {
    const INTL_FLAT = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
    return INTL_FLAT[chroma];
  }
  return NOTES_INTERNATIONAL[chroma];
}

function nameToChroma(name, notation) {
  const list = notation === 'czech'
    ? [...NOTES_CZECH_SHARP, ...NOTES_CZECH_FLAT]
    : [...NOTES_INTERNATIONAL, 'Db','Eb','Gb','Ab','Bb'];
  const sharps = notation === 'czech' ? NOTES_CZECH_SHARP : NOTES_INTERNATIONAL;
  const flats  = notation === 'czech' ? NOTES_CZECH_FLAT  : ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
  let idx = sharps.indexOf(name);
  if (idx === -1) idx = flats.indexOf(name);
  return idx === -1 ? 0 : idx;
}

function midiToChroma(midi) {
  return ((midi % 12) + 12) % 12;
}

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// ─── Intervaly ────────────────────────────────────────────────────────────────

const INTERVAL_NAMES = {
  0:  { cz: 'Prima',         short: 'R'   },
  1:  { cz: 'Malá sekunda',  short: 'm2'  },
  2:  { cz: 'Velká sekunda', short: 'M2'  },
  3:  { cz: 'Malá tercie',   short: 'm3'  },
  4:  { cz: 'Velká tercie',  short: 'M3'  },
  5:  { cz: 'Čistá kvarta',  short: 'P4'  },
  6:  { cz: 'Tritón',        short: 'TT'  },
  7:  { cz: 'Čistá kvinta',  short: 'P5'  },
  8:  { cz: 'Malá sexta',    short: 'm6'  },
  9:  { cz: 'Velká sexta',   short: 'M6'  },
  10: { cz: 'Malá septima',  short: 'm7'  },
  11: { cz: 'Velká septima', short: 'M7'  },
};

const INTERVAL_CSS_VAR = {
  0:  '--color-root',
  1:  '--color-m2',
  2:  '--color-M2',
  3:  '--color-m3',
  4:  '--color-M3',
  5:  '--color-P4',
  6:  '--color-TT',
  7:  '--color-P5',
  8:  '--color-m6',
  9:  '--color-M6',
  10: '--color-m7',
  11: '--color-M7',
};

// ─── Akordy ──────────────────────────────────────────────────────────────────

const CHORD_FORMULAS = {
  'Dur':   { label: 'Dur',   intervals: [0,4,7],      nameCz: 'Durový',               desc: 'Základní durový akord, radostný a stabilní zvuk.' },
  'Moll':  { label: 'Moll',  intervals: [0,3,7],      nameCz: 'Mollový',              desc: 'Základní mollový akord, melancholický a hluboký.' },
  'power': { label: 'Power', intervals: [0,7],        nameCz: 'Powerakord (kvinta)',   desc: 'Root + kvinta. Základ rockové a metalové rytmiky. Bez tercie — neutrální (ani dur ani moll).' },
  'dom7':  { label: '7',    intervals: [0,4,7,10],   nameCz: 'Dominantní septimový', desc: 'Durový akord s malou septimou. Vytváří silné napětí směřující k tónice.' },
  'm7':    { label: 'm7',   intervals: [0,3,7,10],   nameCz: 'Malý septimový',       desc: 'Mollový akord s malou septimou. Bohatý, jazzový zvuk.' },
  'maj7':  { label: 'maj7', intervals: [0,4,7,11],   nameCz: 'Velký septimový',      desc: 'Durový akord s velkou septimou. Jemný, romantický zvuk.' },
  'sus4':  { label: 'sus4', intervals: [0,5,7],      nameCz: 'Suspenze 4',           desc: 'Akord bez tercie s čistou kvartou. Napjatý, hledající zvuk.' },
  'sus2':  { label: 'sus2', intervals: [0,2,7],      nameCz: 'Suspenze 2',           desc: 'Akord bez tercie s velkou sekundou. Otevřený, neurčitý zvuk.' },
  'add9':  { label: 'add9', intervals: [0,2,4,7],    nameCz: 'S přidanou nonou',     desc: 'Durový akord s přidanou velkou nonou. Otevřený, moderní zvuk.' },
  'dim':   { label: 'dim',  intervals: [0,3,6],      nameCz: 'Zmenšený',             desc: 'Akord se sníženou kvintou. Maximální napětí a nestabilita.' },
  'aug':   { label: 'aug',  intervals: [0,4,8],      nameCz: 'Zvětšený',             desc: 'Durový akord se zvětšenou kvintou. Tajemný, pohyblivý zvuk.' },
  'maj6':  { label: '6',    intervals: [0,4,7,9],    nameCz: 'Durový sextový',       desc: 'Durový akord s přidanou velkou sextou. Teplý, retro zvuk.' },
  'm6':    { label: 'm6',   intervals: [0,3,7,9],    nameCz: 'Mollový sextový',      desc: 'Mollový akord s přidanou velkou sextou. Elegantní, jazzový zvuk.' },
};

// ─── Stupnice ─────────────────────────────────────────────────────────────────

const SCALE_FORMULAS = {
  'Dur':         { intervals: [0,2,4,5,7,9,11],  nameCz: 'Durová (Iónská)',       char: 'Radostná, jasná, stabilní.' },
  'Moll':        { intervals: [0,2,3,5,7,8,10],  nameCz: 'Mollová (Aiolská)',     char: 'Smutná, melancholická, introspektivní.' },
  'Dorická':     { intervals: [0,2,3,5,7,9,10],  nameCz: 'Dórická',              char: 'Mollová s durovou sextou. Jazzová, folklórní.' },
  'Frygická':    { intervals: [0,1,3,5,7,8,10],  nameCz: 'Frygická',             char: 'Španělský, flamencový charakter. Temná a exotická.' },
  'Lydická':     { intervals: [0,2,4,6,7,9,11],  nameCz: 'Lydická',              char: 'Durová se zvýšenou kvartou. Snivá, vznešená.' },
  'Mixolydická': { intervals: [0,2,4,5,7,9,10],  nameCz: 'Mixolydická',          char: 'Durová s malou septimou. Bluesová, rocková.' },
  'Lokriánská':  { intervals: [0,1,3,5,6,8,10],  nameCz: 'Lokriánská',           char: 'Nejnestabilnější modus. Velmi disonantní.' },
  'PentaDur':    { intervals: [0,2,4,7,9],        nameCz: 'Pentatonika durová',   char: 'Pět tónů, universální. Lidový, čínský charakter.' },
  'PentaMoll':   { intervals: [0,3,5,7,10],       nameCz: 'Pentatonika mollová',  char: 'Pět tónů. Základ bluesové a rockové improvizace.' },
  'Bluesová':    { intervals: [0,3,5,6,7,10],     nameCz: 'Bluesová',            char: 'Mollová pentatonika s tritonem. Bluesový výraz.' },
};

// Nashville numerály pro standardní 7-tónové stupnice
const NASHVILLE_QUALITIES = {
  'Dur':         ['Dur','Moll','Moll','Dur','Dur','Moll','dim'],
  'Moll':        ['Moll','dim','Dur','Moll','Moll','Dur','Dur'],
  'Dorická':     ['Moll','Moll','Dur','Dur','Moll','dim','Dur'],
  'Frygická':    ['Moll','Dur','Dur','Moll','dim','Dur','Moll'],
  'Lydická':     ['Dur','Dur','Moll','dim','Dur','Moll','Moll'],
  'Mixolydická': ['Dur','Moll','dim','Dur','Moll','Moll','Dur'],
  'Lokriánská':  ['dim','Dur','Moll','Moll','Dur','Dur','Moll'],
};

// Harmonické funkce stupňů (index 0–6)
const DEGREE_ROLES = [
  { name: 'Tónika'      },
  { name: 'Supertónika' },
  { name: 'Medianta'    },
  { name: 'Subdominanta'},
  { name: 'Dominanta'   },
  { name: 'Submedianta' },
  { name: 'Citlivý tón' },
];

const ROMAN_UPPER = ['I','II','III','IV','V','VI','VII'];
const ROMAN_LOWER = ['i','ii','iii','iv','v','vi','vii'];

// ─── Ladění ───────────────────────────────────────────────────────────────────

const TUNINGS = {
  guitar: {
    'Standardní': { strings: [40,45,50,55,59,64] },
    'Drop D':     { strings: [38,45,50,55,59,64] },
  },
  bass4: {
    'Standardní': { strings: [28,33,38,43] },
    'Drop D':     { strings: [26,33,38,43] },
  },
  bass5: {
    'Standardní': { strings: [23,28,33,38,43] },  // B-E-A-D-G
  },
};

const INSTRUMENT_LABELS = {
  guitar: 'Kytara (6 strun)',
  bass4:  'Baskytara (4 struny)',
  bass5:  'Baskytara (5 strun)',
};

// ─── Kruh kvint ───────────────────────────────────────────────────────────────

// Kruh kvint — pořadí chromatických indexů (po kvintách)
// C G D A E H Fis/Ges Des As Es B F
const COF_ORDER = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];

// Relativní moll: každá durová tónina má relativní moll o malou tercii níže
// C→Am, G→Em, D→Hm, A→Fism, E→Cism, H→Gism, Fis/Ges→Dism/Esm, Des→Asm, As→Esm, Es→Cm, B→Gm, F→Dm
const RELATIVE_MINOR_CHROMA = COF_ORDER.map(c => (c + 9) % 12);

function getCircleOfFifths(notation) {
  return COF_ORDER.map((chroma, i) => {
    const pf = FLAT_KEYS.has(chroma);
    const minorChroma = RELATIVE_MINOR_CHROMA[i];
    const minorPf = pf;
    return {
      chroma,
      majorName: chromaToName(chroma, notation, pf),
      minorChroma,
      minorName:  chromaToName(minorChroma, notation, minorPf),
      angle: i * 30 - 90,  // stupně, C nahoře
    };
  });
}

// ─── Aktivní noty ─────────────────────────────────────────────────────────────

function getActiveNotes(rootChroma, formula) {
  return formula.map(semitones => ({
    chroma: (rootChroma + semitones) % 12,
    interval: semitones % 12,
  }));
}

// ─── Hmatník ─────────────────────────────────────────────────────────────────

function buildFretboard(tuningMidi, fretCount, notation, activeNotes, rootChroma, useFlatsOverride) {
  const useFlats = useFlatsOverride !== undefined ? useFlatsOverride : prefersFlats(rootChroma);
  // activeNotesMap: chroma → interval
  const activeMap = new Map(activeNotes.map(n => [n.chroma, n.interval]));

  return tuningMidi.map(openMidi => {
    return Array.from({ length: fretCount + 1 }, (_, fret) => {
      const midi   = openMidi + fret;
      const chroma = midiToChroma(midi);
      const interval = activeMap.has(chroma) ? activeMap.get(chroma) : null;
      const isRoot = chroma === rootChroma;
      const isActive = interval !== null;
      return {
        midi,
        chroma,
        name: chromaToName(chroma, notation, useFlats),
        interval,
        isRoot,
        isActive,
      };
    });
  });
}

// ─── Nashville ────────────────────────────────────────────────────────────────

function getNashvilleChords(rootChroma, scaleKey, notation, useFlats = null) {
  const formula = SCALE_FORMULAS[scaleKey];
  if (!formula || formula.intervals.length < 7) return null;
  const intervals = formula.intervals;
  const qualities = NASHVILLE_QUALITIES[scaleKey];
  if (!qualities) return null;

  const pf = useFlats !== null ? useFlats : prefersFlats(rootChroma);
  return intervals.map((semitones, i) => {
    const degreeChroma = (rootChroma + semitones) % 12;
    const quality = qualities[i];
    const isDim = quality === 'dim';
    const isDur = quality === 'Dur';
    const numeral = isDim
      ? ROMAN_LOWER[i] + '°'
      : isDur
        ? ROMAN_UPPER[i]
        : ROMAN_LOWER[i];
    const noteName = chromaToName(degreeChroma, notation, pf);
    return { numeral, noteName, quality, degreeChroma, semitones };
  });
}

function getDominantInfo(rootChroma, scaleKey, notation, useFlats = null) {
  const nashville = getNashvilleChords(rootChroma, scaleKey, notation, useFlats);
  if (!nashville) return null;

  const dominant = nashville[4];
  const pf = useFlats !== null ? useFlats : prefersFlats(rootChroma);

  const secDoms = nashville
    .filter((_, i) => i !== 0 && i !== 6)
    .map(target => {
      const domChroma = (target.degreeChroma + 7) % 12;
      const domName = chromaToName(domChroma, notation, pf);
      return {
        label: `V/${target.numeral}`,
        chordName: `${domName} 7`,
        targetNumeral: target.numeral,
        targetNoteName: target.noteName,
        targetQuality: target.quality,
      };
    });

  return { dominant, secondaryDominants: secDoms };
}

// ─── Výběr hlasů pro přehrávání ───────────────────────────────────────────────

function selectVoicingMidi(fretboard, activeNotes, minFret = 0) {
  const needed = new Set(activeNotes.map(n => n.chroma));
  const found = new Map();
  const rangeEnd = minFret + 5;

  // Hledej v zadané oblasti (minFret..minFret+5)
  for (let s = 0; s < fretboard.length; s++) {
    for (let f = minFret; f <= Math.min(rangeEnd, fretboard[s].length - 1); f++) {
      const note = fretboard[s][f];
      if (needed.has(note.chroma) && !found.has(note.chroma)) {
        found.set(note.chroma, note.midi);
      }
    }
  }

  // Záloha: pokud chybí tóny, prohledej 0–12
  if (found.size < needed.size) {
    for (let s = 0; s < fretboard.length; s++) {
      for (let f = 0; f <= Math.min(12, fretboard[s].length - 1); f++) {
        const note = fretboard[s][f];
        if (needed.has(note.chroma) && !found.has(note.chroma)) {
          found.set(note.chroma, note.midi);
        }
      }
    }
  }

  return [...found.values()];
}

// ─── Pentatonické boxy ────────────────────────────────────────────────────────

// Jádro boxu je vždy 5 tónů; Bluesová používá moll pentatoniku, blue nota (b5)
// se přidává dodatečně uvnitř okna boxu.
const PENTA_BOX_CORE = {
  'PentaDur':  [0, 2, 4, 7, 9],
  'PentaMoll': [0, 3, 5, 7, 10],
  'Bluesová':  [0, 3, 5, 7, 10],
};

// Vrátí Map<'struna:pražec', number[]> → indexy boxů 0–4 (box k začíná k-tým
// stupněm stupnice na nejnižší struně; k=0 = základní tón = Box 1).
// Dva tóny na strunu; pražce z reálných MIDI ladění (B-struna se posune sama).
function getPentatonicBoxes(tuningMidi, fretCount, rootChroma, scaleKey) {
  const core = PENTA_BOX_CORE[scaleKey];
  if (!core || !tuningMidi.length) return null;

  const chromas = core.map(i => (rootChroma + i) % 12);
  const isBlues = scaleKey === 'Bluesová';
  const blueChroma = (rootChroma + 6) % 12;

  const map = new Map();
  const add = (s, f, boxIdx) => {
    if (f < 0 || f > fretCount) return;
    const key = s + ':' + f;
    const arr = map.get(key) || [];
    if (!arr.includes(boxIdx)) { arr.push(boxIdx); map.set(key, arr); }
  };

  for (let k = 0; k < 5; k++) {
    const walk = (startFret) => {
      const notes = [];
      let pitch = tuningMidi[0] + startFret;
      let idx = k;
      for (let s = 0; s < tuningMidi.length; s++) {
        for (let n = 0; n < 2; n++) {
          notes.push({ string: s, fret: pitch - tuningMidi[s] });
          idx = (idx + 1) % 5;
          pitch += ((chromas[idx] - midiToChroma(pitch)) + 12) % 12;
        }
      }
      return notes;
    };

    let f0 = ((chromas[k] - midiToChroma(tuningMidi[0])) + 12) % 12;
    let notes = walk(f0);
    if (notes.some(n => n.fret < 0)) notes = walk(f0 + 12);

    // Blue noty: všechny výskyty b5 v globálním okně boxu
    if (isBlues) {
      const frets = notes.map(n => n.fret);
      const lo = Math.min(...frets), hi = Math.max(...frets);
      for (let s = 0; s < tuningMidi.length; s++) {
        for (let f = Math.max(0, lo); f <= hi; f++) {
          if (midiToChroma(tuningMidi[s] + f) === blueChroma) notes.push({ string: s, fret: f });
        }
      }
    }

    // Zápis + opakování o oktávu výš, pokud se vejde
    for (const n of notes) {
      add(n.string, n.fret, k);
      add(n.string, n.fret + 12, k);
    }
  }

  return map;
}

// ─── Basová linka: délky, výška, dělení do taktů ──────────────────────────────

// div = počet šestnáctin (divisions=4 na čtvrťovou); xml = MusicXML <type>; vf = VexFlow kód
const DURATIONS = {
  whole:     { div: 16, xml: 'whole',   vf: 'w',  glyph: '𝅝',  label: 'celá' },
  half:      { div: 8,  xml: 'half',    vf: 'h',  glyph: '𝅗𝅥',  label: 'půlová' },
  quarter:   { div: 4,  xml: 'quarter', vf: 'q',  glyph: '♩',  label: 'čtvrťová' },
  eighth:    { div: 2,  xml: 'eighth',  vf: '8',  glyph: '♪',  label: 'osminová' },
  sixteenth: { div: 1,  xml: '16th',    vf: '16', glyph: '𝅘𝅥𝅯',  label: 'šestnáctinová' },
};

const MEASURE_DIV = 16;  // 4/4

// Spelling chroma → notová hlava (step + alter), sdíleno osnovou i MusicXML.
// Křížky: C C# D D# E F F# G G# A A# B; Béčka: C Db D Eb E F Gb G Ab A Bb B
const SHARP_SPELL = [['C',0],['C',1],['D',0],['D',1],['E',0],['F',0],['F',1],['G',0],['G',1],['A',0],['A',1],['B',0]];
const FLAT_SPELL  = [['C',0],['D',-1],['D',0],['E',-1],['E',0],['F',0],['G',-1],['G',0],['A',-1],['A',0],['B',-1],['B',0]];

// midi → { step:'G', alter:-1|0|1, octave } (žádné Cb/H#, takže oktáva z floor je vždy správná)
function midiToPitch(midi, useFlats) {
  const chroma = midiToChroma(midi);
  const [step, alter] = (useFlats ? FLAT_SPELL : SHARP_SPELL)[chroma];
  return { step, alter, octave: Math.floor(midi / 12) - 1 };
}

// ─── Předznamenání (klíčové posuvky) ──────────────────────────────────────────

// fifths dle MusicXML: kladné = křížky, záporné = béčka. vfKey = VexFlow durový klíč.
const KEY_SIGNATURES = [
  { fifths: -7, label: 'Ces dur / as moll (7 ♭)', vfKey: 'Cb' },
  { fifths: -6, label: 'Ges dur / es moll (6 ♭)', vfKey: 'Gb' },
  { fifths: -5, label: 'Des dur / b moll (5 ♭)',  vfKey: 'Db' },
  { fifths: -4, label: 'As dur / f moll (4 ♭)',   vfKey: 'Ab' },
  { fifths: -3, label: 'Es dur / c moll (3 ♭)',   vfKey: 'Eb' },
  { fifths: -2, label: 'B dur / g moll (2 ♭)',    vfKey: 'Bb' },
  { fifths: -1, label: 'F dur / d moll (1 ♭)',    vfKey: 'F'  },
  { fifths:  0, label: 'C dur / a moll (bez předznamenání)', vfKey: 'C' },
  { fifths:  1, label: 'G dur / e moll (1 ♯)',    vfKey: 'G'  },
  { fifths:  2, label: 'D dur / h moll (2 ♯)',    vfKey: 'D'  },
  { fifths:  3, label: 'A dur / fis moll (3 ♯)',  vfKey: 'A'  },
  { fifths:  4, label: 'E dur / cis moll (4 ♯)',  vfKey: 'E'  },
  { fifths:  5, label: 'H dur / gis moll (5 ♯)',  vfKey: 'B'  },
  { fifths:  6, label: 'Fis dur / dis moll (6 ♯)',vfKey: 'F#' },
  { fifths:  7, label: 'Cis dur / ais moll (7 ♯)',vfKey: 'C#' },
];

const SHARP_ORDER = ['F','C','G','D','A','E','B'];  // pořadí křížků
const FLAT_ORDER  = ['B','E','A','D','G','C','F'];  // pořadí béček

// Alterace, kterou předznamenání dává danému písmenu (0 / +1 / -1)
function keySigAlter(step, fifths) {
  if (fifths > 0) return SHARP_ORDER.slice(0, fifths).includes(step) ? 1 : 0;
  if (fifths < 0) return FLAT_ORDER.slice(0, -fifths).includes(step) ? -1 : 0;
  return 0;
}

// midi + předznamenání → { step, alter, octave, accidental }
// accidental = zobrazená posuvka ('sharp'|'flat'|'natural') POUZE když se liší od předznamenání
function midiToNotated(midi, fifths) {
  const useFlats = fifths < 0;
  const chroma = midiToChroma(midi);
  const [step, alter] = (useFlats ? FLAT_SPELL : SHARP_SPELL)[chroma];
  const octave = Math.floor(midi / 12) - 1;
  const sig = keySigAlter(step, fifths);
  let accidental = null;
  if (alter !== sig) accidental = alter === 1 ? 'sharp' : alter === -1 ? 'flat' : 'natural';
  return { step, alter, octave, accidental };
}

// Rozloží počet šestnáctin na platné délky (mocniny 2), hladově od největší.
function decomposeDuration(n) {
  const out = [];
  for (const name of ['whole','half','quarter','eighth','sixteenth']) {
    const d = DURATIONS[name].div;
    while (n >= d) { out.push({ dur: name, div: d }); n -= d; }
  }
  return out;
}

// Ploché události {kind,midi?,dur} → pole taktů (4/4). Noty přes taktovou čáru se
// rozříznou a části se sváží ligaturou (tieStart/tieStop). Poslední takt se doplní pomlkou.
function fitToMeasures(events) {
  const flat = [];
  let filled = 0;

  for (const ev of events) {
    const base = DURATIONS[ev.dur] ? DURATIONS[ev.dur].div : 0;
    if (!base) continue;
    // Tečka = 1,5×; povolena jen pokud vyjde celé číslo (tj. ne u šestnáctinové)
    const dot   = !!ev.dot && Number.isInteger(base * 1.5);
    const evDiv = dot ? base * 1.5 : base;
    const startIdx = flat.length;

    if (evDiv <= MEASURE_DIV - filled) {
      // Vejde se celá → jeden zápis (zachová tečku)
      flat.push({ kind: ev.kind, midi: ev.midi, dur: ev.dur, dot, div: evDiv, tieStart: false, tieStop: false });
      filled += evDiv;
      if (filled >= MEASURE_DIV) filled = 0;
    } else {
      // Přesah přes taktovou čáru → rozklad na základní délky, svázat ligaturou
      let remaining = evDiv;
      while (remaining > 0) {
        const take = Math.min(MEASURE_DIV - filled, remaining);
        for (const p of decomposeDuration(take)) {
          flat.push({ kind: ev.kind, midi: ev.midi, dur: p.dur, dot: false, div: p.div, tieStart: false, tieStop: false });
          filled += p.div;
        }
        remaining -= take;
        if (filled >= MEASURE_DIV) filled = 0;  // taktová čára
      }
    }

    // Sváž všechny části jedné noty (rozklad / přechod přes takt)
    if (ev.kind === 'note') {
      for (let k = startIdx; k < flat.length - 1; k++) {
        flat[k].tieStart = true;
        flat[k + 1].tieStop = true;
      }
    }
  }

  // Rozděl ploché části do taktů po 16 (přesně tvarované už z pass 1)
  const measures = [];
  let cur = [];
  let f = 0;
  for (const piece of flat) {
    cur.push(piece);
    f += piece.div;
    if (f >= MEASURE_DIV) { measures.push(cur); cur = []; f = 0; }
  }
  if (cur.length) {
    for (const p of decomposeDuration(MEASURE_DIV - f)) {
      cur.push({ kind: 'rest', midi: undefined, dur: p.dur, dot: false, div: p.div, tieStart: false, tieStop: false });
    }
    measures.push(cur);
  }
  return measures;
}

// ─── Export ───────────────────────────────────────────────────────────────────

const Theory = {
  NOTES_INTERNATIONAL,
  NOTES_CZECH_SHARP,
  NOTES_CZECH_FLAT,
  CHORD_FORMULAS,
  SCALE_FORMULAS,
  NASHVILLE_QUALITIES,
  DEGREE_ROLES,
  INTERVAL_NAMES,
  INTERVAL_CSS_VAR,
  TUNINGS,
  INSTRUMENT_LABELS,
  COF_ORDER,
  prefersFlats,
  chromaToName,
  nameToChroma,
  midiToChroma,
  midiToFreq,
  getCircleOfFifths,
  getActiveNotes,
  buildFretboard,
  getNashvilleChords,
  getDominantInfo,
  selectVoicingMidi,
  DURATIONS,
  MEASURE_DIV,
  midiToPitch,
  decomposeDuration,
  fitToMeasures,
  KEY_SIGNATURES,
  keySigAlter,
  midiToNotated,
  PENTA_BOX_CORE,
  getPentatonicBoxes,
};
