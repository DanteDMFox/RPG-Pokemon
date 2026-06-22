// ============================================
//  THEME ENGINE — RPG POKÉMON
//  Sistema central de temas visuais. Injeta o botão "Temas" na navbar,
//  troca a paleta via atributo [data-theme] no <html>, e expõe uma função
//  pra cada página pedir o sprite "certo" pro tema atual.
//
//  Pra adicionar um tema novo no futuro:
//   1. Criar themes/<id>.css com as overrides de [data-theme="<id>"]
//   2. Adicionar a entrada em THEMES abaixo (id, nome, ícone, spriteKey)
//   3. Linkar o novo themes/<id>.css no <head> de cada página (ou,
//      melhor, deixar carregado sempre — é só CSS, custo baixo)
// ============================================

const THEME_STORAGE_KEY = 'fichaPokemon_theme';

// Cada tema aponta pra uma "chave de sprite" que sabe montar a URL certa
// a partir do objeto `sprites` que a PokeAPI devolve em /pokemon/{id}.
// `spriteKey: 'official-artwork'` é o atual (padrão); os próximos temas
// (GBC, GBA, DS, 3D Moderno) vão preencher os outros casos do switch em
// getThemeSpriteUrl(). Por enquanto todo mundo que não for "tcg" cai no
// fallback, até a etapa de cada tema ser implementada.
const THEMES = [
  {
    id: 'tcg',
    nome: 'TCG Clássico',
    descricao: 'Cartas holográficas, artwork oficial moderno',
    icone: '🃏',
    spriteKey: 'official-artwork',
  },
  {
    id: 'gbc',
    nome: 'Game Boy Color',
    descricao: 'Pixel art da era Crystal/Gold/Silver',
    icone: '🎮',
    spriteKey: 'gen2-crystal',
  },
  {
    id: 'gba',
    nome: 'Game Boy Advance',
    descricao: 'Pixel art da era Fire Red/Leaf Green',
    icone: '📟',
    spriteKey: 'gen3-frlg',
  },
  {
    id: 'ds',
    nome: 'Nintendo DS',
    descricao: 'Pixel art animado da era Black/White',
    icone: '🕹️',
    spriteKey: 'gen5-bw-anim',
  },
  {
    id: 'home',
    nome: '3D Moderno',
    descricao: 'Renders 3D no estilo Pokémon Home',
    icone: '✨',
    spriteKey: 'home-3d',
  },
];

function getThemeById(id) {
  return THEMES.find(t => t.id === id) || THEMES[0];
}

function getCurrentThemeId() {
  return localStorage.getItem(THEME_STORAGE_KEY) || 'tcg';
}

function setCurrentThemeId(id) {
  localStorage.setItem(THEME_STORAGE_KEY, id);
  applyTheme(id);
}

// Aplica o atributo no <html>, que dispara as overrides de CSS em
// themes/<id>.css (cada arquivo só faz efeito quando [data-theme="id"]
// está presente, então é seguro carregar todos os CSS de tema sempre).
function applyTheme(id) {
  const theme = getThemeById(id);
  document.documentElement.setAttribute('data-theme', theme.id);
  document.querySelectorAll('.theme-pick-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.themeId === theme.id);
  });
  const labelEl = document.getElementById('themeButtonLabel');
  if (labelEl) labelEl.textContent = `${theme.icone} ${theme.nome}`;
  document.dispatchEvent(new CustomEvent('rpgpokemon:themechange', { detail: { theme: theme.id } }));
}

// ---- SPRITE RESOLUTION ----
// Cada página chama getThemeSpriteUrl(pokemonId, spritesObj) no lugar de
// acessar sprites.other['official-artwork'] direto. Centraliza a lógica
// de "qual sprite usar" num único ponto, pra cada novo tema só precisar
// editar este switch (não cada página).
function getThemeSpriteUrl(pokemonId, spritesObj) {
  const theme = getThemeById(getCurrentThemeId());
  const RAW = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';

  switch (theme.spriteKey) {
    case 'gen2-crystal':
      return spritesObj?.versions?.['generation-ii']?.crystal?.front_default
          || `${RAW}/versions/generation-ii/crystal/${pokemonId}.png`;
    case 'gen3-frlg':
      return spritesObj?.versions?.['generation-iii']?.['firered-leafgreen']?.front_default
          || `${RAW}/versions/generation-iii/firered-leafgreen/${pokemonId}.png`;
    case 'gen5-bw-anim':
      return spritesObj?.versions?.['generation-v']?.['black-white']?.animated?.front_default
          || spritesObj?.versions?.['generation-v']?.['black-white']?.front_default
          || `${RAW}/versions/generation-v/black-white/${pokemonId}.png`;
    case 'home-3d':
      return spritesObj?.other?.home?.front_default
          || spritesObj?.other?.['official-artwork']?.front_default
          || `${RAW}/other/home/${pokemonId}.png`;
    case 'official-artwork':
    default:
      return spritesObj?.other?.['official-artwork']?.front_default
          || spritesObj?.front_default
          || `${RAW}/${pokemonId}.png`;
  }
}

