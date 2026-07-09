// ---------- Storage ----------
const STORAGE_KEY = 'flip.decks.v1';
const STATS_KEY = 'flip.stats.v1';

function loadDecks(){
  try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch(e){ return []; }
}
function saveDecks(decks){ localStorage.setItem(STORAGE_KEY, JSON.stringify(decks)); }

function loadStats(){
  try{
    return JSON.parse(localStorage.getItem(STATS_KEY)) || { totalReviewed:0, streak:0, lastStudyDate:null };
  }catch(e){ return { totalReviewed:0, streak:0, lastStudyDate:null }; }
}
function saveStats(s){ localStorage.setItem(STATS_KEY, JSON.stringify(s)); }

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

let decks = loadDecks();
let stats = loadStats();

let currentDeckId = null;
let studyQueue = [];      // array of card objects for this round
let studyIndex = 0;
let missed = [];          // cards marked "didn't know" this round
let cardsSeenThisRound = 0;

// ---------- Nav ----------
const views = {
  decks: document.getElementById('view-decks'),
  edit: document.getElementById('view-edit'),
  study: document.getElementById('view-study'),
  stats: document.getElementById('view-stats'),
};
function showView(name){
  Object.values(views).forEach(v => v.classList.remove('active'));
  views[name].classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const map = { decks: 'navDecks', study: 'navStudy', stats: 'navStats' };
  if(map[name]) document.getElementById(map[name]).classList.add('active');
  if(name === 'stats') renderStats();
}
document.getElementById('navDecks').onclick = () => { renderDecks(); showView('decks'); };
document.getElementById('navStudy').onclick = () => {
  if(!decks.length){ toast('Make a deck first'); renderDecks(); showView('decks'); return; }
  openStudy(currentDeckId || decks[0].id);
};
document.getElementById('navStats').onclick = () => showView('stats');
document.getElementById('backFromEdit').onclick = () => { renderDecks(); showView('decks'); };
document.getElementById('backFromStudy').onclick = () => { renderDecks(); showView('decks'); };

// ---------- Toast ----------
let toastTimer;
function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.hidden = true, 1800);
}

// ---------- Deck list ----------
function renderDecks(){
  const grid = document.getElementById('deckGrid');
  const empty = document.getElementById('emptyState');
  grid.innerHTML = '';
  if(!decks.length){ empty.hidden = false; grid.hidden = true; return; }
  empty.hidden = true; grid.hidden = false;

  decks.forEach(deck => {
    const card = document.createElement('div');
    card.className = 'deck-card';
    card.innerHTML = `
      <p class="deck-card-name">${escapeHtml(deck.name)}</p>
      <p class="deck-card-count">${deck.cards.length} card${deck.cards.length===1?'':'s'}</p>
      <div class="deck-card-actions">
        <button class="studyBtn">Study</button>
        <button class="editBtn">Edit</button>
      </div>`;
    card.querySelector('.studyBtn').onclick = () => openStudy(deck.id);
    card.querySelector('.editBtn').onclick = () => openEdit(deck.id);
    grid.appendChild(card);
  });
}

function escapeHtml(str){
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ---------- New deck ----------
document.getElementById('newDeckBtn').onclick = () => {
  const deck = { id: uid(), name: 'Untitled deck', cards: [] };
  decks.unshift(deck);
  saveDecks(decks);
  openEdit(deck.id);
};

// ---------- Edit deck ----------
function openEdit(deckId){
  currentDeckId = deckId;
  const deck = decks.find(d => d.id === deckId);
  document.getElementById('deckNameInput').value = deck.name;
  document.getElementById('editDeckTitleLabel').textContent = 'Edit deck';
  renderCardList(deck);
  showView('edit');
}

document.getElementById('deckNameInput').addEventListener('input', (e) => {
  const deck = decks.find(d => d.id === currentDeckId);
  if(!deck) return;
  deck.name = e.target.value || 'Untitled deck';
  saveDecks(decks);
});

document.getElementById('cardForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const deck = decks.find(d => d.id === currentDeckId);
  const front = document.getElementById('cardFront').value.trim();
  const back = document.getElementById('cardBack').value.trim();
  if(!front || !back) return;
  deck.cards.push({ id: uid(), front, back });
  saveDecks(decks);
  document.getElementById('cardFront').value = '';
  document.getElementById('cardBack').value = '';
  document.getElementById('cardFront').focus();
  renderCardList(deck);
});

