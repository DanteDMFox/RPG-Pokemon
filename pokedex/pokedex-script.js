// ============================================
//  POKÉDEX — RPG POKÉMON
// ============================================

const TYPE_COLORS = {
  normal:'#A8A878', fire:'#F08030', water:'#6890F0', electric:'#F8D030',
  grass:'#78C850', ice:'#98D8D8', fighting:'#C03028', poison:'#A040A0',
  ground:'#E0C068', flying:'#A890F0', psychic:'#F85888', bug:'#A8B820',
  rock:'#B8A038', ghost:'#705898', dragon:'#7038F8', dark:'#705848',
  steel:'#B8B8D0', fairy:'#EE99AC'
};

const STAT_COLORS = {
  hp:'#FF5959', attack:'#F5AC78', defense:'#FAE078',
  'special-attack':'#9DB7F5', 'special-defense':'#A7DB8D', speed:'#FA92B2'
};

const STAT_LABELS = {
  hp:'HP', attack:'ATK', defense:'DEF',
  'special-attack':'SpATK', 'special-defense':'SpDEF', speed:'SPD'
};

// ---- Global state ----
let allPokemon   = [];
let captured     = new Set();
let filterType   = '';
let showCaptured = false;
// Holds the raw moves array of the currently open pokemon (for lazy loading)
let currentMoves = [];
let movesLoaded  = false;

// ---- DOM refs ----
const grid            = document.getElementById('pokemonGrid');
const searchInput     = document.getElementById('searchInput');
const typeFilter      = document.getElementById('typeFilter');
const capturedFilter  = document.getElementById('capturedFilter');
const resetBtn        = document.getElementById('resetBtn');
const capturedCount   = document.getElementById('capturedCount');
const totalCount      = document.getElementById('totalCount');
const progressPercent = document.getElementById('progressPercent');
const progressBar     = document.getElementById('progressBar');
const modal           = document.getElementById('modalDetalhes');
const modalBody       = document.getElementById('modalBody');
const modalClose      = document.getElementById('modalClose');

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  loadCaptured();
  loadAllPokemon();
});

searchInput.addEventListener('input', filterPokemon);
typeFilter.addEventListener('change', () => { filterType = typeFilter.value; filterPokemon(); });
capturedFilter.addEventListener('click', () => {
  showCaptured = !showCaptured;
  capturedFilter.classList.toggle('active', showCaptured);
  filterPokemon();
});
resetBtn.addEventListener('click', confirmReset);
modalClose.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

// ---- Load all Pokémon ----
async function loadAllPokemon() {
  grid.innerHTML = '<div class="pdx-loading">⏳ Carregando Pokédex...</div>';
  try {
    const res  = await fetch('https://pokeapi.co/api/v2/pokemon?limit=1025&offset=0');
    const data = await res.json();

    const results = [];
    const BATCH   = 50;
    for (let i = 0; i < data.results.length; i += BATCH) {
      const batch    = data.results.slice(i, i + BATCH).map(p =>
        fetch(p.url).then(r => r.json()).catch(() => null)
      );
      const resolved = await Promise.all(batch);
      results.push(...resolved);
    }

    allPokemon = results.filter(Boolean);
    totalCount.textContent = allPokemon.length;
    updateProgress();
    renderPokemon(allPokemon);
  } catch (err) {
    grid.innerHTML = '<div class="pdx-loading">❌ Erro ao carregar. Verifique sua conexão.</div>';
    console.error(err);
  }
}

// ---- Render grid ----
function renderPokemon(list) {
  grid.innerHTML = '';
  if (list.length === 0) {
    grid.innerHTML = '<div class="pdx-loading">😢 Nenhum Pokémon encontrado</div>';
    return;
  }
  const frag = document.createDocumentFragment();
  list.forEach(p => frag.appendChild(makeCard(p)));
  grid.appendChild(frag);
}

