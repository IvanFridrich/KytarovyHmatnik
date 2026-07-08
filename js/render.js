'use strict';

// ─── Konstanty hmatníku ───────────────────────────────────────────────────────

const FB = {
  STRING_SPACING:  80,
  NUT_WIDTH:       12,
  LABEL_LEFT:      80,
  PAD_TOP:         70,
  PAD_BOTTOM:      44,
  FRET_NUM_H:      30,
  NOTE_R_GHOST:    20,
  NOTE_R_ACTIVE:   26,
  NOTE_R_ROOT:     28,
  MARKER_R:        12,
  BOARD_FRET_W:    80,
};

const MARKER_FRETS_SINGLE = new Set([3,5,7,9,15,17,19,21]);
const MARKER_FRETS_DOUBLE = new Set([12,24]);

// ─── Souřadnice ───────────────────────────────────────────────────────────────

function buildCoords(state) {
  const { fretCount, nonLinearFrets } = state;
  const stringCount = state.tuningMidi.length;
  const boardW = fretCount * FB.BOARD_FRET_W;

  // Pozice pražcového drátu f (0 = kobylka/nut)
  function wireX(f) {
    if (f === 0) return FB.LABEL_LEFT + FB.NUT_WIDTH;
    if (!nonLinearFrets) {
      return FB.LABEL_LEFT + FB.NUT_WIDTH + f * FB.BOARD_FRET_W;
    }
    const total = 1 - Math.pow(2, -fretCount / 12);
    return FB.LABEL_LEFT + FB.NUT_WIDTH + (1 - Math.pow(2, -f / 12)) / total * boardW;
  }

  // Střed pražcového okénka f (1–fretCount)
  function noteX(f) {
    return (wireX(f - 1) + wireX(f)) / 2;
  }

  // Y souřadnice struny (i=0 nejnižší = dole v SVG = největší y)
  function stringY(i) {
    return FB.PAD_TOP + (stringCount - 1 - i) * FB.STRING_SPACING;
  }

  const viewBoxW = wireX(fretCount) + 20;
  const viewBoxH = FB.PAD_TOP + (stringCount - 1) * FB.STRING_SPACING + FB.PAD_BOTTOM + FB.FRET_NUM_H;

  return { wireX, noteX, stringY, viewBoxW, viewBoxH, stringCount, fretCount, boardW };
}

// ─── SVG pomocníci ────────────────────────────────────────────────────────────

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function svgText(text, attrs = {}) {
  const el = svgEl('text', attrs);
  el.textContent = text;
  return el;
}

// ─── Hmatník ─────────────────────────────────────────────────────────────────

