// Rock Quiz – Lokal (ingen login) + Importer playlist i browseren.
const state = {
  token: null,
  tracks: [],
  pool: [],
  round: 0,
  totalRounds: 10,
  timeLimit: 30,
  score: 0,
  current: null,
  timerId: null,
  countdown: 30,
  hardMode: false
};

const els = {
  roundNo: document.getElementById('roundNo'),
  roundTotal: document.getElementById('roundTotal'),
  statusLine: document.getElementById('statusLine'),
  score: document.getElementById('score'),
  countdown: document.getElementById('countdown'),
  audio: document.getElementById('audio'),
  startBtn: document.getElementById('startBtn'),
  replayBtn: document.getElementById('replayBtn'),
  skipBtn: document.getElementById('skipBtn'),
  revealBtn: document.getElementById('revealBtn'),
  choices: document.getElementById('choices'),
  nowPlaying: document.getElementById('nowPlaying'),
  trackList: document.getElementById('trackList'),
  settingsBtn: document.getElementById('settingsBtn'),
  helpBtn: document.getElementById('helpBtn'),
  importBtn: document.getElementById('importBtn'),
  newGameBtn: document.getElementById('newGameBtn'),
  hardMode: document.getElementById('hardMode'),
  downloadBtn: document.getElementById('downloadBtn')
};

const settingsModal = document.getElementById('settingsModal');
const helpModal = document.getElementById('helpModal');
const importModal = document.getElementById('importModal');

const tokenInput = document.getElementById('tokenInput');
const roundsInput = document.getElementById('roundsInput');
const timeLimitInput = document.getElementById('timeLimitInput');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');

const playlistInput = document.getElementById('playlistInput');
const importTokenInput = document.getElementById('importTokenInput');
const keepNoPreview = document.getElementById('keepNoPreview');
const runImportBtn = document.getElementById('runImportBtn');
const importStatus = document.getElementById('importStatus');

init();

async function init(){
  const saved = JSON.parse(localStorage.getItem('rockquiz.settings') || '{}');
  state.token = saved.token || null;
  state.totalRounds = saved.totalRounds || 10;
  state.timeLimit = saved.timeLimit || 30;
  state.hardMode = JSON.parse(localStorage.getItem('rockquiz.hardMode') || 'false');

  roundsInput.value = state.totalRounds;
  timeLimitInput.value = state.timeLimit;
  tokenInput.value = state.token || '';
  els.hardMode.checked = state.hardMode;
  els.roundTotal.textContent = state.totalRounds;
  els.countdown.textContent = state.timeLimit;

  // UI events
  els.startBtn.addEventListener('click', startRound);
  els.replayBtn.addEventListener('click', () => playCurrent(true));
  els.skipBtn.addEventListener('click', skipRound);
  els.revealBtn.addEventListener('click', revealAnswer);
  els.newGameBtn.addEventListener('click', newGame);
  els.hardMode.addEventListener('change', e => {
    state.hardMode = e.target.checked;
    localStorage.setItem('rockquiz.hardMode', JSON.stringify(state.hardMode));
  });

  els.settingsBtn.addEventListener('click', () => settingsModal.showModal());
  els.helpBtn.addEventListener('click', () => helpModal.showModal());
  els.importBtn.addEventListener('click', () => {
    importTokenInput.value = state.token || '';
    playlistInput.value = '';
    keepNoPreview.checked = false;
    importStatus.textContent = '';
    importModal.showModal();
  });
  els.downloadBtn.addEventListener('click', downloadTracksJson);

  saveSettingsBtn.addEventListener('click', (e)=> {
    e.preventDefault();
    const token = tokenInput.value.trim();
    const trounds = parseInt(roundsInput.value, 10) || 10;
    const tlimit = parseInt(timeLimitInput.value, 10) || 30;
    state.token = token || null;
    state.totalRounds = clamp(trounds, 3, 50);
    state.timeLimit = clamp(tlimit, 10, 60);
    els.roundTotal.textContent = state.totalRounds;
    els.countdown.textContent = state.timeLimit;
    localStorage.setItem('rockquiz.settings', JSON.stringify({token: state.token, totalRounds: state.totalRounds, timeLimit: state.timeLimit}));
    settingsModal.close();
  });

  // Load tracks.json if present
  await loadTracks();
  newGame();
}

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