function makeCard(p) {
  const isCap  = captured.has(p.id);
  const card   = document.createElement('div');
  card.className   = 'pdx-card' + (isCap ? ' captured' : '');
  card.dataset.id  = p.id;

  const imgSrc = p.sprites?.other?.['official-artwork']?.front_default
              || p.sprites?.front_default
              || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png`;

  const types = p.types.map(t =>
    `<span class="pdx-type-badge" style="background:${TYPE_COLORS[t.type.name] || '#888'}">${t.type.name}</span>`
  ).join('');

  card.innerHTML = `
    <div class="pdx-card-num">#${String(p.id).padStart(3, '0')}</div>
    <img class="pdx-card-img" src="${imgSrc}" alt="${p.name}" loading="lazy"
         onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png'">
    <div class="pdx-card-name">${p.name}</div>
    <div class="pdx-card-types">${types}</div>
  `;
  card.addEventListener('click', () => openModal(p));
  return card;
}

// ---- Modal ----
async function openModal(p) {
  // Reset lazy-load state for this new pokemon
  currentMoves = p.moves || [];
  movesLoaded  = false;

  modalBody.innerHTML = '<div class="pdx-loading" style="padding:40px">⏳ Carregando...</div>';
  modal.classList.add('show');

  try {
    // 1. Species → description
    const specRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${p.id}`);
    const species = await specRes.json();

    let descricao = 'Descrição não disponível.';
    const entry = (species.flavor_text_entries || []).find(e => e.language.name === 'pt-BR')
               || (species.flavor_text_entries || []).find(e => e.language.name === 'pt')
               || (species.flavor_text_entries || []).find(e => e.language.name === 'en');
    if (entry) descricao = entry.flavor_text.replace(/\f/g, ' ').replace(/\n/g, ' ').trim();

    // 2. Type effectiveness
    const typeData = await Promise.all(p.types.map(t => fetch(t.type.url).then(r => r.json())));
    const weakTo  = new Set();
    const strongVs = new Set();
    const immuneTo = new Set();
    typeData.forEach(td => {
      td.damage_relations.double_damage_from.forEach(t => weakTo.add(t.name));
      td.damage_relations.double_damage_to.forEach(t => strongVs.add(t.name));
      td.damage_relations.no_damage_from.forEach(t => immuneTo.add(t.name));
    });

    // 3. Base stats HTML
    const typeBadge = t =>
      `<span class="pdx-type-badge" style="background:${TYPE_COLORS[t] || '#888'};padding:4px 10px;border-radius:4px;font-size:0.72rem">${t}</span>`;

    const statsHTML = (p.stats || []).map(s => {
      const pct   = Math.round((s.base_stat / 255) * 100);
      const color = STAT_COLORS[s.stat.name] || '#aaa';
      const label = STAT_LABELS[s.stat.name] || s.stat.name.toUpperCase();
      return `
        <div class="stat-row">
          <span class="stat-name">${label}</span>
          <div class="stat-bar-wrap">
            <div class="stat-bar-fill" style="width:${pct}%;background:${color}"></div>
          </div>
          <span class="stat-val">${s.base_stat}</span>
        </div>`;
    }).join('');

    const ownTypes = p.types.map(t => typeBadge(t.type.name)).join(' ');
    const categoria = species.genera?.find(g => g.language.name === 'en')?.genus || '—';

    // 4. Render modal
    modalBody.innerHTML = `
      <div class="modal-pokemon-image">
        <img src="${p.sprites?.other?.['official-artwork']?.front_default || p.sprites?.front_default}"
             alt="${p.name}"
             onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png'">
      </div>
      <div class="modal-pokemon-name">#${String(p.id).padStart(3,'0')} ${p.name}</div>

      <div class="modal-tabs">
        <button class="tab-btn active" data-tab="info">Info</button>
        <button class="tab-btn" data-tab="stats">Stats</button>
        <button class="tab-btn" data-tab="types">Types</button>
        <button class="tab-btn" data-tab="moves">Moves</button>
      </div>

      <!-- INFO -->
      <div id="tab-info" class="tab-content active">
        <div class="detail-grid">
          <div class="detail-item">
            <div class="detail-label">Tipos</div>
            <div class="detail-value" style="margin-top:4px">${ownTypes}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Status</div>
            <div class="detail-value capture-status">${captured.has(p.id) ? '✅ Capturado' : '❌ Não capturado'}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Altura</div>
            <div class="detail-value">${(p.height / 10).toFixed(1)} m</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Peso</div>
            <div class="detail-value">${(p.weight / 10).toFixed(1)} kg</div>
          </div>
          <div class="detail-item full">
            <div class="detail-label">Categoria</div>
            <div class="detail-value">${categoria}</div>
          </div>
        </div>
        <div class="pdx-description">${descricao}</div>
      </div>

      <!-- STATS -->
      <div id="tab-stats" class="tab-content">
        <div class="stats-list">
          ${statsHTML || '<p style="color:var(--text-gray)">Stats não disponíveis</p>'}
        </div>
      </div>

      <!-- TYPES -->
      <div id="tab-types" class="tab-content">
        <div class="efet-section">
          <h4>⚠️ Fraco contra (recebe dano 2×)</h4>
          <div class="tipos-list">
            ${weakTo.size ? [...weakTo].map(typeBadge).join('') : '<span style="color:var(--text-gray)">—</span>'}
          </div>
        </div>
        <div class="efet-section">
          <h4>✅ Forte contra (dano 2×)</h4>
          <div class="tipos-list">
            ${strongVs.size ? [...strongVs].map(typeBadge).join('') : '<span style="color:var(--text-gray)">—</span>'}
          </div>
        </div>
        <div class="efet-section">
          <h4>🛡️ Imune a</h4>
          <div class="tipos-list">
            ${immuneTo.size ? [...immuneTo].map(typeBadge).join('') : '<span style="color:var(--text-gray)">—</span>'}
          </div>
        </div>
      </div>

      <!-- MOVES (lazy-loaded on first click) -->
      <div id="tab-moves" class="tab-content">
        <div id="moves-placeholder" class="pdx-loading" style="padding:30px;text-align:center;color:var(--text-gray)">
          ⏳ Carregando moves...
        </div>
      </div>

      <div class="modal-actions">
        <button class="btn ${captured.has(p.id) ? 'btn-secondary' : 'btn-primary'}"
                id="captureBtn"
                onclick="toggleCapture(${p.id}, this)">
          ${captured.has(p.id) ? '❌ Liberar' : '🔴 Capturar'}
        </button>
        <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
      </div>
    `;

    // Attach tab listeners
    modalBody.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

  } catch (err) {
    console.error('Erro ao abrir modal:', err);
    modalBody.innerHTML = `
      <div class="pdx-loading" style="padding:40px;color:var(--pokered-lite)">
        ❌ Erro ao carregar detalhes.<br>
        <small style="color:var(--text-gray);font-size:0.78rem;margin-top:8px;display:block">
          ${err.message || 'Verifique sua conexão.'}
        </small>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
      </div>
    `;
  }
}