function renderFretboard(svgEl_, state, onNoteClick) {
  svgEl_.innerHTML = '';
  const coords = buildCoords(state);
  const { wireX, noteX, stringY, viewBoxW, viewBoxH, stringCount, fretCount } = coords;
  const { fretboard, notation } = state;

  svgEl_.setAttribute('viewBox', `0 0 ${viewBoxW} ${viewBoxH}`);
  svgEl_.setAttribute('width',  '100%');
  svgEl_.removeAttribute('height');

  const boardTop    = FB.PAD_TOP;
  const boardBottom = FB.PAD_TOP + (stringCount - 1) * FB.STRING_SPACING;
  const boardMidY   = (boardTop + boardBottom) / 2;

  // Pozadí hmatníku
  const bgRect = svgEl('rect', {
    x: FB.LABEL_LEFT, y: boardTop - 4,
    width: wireX(fretCount) - FB.LABEL_LEFT,
    height: boardBottom - boardTop + 8,
    rx: 4,
  });
  bgRect.style.fill = 'var(--fb-wood)';
  svgEl_.appendChild(bgRect);

  // Pražcové dráty
  for (let f = 1; f <= fretCount; f++) {
    const x = wireX(f);
    const line = svgEl('line', { x1: x, y1: boardTop - 2, x2: x, y2: boardBottom + 2 });
    line.style.stroke = 'var(--fb-fret-wire)';
    line.style.strokeWidth = f === 12 ? 4 : 2.5;
    svgEl_.appendChild(line);
  }

  // Kobylka (nut)
  const nut = svgEl('rect', {
    x: FB.LABEL_LEFT, y: boardTop - 4,
    width: FB.NUT_WIDTH, height: boardBottom - boardTop + 8,
    rx: 2,
  });
  nut.style.fill = 'var(--fb-nut)';
  svgEl_.appendChild(nut);

  // Struny
  const isGuitar = state.instrument === 'guitar';
  const strMinW  = isGuitar ? 0.6 : 1.5;
  const strRange = isGuitar ? 1.6 : 2.5;
  for (let s = 0; s < stringCount; s++) {
    const y = stringY(s);
    const strokeW = strMinW + (stringCount - 1 - s) / (stringCount - 1) * strRange;
    const line = svgEl('line', {
      x1: FB.LABEL_LEFT, y1: y,
      x2: wireX(fretCount), y2: y,
    });
    line.style.stroke = 'var(--fb-string)';
    line.style.strokeWidth = strokeW;
    svgEl_.appendChild(line);
  }

  // Poziční značky — vždy uprostřed hmatníku
  const markerY = boardMidY;
  for (let f = 1; f <= fretCount; f++) {
    const cx = noteX(f);
    if (MARKER_FRETS_SINGLE.has(f)) {
      const dot = svgEl('circle', { cx, cy: markerY, r: FB.MARKER_R });
      dot.style.fill = 'var(--fb-marker)';
      svgEl_.appendChild(dot);
    } else if (MARKER_FRETS_DOUBLE.has(f)) {
      const off = FB.STRING_SPACING * 0.85;
      for (const dy of [-off, off]) {
        const dot = svgEl('circle', { cx, cy: markerY + dy, r: FB.MARKER_R });
        dot.style.fill = 'var(--fb-marker)';
        svgEl_.appendChild(dot);
      }
    }
  }

  // Čísla pražců — každý pražec, tučně u důležitých pozic
  const FRET_BOLD = new Set([3,5,7,9,12,15,17,19,21,24]);
  for (let f = 1; f <= fretCount; f++) {
    const isBold = FRET_BOLD.has(f);
    const tx = svgText(String(f), {
      x: noteX(f), y: boardBottom + FB.PAD_BOTTOM + 4,
      'text-anchor': 'middle',
      'font-size': isBold ? 24 : 18,
      'font-weight': isBold ? 'bold' : 'normal',
    });
    tx.style.fill = isBold ? 'var(--text-primary)' : 'var(--text-secondary)';
    svgEl_.appendChild(tx);
  }

  // Tooltip div (mimo SVG)
  const tooltip = document.getElementById('tooltip');

  // Nota kroužky
  for (let s = 0; s < stringCount; s++) {
    if (!fretboard[s]) continue;
    for (let f = 0; f <= fretCount; f++) {
      const note = fretboard[s][f];
      if (!note) continue;

      const cx = f === 0
        ? Math.round(FB.LABEL_LEFT / 2)   // vycentrováno v prostoru před kobylkou
        : noteX(f);
      const cy = stringY(s);

      const g = svgEl('g');
      g.style.cursor = 'pointer';

      const byTone = (state.colorMode === 'tone');
      const hue    = note.chroma * 30;  // 0..330° na barevném kole

      let r, fillColor, strokeColor, textFill, fontWeight;

      if (note.isRoot) {
        r           = FB.NOTE_R_ROOT;
        fillColor   = byTone ? `hsl(${hue},85%,var(--tone-root-l))` : 'var(--root-fill)';
        strokeColor = byTone ? `hsl(${hue},85%,var(--tone-root-dk))` : 'var(--root-stroke)';
        textFill    = 'var(--root-text)';
        fontWeight  = 'bold';
      } else if (note.isActive) {
        r           = FB.NOTE_R_ACTIVE;
        fillColor   = byTone ? `hsl(${hue},72%,var(--tone-active-l))` : `var(${Theory.INTERVAL_CSS_VAR[note.interval]})`;
        strokeColor = null;
        textFill    = 'var(--note-text-active)';
        fontWeight  = '600';
      } else {
        r           = FB.NOTE_R_GHOST;
        fillColor   = 'var(--ghost-fill)';
        strokeColor = null;
        textFill    = 'var(--text-primary)';
        fontWeight  = '600';
      }

      const circle = svgEl('circle', { cx, cy, r });
      circle.style.fill    = fillColor;
      circle.style.opacity = note.isActive || note.isRoot ? '1' : '0.55';
      if (strokeColor) {
        circle.style.stroke      = strokeColor;
        circle.style.strokeWidth = '2.5';
      }
      g.appendChild(circle);

      // Lem pentatonického boxu — barevný kroužek okolo noty (tón na švu má dva)
      const boxIdxs = state.boxHighlight && state.boxHighlight.get(s + ':' + f);
      if (boxIdxs) {
        boxIdxs.slice(0, 2).forEach((bi, ring) => {
          const ringC = svgEl('circle', { cx, cy, r: r + 5 + ring * 7 });
          ringC.style.fill = 'none';
          ringC.style.stroke = `var(--penta-box-${bi + 1})`;
          ringC.style.strokeWidth = '5.5';
          ringC.style.pointerEvents = 'none';
          g.appendChild(ringC);
        });
      }

      // Text uvnitř kroužku — jméno noty + číslo oktávy
      const octaveNum = Math.floor(note.midi / 12) - 1;
      const fontSize = note.isRoot ? 22 : note.isActive ? 18 : 16;
      const baseName = note.name.length <= 3 ? note.name : note.name.slice(0, 3);
      const label = baseName + octaveNum;
      const tx = svgEl('text', {
        x: cx, y: cy + fontSize * 0.38,
        'text-anchor': 'middle',
        'font-size': fontSize,
        'font-weight': fontWeight,
      });
      tx.style.fill = textFill;
      tx.style.pointerEvents = 'none';
      tx.style.userSelect = 'none';
      tx.textContent = label;
      g.appendChild(tx);

      // Hover tooltip — interval + struna podle noty + frekvence dole
      g.addEventListener('mouseenter', (e) => {
        if (!tooltip) return;
        const chromaInt = ((note.chroma - state.rootChroma) + 12) % 12;
        const info = Theory.INTERVAL_NAMES[chromaInt];
        const inScale = note.interval !== null;
        const outsideLabel = state.mode === 'chord' ? 'mimo akord' : 'mimo stupnici';
        const intervalStr = inScale
          ? `${info.cz} (${info.short})`
          : `${info.cz} (${info.short}) — ${outsideLabel}`;
        const freq = Theory.midiToFreq(note.midi).toFixed(1);
        const openMidi    = state.tuningMidi[s];
        const openChroma  = Theory.midiToChroma(openMidi);
        const openOct     = Math.floor(openMidi / 12) - 1;
        const openUseFlats = Theory.prefersFlats(openChroma);
        const openNote    = Theory.chromaToName(openChroma, state.notation, openUseFlats) + openOct;
        tooltip.innerHTML =
          `<strong>${note.name}${octaveNum}</strong><br>` +
          `Interval: ${intervalStr}<br>` +
          `Str. ${openNote} · Pražec ${f}<br>` +
          `<span class="tooltip-freq">${freq} Hz</span>`;
        tooltip.hidden = false;
        positionTooltip(e, tooltip);
      });
      g.addEventListener('mousemove', (e) => positionTooltip(e, tooltip));
      g.addEventListener('mouseleave', () => { if (tooltip) tooltip.hidden = true; });

      // Klik = přehrát
      g.addEventListener('click', () => onNoteClick && onNoteClick(note.midi));

      svgEl_.appendChild(g);
    }
  }
}

