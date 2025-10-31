/**
 * === VolleyVision: p5.js video annotation for volleyball sets ===
 *
 * Loads a training MP4, guides the user through a 4-click net calibration,
 * records ball trails by clicking the video, and computes per-rep metrics:
 *   - Peak height (m) and cm above net
 *   - Horizontal width (m) and left/right direction
 * A dashboard and a stats table are shown when the video finishes.
 */

// ------------------------------ Global constants ------------------------------

const NET_HEIGHT_M = 2.43; // Men’s beach volleyball net height in metres

// ------------------------------ Video state -----------------------------------

let vid;             // p5.MediaElement that wraps the underlying <video>
let ready = false;   // True once a decodable video frame is available
let warmed = false;  // True after a brief play/pause to “prime” the first frame
let started = false; // True after playback begins post-calibration

// ------------------------------ Rep data --------------------------------------

/**
 * A rep = one coloured trail with computed metrics.
 * current = the rep being drawn; trails = completed reps.
 */
let trails = [];                           // All reps finished so far
let current = { points: [], color: null }; // Points clicked for the current rep

let showAllAtEnd = false; // If true (on ended), reveal all trails
let showTrails = true;    // Toggle to show/hide trails on end screen

// ------------------------------ Calibration -----------------------------------

/**
 * User clicks the net at: LB, LT, RB, RT.
 * From this we compute pixelsPerMeter and the top-tape line y = m*x + b.
 */
let calibStep = 0;                                        // 0..4 (4 = done)
let calibPts = { LB: null, LT: null, RB: null, RT: null };// Stores the 4 clicks
let pixelsPerMeter = null;                                // px per metre
let topLine = null;                                       // { m, b } for top tape

// ------------------------------ UI widgets ------------------------------------

let btnReplay, btnToggle, btnSnapshot, btnRestart, btnStats; // End-screen buttons
let statsDiv;                 // Div under canvas to display the stats table
let statsVisible = true;      // Whether the stats div is shown

// ------------------------------ Colour palette --------------------------------

/** Distinct colours to cycle through for each rep. */
const PALETTE = [
  [255, 80, 80],   // red
  [255, 160, 0],   // orange
  [255, 220, 0],   // yellow
  [0, 190, 255],   // sky
  [80, 220, 160],  // mint
  [180, 120, 255], // purple
  [255, 100, 200], // pink
];
let paletteIdx = 0; // Index into the palette
const nextColour = () => PALETTE[(paletteIdx++) % PALETTE.length].slice(); // Return a copy

// ------------------------------ Setup -----------------------------------------