// Versão "só com o ID" pra lugares que não têm o objeto sprites completo
// em mãos (ex: cards montados a partir de cache local). Sempre funciona,
// mas sem os fallbacks específicos do objeto sprites real.
function getThemeSpriteUrlById(pokemonId) {
  return getThemeSpriteUrl(pokemonId, null);
}

// Sprites antigos (Crystal vai só até #251, Fire Red/Leaf Green até #386
// etc.) não existem pra Pokémon de gerações mais novas — a PokeAPI retorna
// front_default: null e a URL hardcoded de fallback dá 404. Em vez de
// deixar a <img> quebrada, troca pra esta silhueta "?" estilo Pokédex não
// vista. É um SVG inline (data URI), então funciona sempre, sem rede.
const SPRITE_NOT_FOUND_PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="none"/>
  <path d="M32 12c-9 0-15 6-15 13h8c0-4 3-6 7-6s6 2 6 5c0 3-2 4-5 7-3 2-5 5-5 10h8c0-3 1-5 4-7 3-3 6-6 6-11 0-7-6-11-14-11z"
        fill="#9098a8"/>
  <rect x="28" y="44" width="8" height="8" fill="#9098a8"/>
</svg>`.trim());

// Anexa um onerror seguro num <img> de sprite: se a URL de tema falhar,
// cai pro placeholder "?" ao invés de ícone de imagem quebrada do navegador.
// Uso: <img src="..." onerror="window.spriteFallback(this)">
function spriteFallback(imgEl) {
  if (imgEl.dataset.fallbackApplied) return; // evita loop se o placeholder também falhar
  imgEl.dataset.fallbackApplied = '1';
  imgEl.src = SPRITE_NOT_FOUND_PLACEHOLDER;
  imgEl.classList.add('sprite-not-found');
}
window.spriteFallback = spriteFallback;


function buildThemeButtonHTML() {
  const current = getThemeById(getCurrentThemeId());
  return `
    <button type="button" class="theme-pick-trigger" id="themeButtonTrigger" title="Trocar tema visual">
      <span id="themeButtonLabel">${current.icone} ${current.nome}</span>
    </button>
  `;
}

function buildThemeModalHTML() {
  const current = getCurrentThemeId();
  const cards = THEMES.map(t => `
    <button type="button"
            class="theme-pick-btn${t.id === current ? ' active' : ''}${t.emBreve ? ' theme-pick-btn--soon' : ''}"
            data-theme-id="${t.id}"
            ${t.emBreve ? 'disabled' : ''}>
      <span class="theme-pick-icon">${t.icone}</span>
      <span class="theme-pick-name">${t.nome}</span>
      <span class="theme-pick-desc">${t.descricao}</span>
      ${t.emBreve ? '<span class="theme-pick-soon-badge">Em breve</span>' : ''}
    </button>
  `).join('');

  return `
    <div class="theme-modal" id="themeModal">
      <div class="theme-modal-content">
        <button class="theme-modal-close" id="themeModalClose" aria-label="Fechar">✕</button>
        <h2 class="theme-modal-title">🎨 Escolher Tema</h2>
        <p class="theme-modal-subtitle">Troca o visual de todo o site. Sua escolha fica salva neste navegador.</p>
        <div class="theme-modal-grid">${cards}</div>
      </div>
    </div>
  `;
}

function initThemeEngine() {
  // Injeta o botão dentro da navbar-nav (junto aos outros links), pra não
  // quebrar o layout "space-between" entre o brand e a navegação que já
  // existe em .navbar-inner.
  const navList = document.querySelector('.navbar-nav');
  if (navList) {
    const holder = document.createElement('li');
    holder.className = 'theme-pick-holder';
    holder.innerHTML = buildThemeButtonHTML();
    navList.appendChild(holder);
  }

  // Injeta o modal no fim do body
  const modalHolder = document.createElement('div');
  modalHolder.innerHTML = buildThemeModalHTML();
  document.body.appendChild(modalHolder.firstElementChild);

  const trigger = document.getElementById('themeButtonTrigger');
  const modal = document.getElementById('themeModal');
  const closeBtn = document.getElementById('themeModalClose');

  trigger?.addEventListener('click', () => modal.classList.add('show'));
  closeBtn?.addEventListener('click', () => modal.classList.remove('show'));
  modal?.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('show'); });

  modal?.querySelectorAll('.theme-pick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      setCurrentThemeId(btn.dataset.themeId);
      modal.classList.remove('show');
    });
  });

  applyTheme(getCurrentThemeId());
}

// Aplica o tema o quanto antes (antes mesmo do DOMContentLoaded) pra
// evitar "flash" da paleta padrão antes da paleta salva ser aplicada.
applyTheme(getCurrentThemeId());

document.addEventListener('DOMContentLoaded', initThemeEngine);
