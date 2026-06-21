// ============================================
//  FICHA DE PERSONAGEM — RPG POKÉMON
//  Script principal com todas as features
// ============================================

// ---- MÚLTIPLAS FICHAS (abas) ----
// Cada ficha tem um id único. Os dados de cada ficha ficam em chaves
// próprias no localStorage (namespaced por sheetId), então criar fichas
// novas (ex: NPCs do mestre) nunca sobrescreve as outras.
const SHEETS_INDEX_KEY = 'fichaPokemon_sheets'; // [{id, nome}]
const ACTIVE_SHEET_KEY = 'fichaPokemon_activeSheet';

function loadSheetsIndex() {
  try {
    const raw = localStorage.getItem(SHEETS_INDEX_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (Array.isArray(list) && list.length) return list;
  } catch { /* ignore */ }
  // Nenhuma ficha ainda: cria a primeira automaticamente
  const first = { id: criarSheetId(), nome: 'Ficha 1', editado: false };
  salvarSheetsIndex([first]);
  return [first];
}

function salvarSheetsIndex(list) {
  localStorage.setItem(SHEETS_INDEX_KEY, JSON.stringify(list));
}

function criarSheetId() {
  return 'sheet_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Acha o menor número N >= 1 tal que nenhuma ficha "não editada" (ainda no
// nome padrão "Ficha N") esteja usando esse número. Fichas renomeadas
// (editado === true) liberam seu número de volta pro próximo "Nova ficha".
function proximoNumeroLivre() {
  const usados = new Set(
    sheetsIndex
      .filter(s => !s.editado)
      .map(s => {
        const m = /^Ficha (\d+)$/.exec(s.nome);
        return m ? parseInt(m[1], 10) : null;
      })
      .filter(n => n !== null)
  );
  let n = 1;
  while (usados.has(n)) n++;
  return n;
}

let sheetsIndex = loadSheetsIndex();
let activeSheetId = localStorage.getItem(ACTIVE_SHEET_KEY);
if (!activeSheetId || !sheetsIndex.some(s => s.id === activeSheetId)) {
  activeSheetId = sheetsIndex[0].id;
  localStorage.setItem(ACTIVE_SHEET_KEY, activeSheetId);
}

// Chaves de dados que são namespaced por ficha (cada ficha tem a sua cópia)
function chaveFicha()  { return `fichaPokemon_${activeSheetId}`; }
function chaveFoto()   { return `fichaPokemon_foto_${activeSheetId}`; }
function chaveParty()  { return `fichaPartyAssignments_${activeSheetId}`; }

function renderSheetTabs() {
  const wrap = document.getElementById('sheetTabs');
  if (!wrap) return;
  wrap.innerHTML = '';

  sheetsIndex.forEach(sheet => {
    const tab = document.createElement('div');
    tab.className = 'sheet-tab' + (sheet.id === activeSheetId ? ' active' : '');
    tab.dataset.id = sheet.id;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'sheet-tab-name';
    nameSpan.textContent = sheet.nome;
    nameSpan.title = 'Duplo clique para renomear';

    nameSpan.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      nameSpan.contentEditable = 'true';
      nameSpan.focus();
      document.execCommand('selectAll', false, null);
    });
    nameSpan.addEventListener('blur', () => {
      nameSpan.contentEditable = 'false';
      const novoNome = nameSpan.textContent.trim() || 'Sem nome';
      nameSpan.textContent = novoNome;
      sheet.nome = novoNome;
      // Considera "editada" qualquer ficha cujo nome não seja exatamente o
      // padrão "Ficha N" — isso libera (ou ocupa) o número pra próxima criação.
      sheet.editado = !/^Ficha \d+$/.test(novoNome);
      salvarSheetsIndex(sheetsIndex);
    });
    nameSpan.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); nameSpan.blur(); }
      if (e.key === 'Escape') { e.preventDefault(); nameSpan.textContent = sheet.nome; nameSpan.blur(); }
    });

    tab.addEventListener('click', (e) => {
      if (nameSpan.contentEditable === 'true') return;
      if (sheet.id !== activeSheetId) trocarFicha(sheet.id);
    });

    tab.appendChild(nameSpan);

    if (sheetsIndex.length > 1) {
      const closeBtn = document.createElement('span');
      closeBtn.className = 'sheet-tab-close';
      closeBtn.textContent = '✕';
      closeBtn.title = 'Apagar esta ficha';
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        apagarFicha(sheet.id);
      });
      tab.appendChild(closeBtn);
    }

    wrap.appendChild(tab);
  });
}

