// ============================================
//  FICHA DE PERSONAGEM — RPG POKÉMON
//  Script principal com todas as features
// ============================================

const POKEMON_TYPES_EN = [
  'Normal','Fire','Water','Electric','Grass','Ice',
  'Fighting','Poison','Ground','Flying','Psychic','Bug',
  'Rock','Ghost','Dragon','Dark','Steel','Fairy'
];

const STATUS_CONDITIONS = [
  { value: '',    label: '✅ Healthy',    cls: 'none' },
  { value: 'BRN', label: '🔥 Burn',       cls: 'BRN'  },
  { value: 'FRZ', label: '❄️ Freeze',     cls: 'FRZ'  },
  { value: 'PAR', label: '⚡ Paralysis',  cls: 'PAR'  },
  { value: 'PSN', label: '🟣 Poison',     cls: 'PSN'  },
  { value: 'TOX', label: '💜 Bad Poison', cls: 'TOX'  },
  { value: 'SLP', label: '💤 Sleep',      cls: 'SLP'  },
  { value: 'FNT', label: '💀 Fainted',    cls: 'FNT'  },
];

const TYPE_COLORS = {
  Normal:'#A8A878', Fire:'#F08030', Water:'#6890F0', Electric:'#F8D030',
  Grass:'#78C850', Ice:'#98D8D8', Fighting:'#C03028', Poison:'#A040A0',
  Ground:'#E0C068', Flying:'#A890F0', Psychic:'#F85888', Bug:'#A8B820',
  Rock:'#B8A038', Ghost:'#705898', Dragon:'#7038F8', Dark:'#705848',
  Steel:'#B8B8D0', Fairy:'#EE99AC'
};

// ---- CAPTURED POKÉMON (lido do mesmo localStorage usado pela Pokédex) ----
let capturedList = []; // [{id, name}]

// ---- ESTADO: quem está em cada slot da party (fonte de verdade) ----
// { 1: "25", 2: null, 3: "1", ... }
let partyAssignments = { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null };

function loadCapturedList() {
  const raw = localStorage.getItem('pokemonCapturados');
  if (!raw) { capturedList = []; return; }
  try {
    const ids = JSON.parse(raw);
    capturedList = [...ids].sort((a, b) => a - b).map(id => ({ id, name: null }));
  } catch {
    capturedList = [];
  }
}

// Cache de nomes (id -> nome) para não martelar a PokeAPI toda hora
const POKEMON_NAME_CACHE_KEY = 'pokemonNameCache';
function loadNameCache() {
  try { return JSON.parse(localStorage.getItem(POKEMON_NAME_CACHE_KEY)) || {}; }
  catch { return {}; }
}
function saveNameCache(cache) {
  localStorage.setItem(POKEMON_NAME_CACHE_KEY, JSON.stringify(cache));
}

async function ensureCapturedNames() {
  const cache = loadNameCache();
  const missing = capturedList.filter(p => !cache[p.id]);

  if (missing.length) {
    await Promise.all(missing.map(async (p) => {
      try {
        const res  = await fetch(`https://pokeapi.co/api/v2/pokemon/${p.id}`);
        const data = await res.json();
        cache[p.id] = data.name;
      } catch {
        cache[p.id] = `#${p.id}`;
      }
    }));
    saveNameCache(cache);
  }

  capturedList.forEach(p => { p.name = cache[p.id] || `#${p.id}`; });
}