// ---- Tab switching ----
function switchTab(name) {
  modalBody.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
  modalBody.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

  const content = document.getElementById('tab-' + name);
  if (content) content.style.display = 'block';
  const btn = modalBody.querySelector('[data-tab="' + name + '"]');
  if (btn) btn.classList.add('active');

  // Lazy-load moves only when that tab is first opened
  if (name === 'moves' && !movesLoaded) {
    loadMoves();
  }
}

// ---- Lazy moves loader ----
async function loadMoves() {
  movesLoaded = true; // prevent double-loading
  const container = document.getElementById('tab-moves');
  if (!container) return;

  container.innerHTML = '<div class="pdx-loading" style="padding:20px;text-align:center">⏳ Carregando moves...</div>';

  try {
    // Take up to 80 moves, fetch details in parallel batches of 20
    const moveList = currentMoves.slice(0, 80);
    const BATCH    = 20;
    const details  = [];

    for (let i = 0; i < moveList.length; i += BATCH) {
      const batch = moveList.slice(i, i + BATCH).map(async m => {
        try {
          const res  = await fetch(m.move.url);
          const data = await res.json();
          const level = m.version_group_details?.[0]?.level_learned_at ?? 0;
          return {
            name:     data.name,
            type:     data.type.name,
            category: data.damage_class?.name || '—',
            power:    data.power    ?? '—',
            accuracy: data.accuracy ?? '—',
            pp:       data.pp       ?? '—',
            level
          };
        } catch { return null; }
      });
      const resolved = await Promise.all(batch);
      details.push(...resolved.filter(Boolean));
    }

    // Sort: level-up moves first (ascending level), then others
    details.sort((a, b) => {
      if (a.level > 0 && b.level > 0) return a.level - b.level;
      if (a.level > 0) return -1;
      if (b.level > 0) return  1;
      return a.name.localeCompare(b.name);
    });

    const catIcon = { physical:'⚔️', special:'✨', status:'🔵' };

    const movesHTML = details.map(m => `
      <div class="move-item">
        <div class="move-left">
          <span class="pdx-type-badge" style="background:${TYPE_COLORS[m.type] || '#888'};font-size:0.65rem;padding:2px 8px">${m.type}</span>
          <span class="move-name">${m.name.replace(/-/g, ' ')}</span>
        </div>
        <div class="move-meta">
          <span title="Categoria">${catIcon[m.category] || ''} ${m.category}</span>
          <span title="Poder">💥 ${m.power}</span>
          <span title="Precisão">🎯 ${m.accuracy}</span>
          <span title="PP">PP ${m.pp}</span>
          ${m.level > 0 ? `<span title="Level">Lv.${m.level}</span>` : '<span>—</span>'}
        </div>
      </div>
    `).join('');

    container.innerHTML = `
      <p style="color:var(--text-gray);font-size:0.78rem;margin-bottom:12px">
        Mostrando ${details.length} moves (nomes em inglês)
      </p>
      <div class="moves-list">${movesHTML || '<p style="color:var(--text-gray)">Nenhum move encontrado</p>'}</div>
    `;

  } catch (err) {
    container.innerHTML = `<p style="color:var(--pokered-lite);padding:20px">❌ Erro ao carregar moves: ${err.message}</p>`;
  }
}