// Sincroniza o nome da aba com o campo "Nome" (do treinador) do formulário.
// Editar esse campo conta como "editar o nome do personagem" — a aba passa
// a mostrar o nome digitado e libera o número "Ficha N" pra próxima criação.
function sincronizarNomeAba() {
  const nomeInput = document.getElementById('nome');
  const sheet = sheetsIndex.find(s => s.id === activeSheetId);
  if (!nomeInput || !sheet) return;

  const novoNome = nomeInput.value.trim();
  if (novoNome) {
    sheet.nome = novoNome;
    sheet.editado = !/^Ficha \d+$/.test(novoNome);
  } else {
    // Campo de nome vazio: volta a aba pro padrão "Ficha N" (próximo livre)
    // só se ela ainda não tiver um nome manual diferente preservado.
    if (!sheet.editado) return;
    sheet.nome = `Ficha ${proximoNumeroLivre()}`;
    sheet.editado = false;
  }
  salvarSheetsIndex(sheetsIndex);
  renderSheetTabs();
}

function trocarFicha(sheetId) {
  salvarDados(); // garante que a ficha atual não perde edições pendentes
  activeSheetId = sheetId;
  localStorage.setItem(ACTIVE_SHEET_KEY, activeSheetId);
  recarregarFichaAtual();
}

async function novaFicha() {
  salvarDados();
  const numero = proximoNumeroLivre();
  const novo = { id: criarSheetId(), nome: `Ficha ${numero}`, editado: false };
  sheetsIndex.push(novo);
  salvarSheetsIndex(sheetsIndex);
  activeSheetId = novo.id;
  localStorage.setItem(ACTIVE_SHEET_KEY, activeSheetId);
  await recarregarFichaAtual();
  mostrarNotificacao('✨ Nova ficha criada!');
}

function apagarFicha(sheetId) {
  if (sheetsIndex.length <= 1) return; // sempre mantém pelo menos 1 ficha
  const sheet = sheetsIndex.find(s => s.id === sheetId);
  const ok = confirm(`Apagar a ficha "${sheet ? sheet.nome : ''}"? Essa ação não pode ser desfeita.`);
  if (!ok) return;

  // Remove os dados namespaced dessa ficha
  localStorage.removeItem(`fichaPokemon_${sheetId}`);
  localStorage.removeItem(`fichaPokemon_foto_${sheetId}`);
  localStorage.removeItem(`fichaPartyAssignments_${sheetId}`);

  sheetsIndex = sheetsIndex.filter(s => s.id !== sheetId);
  salvarSheetsIndex(sheetsIndex);

  if (activeSheetId === sheetId) {
    activeSheetId = sheetsIndex[0].id;
    localStorage.setItem(ACTIVE_SHEET_KEY, activeSheetId);
    recarregarFichaAtual();
  } else {
    renderSheetTabs();
  }
  mostrarNotificacao('🗑️ Ficha apagada', 'aviso');
}

// Recarrega todo o conteúdo visual da ficha atual (usado ao trocar de aba)
async function recarregarFichaAtual() {
  renderSheetTabs();
  form.reset();
  // limpa a party visualmente antes de reconstruir, pra não vazar estado entre fichas
  partyAssignments = { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null };
  document.getElementById('partySlots').innerHTML = '';
  await buildPartySlots();
  carregarFoto();
  carregarDados();
  populateCapturedDropdowns();
}

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