function positionTooltip(e, tooltip) {
  tooltip.style.left = (e.clientX + 14) + 'px';
  tooltip.style.top  = Math.max(4, e.clientY - 48) + 'px';
}

// ─── Kruh kvint ───────────────────────────────────────────────────────────────

const COF = {
  CX: 150, CY: 150,
  R_OUTER_OUT: 140, R_OUTER_IN: 100,
  R_INNER_OUT: 98,  R_INNER_IN: 62,
};

function sectorPath(cx, cy, r1, r2, startDeg, endDeg) {
  const toRad = d => d * Math.PI / 180;
  const sx1 = cx + r2 * Math.cos(toRad(startDeg));
  const sy1 = cy + r2 * Math.sin(toRad(startDeg));
  const ex2 = cx + r2 * Math.cos(toRad(endDeg));
  const ey2 = cy + r2 * Math.sin(toRad(endDeg));
  const ex3 = cx + r1 * Math.cos(toRad(endDeg));
  const ey3 = cy + r1 * Math.sin(toRad(endDeg));
  const sx4 = cx + r1 * Math.cos(toRad(startDeg));
  const sy4 = cy + r1 * Math.sin(toRad(startDeg));
  return `M ${sx1} ${sy1} A ${r2} ${r2} 0 0 1 ${ex2} ${ey2} L ${ex3} ${ey3} A ${r1} ${r1} 0 0 0 ${sx4} ${sy4} Z`;
}

