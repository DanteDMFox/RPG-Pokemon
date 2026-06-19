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

// ---- BUILD PARTY SLOTS ----
function buildPartySlots() {
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
      <span class="slot-name" id="slotName${i}">Empty slot</span>
    </div>

    <div class="slot-fields">
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
        <div class="slot-field-label">Level</div>
        <input type="number" name="level${i}" id="pokemonLevel${i}"
               placeholder="1" min="1" max="100" class="pokemon-level-input">
        <div class="level-display">
          <div class="level-bar-wrap">
            <div class="level-bar-fill" id="levelBar${i}" style="width:1%"></div>
          </div>
          <span class="level-badge" id="levelBadge${i}">Lv.—</span>
        </div>
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

  nameInput.addEventListener('input', () => updateSlotName(i));
  levelInput.addEventListener('input', () => updateLevelBar(i));
  statusSel.addEventListener('change', () => updateStatusBadge(i));
  type1Sel.addEventListener('change', () => updateSlotColor(i));

  // also trigger on any change for autosave
  document.querySelectorAll(`#slot-${i} input, #slot-${i} select`).forEach(el => {
    el.addEventListener('change', salvarDados);
    el.addEventListener('input', salvarDados);
  });
}

function updateSlotName(i) {
  const val = document.getElementById(`pokemonName${i}`).value.trim();
  const label = document.getElementById(`slotName${i}`);
  label.textContent = val || 'Empty slot';
  const slot = document.getElementById(`slot-${i}`);
  slot.classList.toggle('has-pokemon', val.length > 0);
  updateLevelBar(i);
}

function updateLevelBar(i) {
  const level = parseInt(document.getElementById(`pokemonLevel${i}`).value) || 0;
  const capped = Math.min(100, Math.max(0, level));
  document.getElementById(`levelBar${i}`).style.width = `${capped}%`;
  document.getElementById(`levelBadge${i}`).textContent = level > 0 ? `Lv.${level}` : 'Lv.—';
  updateEvoStages(i, level);
}

// Very simplified evolution bands — the "narrative" approach:
// shows milestone stages (<= 16, <= 36, <= 100)
function updateEvoStages(i, level) {
  const evoRow = document.getElementById(`evoRow${i}`);
  const name   = document.getElementById(`pokemonName${i}`).value.trim();
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
    updateLevelBar(i);
    updateStatusBadge(i);
    updateSlotColor(i);
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
      updateLevelBar(i);
      updateStatusBadge(i);
      updateSlotColor(i);
    }
    mostrarNotificacao('🔄 Campos limpos!', 'aviso');
  }, 10);
});

// ---- AUTO SAVE on any change ----
form.addEventListener('change', salvarDados);

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
  buildPartySlots();
  initFotoUpload();
  carregarDados();
  console.log('🔴⚪ Ficha de Pokémon carregada!');
});