function renderCardList(deck){
  const list = document.getElementById('cardList');
  list.innerHTML = '';
  deck.cards.slice().reverse().forEach(c => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div>
        <p class="ci-text ci-front">${escapeHtml(c.front)}</p>
        <p class="ci-text ci-back">${escapeHtml(c.back)}</p>
      </div>
      <button class="removeBtn" title="Remove card">&times;</button>`;
    li.querySelector('.removeBtn').onclick = () => {
      deck.cards = deck.cards.filter(x => x.id !== c.id);
      saveDecks(decks);
      renderCardList(deck);
    };
    list.appendChild(li);
  });
}

// ---------- AI generate ----------
let aiGeneratedCards = [];

document.getElementById('aiGenerateBtn').onclick = async () => {
  const btn = document.getElementById('aiGenerateBtn');
  const errEl = document.getElementById('aiError');
  const input = document.getElementById('aiInput').value.trim();
  const count = document.getElementById('aiCount').value;
  errEl.hidden = true;
  document.getElementById('aiResults').hidden = true;

  if(!input){ errEl.textContent = 'Paste some notes or type a topic first.'; errEl.hidden = false; return; }

  btn.textContent = 'Generating...';
  btn.disabled = true;

  try{
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: input, count })
    });
    const data = await res.json();
    if(!res.ok){ throw new Error(data.error || 'Something went wrong.'); }
    if(!data.cards || !data.cards.length){ throw new Error('No cards came back — try adding more detail.'); }
    aiGeneratedCards = data.cards;
    renderAiResults();
  }catch(e){
    errEl.textContent = e.message;
    errEl.hidden = false;
  }finally{
    btn.textContent = 'Generate';
    btn.disabled = false;
  }
};

function renderAiResults(){
  const list = document.getElementById('aiResultsList');
  list.innerHTML = '';
  aiGeneratedCards.forEach((c, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <input type="checkbox" checked data-idx="${i}">
      <div>
        <p class="ci-text ci-front">${escapeHtml(c.front)}</p>
        <p class="ci-text ci-back">${escapeHtml(c.back)}</p>
      </div>`;
    list.appendChild(li);
  });
  document.getElementById('aiResultsLabel').textContent = `Review & add (${aiGeneratedCards.length} generated)`;
  document.getElementById('aiResults').hidden = false;
}

document.getElementById('aiAddSelectedBtn').onclick = () => {
  const deck = decks.find(d => d.id === currentDeckId);
  if(!deck) return;
  const checked = document.querySelectorAll('#aiResultsList input[type="checkbox"]:checked');
  let added = 0;
  checked.forEach(cb => {
    const c = aiGeneratedCards[parseInt(cb.dataset.idx)];
    if(c){ deck.cards.push({ id: uid(), front: c.front, back: c.back }); added++; }
  });
  saveDecks(decks);
  renderCardList(deck);
  document.getElementById('aiResults').hidden = true;
  document.getElementById('aiInput').value = '';
  aiGeneratedCards = [];
  toast(`Added ${added} card${added===1?'':'s'}`);
};

document.getElementById('aiDismissBtn').onclick = () => {
  aiGeneratedCards = [];
  document.getElementById('aiResults').hidden = true;
};