// Estágios de batalha rastreados na ficha: -6 a +6, reiniciam em 0
const STAGE_ATTRS = [
  { key: 'atk', label: '⚔️ Ataque',    short: 'ATK' },
  { key: 'def', label: '🛡️ Defesa',    short: 'DEF' },
  { key: 'spd', label: '🐎 Velocidade', short: 'SPD' },
  { key: 'eva', label: '👻 Evasão',     short: 'EVA' },
  { key: 'acc', label: '🔍 Precisão',   short: 'ACC' },
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

function chaveCaptured()  { return `pokemonCapturados_${activeSheetId}`; }
function chaveNameCache() { return `pokemonNameCache_${activeSheetId}`; }

function loadCapturedList() {
  const raw = localStorage.getItem(chaveCaptured());
  if (!raw) { capturedList = []; return; }
  try {
    const ids = JSON.parse(raw);
    capturedList = [...ids].sort((a, b) => a - b).map(id => ({ id, name: null }));
  } catch {
    capturedList = [];
  }
}

// Cache de nomes (id -> nome) para não martelar a PokeAPI toda hora
function loadNameCache() {
  try { return JSON.parse(localStorage.getItem(chaveNameCache())) || {}; }
  catch { return {}; }
}
function saveNameCache(cache) {
  localStorage.setItem(chaveNameCache(), JSON.stringify(cache));
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
        <div class="farm-card-inner">
          <img src="${img}" alt="${p.name || ''}" loading="lazy">
          <div class="farm-card-num">#${String(p.id).padStart(3,'0')}</div>
          <div class="farm-card-name">${p.name ? capitalize(p.name) : '...'}</div>
        </div>
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
    <div class="slot-card-inner">
    <div class="slot-header">
      <img class="slot-sprite" id="slotSprite${i}" style="display:none" alt="">
      <div class="slot-header-text">
        <span class="slot-number">${nums[i-1]}</span>
        <span class="slot-name" id="slotName${i}">Empty slot</span>
      </div>
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
        <div class="pokemon-name-display" id="pokemonNameDisplay${i}">—</div>
        <input type="hidden" name="pokemon${i}" id="pokemonName${i}">
      </div>
      <div>
        <div class="slot-field-label">Nickname</div>
        <input type="text" name="nickname${i}" id="pokemonNickname${i}"
               placeholder="Apelido (opcional)">
      </div>

      <div>
        <div class="slot-field-label">Type 1</div>
        <div class="pokemon-type-display" id="pokemonType1Display${i}">
          <span class="type-badge-empty">—</span>
        </div>
        <input type="hidden" name="type1_${i}" id="pokemonType1_${i}">
      </div>
      <div>
        <div class="slot-field-label">Type 2</div>
        <div class="pokemon-type-display" id="pokemonType2Display${i}">
          <span class="type-badge-empty">—</span>
        </div>
        <input type="hidden" name="type2_${i}" id="pokemonType2_${i}">
      </div>

      <div class="slot-level-row">
        <div class="slot-field-label">❤️ Vida</div>
        <div class="hp-bubbles" id="hpBubbles${i}"></div>
        <span class="hp-count" id="hpCount${i}">9 / 9</span>
        <input type="hidden" name="hp${i}" id="pokemonHp${i}" value="9">
      </div>

      <div class="slot-level-row">
        <div class="slot-field-label">🧬 Estágio Evolutivo</div>
        <div class="evo-row" id="evoRow${i}"></div>
        <input type="hidden" name="evoStage${i}" id="pokemonEvoStage${i}" value="1">
      </div>

      <div class="slot-level-row">
        <div class="slot-field-label">Status</div>
        <select name="status${i}" id="pokemonStatus${i}" class="pokemon-status-select">
          ${statusOptions}
        </select>
        <span class="status-badge none" id="statusBadge${i}">✅ Healthy</span>
      </div>

      <div class="slot-level-row stage-block">
        <div class="slot-field-label">📊 Estágios de Batalha</div>
        <div class="stage-tracker-grid" id="stageTracker${i}"></div>
      </div>
    </div>
    </div>
  `;
  return div;
}

function attachSlotListeners(i) {
  const nameInput     = document.getElementById(`pokemonName${i}`);
  const nicknameInput = document.getElementById(`pokemonNickname${i}`);
  const statusSel     = document.getElementById(`pokemonStatus${i}`);
  const type1Sel      = document.getElementById(`pokemonType1_${i}`);
  const captureSel    = document.getElementById(`pokemonSelect${i}`);

  nameInput.addEventListener('input', () => updateSlotName(i));
  nicknameInput.addEventListener('input', () => updateSlotName(i));
  statusSel.addEventListener('change', () => updateStatusBadge(i));
  type1Sel.addEventListener('change', () => updateSlotColor(i));
  captureSel.addEventListener('change', () => fillFromPokedex(i));

  buildHpBubbles(i);
  renderHpBubbles(i);
  buildEvoStageSelector(i);
  buildStageTracker(i);
  renderAllStages(i);

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
    document.getElementById(`pokemonName${i}`).value = '';
    document.getElementById(`pokemonType1_${i}`).value = '';
    document.getElementById(`pokemonType2_${i}`).value = '';
    partyAssignments[i] = null;
    hint.textContent = '';
    updateSlotName(i);
    updateSlotColor(i);
    updateNameTypeDisplay(i);
    const sprite = document.getElementById(`slotSprite${i}`);
    sprite.style.display = 'none';
    sprite.removeAttribute('src');
    populateCapturedDropdowns(); // libera o antigo pra farm/outros slots
    salvarPartyAssignments();
    salvarDados();
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
    updateNameTypeDisplay(i);
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
  localStorage.setItem(chaveParty(), JSON.stringify(partyAssignments));
}
function carregarPartyAssignments() {
  const raw = localStorage.getItem(chaveParty());
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    for (let i = 1; i <= 6; i++) {
      partyAssignments[i] = saved[i] || null;
    }
  } catch { /* ignore */ }
}

function updateSlotName(i) {
  const name     = document.getElementById(`pokemonName${i}`).value.trim();
  const nickname = document.getElementById(`pokemonNickname${i}`).value.trim();
  const label    = document.getElementById(`slotName${i}`);

  // Apelido tem prioridade sobre o nome do Pokémon quando preenchido
  const displayVal = nickname || name;
  label.textContent = displayVal || 'Empty slot';

  const slot = document.getElementById(`slot-${i}`);
  slot.classList.toggle('has-pokemon', name.length > 0);
}

// ---- DISPLAY (somente leitura) do nome e dos tipos ----
// O nome do Pokémon e os tipos vêm sempre da Pokédex (via fillFromPokedex);
// não são editáveis pelo jogador, só o apelido é. Esta função espelha os
// valores guardados nos campos hidden pros divs visuais de exibição.
function updateNameTypeDisplay(i) {
  const name     = document.getElementById(`pokemonName${i}`).value.trim();
  const nameDisp = document.getElementById(`pokemonNameDisplay${i}`);
  if (nameDisp) nameDisp.textContent = name || '—';

  [1, 2].forEach(n => {
    const typeVal  = document.getElementById(`pokemonType${n}_${i}`).value.trim();
    const typeDisp = document.getElementById(`pokemonType${n}Display${i}`);
    if (!typeDisp) return;
    if (typeVal) {
      const color = TYPE_COLORS[typeVal] || '#888';
      typeDisp.innerHTML = `<span class="type-badge" style="background:${color}">${typeVal}</span>`;
    } else {
      typeDisp.innerHTML = `<span class="type-badge-empty">—</span>`;
    }
  });
}

// ---- ESTÁGIO EVOLUTIVO (marcado manualmente: Base Form / Stage 2 / Stage 3) ----
const EVO_STAGES = [
  { n: 1, label: 'Base Form' },
  { n: 2, label: 'Stage 2'   },
  { n: 3, label: 'Stage 3'   },
];

function buildEvoStageSelector(i) {
  const evoRow = document.getElementById(`evoRow${i}`);
  if (!evoRow) return;

  evoRow.innerHTML = EVO_STAGES.map(s =>
    `<span class="evo-stage" data-stage="${s.n}">${s.label}</span>`
  ).join('');

  evoRow.querySelectorAll('.evo-stage').forEach(badge => {
    badge.addEventListener('click', () => {
      setEvoStage(i, parseInt(badge.dataset.stage));
      salvarDados();
    });
  });
}

function setEvoStage(i, stage) {
  const hidden = document.getElementById(`pokemonEvoStage${i}`);
  if (hidden) hidden.value = stage;
  renderEvoStage(i);
}

function renderEvoStage(i) {
  const hidden = document.getElementById(`pokemonEvoStage${i}`);
  if (!hidden) return;
  const current = parseInt(hidden.value) || 1;

  document.querySelectorAll(`#evoRow${i} .evo-stage`).forEach(badge => {
    const n = parseInt(badge.dataset.stage);
    badge.classList.toggle('achieved', n === current);
    badge.classList.toggle('future', n !== current);
  });
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