// ---- Close modal ----
function closeModal() {
  modal.classList.remove('show');
}

// ---- Capture toggle ----
function toggleCapture(id, btn) {
  if (captured.has(id)) {
    captured.delete(id);
    btn.textContent = '🔴 Capturar';
    btn.className   = 'btn btn-primary';
  } else {
    captured.add(id);
    btn.textContent = '❌ Liberar';
    btn.className   = 'btn btn-secondary';
  }
  // Update status text in info tab
  const statusEl = modalBody.querySelector('.capture-status');
  if (statusEl) statusEl.textContent = captured.has(id) ? '✅ Capturado' : '❌ Não capturado';

  saveCaptured();
  updateCardCapture(id);
  updateProgress();
}

function updateCardCapture(id) {
  const card = grid.querySelector('[data-id="' + id + '"]');
  if (card) card.classList.toggle('captured', captured.has(id));
}

// ---- Filter ----
function filterPokemon() {
  const term = searchInput.value.toLowerCase().trim();
  let list   = allPokemon;
  if (term)        list = list.filter(p => p.name.toLowerCase().includes(term) || String(p.id).includes(term));
  if (filterType)  list = list.filter(p => p.types.some(t => t.type.name === filterType));
  if (showCaptured) list = list.filter(p => captured.has(p.id));
  renderPokemon(list);
}

// ---- Progress ----
function updateProgress() {
  const total = allPokemon.length;
  const cap   = captured.size;
  const pct   = total > 0 ? Math.round((cap / total) * 100) : 0;
  capturedCount.textContent   = cap;
  progressPercent.textContent = pct + '%';
  progressBar.style.width     = pct + '%';
}

// ---- Persist ----
function loadCaptured() {
  const raw = localStorage.getItem('pokemonCapturados');
  if (raw) captured = new Set(JSON.parse(raw));
}
function saveCaptured() {
  localStorage.setItem('pokemonCapturados', JSON.stringify([...captured]));
}

// ---- Reset ----
function confirmReset() {
  if (captured.size === 0) { alert('Nenhum Pokémon capturado!'); return; }
  if (confirm(`Liberar todos os ${captured.size} Pokémon capturados?`)) {
    captured.clear();
    saveCaptured();
    updateProgress();
    filterPokemon();
  }
}

console.log('🔴 Pokédex carregada!');