function setup() {
  createCanvas(960, 540);         // 16:9 canvas to match the video
  textFont('system-ui');          // UI font

  // Create the hidden HTML5 <video>, load the file, and render frames via image()
  vid = createVideo('assets-stupid-training-720p.mp4', () => console.log('video element created'));
  vid.attribute('playsinline', ''); // iOS: keep inline playback
  vid.attribute('muted', '');       // Allow autoplay policies to pass
  vid.volume(0);                    // Ensure silence
  vid.hide();                       // Don’t show the DOM video; draw it to canvas instead

  // Mark as ready when the browser has enough data to decode a frame
  vid.elt.onloadeddata = () => { ready = true; };
  vid.elt.oncanplay = () => { ready = true; }; // Some browsers use this

  // Log any load errors (bad path/codec)
  vid.elt.onerror = (e) => console.error('VIDEO ERROR', e);

  // When playback reaches the end, reveal trails and show dashboard/stats
  vid.elt.onended = () => {
    showAllAtEnd = true;                 // End screen mode
    showTrails = true;                   // Default to showing trails
    computeAllRepMetrics();              // Fill in metrics for each rep
    renderStatsTable();                  // Build the HTML stats below the canvas
    updateDashboard();                   // Show buttons
  };

  current.color = nextColour();          // Colour for the first rep

  // --- Stats div (hidden at start) ---
  statsDiv = createDiv('');
  statsDiv.style('font-family', 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial');
  statsDiv.style('margin', '8px 0 0 0');
  statsDiv.style('padding', '12px');
  statsDiv.style('border-radius', '10px');
  statsDiv.style('background', '#111');
  statsDiv.style('color', '#fff');
  statsDiv.style('display', 'none');

  // --- Dashboard buttons (created now, shown only at end) ---
  btnReplay   = createButton('▶ Replay (hide trails)');
  btnToggle   = createButton('🎨 Toggle trails');
  btnSnapshot = createButton('💾 Save snapshot (PNG)');
  btnRestart  = createButton('⏮ Restart video');
  btnStats    = createButton('📊 Show/Hide Stats');

  // Shared button styling
  [btnReplay, btnToggle, btnSnapshot, btnRestart, btnStats].forEach((b) => {
    b.style('padding', '10px 14px');
    b.style('border-radius', '10px');
    b.style('border', 'none');
    b.style('background', '#ffffff');
    b.style('box-shadow', '0 2px 10px rgba(0,0,0,0.15)');
    b.style('font-family', 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial');
    b.style('cursor', 'pointer');
    b.hide(); // Hidden until the end screen
  });

  // --- Button actions ---
  btnReplay.mousePressed(() => {           // Rewind and hide trails for a fresh pass
    showAllAtEnd = false;
    showTrails = false;
    statsDiv.style('display', 'none');
    current = { points: [], color: nextColour() };
    vid.time(0);
    vid.play();
    updateDashboard();
  });

  btnToggle.mousePressed(() => {           // Toggle trail visibility at end
    showTrails = !showTrails;
    updateDashboard();
  });

  btnSnapshot.mousePressed(() => {         // Save the canvas as a PNG
    const prev = showTrails;
    showTrails = true;                     // Ensure trails are visible in the snapshot
    redraw();
    saveCanvas('reps_snapshot', 'png');
    showTrails = prev;
  });

  btnRestart.mousePressed(restartVideoHidden); // Restart any time

  btnStats.mousePressed(() => {            // Show/Hide the stats HTML block
    statsVisible = !statsVisible;
    statsDiv.style('display', statsVisible ? 'block' : 'none');
  });
}

// ------------------------------ Draw loop --------------------------------------

function draw() {
  background(0);                         // Clear to black each frame

  if (ready) image(vid, 0, 0, width, height); // Draw current video frame when ready

  if (!warmed) centerMsg('Click once to load video'); // Prompt to prime the video

  // ----- Calibration mode (before 4 clicks) -----
  if (calibStep < 4) {
    if (!warmed) primeVideo();           // Brief play/pause to reveal the first frame
    drawCalibrationBanner();             // Top instruction banner
    drawCalibrationMarkers();            // Crosses where you’ve clicked
    drawHUD(true);                       // Bottom status line
    return;                              // Don’t draw trails/UI until calibration completes
  }

  // ----- Normal mode (after calibration) -----
  strokeWeight(4);
  noFill();

  if (showAllAtEnd) {                    // End screen: optionally draw all trails
    if (showTrails) {
      for (const rep of trails) {
        stroke(rep.color[0], rep.color[1], rep.color[2]);
        drawSmoothPath(rep.points);
      }
    }
  } else {                               // Recording mode: draw only the current trail
    stroke(current.color[0], current.color[1], current.color[2]);
    drawSmoothPath(current.points);
  }

  drawHUD(false);                        // Status/instructions at the bottom
  updateDashboard();                     // Keep buttons positioned/visible appropriately
}

// ------------------------------ Video priming ----------------------------------

/**
 * Briefly plays the video (muted) and pauses it to guarantee a decodable frame
 * is available for calibration overlays.
 */
function primeVideo() {
  if (warmed) return;                    // Only run once
  vid.volume(0);
  const p = vid.play();                  // Start playback (promise on some browsers)
  if (p && p.catch) p.catch(() => {});   // Ignore autoplay errors
  setTimeout(() => {                     // Pause shortly after to “freeze” a frame
    vid.pause();
    warmed = true;
    redraw();
  }, 150);
}

// ------------------------------ Calibration UI ---------------------------------

function drawCalibrationBanner() {
  push();
  noStroke();
  fill(0, 200);                          // Semi-transparent black bar
  rect(0, 0, width, 56);

  fill(255);
  textSize(24);
  textAlign(LEFT, CENTER);

  // Instruction changes based on which point we’re asking for
  let msg = '';
  if (calibStep === 0) msg = 'Calibration 1/4 — Click the BOTTOM of the net at the LEFT antenna';
  if (calibStep === 1) msg = 'Calibration 2/4 — Click the TOP of the net at the LEFT antenna';
  if (calibStep === 2) msg = 'Calibration 3/4 — Click the BOTTOM of the net at the RIGHT antenna';
  if (calibStep === 3) msg = 'Calibration 4/4 — Click the TOP of the net at the RIGHT antenna';
  text(msg, 12, 28);
  pop();
}

// Draw tiny crosses where the user has already clicked
function drawCalibrationMarkers() {
  if (calibPts.LB) drawCross(calibPts.LB.x, calibPts.LB.y, '#ff5757'); // red for bottom
  if (calibPts.LT) drawCross(calibPts.LT.x, calibPts.LT.y, '#57c7ff'); // blue for top
  if (calibPts.RB) drawCross(calibPts.RB.x, calibPts.RB.y, '#ff5757');
  if (calibPts.RT) drawCross(calibPts.RT.x, calibPts.RT.y, '#57c7ff');
}

// Helper to draw a crosshair marker
function drawCross(x, y, color) {
  push();
  stroke(color); strokeWeight(3);
  line(x - 8, y, x + 8, y);
  line(x, y - 8, x, y + 8);
  pop();
}

// ------------------------------ HUD / Instructions -----------------------------

function drawHUD(inCalibration) {
  fill(255);
  noStroke();
  textSize(12);

  // Construct a status string for the bottom-left HUD
  const paused = vid && vid.elt ? vid.elt.paused : true;
  const status = inCalibration
    ? 'Calibration mode'
    : (showAllAtEnd ? 'Ended' : (paused ? 'Paused' : 'Playing'));

  text(
    `Status: ${status}   Reps: ${trails.length}   Current pts: ${current.points.length}`,
    12, height - 12
  );

  // Pre-start instructions (after calibration, before first click to play)
  if (!started && !inCalibration) {
    centerMsg(
      'Click once to start video\n' +
      'Click to add points • N = end rep • Z = undo\n' +
      'Space = play/pause • ,/. = step • R = reset • Enter = replay & hide • S = restart'
    );
  }

  // Helpful tip while paused during recording
  if (!showAllAtEnd && started && !inCalibration && vid.elt.paused) {
    text('Tip: press N to end a rep (it hides until the end).', 12, 40);
  }
}

// Draw centered multi-line helper text
function centerMsg(msg) {
  push();
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(18);
  text(msg, width / 2, height / 2);
  pop();
}

// ------------------------------ Mouse interaction ------------------------------

function mousePressed() {
  if (!warmed) { primeVideo(); return; } // First click may be used to prime the video

  // Handle the four calibration clicks in order
  if (calibStep < 4) {
    const pt = { x: mouseX, y: mouseY };      // Canvas coordinates of the click
    if (calibStep === 0) calibPts.LB = pt;    // Left bottom
    else if (calibStep === 1) calibPts.LT = pt; // Left top
    else if (calibStep === 2) calibPts.RB = pt; // Right bottom
    else if (calibStep === 3) calibPts.RT = pt; // Right top
    calibStep++;                               // Advance to the next step
    if (calibStep === 4) finalizeCalibration();// Build conversion line/scale
    return;                                    // Don’t record rep points yet
  }

  // First click after calibration starts playback
  if (!started) {
    const p = vid.play(); if (p && p.catch) p.catch(() => {});
    started = true;
    return;
  }

  if (showAllAtEnd) return;                    // Ignore clicks after the video ended

  // Add a new point to the current rep (with video timestamp)
  current.points.push({ x: mouseX, y: mouseY, t: vid.time() });
}

// ------------------------------ Keyboard interaction ---------------------------

function keyPressed() {
  if (calibStep < 4) return;                   // Disable shortcuts during calibration

  if (key === ' ') {                           // Space: toggle play/pause
    if (vid.elt.paused) vid.play(); else vid.pause();

  } else if (key === 'N' || key === 'n') {     // N: finish current rep and start a new colour
    if (current.points.length) trails.push(current);
    current = { points: [], color: nextColour() };

  } else if (key === 'Z' || key === 'z') {     // Z: undo last clicked point
    if (current.points.length) current.points.pop();

  } else if (key === ',') {                    // , : step backward ≈ 1 frame (1/30 s)
    if (!showAllAtEnd) { vid.pause(); vid.time(Math.max(0, vid.time() - 1 / 30)); }

  } else if (key === '.') {                    // . : step forward ≈ 1 frame
    if (!showAllAtEnd) { vid.pause(); vid.time(Math.min(vid.duration(), vid.time() + 1 / 30)); }

  } else if (keyCode === ENTER) {              // Enter: replay from 0 and hide trails
    showAllAtEnd = false;
    showTrails = false;
    statsDiv.style('display', 'none');
    current = { points: [], color: nextColour() };
    vid.time(0); vid.play();
    updateDashboard();

  } else if (key === 'S' || key === 's') {     // S: restart video immediately
    restartVideoHidden();

  } else if (key === 'R' || key === 'r') {     // R: full reset (wipe reps + calibration)
    trails = [];
    current = { points: [], color: nextColour() };
    showAllAtEnd = false; started = false; ready = false;
    calibStep = 0; calibPts = { LB: null, LT: null, RB: null, RT: null };
    pixelsPerMeter = null; topLine = null; warmed = false;
    statsDiv.style('display', 'none'); statsDiv.html('');
    vid.time(0); vid.pause(); ready = true;
    updateDashboard();
  }
}

// ------------------------------ Calibration math -------------------------------

/** Build px→m scale and top-of-net line from the four clicks. */
function finalizeCalibration() {
  const hLeft  = Math.abs(calibPts.LT.y - calibPts.LB.y); // Pixel height at left antenna
  const hRight = Math.abs(calibPts.RT.y - calibPts.RB.y); // Pixel height at right antenna
  const hAvgPx = (hLeft + hRight) / 2;                    // Average to reduce perspective error
  pixelsPerMeter = hAvgPx / NET_HEIGHT_M;                 // Convert px to metres

  // Top tape line through LT and RT: y = m*x + b
  const m = (calibPts.RT.y - calibPts.LT.y) / (calibPts.RT.x - calibPts.LT.x);
  const b = calibPts.LT.y - m * calibPts.LT.x;
  topLine = { m, b };

  console.log('Calibration complete:', { hLeft, hRight, hAvgPx, pixelsPerMeter, topLine });
}

/** Metres the point is ABOVE (+) or BELOW (–) the net tape at the same x. */
function metersAboveNetAtPoint(x, y) {
  if (!pixelsPerMeter || !topLine) return null;
  const yTop = topLine.m * x + topLine.b; // Pixel y of the tape at this x
  const dyPx = (yTop - y);                // Positive if point is above (screen y grows downward)
  return dyPx / pixelsPerMeter;           // Convert pixel delta to metres
}

/** Approx horizontal distance (metres) from p1 to p2 in screen space. */
function metersHorizDistance(p1, p2) {
  if (!pixelsPerMeter) return null;
  const dxPx = Math.abs(p2.x - p1.x);
  return dxPx / pixelsPerMeter;
}

// ------------------------------ Metrics per rep --------------------------------

/** Fill in peak height, above-net cm, width, and direction for each rep. */
function computeAllRepMetrics() {
  for (const rep of trails) {
    if (!rep.points || rep.points.length < 2) {     // Need at least two points
      rep.peakM = null; rep.aboveNetCM = null; rep.widthM = null; rep.direction = null;
      continue;
    }

    // ---- Peak height above the net (metres) ----
    let peakAboveM = -Infinity;                      // Track max “above net” value
    for (const p of rep.points) {
      const a = metersAboveNetAtPoint(p.x, p.y);     // metres above (+) / below (–) at this click
      if (a != null && a > peakAboveM) peakAboveM = a;
    }
    if (!isFinite(peakAboveM)) {
      rep.peakM = null;                              // Couldn’t compute
      rep.aboveNetCM = null;
    } else {
      rep.peakM = NET_HEIGHT_M + peakAboveM;         // Absolute peak height from floor
      rep.aboveNetCM = Math.round(peakAboveM * 100); // Centimetres above the tape
    }

    // ---- Horizontal width (metres) from first → last point ----
    const start = rep.points[0];
    const end   = rep.points[rep.points.length - 1];
    const wM = metersHorizDistance(start, end);
    rep.widthM = (wM != null) ? wM : null;

    // Directional arrow for readability
    rep.direction = (end.x > start.x) ? '→' : (end.x < start.x ? '←' : '•');
  }
}

// ------------------------------ Stats table (HTML) -----------------------------

/** Build a neat HTML table summarising each rep and overall best/averages. */
function renderStatsTable() {
  const rows = [];                      // Rows to render
  let bestIdx = -1, bestVal = -Infinity;// Track highest absolute peak
  let sumPeak = 0, nPeak = 0;           // For average peak
  let sumWidth = 0, nWidth = 0;         // For average width

  // Assemble row data and summary accumulators
  for (let i = 0; i < trails.length; i++) {
    const r = trails[i];

    if (r.peakM != null) {
      if (r.peakM > bestVal) { bestVal = r.peakM; bestIdx = i; }
      sumPeak += r.peakM; nPeak++;
    }
    if (r.widthM != null) {
      sumWidth += r.widthM; nWidth++;
    }

    rows.push({
      rep: i + 1,
      peakM: r.peakM,
      aboveCM: r.aboveNetCM,
      widthM: r.widthM,
      direction: r.direction || '',
      color: r.color
    });
  }

  // Compute simple averages
  const avgPeak  = nPeak  ? (sumPeak  / nPeak)  : null;
  const avgWidth = nWidth ? (sumWidth / nWidth) : null;

  // Build HTML string for the table (kept inline for portability)
  let html = `
    <div style="font-size:14px; line-height:1.4">
      <div style="margin-bottom:8px; font-weight:600">SET STATS (Net = ${NET_HEIGHT_M.toFixed(2)} m)</div>
      <table style="width:100%; border-collapse:collapse; overflow:hidden; border-radius:10px">
        <thead>
          <tr style="background:#222; color:#ddd">
            <th style="text-align:left; padding:8px 10px">Rep</th>
            <th style="text-align:left; padding:8px 10px">Peak height (m)</th>
            <th style="text-align:left; padding:8px 10px">Above net (cm)</th>
            <th style="text-align:left; padding:8px 10px">Width (m)</th>
          </tr>
        </thead>
        <tbody>
  `;

  // Render each row with colour dot + metrics
  rows.forEach((row) => {
    const clr = `rgb(${row.color[0]},${row.color[1]},${row.color[2]})`;
    const peakTxt  = row.peakM  != null ? row.peakM.toFixed(2)  : '—';
    const aboveTxt = row.aboveCM != null ? `${row.aboveCM}`      : '—';
    const widthTxt = row.widthM != null ? `${row.direction} ${row.widthM.toFixed(2)}` : '—';

    html += `
      <tr style="background:#181818; border-top:1px solid #2a2a2a">
        <td style="padding:8px 10px">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${clr};margin-right:8px"></span>
          Rep ${row.rep}
        </td>
        <td style="padding:8px 10px">${peakTxt}</td>
        <td style="padding:8px 10px">${aboveTxt}</td>
        <td style="padding:8px 10px">${widthTxt}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
  `;

  // Add summary lines
  if (bestIdx >= 0) {
    html += `<div style="margin-top:8px">🏅 <b>Highest Peak:</b> Rep ${bestIdx + 1} (${bestVal.toFixed(2)} m)</div>`;
  }
  if (avgPeak != null) {
    html += `<div><b>Average Peak:</b> ${avgPeak.toFixed(2)} m</div>`;
  }
  if (avgWidth != null) {
    html += `<div><b>Average Width:</b> ${avgWidth.toFixed(2)} m</div>`;
  }

  html += `</div>`;                 // Close wrapper

  statsDiv.html(html);              // Inject HTML into the div
  statsDiv.style('display', 'block'); // Make it visible
  statsVisible = true;              // Track visibility state
}

// ------------------------------ Dashboard layout -------------------------------

/** Position buttons along the bottom when we’re on the end screen. */
function updateDashboard() {
  if (showAllAtEnd && calibStep >= 4) {
    const pad = 12, gap = 10, btnW = 190, btnH = 40; // Layout constants

    // Position each button left→right along the bottom
    btnReplay.position(  pad,                       height - btnH - pad );
    btnToggle.position(  pad + btnW + gap,         height - btnH - pad );
    btnSnapshot.position(pad + (btnW + gap) * 2,   height - btnH - pad );
    btnRestart.position( pad + (btnW + gap) * 3,   height - btnH - pad );
    btnStats.position(   pad + (btnW + gap) * 4,   height - btnH - pad );

    // Ensure they’re visible
    btnReplay.show(); btnToggle.show(); btnSnapshot.show(); btnRestart.show(); btnStats.show();

    // Update the toggle button label
    btnToggle.html(showTrails ? '🎨 Hide trails' : '🎨 Show trails');
  } else {
    // Hide all when not on the end screen
    [btnReplay, btnToggle, btnSnapshot, btnRestart, btnStats].forEach(b => b.hide());
  }
}

// ------------------------------ Drawing helpers --------------------------------

/** Draw a smooth line through a list of points using curve vertices. */
function drawSmoothPath(points) {
  if (!points || points.length < 2) return;
  beginShape();
  curveVertex(points[0].x, points[0].y);                  // Lead-in control point
  for (const p of points) curveVertex(p.x, p.y);          // Main vertices
  curveVertex(points[points.length - 1].x, points[points.length - 1].y); // Lead-out
  endShape();
}

/** Restart helper used by the button and the “S” key. */
function restartVideoHidden() {
  showAllAtEnd = false;                 // Leave end screen
  showTrails = false;                   // Hide old trails for a clean view
  statsDiv.style('display', 'none');    // Hide stats
  current = { points: [], color: nextColour() }; // Fresh rep
  vid.time(0);                          // Seek to start
  vid.play();                           // Play again
  started = true;                       // Mark as started
  updateDashboard();                    // Hide buttons again
}





