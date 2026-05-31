'use strict';

// ─── Nota tabulky ────────────────────────────────────────────────────────────

const NOTES_INTERNATIONAL = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const NOTES_CZECH_SHARP   = ['C','Cis','D','Dis','E','F','Fis','G','Gis','A','Ais','H'];
const NOTES_CZECH_FLAT    = ['C','Des','D','Es', 'E','F','Ges','G','As', 'A','B',  'H'];

// Béčkové tóniny: F(5), B/Bes(10), Es(3), As(8), Des(1), Ges(6)
const FLAT_KEYS = new Set([1, 3, 5, 6, 8, 10]);

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
    const minorPf = FLAT_KEYS.has(minorChroma);
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

function getNashvilleChords(rootChroma, scaleKey, notation) {
  const formula = SCALE_FORMULAS[scaleKey];
  if (!formula || formula.intervals.length < 7) return null;
  const intervals = formula.intervals;
  const qualities = NASHVILLE_QUALITIES[scaleKey];
  if (!qualities) return null;

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
    const pf = prefersFlats(degreeChroma);
    const noteName = chromaToName(degreeChroma, notation, pf);
    return { numeral, noteName, quality, degreeChroma, semitones };
  });
}

function getDominantInfo(rootChroma, scaleKey, notation) {
  const nashville = getNashvilleChords(rootChroma, scaleKey, notation);
  if (!nashville) return null;

  // Primární dominant = V (index 4)
  const dominant = nashville[4];

  // Sekundární dominanty: V/ii, V/iii, V/IV, V/V, V/vi (ne V/I a ne V/vii°)
  const secDoms = nashville
    .filter((_, i) => i !== 0 && i !== 6)
    .map(target => {
      // sekundární dominant k tomuto stupni = akord na čisté kvintě nad ním
      const domChroma = (target.degreeChroma + 7) % 12;
      const pf = prefersFlats(domChroma);
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
};
