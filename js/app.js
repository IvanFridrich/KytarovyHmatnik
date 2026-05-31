'use strict';

// ─── Pořadí root pickeru — od A ───────────────────────────────────────────────
const ROOT_ORDER = [9, 10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8];

// ─── Výchozí stav ─────────────────────────────────────────────────────────────

const defaultState = {
  theme:         'auto',
  instrument:    'guitar',
  tuningKey:     'Standardní',
  customTuning:  null,
  notation:      'czech',
  accidentals:   'auto',      // 'auto' | 'sharp' | 'flat'
  fretCount:     22,
  mode:          'chord',
  rootChroma:    9,           // výchozí: A
  chordKey:      'Dur',
  scaleKey:      'Dur',
  nonLinearFrets: false,
  timbre:        'sine',
  colorMode:     'interval',  // 'interval' | 'tone'
  playOctave:    3,           // cílová oktáva základního tónu (0–7)
  playDuration:  'normal',    // 'short' | 'normal' | 'long'
  livePlay:      false,       // živý náhled — akord hraje průběžně
  volume:        70,          // hlasitost 0–100
};

const PERSISTED_KEYS = [
  'theme','instrument','tuningKey','customTuning','notation','accidentals',
  'fretCount','mode','rootChroma','chordKey','scaleKey','nonLinearFrets','timbre',
  'colorMode','playOctave','playDuration','livePlay','volume',
];

// ─── Stav aplikace ────────────────────────────────────────────────────────────

const state = {
  ...defaultState,
  // odvozená pole (neperzistovaná)
  resolvedTheme: 'light',
  activeNotes:   [],
  fretboard:     [],
  tuningMidi:    [],
  useFlats:      false,
};

// ─── localStorage ─────────────────────────────────────────────────────────────

function saveState() {
  const saved = {};
  for (const k of PERSISTED_KEYS) saved[k] = state[k];
  try { localStorage.setItem('kytarnyHmatnik', JSON.stringify(saved)); } catch (_) {}
}

function loadState() {
  try {
    const raw = localStorage.getItem('kytarnyHmatnik');
    if (!raw) return;
    const saved = JSON.parse(raw);
    for (const k of PERSISTED_KEYS) {
      if (saved[k] !== undefined) state[k] = saved[k];
    }
    // Migrace starých klíčů (před přejmenováním '7'→'dom7', '6'→'maj6')
    if (state.chordKey === '7') state.chordKey = 'dom7';
    if (state.chordKey === '6') state.chordKey = 'maj6';
  } catch (_) {}
}

// ─── Témata ───────────────────────────────────────────────────────────────────

