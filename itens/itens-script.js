// ============================================
//  ITENS — RPG POKÉMON
//  Consulta de itens via PokeAPI, filtrados pelas
//  categorias mais úteis numa mesa de RPG.
// ============================================

// Categorias da PokeAPI (endpoint item-category) selecionadas por serem
// relevantes pra uma mesa: bolas de captura, cura, status, vitaminas/boost,
// evolução, berries e itens-chave. Cada entrada tem um rótulo PT-BR e uma
// cor de destaque pro badge do card.
const ITEM_CATEGORIES = [
  { slug: 'standard-balls',        label: 'Poké Bolas',        color: '#CC0000' },
  { slug: 'special-balls',         label: 'Bolas Especiais',   color: '#990000' },
  { slug: 'medicine',              label: 'Cura',               color: '#23a05a' },
  { slug: 'baking-only',           label: 'Cura (receitas)',    color: '#1a7a3a' },
  { slug: 'status-cures',          label: 'Cura de Status',     color: '#5A6DE0' },
  { slug: 'vitamins',              label: 'Vitaminas',          color: '#F8D030' },
  { slug: 'in-a-pinch',            label: 'Emergência',         color: '#E0C068' },
  { slug: 'picky-healing',         label: 'Cura Seletiva',      color: '#78C850' },
  { slug: 'training',              label: 'Treino',             color: '#F08030' },
  { slug: 'evolution',             label: 'Evolução',           color: '#7038F8' },
  { slug: 'type-enhancement',      label: 'Realce de Tipo',     color: '#A040A0' },
  { slug: 'type-protection',       label: 'Proteção de Tipo',   color: '#B8B8D0' },
  { slug: 'baking-only-berries',   label: 'Berries',            color: '#A8B820' },
  { slug: 'effort-drop',           label: 'Berries (Esforço)',  color: '#98D8D8' },
  { slug: 'medicine-berries',      label: 'Berries (Cura)',     color: '#6890F0' },
  { slug: 'flavor-berries',        label: 'Berries (Sabor)',    color: '#EE99AC' },
  { slug: 'spelunking',            label: 'Exploração',         color: '#705848' },
  { slug: 'held-items',            label: 'Itens Equipáveis',   color: '#A890F0' },
  { slug: 'choice',                label: 'Itens de Escolha',   color: '#F85888' },
  { slug: 'mega-stones',           label: 'Mega Stones',        color: '#705898' },
  { slug: 'plates',                label: 'Placas (Arceus)',    color: '#B8A038' },
  { slug: 'species-specific',      label: 'Específicos',        color: '#666666' },
  { slug: 'all-mail',              label: 'Correspondência',    color: '#A0A0A0' },
  { slug: 'plot-advancement',      label: 'Itens-Chave',        color: '#FFCC00' },
  { slug: 'unused',                label: 'Itens Diversos',     color: '#888888' },
  { slug: 'jewels',                label: 'Joias',              color: '#9DB7F5' },
  { slug: 'gameplay',              label: 'Jogabilidade',       color: '#FAE078' },
];

const CATEGORY_MAP = Object.fromEntries(ITEM_CATEGORIES.map(c => [c.slug, c]));

// ---- Global state ----
let allItems       = [];   // [{ name, url, category }]
const itemCache     = new Map(); // name -> dados completos do /item/{name}
let filterCategory  = '';

// ---- DOM refs ----
const grid            = document.getElementById('itemsGrid');
const searchInput     = document.getElementById('searchInput');
const categoryFilter  = document.getElementById('categoryFilter');
const shownCount      = document.getElementById('shownCount');
const totalCount      = document.getElementById('totalCount');
const modal           = document.getElementById('modalDetalhes');
const modalBody       = document.getElementById('modalBody');
const modalClose      = document.getElementById('modalClose');

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  populateCategoryFilter();
  loadAllItems();
});

searchInput.addEventListener('input', filterItems);
categoryFilter.addEventListener('change', () => {
  filterCategory = categoryFilter.value;
  filterItems();
});
modalClose.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

function populateCategoryFilter() {
  ITEM_CATEGORIES.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.slug;
    opt.textContent = cat.label;
    categoryFilter.appendChild(opt);
  });
}

// ---- Load items from selected categories ----
async function loadAllItems() {
  grid.innerHTML = '<div class="pdx-loading">⏳ Carregando itens...</div>';
  try {
    const catFetches = ITEM_CATEGORIES.map(cat =>
      fetch(`https://pokeapi.co/api/v2/item-category/${cat.slug}`)
        .then(r => r.ok ? r.json() : null)
        .catch(() => null)
    );
    const catResults = await Promise.all(catFetches);

    const seen = new Set();
    const items = [];
    catResults.forEach((data, idx) => {
      if (!data || !data.items) return;
      const catSlug = ITEM_CATEGORIES[idx].slug;
      data.items.forEach(it => {
        if (seen.has(it.name)) return; // evita duplicar item presente em 2 categorias
        seen.add(it.name);
        items.push({ name: it.name, url: it.url, category: catSlug });
      });
    });

    items.sort((a, b) => a.name.localeCompare(b.name));
    allItems = items;
    totalCount.textContent = allItems.length;
    renderItems(allItems);
  } catch (err) {
    grid.innerHTML = '<div class="pdx-loading">❌ Erro ao carregar. Verifique sua conexão.</div>';
    console.error(err);
  }
}