async function loadTracks(){
  try{
    const res = await fetch('tracks.json', {cache:'no-store'});
    if(!res.ok) throw new Error('Kunne ikke læse tracks.json');
    const data = await res.json();
    state.tracks = Array.isArray(data.tracks) ? data.tracks : [];
    renderTrackList();
  }catch(err){
    console.warn('Ingen/fejl i tracks.json', err);
    state.tracks = [];
    renderTrackList();
    els.statusLine.textContent = 'Ingen tracks.json indlæst endnu. Brug Importer playlist eller læg en fil.';
  }
}

function renderTrackList(){
  els.trackList.innerHTML = '';
  if (!state.tracks.length){
    els.downloadBtn.disabled = true;
    return;
  }
  els.downloadBtn.disabled = false;
  state.tracks.forEach(t => {
    const item = document.createElement('div');
    item.className = 'trackitem';
    item.innerHTML = `
      <img src="${t.cover || ''}" alt="">
      <div class="meta">
        <div><strong>${t.name || 'Ukendt'}</strong></div>
        <div class="muted small">${t.artist || ''}</div>
      </div>
      <div class="id" style="margin-left:auto">${t.id}</div>
    `;
    els.trackList.appendChild(item);
  });
}

// -------------------- Spilflow --------------------
function newGame(){
  stopAudio();
  state.score = 0;
  state.round = 0;
  state.pool = shuffle([...state.tracks]);
  els.score.textContent = state.score;
  els.statusLine.textContent = 'Klar! Tryk Start runde.';
  els.nowPlaying.textContent = '';
  els.choices.innerHTML = '';
  updateButtons({start:true, replay:false, skip:false, reveal:false});
}

function updateButtons({start, replay, skip, reveal}){
  els.startBtn.disabled = !start;
  els.replayBtn.disabled = !replay;
  els.skipBtn.disabled = !skip;
  els.revealBtn.disabled = !reveal;
}

async function startRound(){
  if(state.pool.length === 0){
    els.statusLine.textContent = 'Ikke flere tracks. Start et nyt spil.';
    return;
  }
  state.round += 1;
  if(state.round > state.totalRounds){
    endGame();
    return;
  }
  els.roundNo.textContent = state.round;
  els.statusLine.textContent = 'Gæt sangen før tiden løber ud!';

  state.current = state.pool.shift();
  const options = pickOptions(state.current, state.tracks, 4);
  renderChoices(options);
  state.countdown = state.timeLimit;
  els.countdown.textContent = state.countdown;
  startTimer();
  await playCurrent();
  updateButtons({start:false, replay:false, skip:true, reveal:true});
}

function endGame(){
  stopAudio();
  updateButtons({start:false, replay:false, skip:false, reveal:false});
  els.statusLine.textContent = `Færdig! Slutscore: ${state.score} / ${state.totalRounds}`;
}

function pickOptions(correct, all, n){
  const wrongs = shuffle(all.filter(t=>t.id !== correct.id)).slice(0, n-1);
  return shuffle([correct, ...wrongs]);
}

function renderChoices(options){
  els.choices.innerHTML = '';
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'choice';
    btn.innerHTML = `
      <img class="cover" src="${opt.cover || ''}" alt="">
      <div class="meta">
        <div class="title">${ state.hardMode ? (opt.artist || 'Ukendt') : (opt.name || 'Ukendt sang') }</div>
        <div class="artist">${ state.hardMode ? '' : (opt.artist || '') }</div>
        <div class="id">${opt.id}</div>
      </div>
    `;
    btn.addEventListener('click', ()=> onGuess(opt));
    els.choices.appendChild(btn);
  });
}

function markChoices(correctId, pickedId){
  const nodes = [...document.querySelectorAll('.choice')];
  nodes.forEach(node => {
    const id = node.querySelector('.id').textContent.trim();
    if(id === correctId) node.classList.add('correct');
    if(pickedId && id === pickedId && id !== correctId) node.classList.add('wrong');
  });
}

function onGuess(opt){
  if(!state.current) return;
  const correctId = state.current.id;
  const pickedId = opt.id;
  stopTimer();
  markChoices(correctId, pickedId);
  if(pickedId === correctId){
    state.score += 1;
    els.score.textContent = state.score;
    els.statusLine.textContent = 'Korrekt!';
  }else{
    els.statusLine.textContent = 'Forkert…';
  }
  updateButtons({start:true, replay:true, skip:false, reveal:false});
  els.nowPlaying.textContent = `${state.current.artist || ''} – ${state.current.name || ''}`;
}

function revealAnswer(){
  if(!state.current) return;
  stopTimer();
  markChoices(state.current.id, null);
  updateButtons({start:true, replay:true, skip:false, reveal:false});
  els.nowPlaying.textContent = `${state.current.artist || ''} – ${state.current.name || ''}`;
}