function resolveTheme(theme) {
  if (theme === 'light' || theme === 'dark') return theme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(resolved) {
  document.documentElement.setAttribute('data-theme', resolved);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = resolved === 'dark' ? '☀' : '☾';
}

// ─── Alterace ─────────────────────────────────────────────────────────────────

// Vrátí useFlats pro konkrétní chroma s ohledem na nastavení alterací
function getUseFlats(chroma) {
  if (state.accidentals === 'sharp') return false;
  if (state.accidentals === 'flat')  return true;
  return Theory.prefersFlats(chroma);
}

// ─── Odvozená data ────────────────────────────────────────────────────────────

function recompute() {
  // Ladění
  const tunings = Theory.TUNINGS[state.instrument];
  if (state.tuningKey === 'Vlastní' && state.customTuning) {
    state.tuningMidi = state.customTuning;
  } else if (tunings && tunings[state.tuningKey]) {
    state.tuningMidi = tunings[state.tuningKey].strings;
  } else {
    const firstKey = Object.keys(tunings)[0];
    state.tuningMidi = tunings[firstKey].strings;
    state.tuningKey  = firstKey;
  }

  // useFlats pro root
  state.useFlats = getUseFlats(state.rootChroma);

  // Aktivní noty
  const formula = state.mode === 'chord'
    ? Theory.CHORD_FORMULAS[state.chordKey].intervals
    : Theory.SCALE_FORMULAS[state.scaleKey].intervals;
  state.activeNotes = Theory.getActiveNotes(state.rootChroma, formula);

  // Hmatník — předáme useFlats jako override
  state.fretboard = Theory.buildFretboard(
    state.tuningMidi, state.fretCount, state.notation,
    state.activeNotes, state.rootChroma, state.useFlats
  );
}

// ─── Aktualizace stavu ────────────────────────────────────────────────────────

// Klíče ovlivňující živý náhled
// Instrument/tuningKey záměrně vynechány — změna nástroje nespouští auto-play
const LIVE_TRIGGERS = new Set([
  'rootChroma','chordKey','scaleKey','mode','livePlay','playOctave',
]);

// Transponuje MIDI voicing tak, aby root byl v cílové oktávě
function transposeToOctave(midiNotes, rootChroma, targetOctave) {
  if (!midiNotes.length) return midiNotes;
  const rootMidi = midiNotes.find(m => Theory.midiToChroma(m) === rootChroma);
  const baseMidi = rootMidi !== undefined ? rootMidi : midiNotes[0];
  const currentOctave = Math.floor(baseMidi / 12) - 1;
  const shift = (targetOctave - currentOctave) * 12;
  return midiNotes.map(m => m + shift);
}

function playLiveChord() {
  const midi = Theory.selectVoicingMidi(state.fretboard, state.activeNotes, 0);
  const shifted = transposeToOctave(midi, state.rootChroma, state.playOctave);
  Audio.playSustained(shifted, state.timbre);
}

function playLiveScale() {
  const midi = Theory.selectVoicingMidi(state.fretboard, state.activeNotes, 0);
  const shifted = transposeToOctave(midi, state.rootChroma, state.playOctave);
  Audio.playScale([...shifted].sort((a, b) => a - b), state.timbre);
}

function setState(patch) {
  Object.assign(state, patch);
  state.resolvedTheme = resolveTheme(state.theme);
  applyTheme(state.resolvedTheme);
  recompute();
  saveState();
  renderAll();

  // Živý náhled: přehraj pokud se právě něco přehrává, nebo pokud byl právě zapnut
  if (state.livePlay && Object.keys(patch).some(k => LIVE_TRIGGERS.has(k))) {
    const justEnabled = 'livePlay' in patch && patch.livePlay === true;
    if (justEnabled || Audio.isPlaying()) {
      if (state.mode === 'chord') playLiveChord();
      else playLiveScale();
    }
  }
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderAll() {
  const fbSvg  = document.getElementById('fretboard-svg');
  const cofSvg = document.getElementById('cof-svg');

  if (fbSvg) {
    Render.renderFretboard(fbSvg, state, (midi) => {
      Audio.playNote(midi, state.timbre);
    });
  }

  if (cofSvg) {
    const MINOR_SCALES = new Set(['Moll','Dorická','Frygická','Lokriánská','PentaMoll','Bluesová']);
    const MINOR_CHORDS = new Set(['Moll','m7','m6','dim']);
    const rootIsMajor = state.mode === 'scale'
      ? !MINOR_SCALES.has(state.scaleKey)
      : !MINOR_CHORDS.has(state.chordKey);

    const diatonicMajor = new Set();
    const diatonicMinor = new Set();
    if (state.mode === 'scale') {
      const nash = Theory.getNashvilleChords(state.rootChroma, state.scaleKey, state.notation);
      if (nash) {
        nash.forEach(n => {
          if (n.quality === 'Dur')       diatonicMajor.add(n.degreeChroma);
          else if (n.quality === 'Moll') diatonicMinor.add(n.degreeChroma);
        });
      }
    }
    Render.renderCircleOfFifths(cofSvg, state.rootChroma, state.notation, (chroma, isMajor) => {
      const patch = { rootChroma: chroma };
      if (state.mode === 'scale') patch.scaleKey = isMajor ? 'Dur' : 'Moll';
      else                        patch.chordKey = isMajor ? 'Dur' : 'Moll';
      setState(patch);
    }, diatonicMajor, diatonicMinor, rootIsMajor);
  }

  updateInfoPanel();
  syncControls();
}

// ─── Info panel ───────────────────────────────────────────────────────────────

function updateInfoPanel() {
  updateDescription();
  updateNashville();
  updateLegend();
}

function updateDescription() {
  const el = document.getElementById('info-description');
  if (!el) return;

  const uf = state.useFlats;
  const rootName = Theory.chromaToName(state.rootChroma, state.notation, uf);

  if (state.mode === 'chord') {
    const chord = Theory.CHORD_FORMULAS[state.chordKey];
    const title = `${rootName} ${chord.nameCz}`;
    const intervals = chord.intervals.map(i => {
      const info = Theory.INTERVAL_NAMES[i % 12];
      const noteCh = (state.rootChroma + i) % 12;
      const noteName = Theory.chromaToName(noteCh, state.notation, getUseFlats(noteCh));
      return `<span class="interval-tag" style="background:var(${Theory.INTERVAL_CSS_VAR[i % 12]})">${info.short} – ${noteName}</span>`;
    }).join(' ');

    el.innerHTML = `
      <h3>${title}</h3>
      <div class="interval-tags">${intervals}</div>
      <p>${chord.desc}</p>
    `;
  } else {
    const scale = Theory.SCALE_FORMULAS[state.scaleKey];
    const title = `${rootName} ${scale.nameCz}`;
    const intervals = scale.intervals.map(i => {
      const info = Theory.INTERVAL_NAMES[i % 12];
      const noteCh = (state.rootChroma + i) % 12;
      const noteName = Theory.chromaToName(noteCh, state.notation, getUseFlats(noteCh));
      return `<span class="interval-tag" style="background:var(${Theory.INTERVAL_CSS_VAR[i % 12]})">${info.short} – ${noteName}</span>`;
    }).join(' ');

    el.innerHTML = `
      <h3>${title}</h3>
      <div class="interval-tags">${intervals}</div>
      <p>${scale.char}</p>
    `;
  }
}

function updateNashville() {
  const el = document.getElementById('info-nashville');
  if (!el) return;

  const uf = state.useFlats;
  const rootName = Theory.chromaToName(state.rootChroma, state.notation, uf);

  if (state.mode === 'chord') {
    const chord = Theory.CHORD_FORMULAS[state.chordKey];
    el.innerHTML = `
      <h3>Složení akordu</h3>
      <p><strong>${rootName} ${chord.nameCz}</strong></p>
      <ul>
        ${chord.intervals.map(i => {
          const info = Theory.INTERVAL_NAMES[i % 12];
          const noteCh = (state.rootChroma + i) % 12;
          const noteName = Theory.chromaToName(noteCh, state.notation, getUseFlats(noteCh));
          return `<li><span class="nashville-numeral">${info.short}</span> ${info.cz} — <strong>${noteName}</strong></li>`;
        }).join('')}
      </ul>
      <p class="info-hint">Klikněte na tón v hmatníku pro přehrání.</p>
    `;
    return;
  }

  // Stupnice
  const nashville = Theory.getNashvilleChords(state.rootChroma, state.scaleKey, state.notation);
  const domInfo   = Theory.getDominantInfo(state.rootChroma, state.scaleKey, state.notation);

  if (!nashville) {
    // Pentatonika / bluesová — jen stupně
    const scale_ = Theory.SCALE_FORMULAS[state.scaleKey];
    const degrees = scale_.intervals.map(i => {
      const info = Theory.INTERVAL_NAMES[i % 12];
      const noteCh = (state.rootChroma + i) % 12;
      const noteName = Theory.chromaToName(noteCh, state.notation, getUseFlats(noteCh));
      return `<li><span class="nashville-numeral">${info.short}</span> ${info.cz} — <strong>${noteName}</strong></li>`;
    }).join('');
    el.innerHTML = `<h3>Stupně stupnice</h3><ul>${degrees}</ul>`;
    return;
  }

  const chordRows = nashville.map((n, i) => {
    const isDom = n.numeral === 'V';
    const role  = Theory.DEGREE_ROLES[i];
    return `<li class="${isDom ? 'nash-dominant' : ''}">
      <span class="nashville-numeral">${n.numeral}</span>
      <strong>${n.noteName} ${n.quality}</strong>
      <span class="nash-role">${role.name}</span>
    </li>`;
  }).join('');

  let secDomHtml = '';
  if (domInfo && domInfo.secondaryDominants.length) {
    secDomHtml = `
      <h4>Sekundární dominanty</h4>
      <ul class="sec-dom-list">
        ${domInfo.secondaryDominants.map(sd =>
          `<li>${sd.label}: <strong>${sd.chordName}</strong> → ${sd.targetNumeral} (${sd.targetNoteName} ${sd.targetQuality})</li>`
        ).join('')}
      </ul>
    `;
  }

  el.innerHTML = `
    <h3>Nashvillská notace</h3>
    <ul class="nashville-list">${chordRows}</ul>
    ${secDomHtml}
    <p class="info-hint">Tučně = primární dominant (V). Sekundární dominanty vedou k příslušnému stupni.</p>
  `;
}

function updateLegend() {
  const el = document.getElementById('interval-legend');
  if (!el) return;
  const activeIntervals = new Set(state.activeNotes.map(n => n.interval));
  Render.renderIntervalLegend(el, activeIntervals);
}

// ─── Synchronizace UI ─────────────────────────────────────────────────────────

function syncControls() {
  // Nástroj
  setActiveBtn('instrument-group', state.instrument);

  // Ladění
  const tuningSelect = document.getElementById('tuning-select');
  if (tuningSelect) {
    rebuildTuningOptions(tuningSelect);
    tuningSelect.value = state.tuningKey;
  }

  // Vlastní ladění — skrýt pokud není 'Vlastní'
  updateCustomTuningPickers();

  // Notace
  setActiveBtn('notation-group', state.notation);

  // Alterace
  setActiveBtn('accidentals-group', state.accidentals);

  // Počet pražců
  const slider = document.getElementById('fret-count');
  const display = document.getElementById('fret-count-display');
  if (slider)  slider.value = state.fretCount;
  if (display) display.textContent = state.fretCount;

  // Nelineární pražce
  const cbNL = document.getElementById('nonlinear-check');
  if (cbNL) cbNL.checked = state.nonLinearFrets;

  // Záložky
  document.getElementById('tab-chord')?.classList.toggle('active', state.mode === 'chord');
  document.getElementById('tab-scale')?.classList.toggle('active', state.mode === 'scale');
  const chordPanel = document.getElementById('chord-panel');
  const scalePanel = document.getElementById('scale-panel');
  if (chordPanel) chordPanel.hidden = state.mode !== 'chord';
  if (scalePanel) scalePanel.hidden = state.mode !== 'scale';

  // Základní tón
  syncRootPicker();

  // Typy (data-value)
  setActiveBtn('chord-type-group', state.chordKey);
  setActiveBtn('scale-type-group', state.scaleKey);

  // Timbre
  setActiveBtn('timbre-group', state.timbre);

  // Barvy not
  setActiveBtn('color-mode-group', state.colorMode);

  // Oktáva přehrávání (slider)
  const octSlider = document.getElementById('play-octave');
  const octDisplay = document.getElementById('play-octave-display');
  if (octSlider) octSlider.value = state.playOctave;
  if (octDisplay) octDisplay.textContent = state.playOctave;

  // Délka tónu
  setActiveBtn('play-duration-group', state.playDuration);

  // Živý náhled
  const liveCb = document.getElementById('live-play-check');
  if (liveCb) liveCb.checked = state.livePlay;

  // Hlasitost
  const volSlider = document.getElementById('volume-slider');
  const volDisplay = document.getElementById('volume-display');
  if (volSlider)  volSlider.value = state.volume;
  if (volDisplay) volDisplay.textContent = state.volume;
  Audio.setVolume(state.volume / 100);

  // Tlačítko přehrát
  const playBtn = document.getElementById('play-btn');
  if (playBtn) playBtn.textContent = state.mode === 'chord' ? '▶ Přehrát akord' : '▶ Přehrát stupnici';
}

// Nastaví active class na tlačítka skupiny dle data-value
function setActiveBtn(groupId, value) {
  const group = document.getElementById(groupId);
  if (!group) return;
  group.querySelectorAll('[data-value]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === String(value));
  });
}

function syncRootPicker() {
  const picker = document.getElementById('root-picker');
  if (!picker) return;
  picker.querySelectorAll('[data-value]').forEach(btn => {
    const ch = +btn.dataset.value;
    btn.classList.toggle('active', ch === state.rootChroma);
    btn.textContent = Theory.chromaToName(ch, state.notation, getUseFlats(ch));
  });
}

function rebuildTuningOptions(select) {
  const tunings = Theory.TUNINGS[state.instrument];
  select.innerHTML = '';
  for (const key of Object.keys(tunings)) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = key;
    select.appendChild(opt);
  }
  const vlastniOpt = document.createElement('option');
  vlastniOpt.value = 'Vlastní';
  vlastniOpt.textContent = 'Vlastní';
  select.appendChild(vlastniOpt);
}