// ---- ESTÁGIOS DE BATALHA (Ataque, Defesa, Velocidade, Evasão, Precisão: -6 a +6) ----
function buildStageTracker(i) {
  const container = document.getElementById(`stageTracker${i}`);
  if (!container) return;

  container.innerHTML = STAGE_ATTRS.map(attr => `
    <div class="stage-row" data-attr="${attr.key}">
      <span class="stage-row-label">${attr.label}</span>
      <div class="stage-pips" id="stagePips${i}_${attr.key}">
        ${buildPipsHTML(i, attr.key)}
      </div>
      <input type="hidden" name="stage_${attr.key}_${i}" id="stageVal${i}_${attr.key}" value="0">
      <span class="stage-value" id="stageValLabel${i}_${attr.key}">0</span>
    </div>
  `).join('');

  // Listeners dos pips + botão de reset
  STAGE_ATTRS.forEach(attr => {
    container.querySelectorAll(`#stagePips${i}_${attr.key} .stage-pip`).forEach(pip => {
      pip.addEventListener('click', () => onStagePipClick(i, attr.key, parseInt(pip.dataset.n)));
    });
  });
}

function buildPipsHTML(i, key) {
  // 12 pips: 6 negativos (esquerda) + 6 positivos (direita), centrados em 0
  let html = '';
  for (let n = -6; n <= 6; n++) {
    if (n === 0) {
      html += `<span class="stage-zero-marker" title="Neutro (0)"></span>`;
      continue;
    }
    const side = n < 0 ? 'neg' : 'pos';
    html += `<span class="stage-pip ${side}" data-n="${n}" title="${n > 0 ? '+' + n : n}"></span>`;
  }
  return html;
}

