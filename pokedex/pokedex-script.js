// Cores por tipo de Pokémon
const tiposCorHex = {
    normal: '#A8A878',
    fire: '#F08030',
    water: '#6890F0',
    electric: '#F8D030',
    grass: '#78C850',
    ice: '#98D8D8',
    fighting: '#C03028',
    poison: '#A040A0',
    ground: '#E0C068',
    flying: '#A890F0',
    psychic: '#F85888',
    bug: '#A8B820',
    rock: '#B8A038',
    ghost: '#705898',
    dragon: '#7038F8',
    dark: '#705848',
    steel: '#B8B8D0',
    fairy: '#EE99AC'
};

// Dados globais
let todosPokemon = [];
let pokemonCapturados = new Set();
let filtroTipo = '';
let mostrarApenasCapturados = false;

// Elementos do DOM
const pokemonGrid = document.getElementById('pokemonGrid');
const searchInput = document.getElementById('searchInput');
const typeFilter = document.getElementById('typeFilter');
const capturedFilter = document.getElementById('capturedFilter');
const resetBtn = document.getElementById('resetBtn');
const capturedCount = document.getElementById('capturedCount');
const totalCount = document.getElementById('totalCount');
const progressPercent = document.getElementById('progressPercent');
const progressBar = document.getElementById('progressBar');
const modal = document.getElementById('modalDetalhes');
const modalBody = document.getElementById('modalBody');
const modalClose = document.querySelector('.modal-close');

// Carregar dados ao abrir a página
document.addEventListener('DOMContentLoaded', () => {
    carregarPokemonCapturados();
    carregarTodosPokemon();
});

// Event Listeners
searchInput.addEventListener('input', filtrarPokemon);
typeFilter.addEventListener('change', () => {
    filtroTipo = typeFilter.value;
    filtrarPokemon();
});
capturedFilter.addEventListener('click', () => {
    mostrarApenasCapturados = !mostrarApenasCapturados;
    capturedFilter.classList.toggle('active', mostrarApenasCapturados);
    filtrarPokemon();
});
resetBtn.addEventListener('click', confirmarLimpeza);
modalClose.addEventListener('click', fecharModal);
modal.addEventListener('click', (e) => {
    if (e.target === modal) fecharModal();
});

// Carregar Pokémon capturados do localStorage
function carregarPokemonCapturados() {
    const dados = localStorage.getItem('pokemonCapturados');
    if (dados) {
        pokemonCapturados = new Set(JSON.parse(dados));
    }
}

// Salvar Pokémon capturados no localStorage
function salvarPokemonCapturados() {
    localStorage.setItem('pokemonCapturados', JSON.stringify(Array.from(pokemonCapturados)));
}

// Carregar todos os Pokémon da API
async function carregarTodosPokemon() {
    try {
        pokemonGrid.innerHTML = '<div class="loading">⏳ Carregando Pokédex...</div>';
        
        const promises = [];
        // Carregar primeiros 1025 Pokémon (até 9ª geração)
        for (let i = 1; i <= 1025; i++) {
            promises.push(fetch(`https://pokeapi.co/api/v2/pokemon/${i}`).then(r => r.json()).catch(() => null));
        }
        
        const resultados = await Promise.all(promises);
        todosPokemon = resultados.filter(p => p !== null);
        
        totalCount.textContent = todosPokemon.length;
        atualizarProgresso();
        renderizarPokemon(todosPokemon);
        
        console.log(`✅ ${todosPokemon.length} Pokémon carregados!`);
    } catch (erro) {
        pokemonGrid.innerHTML = '<div class="loading">❌ Erro ao carregar Pokédex. Tente novamente.</div>';
        console.error('Erro ao carregar Pokémon:', erro);
    }
}

// Renderizar Pokémon no grid
function renderizarPokemon(pokemon) {
    pokemonGrid.innerHTML = '';
    
    if (pokemon.length === 0) {
        pokemonGrid.innerHTML = '<div class="loading">😢 Nenhum Pokémon encontrado</div>';
        return;
    }
    
    pokemon.forEach(p => {
        const card = criarCardPokemon(p);
        pokemonGrid.appendChild(card);
    });
}