// ---- BUILD PARTY SLOTS ----
async function buildPartySlots() {
  loadCapturedList();
  carregarPartyAssignments();

  // Sanidade: se um pokémon salvo num slot não está mais na lista de capturados
  // (ex: foi liberado na Pokédex), limpa a alocação.
  const capturedIds = new Set(capturedList.map(p => String(p.id)));
  for (let i = 1; i <= 6; i++) {
    if (partyAssignments[i] && !capturedIds.has(String(partyAssignments[i]))) {
      partyAssignments[i] = null;
    }
  }
  salvarPartyAssignments();

  const container = document.getElementById('partySlots');
  const grid = document.createElement('div');
  grid.className = 'pokemon-party-grid';

  for (let i = 1; i <= 6; i++) {
    grid.appendChild(buildSlot(i));
  }
  container.appendChild(grid);

  // attach listeners after building
  for (let i = 1; i <= 6; i++) {
    attachSlotListeners(i);
  }

  // popula os dropdowns (nomes podem chegar um pouco depois, via PokeAPI)
  populateCapturedDropdowns();
  if (capturedList.length) {
    await ensureCapturedNames();
    populateCapturedDropdowns(); // re-popula já com nomes carregados

    // Restaura visualmente (nome/tipo/sprite) os slots que já tinham um pokémon alocado
    for (let i = 1; i <= 6; i++) {
      if (partyAssignments[i]) await restoreSlotVisuals(i, partyAssignments[i]);
    }
  }
}

// Restaura nome/tipo/sprite de um slot a partir do id já alocado, sem mexer no estado de ocupação
async function restoreSlotVisuals(i, id) {
  const cache = loadNameCache();
  document.getElementById(`pokemonDexId${i}`).value = id;

  const sel = document.getElementById(`pokemonSelect${i}`);
  if (sel) sel.value = String(id);

  const sprite = document.getElementById(`slotSprite${i}`);
  if (sprite) {
    sprite.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
    sprite.style.display = 'inline-block';
  }

  // Se o nome/tipo ainda não foram preenchidos manualmente, busca pra exibir
  const nameInput = document.getElementById(`pokemonName${i}`);
  if (nameInput && !nameInput.value && cache[id]) {
    nameInput.value = capitalize(cache[id]);
    updateSlotName(i);
  }
}

function getOccupiedIds(excludeSlot = null) {
  const set = new Set();
  Object.entries(partyAssignments).forEach(([slot, id]) => {
    if (id && Number(slot) !== Number(excludeSlot)) set.add(String(id));
  });
  return set;
}

function populateCapturedDropdowns() {
  for (let i = 1; i <= 6; i++) {
    const sel = document.getElementById(`pokemonSelect${i}`);
    if (!sel) continue;

    const occupied   = getOccupiedIds(i); // ignora o próprio slot
    const available  = capturedList.filter(p => !occupied.has(String(p.id)));
    const currentVal = partyAssignments[i] ? String(partyAssignments[i]) : '';

    const options = available.map(p =>
      `<option value="${p.id}">#${String(p.id).padStart(3,'0')} ${p.name ? capitalize(p.name) : '...'}</option>`
    ).join('');

    sel.innerHTML = `<option value="">${capturedList.length ? '— Selecione um capturado —' : '— Nenhum Pokémon capturado ainda —'}</option>${options}`;
    sel.disabled = capturedList.length === 0;
    sel.value = currentVal;
  }
  renderFarm();
}