function onStagePipClick(i, key, n) {
  const hidden  = document.getElementById(`stageVal${i}_${key}`);
  const current = parseInt(hidden.value) || 0;

  // Clicar no mesmo estágio já ativo zera (volta pro neutro).
  // Caso contrário, define o estágio clicado.
  const next = (current === n) ? 0 : n;
  setStage(i, key, next);
  salvarDados();
}

function setStage(i, key, value) {
  const clamped = Math.max(-6, Math.min(6, value));
  const hidden  = document.getElementById(`stageVal${i}_${key}`);
  if (hidden) hidden.value = clamped;
  renderStage(i, key);
}

function renderStage(i, key) {
  const hidden = document.getElementById(`stageVal${i}_${key}`);
  if (!hidden) return;
  const current = parseInt(hidden.value) || 0;

  document.querySelectorAll(`#stagePips${i}_${key} .stage-pip`).forEach(pip => {
    const n = parseInt(pip.dataset.n);
    const filled = current >= 0 ? (n > 0 && n <= current) : (n < 0 && n >= current);
    pip.classList.toggle('filled', filled);
  });

  const label = document.getElementById(`stageValLabel${i}_${key}`);
  if (label) {
    label.textContent = current > 0 ? `+${current}` : `${current}`;
    label.classList.toggle('positive', current > 0);
    label.classList.toggle('negative', current < 0);
  }
}

function renderAllStages(i) {
  STAGE_ATTRS.forEach(attr => renderStage(i, attr.key));
}

function resetAllStages(i) {
  STAGE_ATTRS.forEach(attr => setStage(i, attr.key, 0));
}

function updateSlotColor(i) {
  const type = document.getElementById(`pokemonType1_${i}`).value;
  const slot  = document.getElementById(`slot-${i}`);
  if (type && TYPE_COLORS[type]) {
    slot.style.setProperty('--slot-accent', TYPE_COLORS[type]);
  } else {
    slot.style.removeProperty('--slot-accent');
  }
}

// ---- PHOTO UPLOAD ----
function initFotoUpload() {
  const area    = document.getElementById('fotoArea');
  const input   = document.getElementById('fotoInput');
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

  carregarFoto();
}

// Carrega (ou limpa) a foto salva da ficha ativa. Chamada na inicialização
// e sempre que o usuário troca de aba/ficha.
function carregarFoto() {
  const preview = document.getElementById('fotoPreview');
  const ph      = document.getElementById('fotoPlaceholder');
  const remove  = document.getElementById('fotoRemove');

  const savedFoto = localStorage.getItem(chaveFoto());
  if (savedFoto) {
    preview.src = savedFoto;
    preview.style.display = 'block';
    ph.style.display = 'none';
    remove.style.display = 'flex';
  } else {
    preview.src = '';
    preview.style.display = 'none';
    ph.style.display = 'flex';
    remove.style.display = 'none';
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
    localStorage.setItem(chaveFoto(), data);
    mostrarNotificacao('🎴 Foto salva!');
  };
  reader.readAsDataURL(file);
}