// Criar card de Pokémon
function criarCardPokemon(pokemon) {
    const id = pokemon.id;
    const eCapturado = pokemonCapturados.has(id);
    
    const card = document.createElement('div');
    card.className = `pokemon-card ${eCapturado ? 'captured' : ''}`;
    card.innerHTML = `
        <div class="captured-badge">✓</div>
        <div class="pokemon-number">#${String(id).padStart(4, '0')}</div>
        <div class="pokemon-image">
            <img src="${pokemon.sprites.other['official-artwork'].front_default || pokemon.sprites.front_default}" 
                 alt="${pokemon.name}" 
                 onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png'">
        </div>
        <div class="pokemon-name">${pokemon.name}</div>
        <div class="pokemon-types">
            ${pokemon.types.map(t => `<span class="pokemon-type">${t.type.name}</span>`).join('')}
        </div>
    `;
    
    card.addEventListener('click', () => abrirDetalhes(pokemon, card));
    
    return card;
}

// Abrir modal com detalhes do Pokémon
async function abrirDetalhes(pokemon, card) {
    const id = pokemon.id;
    const eCapturado = pokemonCapturados.has(id);
    
    modalBody.innerHTML = `
        <div class="loading" style="padding: 30px; text-align: center;">⏳ Carregando detalhes...</div>
    `;
    modal.classList.add('show');
    
    try {
        // Carregar espécie para descrição
        const especieRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}`);
        const especie = await especieRes.json();
        
        // Buscar descrição em inglês
        let descricao = 'Descrição não disponível';
        if (especie.flavor_text_entries) {
            const entradaEn = especie.flavor_text_entries.find(e => e.language.name === 'en');
            if (entradaEn) {
                descricao = entradaEn.flavor_text.replace(/\f/g, ' ').replace(/\n/g, ' ');
            }
        }
        
        // Calcular efetividade
        const tiposCorChart = {};
        for (const typeObj of pokemon.types) {
            const typeRes = await fetch(typeObj.type.url);
            const typeData = await typeRes.json();
            tiposCorChart[typeObj.type.name] = typeData;
        }
        
        const efetivo = new Set();
        const fraco = new Set();
        
        for (const tipo in tiposCorChart) {
            const typeData = tiposCorChart[tipo];
            typeData.damage_relations.damage_from.forEach(t => fraco.add(t.name));
            typeData.damage_relations.damage_to.forEach(t => efetivo.add(t.name));
        }
        
        const tipos = pokemon.types.map(t => t.type.name);
        const neutro = Object.keys(tiposCorHex).filter(t => 
            !efetivo.has(t) && !fraco.has(t) && !tipos.includes(t)
        );
        
        // Carregar moves
        const movesDetalhes = [];
        if (pokemon.moves) {
            for (const moveInfo of pokemon.moves.slice(0, 100)) {
                try {
                    const moveRes = await fetch(moveInfo.move.url);
                    const moveData = await moveRes.json();
                    
                    let level = 'Tutor';
                    if (moveInfo.version_group_details && moveInfo.version_group_details.length > 0) {
                        level = moveInfo.version_group_details[0].level_learned_at || 'Tutor';
                    }
                    
                    movesDetalhes.push({
                        nome: moveData.name.replace(/-/g, ' ').toUpperCase(),
                        tipo: moveData.type.name,
                        nivel: level,
                        poder: moveData.power || '—',
                        precisao: moveData.accuracy || '—'
                    });
                } catch (e) {
                    console.error('Erro ao carregar move:', e);
                }
            }
        }
        
        // Ordenar moves por level
        movesDetalhes.sort((a, b) => {
            if (a.nivel === 'Tutor' && b.nivel !== 'Tutor') return 1;
            if (a.nivel !== 'Tutor' && b.nivel === 'Tutor') return -1;
            if (typeof a.nivel === 'number' && typeof b.nivel === 'number') {
                return a.nivel - b.nivel;
            }
            return 0;
        });
        
        // Renderizar modal completo
        let movesHTML = movesDetalhes.map(move => `
            <div class="move-item">
                <div class="move-name">${move.nome}</div>
                <div class="move-details">
                    <span class="move-type" style="background-color: ${tiposCorHex[move.tipo] || '#888'}; color: white; padding: 3px 8px; border-radius: 3px; font-size: 0.8rem; font-weight: bold; text-transform: uppercase;">${move.tipo}</span>
                    <span class="move-level">Lvl: ${move.nivel}</span>
                    <span class="move-power">Power: ${move.poder}</span>
                    <span class="move-accuracy">Acc: ${move.precisao}</span>
                </div>
            </div>
        `).join('');
        
        let tiposHTML = tipos.map(t => `<span style="background-color: ${tiposCorHex[t]}; color: white; padding: 5px 10px; border-radius: 5px; font-size: 0.9rem; font-weight: bold; text-transform: uppercase; display: inline-block; margin: 3px;">${t}</span>`).join('');
        
        let efetHTML = Array.from(efetivo).map(t => `<span style="background-color: ${tiposCorHex[t]}; color: white; padding: 4px 8px; border-radius: 3px; font-size: 0.75rem; font-weight: bold; text-transform: uppercase; display: inline-block; margin: 2px;">${t}</span>`).join('');
        
        let fracoHTML = Array.from(fraco).map(t => `<span style="background-color: ${tiposCorHex[t]}; color: white; padding: 4px 8px; border-radius: 3px; font-size: 0.75rem; font-weight: bold; text-transform: uppercase; display: inline-block; margin: 2px;">${t}</span>`).join('');
        
        let neutroHTML = neutro.slice(0, 10).map(t => `<span style="background-color: #ccc; color: #333; padding: 4px 8px; border-radius: 3px; font-size: 0.75rem; font-weight: bold; text-transform: uppercase; display: inline-block; margin: 2px;">${t}</span>`).join('');
        
        modalBody.innerHTML = `
            <div class="modal-pokemon-image">
                <img src="${pokemon.sprites.other['official-artwork'].front_default || pokemon.sprites.front_default}" 
                     alt="${pokemon.name}">
            </div>
            <div class="modal-pokemon-name" style="text-transform: capitalize;">${pokemon.name}</div>
            
            <div class="modal-tabs">
                <button class="tab-btn active" onclick="mostrarAba('info')">Info</button>
                <button class="tab-btn" onclick="mostrarAba('efetividade')">Type Coverage</button>
                <button class="tab-btn" onclick="mostrarAba('moves')">Moves (${movesDetalhes.length})</button>
            </div>
            
            <div id="aba-info" class="tab-content active">
                <div class="modal-pokemon-details">
                    <div class="detail-item">
                        <span class="detail-label">Número:</span>
                        <span class="detail-value">#${String(id).padStart(4, '0')}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Tipos:</span>
                        <span class="detail-value" style="display: block; margin-top: 5px;">${tiposHTML}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Altura:</span>
                        <span class="detail-value">${(pokemon.height / 10).toFixed(1)} m</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Peso:</span>
                        <span class="detail-value">${(pokemon.weight / 10).toFixed(1)} kg</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Status:</span>
                        <span class="detail-value">${eCapturado ? '✅ Captured' : '❌ Not Captured'}</span>
                    </div>
                </div>
                <div class="pokemon-description">
                    <h4>Description</h4>
                    <p>${descricao}</p>
                </div>
            </div>
            
            <div id="aba-efetividade" class="tab-content" style="display: none;">
                <div class="efetividade-container">
                    <div class="efet-section">
                        <h4>✅ Effective Against</h4>
                        <div class="tipos-list">${efetHTML || '<span style="color: #999;">None</span>'}</div>
                    </div>
                    <div class="efet-section">
                        <h4>❌ Weak To</h4>
                        <div class="tipos-list">${fracoHTML || '<span style="color: #999;">None</span>'}</div>
                    </div>
                    <div class="efet-section">
                        <h4>〰️ Neutral To</h4>
                        <div class="tipos-list">${neutroHTML || '<span style="color: #999;">None</span>'}</div>
                    </div>
                </div>
            </div>
            
            <div id="aba-moves" class="tab-content" style="display: none;">
                <div class="moves-container">
                    ${movesHTML || '<div style="text-align: center; color: #999;">No moves available</div>'}
                </div>
            </div>
            
            <div class="modal-actions">
                <button class="modal-btn modal-btn-capture" onclick="marcarCapturado(${id}, this)">${eCapturado ? '❌ Release' : '🔴 Capture'}</button>
                <button class="modal-btn modal-btn-close" onclick="fecharModal()">Close</button>
            </div>
        `;
    } catch (erro) {
        console.error('Erro ao carregar detalhes:', erro);
        modalBody.innerHTML = `
            <div class="loading" style="padding: 30px; text-align: center; color: #c00;">❌ Erro ao carregar detalhes</div>
        `;
    }
}

// Marcar Pokémon como capturado
function marcarCapturado(id, botao) {
    const indice = todosPokemon.findIndex(p => p.id === id);
    if (indice === -1) return;
    
    if (pokemonCapturados.has(id)) {
        pokemonCapturados.delete(id);
        botao.textContent = '🔴 Capturar';
    } else {
        pokemonCapturados.add(id);
        botao.textContent = '❌ Liberar';
    }
    
    salvarPokemonCapturados();
    atualizarCard(id);
    atualizarProgresso();
}

// Atualizar visual do card
function atualizarCard(id) {
    const cards = document.querySelectorAll('.pokemon-card');
    cards.forEach(card => {
        const numero = parseInt(card.querySelector('.pokemon-number').textContent.substring(1));
        if (numero === id) {
            card.classList.toggle('captured', pokemonCapturados.has(id));
        }
    });
}

// Atualizar progresso
function atualizarProgresso() {
    const quantidade = pokemonCapturados.size;
    const total = todosPokemon.length;
    const percentual = Math.round((quantidade / total) * 100);
    
    capturedCount.textContent = quantidade;
    progressPercent.textContent = percentual + '%';
    progressBar.style.width = percentual + '%';
    progressBar.textContent = percentual + '%';
}

// Filtrar Pokémon
function filtrarPokemon() {
    const termo = searchInput.value.toLowerCase();
    let filtrado = todosPokemon;
    
    // Filtro por busca
    if (termo) {
        filtrado = filtrado.filter(p => 
            p.name.toLowerCase().includes(termo) || 
            String(p.id).includes(termo)
        );
    }
    
    // Filtro por tipo
    if (filtroTipo) {
        filtrado = filtrado.filter(p =>
            p.types.some(t => t.type.name === filtroTipo)
        );
    }
    
    // Filtro por capturados
    if (mostrarApenasCapturados) {
        filtrado = filtrado.filter(p => pokemonCapturados.has(p.id));
    }
    
    renderizarPokemon(filtrado);
}

// Fechar modal
function fecharModal() {
    modal.classList.remove('show');
}

// Mostrar abas
function mostrarAba(abaName) {
    const abas = document.querySelectorAll('.tab-content');
    const btns = document.querySelectorAll('.tab-btn');
    
    abas.forEach(aba => aba.style.display = 'none');
    btns.forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(`aba-${abaName}`).style.display = 'block';
    event.target.classList.add('active');
}

// Confirmar limpeza
function confirmarLimpeza() {
    if (pokemonCapturados.size === 0) {
        alert('Nenhum Pokémon capturado para limpar!');
        return;
    }
    
    if (confirm(`Tem certeza que deseja liberar todos os ${pokemonCapturados.size} Pokémon capturados?`)) {
        pokemonCapturados.clear();
        salvarPokemonCapturados();
        atualizarProgresso();
        filtrarPokemon();
        alert('✅ Todos os Pokémon foram liberados!');
    }
}

// Notificação rápida
function mostrarNotificacao(mensagem) {
    const notif = document.createElement('div');
    notif.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #28a745, #20c997);
        color: white;
        padding: 15px 25px;
        border-radius: 50px;
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
        font-weight: bold;
        z-index: 10000;
        animation: slideInRight 0.3s ease-out;
    `;
    notif.textContent = mensagem;
    document.body.appendChild(notif);
    
    setTimeout(() => {
        notif.style.animation = 'slideOutRight 0.3s ease-out forwards';
        setTimeout(() => notif.remove(), 300);
    }, 3000);
}

// Adicionar estilos de animação
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

console.log('🔴 Pokédex carregada! Use as buscas e filtros para encontrar seus Pokémon!');