// ---- FARM: capturados que não estão em nenhum slot ----
function renderFarm() {
  const container = document.getElementById('farmList');
  if (!container) return;

  const occupied  = getOccupiedIds();
  const farmMons  = capturedList.filter(p => !occupied.has(String(p.id)));

  if (!capturedList.length) {
    container.innerHTML = `<p class="farm-empty">Nenhum Pokémon capturado ainda. Capture na Pokédex para vê-los aparecer aqui.</p>`;
    return;
  }

  if (!farmMons.length) {
    container.innerHTML = `<p class="farm-empty">Todos os seus Pokémon capturados estão na party! 🎉</p>`;
    return;
  }

  container.innerHTML = farmMons.map(p => {
    const img = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png`;
    return `
      <div class="farm-card" data-id="${p.id}">
        <img src="${img}" alt="${p.name || ''}" loading="lazy">
        <div class="farm-card-num">#${String(p.id).padStart(3,'0')}</div>
        <div class="farm-card-name">${p.name ? capitalize(p.name) : '...'}</div>
      </div>
    `;
  }).join('');
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildSlot(i) {
  const nums = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣'];

  const typeOptions = POKEMON_TYPES_EN.map(t =>
    `<option value="${t}">${t}</option>`
  ).join('');

  const statusOptions = STATUS_CONDITIONS.map(s =>
    `<option value="${s.value}">${s.label}</option>`
  ).join('');

  const div = document.createElement('div');
  div.className = 'pokemon-slot';
  div.id = `slot-${i}`;
  div.innerHTML = `
    <div class="slot-header">
      <span class="slot-number">${nums[i-1]}</span>
      <img class="slot-sprite" id="slotSprite${i}" style="display:none" alt="">
      <span class="slot-name" id="slotName${i}">Empty slot</span>
    </div>
    <input type="hidden" name="pokedexId${i}" id="pokemonDexId${i}">

    <div class="slot-fields">
      <div class="slot-level-row">
        <div class="slot-field-label">🔴 Escolher da Pokédex (capturados)</div>
        <select id="pokemonSelect${i}" class="pokemon-select-captured">
          <option value="">— Nenhum Pokémon capturado ainda —</option>
        </select>
        <div class="select-hint" id="selectHint${i}"></div>
      </div>

      <div>
        <div class="slot-field-label">Name</div>
        <input type="text" name="pokemon${i}" id="pokemonName${i}"
               placeholder="Pokémon name" class="pokemon-name-input">
      </div>
      <div>
        <div class="slot-field-label">Nickname</div>
        <input type="text" name="nickname${i}" id="pokemonNickname${i}"
               placeholder="Apelido (opcional)">
      </div>

      <div>
        <div class="slot-field-label">Type 1</div>
        <select name="type1_${i}" id="pokemonType1_${i}" class="pokemon-type-select">
          <option value="">— Type —</option>
          ${typeOptions}
        </select>
      </div>
      <div>
        <div class="slot-field-label">Type 2</div>
        <select name="type2_${i}" id="pokemonType2_${i}" class="pokemon-type-select">
          <option value="">—</option>
          ${typeOptions}
        </select>
      </div>

      <div class="slot-level-row">
        <div class="slot-field-label">❤️ Vida (9 bolinhas)</div>
        <div class="hp-bubbles" id="hpBubbles${i}"></div>
        <span class="hp-count" id="hpCount${i}">9 / 9</span>
        <input type="hidden" name="hp${i}" id="pokemonHp${i}" value="9">
      </div>

      <div class="slot-level-row">
        <div class="slot-field-label">Level</div>
        <input type="number" name="level${i}" id="pokemonLevel${i}"
               placeholder="1" min="1" max="100" class="pokemon-level-input">
        <div class="evo-row" id="evoRow${i}"></div>
      </div>

      <div class="slot-level-row" style="margin-top:10px">
        <div class="slot-field-label">Status Condition</div>
        <select name="status${i}" id="pokemonStatus${i}" class="pokemon-status-select">
          ${statusOptions}
        </select>
        <div style="margin-top:6px">
          <span class="status-badge none" id="statusBadge${i}">✅ Healthy</span>
        </div>
      </div>
    </div>
  `;
  return div;
}

function attachSlotListeners(i) {
  const nameInput   = document.getElementById(`pokemonName${i}`);
  const levelInput  = document.getElementById(`pokemonLevel${i}`);
  const statusSel   = document.getElementById(`pokemonStatus${i}`);
  const type1Sel    = document.getElementById(`pokemonType1_${i}`);
  const captureSel  = document.getElementById(`pokemonSelect${i}`);

  nameInput.addEventListener('input', () => updateSlotName(i));
  levelInput.addEventListener('input', () => updateLevelDisplay(i));
  statusSel.addEventListener('change', () => updateStatusBadge(i));
  type1Sel.addEventListener('change', () => updateSlotColor(i));
  captureSel.addEventListener('change', () => fillFromPokedex(i));

  buildHpBubbles(i);
  renderHpBubbles(i);

  // also trigger on any change for autosave
  document.querySelectorAll(`#slot-${i} input, #slot-${i} select`).forEach(el => {
    el.addEventListener('change', salvarDados);
    el.addEventListener('input', salvarDados);
  });
}