function updateCustomTuningPickers() {
  const container = document.getElementById('custom-tuning-pickers');
  if (!container) return;

  if (state.tuningKey !== 'Vlastní') {
    container.hidden = true;
    return;
  }
  container.hidden = false;
  container.innerHTML = '';

  const stringCount = state.tuningMidi.length;
  const notationList = state.notation === 'czech' ? Theory.NOTES_CZECH_SHARP : Theory.NOTES_INTERNATIONAL;

  for (let s = stringCount - 1; s >= 0; s--) {
    const midi   = state.tuningMidi[s] ?? 40;
    const chroma = Theory.midiToChroma(midi);
    const octave = Math.floor(midi / 12) - 1;

    const row = document.createElement('div');
    row.className = 'tuning-row';

    const label = document.createElement('span');
    label.textContent = `Struna ${s + 1}:`;
    row.appendChild(label);

    const noteSelect = document.createElement('select');
    notationList.forEach((n, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = n;
      if (i === chroma) opt.selected = true;
      noteSelect.appendChild(opt);
    });
    row.appendChild(noteSelect);

    const octSelect = document.createElement('select');
    for (let o = 0; o <= 6; o++) {
      const opt = document.createElement('option');
      opt.value = o;
      opt.textContent = `Okt. ${o}`;
      if (o === octave) opt.selected = true;
      octSelect.appendChild(opt);
    }
    row.appendChild(octSelect);

    row.addEventListener('change', () => {
      const newMidi   = +noteSelect.value + (+octSelect.value + 1) * 12;
      const newTuning = [...(state.customTuning || state.tuningMidi)];
      newTuning[s] = newMidi;
      setState({ customTuning: newTuning });
    });

    container.appendChild(row);
  }
}