function skipRound(){
  stopTimer();
  els.statusLine.textContent = 'Sprunget over.';
  updateButtons({start:true, replay:false, skip:false, reveal:false});
}

async function playCurrent(force=false){
  if(!state.current) return;
  if(!state.current.preview_url){
    els.nowPlaying.textContent = 'Ingen preview tilgængelig for dette track.';
    return;
  }
  if(!force){
    stopAudio();
  }
  els.audio.src = state.current.preview_url;
  try{
    await els.audio.play();
    els.replayBtn.disabled = false;
  }catch(e){
    console.warn('Autoplay blokeret – tryk Afspil igen.');
    els.replayBtn.disabled = false;
  }
}

function stopAudio(){
  els.audio.pause();
  els.audio.currentTime = 0;
}

function startTimer(){
  stopTimer();
  state.timerId = setInterval(()=>{
    state.countdown -= 1;
    els.countdown.textContent = state.countdown;
    if(state.countdown <= 0){
      stopTimer();
      revealAnswer();
      els.statusLine.textContent = 'Tiden er gået!';
    }
  }, 1000);
}

function stopTimer(){
  if(state.timerId) clearInterval(state.timerId);
  state.timerId = null;
}

// -------------------- Importer playlist (browser) --------------------
document.getElementById('runImportBtn')?.addEventListener('click', async (e) => {
  e.preventDefault();
  importStatus.textContent = 'Henter playlist…';
  const id = extractPlaylistId(playlistInput.value.trim());
  const token = (importTokenInput.value || '').trim();
  if (!id || !token){
    importStatus.textContent = 'Manglende playlist‑ID eller token.';
    return;
  }
  try{
    const keep = keepNoPreview.checked;
    const tracks = await getAllPlaylistTracks(id, token);
    let normalized = tracks.map(normalizeTrack).filter(Boolean);
    if (!keep){
      normalized = normalized.filter(t => !!t.preview_url);
    }
    normalized = dedupeById(normalized);
    if (!normalized.length){
      importStatus.textContent = 'Ingen brugbare tracks fundet.';
      return;
    }
    state.tracks = normalized;
    renderTrackList();
    newGame();
    prepareDownload(normalized);
    importStatus.textContent = `Importeret ${normalized.length} tracks. Klar til spil.`;
    document.getElementById('importModal').close();
  }catch(err){
    importStatus.textContent = 'Fejl: ' + (err?.message || err);
  }
});

function extractPlaylistId(input){
  if(!input) return null;
  const m = input.match(/playlist\/([A-Za-z0-9]+)(\?|$)/);
  if (m) return m[1];
  if (/^[A-Za-z0-9]+$/.test(input)) return input;
  return null;
}

async function getAllPlaylistTracks(playlistId, token){
  const headers = { Authorization: 'Bearer ' + token };
  let url = `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks?limit=100`;
  let all = [];
  while(url){
    const res = await fetch(url, { headers });
    if(!res.ok){
      const txt = await res.text();
      throw new Error(`HTTP ${res.status}: ${txt}`);
    }
    const json = await res.json();
    all = all.concat(json.items || []);
    url = json.next;
  }
  return all;
}

function normalizeTrack(item){
  const t = item?.track;
  if(!t || t.type !== 'track' || t.is_local) return null;
  const cover = (t.album?.images?.[1]?.url) || (t.album?.images?.[0]?.url) || null;
  return {
    id: t.id,
    name: t.name || null,
    artist: (t.artists || []).map(a => a.name).join(', '),
    preview_url: t.preview_url || null,
    cover
  };
}

function dedupeById(arr){
  const map = new Map();
  for(const x of arr){
    if(!x || !x.id) continue;
    if(!map.has(x.id)) map.set(x.id, x);
  }
  return [...map.values()];
}

function prepareDownload(tracks){
  const payload = JSON.stringify({tracks}, null, 2);
  const blob = new Blob([payload], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  els.downloadBtn.dataset.href = url;
  els.downloadBtn.dataset.filename = 'tracks.json';
}

function downloadTracksJson(){
  const href = els.downloadBtn.dataset.href;
  const filename = els.downloadBtn.dataset.filename || 'tracks.json';
  if(!href){
    const blob = new Blob([JSON.stringify({tracks: state.tracks}, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    triggerDownload(url, filename);
    return;
  }
  triggerDownload(href, filename);
}

function triggerDownload(href, filename){
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// -------------------- Utils --------------------
function shuffle(arr){
  for(let i = arr.length -1; i>0; i--){
    const j = Math.floor(Math.random() * (i+1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