// ---- AUTO-FILL a partir do Pokémon selecionado no dropdown (capturados) ----
async function fillFromPokedex(i) {
  const sel  = document.getElementById(`pokemonSelect${i}`);
  const hint = document.getElementById(`selectHint${i}`);
  const id   = sel.value;

  if (!id) {
    document.getElementById(`pokemonDexId${i}`).value = '';
    partyAssignments[i] = null;
    hint.textContent = '';
    populateCapturedDropdowns(); // libera o antigo pra farm/outros slots
    salvarPartyAssignments();
    return;
  }

  hint.textContent = '⏳ Buscando dados na Pokédex...';

  try {
    const res  = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
    const data = await res.json();

    // Nome
    const nameInput = document.getElementById(`pokemonName${i}`);
    nameInput.value = capitalize(data.name);

    // Tipos
    const types = data.types.map(t => capitalize(t.type.name));
    document.getElementById(`pokemonType1_${i}`).value = types[0] || '';
    document.getElementById(`pokemonType2_${i}`).value = types[1] || '';

    // ID do pokédex (guardado em campo hidden, útil para referência futura)
    document.getElementById(`pokemonDexId${i}`).value = id;

    // Atualiza estado de ocupação (libera o slot do valor antigo automaticamente)
    partyAssignments[i] = String(id);
    salvarPartyAssignments();

    // Sprite no header do slot
    const sprite = document.getElementById(`slotSprite${i}`);
    const imgSrc = data.sprites?.front_default
                || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
    sprite.src = imgSrc;
    sprite.style.display = 'inline-block';

    // Atualiza visuais dependentes
    updateSlotName(i);
    updateSlotColor(i);
    populateCapturedDropdowns(); // remove esse pokémon dos outros dropdowns + atualiza farm
    salvarDados();

    hint.textContent = `✅ Dados carregados de #${String(id).padStart(3,'0')} ${capitalize(data.name)}`;
  } catch (err) {
    console.error('Erro ao buscar Pokémon da Pokédex:', err);
    hint.textContent = '❌ Erro ao buscar dados. Tente novamente.';
  }
}

// ---- Persistência das alocações da party (separado do localStorage da ficha em si,
//      pra não depender da serialização do FormData) ----
function salvarPartyAssignments() {
  localStorage.setItem('fichaPartyAssignments', JSON.stringify(partyAssignments));
}
function carregarPartyAssignments() {
  const raw = localStorage.getItem('fichaPartyAssignments');
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    for (let i = 1; i <= 6; i++) {
      partyAssignments[i] = saved[i] || null;
    }
  } catch { /* ignore */ }
}

function updateSlotName(i) {
  const val = document.getElementById(`pokemonName${i}`).value.trim();
  const label = document.getElementById(`slotName${i}`);
  label.textContent = val || 'Empty slot';
  const slot = document.getElementById(`slot-${i}`);
  slot.classList.toggle('has-pokemon', val.length > 0);
  updateEvoStages(i, parseInt(document.getElementById(`pokemonLevel${i}`).value) || 0);
}

function updateLevelDisplay(i) {
  const level = parseInt(document.getElementById(`pokemonLevel${i}`).value) || 0;
  updateEvoStages(i, level);
}

// Very simplified evolution bands — the "narrative" approach:
// shows milestone stages (<= 16, <= 36, <= 100)
function updateEvoStages(i, level) {
  const evoRow = document.getElementById(`evoRow${i}`);
  if (!evoRow) return;
  const name = document.getElementById(`pokemonName${i}`).value.trim();
  if (!name || !level) { evoRow.innerHTML = ''; return; }

  const stages = [
    { label: 'Base Form',  min: 0,  max: 15  },
    { label: 'Stage 2',   min: 16, max: 35  },
    { label: 'Stage 3',   min: 36, max: 100 },
  ];

  evoRow.innerHTML = stages.map(s => {
    let cls = 'future';
    if (level > s.max) cls = 'achieved';
    else if (level >= s.min) cls = 'next';
    return `<span class="evo-stage ${cls}">${cls === 'achieved' ? '✓ ' : cls === 'next' ? '▶ ' : ''}${s.label}</span>`;
  }).join('');
}