document.getElementById('deleteDeckBtn').onclick = () => {
  const deck = decks.find(d => d.id === currentDeckId);
  if(!deck) return;
  if(!confirm(`Delete "${deck.name}"? This can't be undone.`)) return;
  decks = decks.filter(d => d.id !== currentDeckId);
  saveDecks(decks);
  renderDecks();
  showView('decks');
  toast('Deck deleted');
};

// ---------- Study mode ----------
function openStudy(deckId){
  currentDeckId = deckId;
  const deck = decks.find(d => d.id === deckId);
  document.getElementById('studyDeckTitle').textContent = deck.name;
  document.getElementById('roundDoneMsg').hidden = true;

  if(!deck.cards.length){
    document.getElementById('noCardsMsg').hidden = false;
    document.getElementById('flipCardWrap').hidden = true;
    document.getElementById('studyControls').hidden = true;
    document.getElementById('studyProgress').textContent = '0 / 0';
    showView('study');
    return;
  }
  document.getElementById('noCardsMsg').hidden = true;
  document.getElementById('flipCardWrap').hidden = false;

  studyQueue = shuffle(deck.cards.slice());
  studyIndex = 0;
  missed = [];
  cardsSeenThisRound = 0;
  showCard();
  showView('study');
}

function shuffle(arr){
  for(let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function showCard(){
  const flipCard = document.getElementById('flipCard');
  flipCard.classList.remove('flipped');
  document.getElementById('studyControls').hidden = true;

  if(studyIndex >= studyQueue.length){
    finishRound();
    return;
  }
  const c = studyQueue[studyIndex];
  document.getElementById('frontText').textContent = c.front;
  document.getElementById('backText').textContent = c.back;
  document.getElementById('studyProgress').textContent = `${studyIndex + 1} / ${studyQueue.length}`;
  document.getElementById('flipCardWrap').hidden = false;
  document.getElementById('roundDoneMsg').hidden = true;
}

document.getElementById('flipCard').addEventListener('click', () => {
  const flipCard = document.getElementById('flipCard');
  const wasFlipped = flipCard.classList.contains('flipped');
  flipCard.classList.toggle('flipped');
  if(!wasFlipped){
    document.getElementById('studyControls').hidden = false;
  }
});

document.getElementById('knewBtn').onclick = (e) => { e.stopPropagation(); nextCard(true); };
document.getElementById('againBtn').onclick = (e) => { e.stopPropagation(); nextCard(false); };

function nextCard(knew){
  cardsSeenThisRound++;
  if(!knew) missed.push(studyQueue[studyIndex]);
  studyIndex++;
  recordReview();
  showCard();
}

function finishRound(){
  document.getElementById('flipCardWrap').hidden = true;
  document.getElementById('studyControls').hidden = true;
  document.getElementById('roundDoneMsg').hidden = false;
  const sub = missed.length
    ? `${missed.length} card${missed.length===1?'':'s'} to review again.`
    : `You knew every card. Nicely done.`;
  document.getElementById('roundDoneSub').textContent = sub;
}

document.getElementById('restartRoundBtn').onclick = () => {
  if(missed.length){
    studyQueue = shuffle(missed.slice());
    missed = [];
    studyIndex = 0;
    document.getElementById('roundDoneMsg').hidden = true;
    showCard();
  }else{
    openStudy(currentDeckId);
  }
};

// ---------- Stats ----------
function recordReview(){
  stats.totalReviewed = (stats.totalReviewed || 0) + 1;
  const today = new Date().toDateString();
  if(stats.lastStudyDate !== today){
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    stats.streak = (stats.lastStudyDate === yesterday) ? (stats.streak || 0) + 1 : 1;
    stats.lastStudyDate = today;
  }
  saveStats(stats);
}

function renderStats(){
  document.getElementById('statStreak').textContent = stats.streak || 0;
  document.getElementById('statReviewed').textContent = stats.totalReviewed || 0;
  document.getElementById('statDecks').textContent = decks.length;
}

// ---------- PWA ----------
if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}

// ---------- Init ----------
renderDecks();