function labelPos(cx, cy, r, angleDeg) {
  const rad = angleDeg * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function renderCircleOfFifths(svgEl_, currentRootChroma, notation, onSectorClick,
                              diatonicMajor = new Set(), diatonicMinor = new Set(), rootIsMajor = true, useFlats = false) {
  svgEl_.innerHTML = '';

  const rootPf = useFlats;
  const cof = Theory.getCircleOfFifths(notation);

  cof.forEach((entry, i) => {
    const centerAngle = entry.angle;
    const startAngle  = centerAngle - 15;
    const endAngle    = centerAngle + 15;
    const isMajorActive   = rootIsMajor  && entry.chroma      === currentRootChroma;
    const isMinorActive   = !rootIsMajor && entry.minorChroma === currentRootChroma;
    const isMajorDiatonic = !isMajorActive && diatonicMajor.has(entry.chroma);
    const isMinorDiatonic = !isMinorActive && diatonicMinor.has(entry.minorChroma);

    const outerLabel = Theory.chromaToName(entry.chroma, notation, rootPf);
    const innerLabel = Theory.chromaToName(entry.minorChroma, notation, rootPf) + 'm';

    // Vnější (dur) sektor
    const outerPath = svgEl('path', {
      d: sectorPath(COF.CX, COF.CY, COF.R_OUTER_IN, COF.R_OUTER_OUT, startAngle, endAngle),
    });
    outerPath.style.fill   = isMajorActive   ? 'var(--cof-active)'
                           : isMajorDiatonic  ? 'var(--cof-diatonic)'
                           : 'var(--cof-sector)';
    outerPath.style.stroke = 'var(--cof-stroke)';
    outerPath.style.strokeWidth = '1.5';
    outerPath.style.cursor = 'pointer';
    outerPath.addEventListener('click', () => onSectorClick && onSectorClick(entry.chroma, true));
    svgEl_.appendChild(outerPath);

    // Vnitřní (moll) sektor
    const innerPath = svgEl('path', {
      d: sectorPath(COF.CX, COF.CY, COF.R_INNER_IN, COF.R_INNER_OUT, startAngle, endAngle),
    });
    innerPath.style.fill   = isMinorActive   ? 'var(--cof-active-minor)'
                           : isMinorDiatonic  ? 'var(--cof-diatonic-minor)'
                           : 'var(--cof-sector-minor)';
    innerPath.style.stroke = 'var(--cof-stroke)';
    innerPath.style.strokeWidth = '1';
    innerPath.style.cursor = 'pointer';
    innerPath.addEventListener('click', () => onSectorClick && onSectorClick(entry.minorChroma, false));
    svgEl_.appendChild(innerPath);

    // Popisek dur (vnější)
    const outerR = (COF.R_OUTER_OUT + COF.R_OUTER_IN) / 2;
    const outerPos = labelPos(COF.CX, COF.CY, outerR, centerAngle);
    const outerTx = svgEl('text', {
      x: outerPos.x, y: outerPos.y + 4,
      'text-anchor': 'middle',
      'font-size': 13,
      'font-weight': isMajorActive ? 'bold' : isMajorDiatonic ? '600' : '500',
    });
    outerTx.textContent = outerLabel;
    outerTx.style.fill = isMajorActive ? 'var(--cof-text-active)' : 'var(--cof-text)';
    outerTx.style.pointerEvents = 'none';
    outerTx.style.userSelect = 'none';
    svgEl_.appendChild(outerTx);

    // Popisek moll (vnitřní) — zkráceno + "m"
    const innerR = (COF.R_INNER_OUT + COF.R_INNER_IN) / 2;
    const innerPos = labelPos(COF.CX, COF.CY, innerR, centerAngle);
    const innerTx = svgEl('text', {
      x: innerPos.x, y: innerPos.y + 3,
      'text-anchor': 'middle',
      'font-size': 10,
    });
    innerTx.textContent = innerLabel;
    innerTx.style.fill = isMinorActive ? 'var(--cof-text-active)' : 'var(--cof-text-minor)';
    innerTx.style.pointerEvents = 'none';
    innerTx.style.userSelect = 'none';
    svgEl_.appendChild(innerTx);
  });

  // Středový kroužek — legenda
  const center = svgEl('circle', { cx: COF.CX, cy: COF.CY, r: COF.R_INNER_IN - 2 });
  center.style.fill = 'var(--bg-card)';
  center.style.stroke = 'var(--cof-stroke)';
  svgEl_.appendChild(center);

  const centerTx = svgEl('text', { x: COF.CX, y: COF.CY - 8, 'text-anchor': 'middle', 'font-size': 9 });
  centerTx.textContent = 'Dur';
  centerTx.style.fill = 'var(--text-secondary)';
  svgEl_.appendChild(centerTx);

  const centerTx2 = svgEl('text', { x: COF.CX, y: COF.CY + 6, 'text-anchor': 'middle', 'font-size': 9 });
  centerTx2.textContent = 'Moll';
  centerTx2.style.fill = 'var(--text-secondary)';
  svgEl_.appendChild(centerTx2);
}

// ─── Legenda intervalů ────────────────────────────────────────────────────────

// activeIntervals: Set<number> — pouze přítomné intervaly
function renderIntervalLegend(container, activeIntervals) {
  container.innerHTML = '';
  if (!activeIntervals || activeIntervals.size === 0) return;

  // Seřadit od 0 do 11, zobrazit jen aktivní
  for (let i = 0; i <= 11; i++) {
    if (!activeIntervals.has(i)) continue;
    const info = Theory.INTERVAL_NAMES[i];
    const item = document.createElement('div');
    item.className = 'legend-item';

    const dot = document.createElement('span');
    dot.className = 'legend-dot';
    dot.style.background = `var(${Theory.INTERVAL_CSS_VAR[i]})`;

    const tx = document.createElement('span');
    tx.textContent = `${info.short} — ${info.cz}`;

    item.appendChild(dot);
    item.appendChild(tx);
    container.appendChild(item);
  }
}

// ─── Notová osnova basové linky (VexFlow) ─────────────────────────────────────

function renderNotation(container, events, fifths) {
  container.innerHTML = '';

  if (typeof Vex === 'undefined' || !Vex.Flow) {
    container.innerHTML = '<p class="notation-empty">Notový zápis se nepodařilo načíst (VexFlow).</p>';
    return;
  }
  if (fifths === null || fifths === undefined) {
    container.innerHTML = '<p class="notation-empty">Nejdřív vyber předznamenání.</p>';
    return;
  }
  if (!events || !events.length) {
    container.innerHTML = '<p class="notation-empty">Zatím prázdné — vyber délku a klikni na noty v hmatníku.</p>';
    return;
  }

  const VF = Vex.Flow;
  const sig   = Theory.KEY_SIGNATURES.find(k => k.fifths === fifths) || { vfKey: 'C' };
  const vfKey = sig.vfKey;
  const measures = Theory.fitToMeasures(events);

  const containerW = Math.max(320, container.clientWidth || 800);
  const PAD = 10;
  const ROW_H = 130;

  // První takt navíc na klíč + taktové označení + předznamenání
  const firstExtra = 70 + Math.abs(fifths) * 12;
  const mWidths = measures.map((m, i) =>
    Math.min(360, Math.max(150, 70 + m.length * 34)) + (i === 0 ? firstExtra : 0));

  // Rozvržení do řádků (zalamování)
  let x = PAD, y = PAD;
  const pos = [];
  for (let i = 0; i < measures.length; i++) {
    if (x + mWidths[i] > containerW - PAD && x > PAD) { x = PAD; y += ROW_H; }
    pos.push({ x, y, w: mWidths[i] });
    x += mWidths[i];
  }
  const totalH = y + ROW_H;

  let renderer, context;
  try {
    renderer = new VF.Renderer(container, VF.Renderer.Backends.SVG);
    renderer.resize(containerW, totalH);
    context = renderer.getContext();
  } catch (err) {
    container.innerHTML = '<p class="notation-empty">Chyba vykreslení osnovy.</p>';
    return;
  }

  // Pass 1: sestavit osnovy, noty, hlasy, ligatury
  const built = [];
  const allVoices = [];
  measures.forEach((measure, mi) => {
    const p = pos[mi];
    const stave = new VF.Stave(p.x, p.y, p.w);
    if (mi === 0) stave.addClef('bass').addTimeSignature('4/4').addKeySignature(vfKey);

    const notes = measure.map(piece => {
      const vfBase = Theory.DURATIONS[piece.dur].vf;
      const dotStr = piece.dot ? 'd' : '';
      if (piece.kind === 'rest') {
        return new VF.StaveNote({ clef: 'bass', keys: ['d/3'], duration: vfBase + dotStr + 'r' });
      }
      const n = Theory.midiToNotated(piece.midi, fifths);
      const suffix = n.alter === 1 ? '#' : n.alter === -1 ? 'b' : '';
      const key = n.step.toLowerCase() + suffix + '/' + n.octave;
      return new VF.StaveNote({ clef: 'bass', keys: [key], duration: vfBase + dotStr });
    });

    // Vykreslit augmentační tečky (duration 'd' řeší doby, tohle glyph)
    const dotted = notes.filter((_, idx) => measure[idx].dot);
    if (dotted.length) { try { VF.Dot.buildAndAttach(dotted, { all: true }); } catch (err) {} }

    // Ligatury uvnitř taktu (přechod přes taktovou čáru se vizuálně vynechá)
    const ties = [];
    for (let j = 0; j < measure.length - 1; j++) {
      if (measure[j].kind === 'note' && measure[j].tieStart && measure[j + 1].tieStop) {
        ties.push(new VF.StaveTie({
          first_note: notes[j], last_note: notes[j + 1],
          first_indices: [0], last_indices: [0],
        }));
      }
    }

    const voice = new VF.Voice({ num_beats: 4, beat_value: 4 }).setStrict(false);
    voice.addTickables(notes);
    allVoices.push(voice);
    built.push({ stave, notes, voice, ties, isFirst: mi === 0 });
  });

  // Posuvky automaticky dle předznamenání (odrážky pro noty mimo tóninu,
  // potlačení opakovaných posuvek v rámci taktu). Musí být PŘED formátováním.
  try { VF.Accidental.applyAccidentals(allVoices, vfKey); } catch (err) {}

  // Pass 2: formátovat + vykreslit
  built.forEach(b => {
    b.stave.setContext(context).draw();
    try {
      const beams = VF.Beam.generateBeams(b.notes);
      const inset = b.isFirst ? firstExtra + 20 : 25;
      new VF.Formatter().joinVoices([b.voice]).format([b.voice], b.stave.getWidth() - inset);
      b.voice.draw(context, b.stave);
      beams.forEach(bm => bm.setContext(context).draw());
      b.ties.forEach(t => t.setContext(context).draw());
    } catch (err) {
      /* jednotlivý takt se nevykreslil — pokračuj dál */
    }
  });
}

const Render = {
  renderFretboard,
  renderCircleOfFifths,
  renderIntervalLegend,
  renderNotation,
};