// ---- VIDA (9 BOLINHAS) ----
const HP_MAX = 9;

function buildHpBubbles(i) {
  const container = document.getElementById(`hpBubbles${i}`);
  if (!container) return;
  let html = '';
  for (let n = 1; n <= HP_MAX; n++) {
    html += `<span class="hp-bubble" data-n="${n}" title="Bolinha ${n}"></span>`;
  }
  container.innerHTML = html;

  container.querySelectorAll('.hp-bubble').forEach(bubble => {
    bubble.addEventListener('click', () => onHpBubbleClick(i, parseInt(bubble.dataset.n)));
  });
}

function onHpBubbleClick(i, n) {
  const hidden  = document.getElementById(`pokemonHp${i}`);
  const current = parseInt(hidden.value);

  // Clicar numa bolinha cheia apaga ela (e tudo à direita fica vida perdida).
  // Clicar numa bolinha já apagada restaura a vida até ali.
  let next;
  if (n <= current) {
    next = n - 1; // perde vida: fica com (n-1) bolinhas acesas
  } else {
    next = n; // restaura vida até a bolinha clicada
  }
  setHp(i, next);
  salvarDados();
}

function setHp(i, value) {
  const clamped = Math.max(0, Math.min(HP_MAX, value));
  const hidden  = document.getElementById(`pokemonHp${i}`);
  hidden.value  = clamped;
  renderHpBubbles(i);
}

function renderHpBubbles(i) {
  const hidden = document.getElementById(`pokemonHp${i}`);
  if (!hidden) return;
  const current = parseInt(hidden.value);
  const count   = document.getElementById(`hpCount${i}`);
  const slot    = document.getElementById(`slot-${i}`);

  document.querySelectorAll(`#hpBubbles${i} .hp-bubble`).forEach(bubble => {
    const n = parseInt(bubble.dataset.n);
    bubble.classList.toggle('filled', n <= current);
  });

  if (count) count.textContent = `${current} / ${HP_MAX}`;

  // Reflete vida 0 no badge de status (Fainted), sem sobrescrever outras condições manuais
  const statusSel = document.getElementById(`pokemonStatus${i}`);
  if (slot) slot.classList.toggle('fainted', current === 0);
  if (current === 0 && statusSel && statusSel.value !== 'FNT') {
    statusSel.value = 'FNT';
    updateStatusBadge(i);
  } else if (current > 0 && statusSel && statusSel.value === 'FNT') {
    statusSel.value = '';
    updateStatusBadge(i);
  }
}

function updateStatusBadge(i) {
  const sel   = document.getElementById(`pokemonStatus${i}`);
  const badge = document.getElementById(`statusBadge${i}`);
  const found = STATUS_CONDITIONS.find(s => s.value === sel.value) || STATUS_CONDITIONS[0];
  badge.className = `status-badge ${found.cls}`;
  badge.textContent = found.label;
}

function updateSlotColor(i) {
  const type = document.getElementById(`pokemonType1_${i}`).value;
  const slot  = document.getElementById(`slot-${i}`);
  if (type && TYPE_COLORS[type]) {
    const c = TYPE_COLORS[type];
    slot.style.borderColor = c + '66';
    slot.style.background  = `linear-gradient(135deg, ${c}18 0%, rgba(255,255,255,0.03) 100%)`;
  } else {
    slot.style.borderColor = '';
    slot.style.background  = '';
  }
}