function clearFoto() {
  document.getElementById('fotoPreview').src = '';
  document.getElementById('fotoPreview').style.display = 'none';
  document.getElementById('fotoPlaceholder').style.display = 'flex';
  document.getElementById('fotoRemove').style.display = 'none';
  localStorage.removeItem(chaveFoto());
}

// ---- SAVE / LOAD ----
const form = document.getElementById('fichaPokemon');

function salvarDados() {
  const formData = new FormData(form);
  const dados = {};
  formData.forEach((v, k) => { dados[k] = v; });
  localStorage.setItem(chaveFicha(), JSON.stringify(dados));
}

function carregarDados() {
  const raw = localStorage.getItem(chaveFicha());
  const dados = raw ? JSON.parse(raw) : {};
  // Preenche com os dados salvos e limpa o que não existir (evita vazar
  // valores de uma ficha pra outra ao trocar de aba)
  Array.from(form.elements).forEach((el) => {
    if (!el.name) return;
    el.value = Object.prototype.hasOwnProperty.call(dados, el.name) ? dados[el.name] : '';
  });
  // Re-trigger visual updates
  for (let i = 1; i <= 6; i++) {
    updateSlotName(i);
    updateNameTypeDisplay(i);
    renderEvoStage(i);
    updateStatusBadge(i);
    updateSlotColor(i);
    renderHpBubbles(i);
    renderAllStages(i);

    // Restaura o sprite no header do slot, se houver Pokémon salvo
    const dexId  = document.getElementById(`pokemonDexId${i}`)?.value;
    const sprite = document.getElementById(`slotSprite${i}`);
    if (dexId && sprite) {
      sprite.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dexId}.png`;
      sprite.style.display = 'inline-block';
    } else if (sprite) {
      sprite.style.display = 'none';
      sprite.removeAttribute('src');
    }
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

// ---- POKÉ BOLAS (contador +/-) ----
function initBallCounters() {
  document.querySelectorAll('.ball-counter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      const delta = parseInt(btn.dataset.delta, 10) || 0;
      const atual = parseInt(input.value, 10) || 0;
      const min   = parseInt(input.min, 10) || 0;
      input.value = Math.max(min, atual + delta);
      // dispara 'change' manualmente pra disparar o auto-save (form listener)
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });

  // Corrige digitação manual (negativo ou vazio) ao sair do campo
  document.querySelectorAll('.ball-counter-input').forEach(input => {
    input.addEventListener('blur', () => {
      const min = parseInt(input.min, 10) || 0;
      const val = parseInt(input.value, 10);
      input.value = Number.isNaN(val) ? min : Math.max(min, val);
    });
  });
}

// Migra fichas antigas: o campo único "pokebolas" virava só Poké Ball comum.
// Roda uma vez por ficha, só se o novo campo ainda estiver zerado/vazio.
function migrarPokebolasAntigas() {
  const raw = localStorage.getItem(chaveFicha());
  if (!raw) return;
  try {
    const dados = JSON.parse(raw);
    if (dados.pokebolas && !dados.qtdPokeBall) {
      const input = document.getElementById('qtdPokeBall');
      if (input) {
        input.value = dados.pokebolas;
        salvarDados(); // persiste já no novo formato
      }
    }
  } catch { /* ignora ficha corrompida */ }
}

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
      setEvoStage(i, 1); // reset volta pro estágio Base Form
      updateStatusBadge(i);
      updateSlotColor(i);
      setHp(i, HP_MAX); // reset reinicia vida pra 9/9
      resetAllStages(i); // reset reinicia estágios pra 0
    }
    mostrarNotificacao('🔄 Campos limpos!', 'aviso');
  }, 10);
});

// ---- AUTO SAVE on any change ----
form.addEventListener('change', salvarDados);

// ---- NOME DO TREINADOR → sincroniza nome da aba ----
document.getElementById('nome').addEventListener('blur', sincronizarNomeAba);

// ---- INIT ----
document.addEventListener('DOMContentLoaded', async () => {
  renderSheetTabs();
  document.getElementById('sheetTabAdd').addEventListener('click', novaFicha);

  await buildPartySlots();
  initFotoUpload();
  carregarDados();
  migrarPokebolasAntigas();
  initBallCounters();
  populateCapturedDropdowns(); // garante que os selects refletem o estado final pós-carregarDados
  console.log('🔴⚪ Ficha de Pokémon carregada!');
});