// ─── Sestavení statické UI ────────────────────────────────────────────────────

function buildRootPicker() {
  const picker = document.getElementById('root-picker');
  if (!picker) return;
  picker.innerHTML = '';
  for (const ch of ROOT_ORDER) {
    const btn = document.createElement('button');
    btn.dataset.value = ch;   // data-value (ne data-chroma)
    btn.textContent = Theory.chromaToName(ch, state.notation, getUseFlats(ch));
    btn.className = ch === state.rootChroma ? 'root-btn active' : 'root-btn';
    picker.appendChild(btn);
  }
}

function buildInstrumentGroup() {
  const group = document.getElementById('instrument-group');
  if (!group) return;
  group.innerHTML = '';
  for (const [key, label] of Object.entries(Theory.INSTRUMENT_LABELS)) {
    const btn = document.createElement('button');
    btn.dataset.value = key;
    btn.textContent = label;
    btn.className = key === state.instrument ? 'active' : '';
    group.appendChild(btn);
  }
}

function buildChordTypeGroup() {
  const group = document.getElementById('chord-type-group');
  if (!group) return;
  group.innerHTML = '';
  for (const [key, val] of Object.entries(Theory.CHORD_FORMULAS)) {
    const btn = document.createElement('button');
    btn.dataset.value = key;
    btn.textContent = val.label || key;
    btn.title = val.nameCz;
    btn.className = key === state.chordKey ? 'active' : '';
    group.appendChild(btn);
  }
}