// ---- Render grid ----
function renderItems(list) {
  grid.innerHTML = '';
  shownCount.textContent = list.length;
  if (list.length === 0) {
    grid.innerHTML = '<div class="pdx-loading">😢 Nenhum item encontrado</div>';
    return;
  }
  const frag = document.createDocumentFragment();
  list.forEach(it => frag.appendChild(makeCard(it)));
  grid.appendChild(frag);
}

function spriteUrl(name) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${name}.png`;
}

function makeCard(it) {
  const cat   = CATEGORY_MAP[it.category] || { label: it.category, color: '#888' };
  const card  = document.createElement('div');
  card.className = 'item-card';
  card.style.setProperty('--card-type-color', cat.color);

  const displayName = it.name.replace(/-/g, ' ');

  card.innerHTML = `
    <div class="item-card-inner">
      <div class="item-card-img-wrap">
        <img class="item-card-img" src="${spriteUrl(it.name)}" alt="${displayName}" loading="lazy"
             onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'item-card-img-fallback',textContent:'🎒'}))">
      </div>
      <div class="item-card-name">${displayName}</div>
      <span class="item-card-cat-badge">${cat.label}</span>
    </div>
  `;
  card.addEventListener('click', () => openModal(it));
  return card;
}

// ---- Modal ----
async function openModal(it) {
  modalBody.innerHTML = '<div class="pdx-loading" style="padding:40px">⏳ Carregando...</div>';
  modal.classList.add('show');

  try {
    let data = itemCache.get(it.name);
    if (!data) {
      const res = await fetch(it.url);
      data = await res.json();
      itemCache.set(it.name, data);
    }

    const cat = CATEGORY_MAP[it.category] || { label: it.category, color: '#888' };
    const displayName = data.name.replace(/-/g, ' ');

    // Descrição: prioriza flavor_text em pt-BR/pt, depois en
    const flavorEntries = data.flavor_text_entries || [];
    let flavor = flavorEntries.find(e => e.language.name === 'pt-BR')
              || flavorEntries.find(e => e.language.name === 'pt')
              || flavorEntries.find(e => e.language.name === 'en');
    let descricao = flavor
      ? flavor.text.replace(/\f/g, ' ').replace(/\n/g, ' ').trim()
      : 'Descrição não disponível.';

    // Efeito (effect_entries), fallback em inglês
    const effEn = (data.effect_entries || []).find(e => e.language.name === 'en');
    let efeito = effEn
      ? (effEn.short_effect || effEn.effect || '').replace(/\$effect_chance/g, data.effect_chance ?? '')
      : '';

    const attrs = (data.attributes || []).map(a => a.name.replace(/-/g, ' '));
    const attrsHTML = attrs.length
      ? attrs.map(a => `<span class="item-card-cat-badge" style="background:rgba(255,255,255,0.1);color:var(--text-offwhite)">${a}</span>`).join(' ')
      : '<span style="color:var(--text-gray)">—</span>';

    modalBody.innerHTML = `
      <div class="modal-item-image">
        <img src="${spriteUrl(data.name)}" alt="${displayName}"
             onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'item-card-img-fallback',textContent:'🎒'}))">
      </div>
      <div class="modal-item-name">${displayName}</div>
      <div class="modal-item-cat">
        <span class="item-card-cat-badge" style="background:${cat.color};font-size:0.62rem;padding:3px 10px">${cat.label}</span>
      </div>

      <div class="detail-grid">
        <div class="detail-item">
          <div class="detail-label">Custo</div>
          <div class="detail-value">${data.cost ? `₽ ${data.cost}` : 'Não é vendido'}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Poder de Arremesso</div>
          <div class="detail-value">${data.fling_power ?? '—'}</div>
        </div>
        <div class="detail-item full">
          <div class="detail-label">Atributos</div>
          <div class="detail-value" style="margin-top:4px;display:flex;gap:5px;flex-wrap:wrap">${attrsHTML}</div>
        </div>
      </div>

      ${efeito ? `<div class="pdx-description" style="margin-bottom:10px">${efeito}</div>` : ''}
      <div class="pdx-description">${descricao}</div>

      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
      </div>
    `;
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

function closeModal() {
  modal.classList.remove('show');
}

// ---- Filter ----
function filterItems() {
  const term = searchInput.value.toLowerCase().trim();
  let list = allItems;
  if (term) list = list.filter(it => it.name.toLowerCase().includes(term));
  if (filterCategory) list = list.filter(it => it.category === filterCategory);
  renderItems(list);
}

console.log('🎒 Itens carregados!');