// ---- PHOTO UPLOAD ----
function initFotoUpload() {
  const area    = document.getElementById('fotoArea');
  const input   = document.getElementById('fotoInput');
  const preview = document.getElementById('fotoPreview');
  const ph      = document.getElementById('fotoPlaceholder');
  const remove  = document.getElementById('fotoRemove');

  area.addEventListener('click', (e) => {
    if (e.target === remove) return;
    input.click();
  });

  area.addEventListener('dragover', (e) => {
    e.preventDefault();
    area.style.borderColor = 'var(--pokeyellow)';
  });
  area.addEventListener('dragleave', () => {
    area.style.borderColor = '';
  });
  area.addEventListener('drop', (e) => {
    e.preventDefault();
    area.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) setFoto(file);
  });

  input.addEventListener('change', () => {
    if (input.files[0]) setFoto(input.files[0]);
  });

  remove.addEventListener('click', (e) => {
    e.stopPropagation();
    clearFoto();
  });

  // Load saved photo from localStorage
  const savedFoto = localStorage.getItem('fichaPokemon_foto');
  if (savedFoto) {
    preview.src = savedFoto;
    preview.style.display = 'block';
    ph.style.display = 'none';
    remove.style.display = 'flex';
  }
}

function setFoto(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const data = e.target.result;
    document.getElementById('fotoPreview').src = data;
    document.getElementById('fotoPreview').style.display = 'block';
    document.getElementById('fotoPlaceholder').style.display = 'none';
    document.getElementById('fotoRemove').style.display = 'flex';
    localStorage.setItem('fichaPokemon_foto', data);
    mostrarNotificacao('🎴 Foto salva!');
  };
  reader.readAsDataURL(file);
}

function clearFoto() {
  document.getElementById('fotoPreview').src = '';
  document.getElementById('fotoPreview').style.display = 'none';
  document.getElementById('fotoPlaceholder').style.display = 'flex';
  document.getElementById('fotoRemove').style.display = 'none';
  localStorage.removeItem('fichaPokemon_foto');
}

// ---- SAVE / LOAD ----
const form = document.getElementById('fichaPokemon');

function salvarDados() {
  const formData = new FormData(form);
  const dados = {};
  formData.forEach((v, k) => { dados[k] = v; });
  localStorage.setItem('fichaPokemon', JSON.stringify(dados));
}

function carregarDados() {
  const raw = localStorage.getItem('fichaPokemon');
  if (!raw) return;
  const dados = JSON.parse(raw);
  Object.keys(dados).forEach(k => {
    const el = form.elements[k];
    if (el) el.value = dados[k];
  });
  // Re-trigger visual updates
  for (let i = 1; i <= 6; i++) {
    updateSlotName(i);
    updateLevelDisplay(i);
    updateStatusBadge(i);
    updateSlotColor(i);
    renderHpBubbles(i);
  }
}

// ---- NOTIFICATION ----
function mostrarNotificacao(msg, tipo = '') {
  const n = document.createElement('div');
  n.className = 'notificacao' + (tipo ? ` ${tipo}` : '');
  n.textContent = msg;
  document.body.appendChild(n);
  setTimeout(() => {
    n.style.animation = 'slideOutRight 0.3s ease-out forwards';
    setTimeout(() => n.remove(), 300);
  }, 2800);
}

// ---- KEYBOARD SHORTCUTS ----
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    salvarDados();
    mostrarNotificacao('✅ Ficha salva!');
  }
});

// ---- FORM SUBMIT ----
form.addEventListener('submit', (e) => {
  e.preventDefault();
  salvarDados();
  mostrarNotificacao('✅ Ficha salva com sucesso!');
});

// ---- FORM RESET ----
form.addEventListener('reset', () => {
  setTimeout(() => {
    for (let i = 1; i <= 6; i++) {
      updateSlotName(i);
      updateLevelDisplay(i);
      updateStatusBadge(i);
      updateSlotColor(i);
      setHp(i, HP_MAX); // reset reinicia vida pra 9/9
    }
    mostrarNotificacao('🔄 Campos limpos!', 'aviso');
  }, 10);
});

// ---- AUTO SAVE on any change ----
form.addEventListener('change', salvarDados);

// ---- INIT ----
document.addEventListener('DOMContentLoaded', async () => {
  await buildPartySlots();
  initFotoUpload();
  carregarDados();
  populateCapturedDropdowns(); // garante que os selects refletem o estado final pós-carregarDados
  console.log('🔴⚪ Ficha de Pokémon carregada!');
});