function buildScaleTypeGroup() {
  const group = document.getElementById('scale-type-group');
  if (!group) return;
  group.innerHTML = '';
  for (const [key, val] of Object.entries(Theory.SCALE_FORMULAS)) {
    const btn = document.createElement('button');
    btn.dataset.value = key;   // OPRAVA: data-value, ne data-key
    btn.textContent = val.nameCz;
    btn.className = key === state.scaleKey ? 'active' : '';
    group.appendChild(btn);
  }
}

// ─── Event binding ────────────────────────────────────────────────────────────

function bindEvents() {
  // Nástroj
  document.getElementById('instrument-group')?.addEventListener('click', e => {
    const val = e.target.dataset.value;
    if (val) setState({ instrument: val, tuningKey: 'Standardní', customTuning: null });
  });

  // Ladění
  document.getElementById('tuning-select')?.addEventListener('change', e => {
    const tuningKey = e.target.value;
    const customTuning = tuningKey === 'Vlastní' ? [...state.tuningMidi] : null;
    setState({ tuningKey, customTuning });
  });

  // Notace
  document.getElementById('notation-group')?.addEventListener('click', e => {
    const val = e.target.dataset.value;
    if (val) setState({ notation: val });
  });

  // Alterace (#/♭/Auto)
  document.getElementById('accidentals-group')?.addEventListener('click', e => {
    const val = e.target.dataset.value;
    if (val) setState({ accidentals: val });
  });

  // Počet pražců
  document.getElementById('fret-count')?.addEventListener('input', e => {
    const fretCount = +e.target.value;
    const display = document.getElementById('fret-count-display');
    if (display) display.textContent = fretCount;
    setState({ fretCount });
  });

  // Nelineární pražce
  document.getElementById('nonlinear-check')?.addEventListener('change', e => {
    setState({ nonLinearFrets: e.target.checked });
  });

  // Záložky
  document.getElementById('tab-chord')?.addEventListener('click', () => setState({ mode: 'chord' }));
  document.getElementById('tab-scale')?.addEventListener('click', () => setState({ mode: 'scale' }));

  // Základní tón — data-value (pořadí od A)
  document.getElementById('root-picker')?.addEventListener('click', e => {
    const val = e.target.dataset.value;
    if (val !== undefined) setState({ rootChroma: +val });
  });

  // Typ akordu — data-value
  document.getElementById('chord-type-group')?.addEventListener('click', e => {
    const val = e.target.dataset.value;
    if (val) setState({ chordKey: val });
  });

  // Typ stupnice — data-value
  document.getElementById('scale-type-group')?.addEventListener('click', e => {
    const val = e.target.dataset.value;
    if (val) setState({ scaleKey: val });
  });

  // Téma
  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const next = state.resolvedTheme === 'light' ? 'dark' : 'light';
    setState({ theme: next });
  });

  // Přehrávání
  document.getElementById('play-btn')?.addEventListener('click', () => {
    const CHORD_DUR = { short: 0.7, normal: 2.5, long: 6.0 };
    const SCALE_DUR = { short: 0.4, normal: 1.0, long: 2.5 };
    const midi = Theory.selectVoicingMidi(state.fretboard, state.activeNotes, 0);
    const shifted = transposeToOctave(midi, state.rootChroma, state.playOctave);
    if (state.mode === 'scale') {
      // Stupnice vždy tón po tónu, seřazená vzestupně
      const sorted = [...shifted].sort((a, b) => a - b);
      Audio.playScale(sorted, state.timbre, SCALE_DUR[state.playDuration] ?? 1.0);
    } else if (state.playDuration === 'long') {
      Audio.playSustained(shifted, state.timbre);
    } else {
      Audio.playChord(shifted, state.timbre, CHORD_DUR[state.playDuration] ?? 2.5);
    }
  });

  document.getElementById('stop-btn')?.addEventListener('click', () => Audio.stopAll());

  // Timbre — při změně za přehrávání okamžitě restartuje, jinak jen uloží
  document.getElementById('timbre-group')?.addEventListener('click', e => {
    const val = e.target.dataset.value;
    if (!val) return;
    setState({ timbre: val });
    if (Audio.isPlaying()) {
      if (state.mode === 'chord') playLiveChord();
      else playLiveScale();
    }
  });

  // Barvy not
  document.getElementById('color-mode-group')?.addEventListener('click', e => {
    const val = e.target.dataset.value;
    if (val) setState({ colorMode: val });
  });

  // Oktáva přehrávání (slider)
  document.getElementById('play-octave')?.addEventListener('input', e => {
    const playOctave = +e.target.value;
    const display = document.getElementById('play-octave-display');
    if (display) display.textContent = playOctave;
    setState({ playOctave });
  });

  // Živý náhled
  document.getElementById('live-play-check')?.addEventListener('change', e => {
    setState({ livePlay: e.target.checked });
    if (!e.target.checked) Audio.stopAll();
  });

  // Délka tónu
  document.getElementById('play-duration-group')?.addEventListener('click', e => {
    const val = e.target.dataset.value;
    if (val) setState({ playDuration: val });
  });

  // Hlasitost — bez setState, jen aktualizuj audio a ulož
  document.getElementById('volume-slider')?.addEventListener('input', e => {
    const volume = +e.target.value;
    const display = document.getElementById('volume-display');
    if (display) display.textContent = volume;
    state.volume = volume;
    saveState();
    Audio.setVolume(volume / 100);
  });


  // System theme change
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (state.theme === 'auto') {
      state.resolvedTheme = resolveTheme('auto');
      applyTheme(state.resolvedTheme);
    }
  });
}

// ─── Inicializace ─────────────────────────────────────────────────────────────

function init() {
  loadState();
  state.resolvedTheme = resolveTheme(state.theme);
  applyTheme(state.resolvedTheme);

  buildInstrumentGroup();
  buildRootPicker();
  buildChordTypeGroup();
  buildScaleTypeGroup();

  bindEvents();
  recompute();
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);
