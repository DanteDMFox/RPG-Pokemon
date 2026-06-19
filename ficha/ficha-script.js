// LocalStorage - Salvar dados da ficha
const form = document.getElementById('fichaPokemon');

// Carregar dados ao abrir a página
document.addEventListener('DOMContentLoaded', () => {
    carregarDados();
    console.log('📋 Ficha de Pokémon carregada!');
});

// Salvar dados quando o formulário é submetido
form.addEventListener('submit', (e) => {
    e.preventDefault();
    salvarDados();
});

// Salvar dados automaticamente a cada mudança
const inputs = form.querySelectorAll('input, textarea, select');
inputs.forEach(input => {
    input.addEventListener('change', () => {
        salvarDados();
    });
});

function salvarDados() {
    const formData = new FormData(form);
    const dados = {};
    
    formData.forEach((value, key) => {
        dados[key] = value;
    });
    
    localStorage.setItem('fichaPokemon', JSON.stringify(dados));
    mostrarNotificacao('✅ Ficha salva com sucesso!');
}

function carregarDados() {
    const dadosArmazenados = localStorage.getItem('fichaPokemon');
    
    if (dadosArmazenados) {
        const dados = JSON.parse(dadosArmazenados);
        
        Object.keys(dados).forEach(chave => {
            const elemento = form.elements[chave];
            if (elemento) {
                elemento.value = dados[chave];
            }
        });
    }
}

function mostrarNotificacao(mensagem) {
    const notificacao = document.createElement('div');
    notificacao.style.cssText = `
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
    notificacao.textContent = mensagem;
    
    document.body.appendChild(notificacao);
    
    setTimeout(() => {
        notificacao.style.animation = 'slideOutRight 0.3s ease-out forwards';
        setTimeout(() => notificacao.remove(), 300);
    }, 3000);
}

// Adicionar estilos de animação
const estilo = document.createElement('style');
estilo.textContent = `
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

    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
    }
`;
document.head.appendChild(estilo);

// Validação de Nome (obrigatório)
const campoNome = form.elements['nome'];
campoNome.addEventListener('blur', () => {
    if (campoNome.value.trim() === '') {
        campoNome.style.borderColor = '#DC143C';
        campoNome.style.animation = 'shake 0.3s ease-in-out';
        mostrarNotificacao('⚠️ Por favor, digite seu nome!');
    } else {
        campoNome.style.borderColor = '#E0E0E0';
        campoNome.style.animation = '';
    }
});

// Validação de Idade
const campoIdade = form.elements['idade'];
campoIdade.addEventListener('change', () => {
    if (campoIdade.value) {
        const idade = parseInt(campoIdade.value);
        if (idade < 1 || idade > 100) {
            mostrarNotificacao('⚠️ Idade deve estar entre 1 e 100 anos');
            campoIdade.value = '';
        }
    }
});

// Validação de Altura e Peso
const campoAltura = form.elements['altura'];
const campoPeso = form.elements['peso'];

campoAltura.addEventListener('change', () => {
    if (campoAltura.value) {
        const altura = parseInt(campoAltura.value);
        if (altura < 100 || altura > 250) {
            mostrarNotificacao('⚠️ Altura deve estar entre 100cm e 250cm');
            campoAltura.value = '';
        }
    }
});

campoPeso.addEventListener('change', () => {
    if (campoPeso.value) {
        const peso = parseFloat(campoPeso.value);
        if (peso < 20 || peso > 200) {
            mostrarNotificacao('⚠️ Peso deve estar entre 20kg e 200kg');
            campoPeso.value = '';
        }
    }
});

// Efeito de mudança de cor dos campos de Pokémon por tipo
const seletoresType = form.querySelectorAll('.pokemon-type');
const coresPorTipo = {
    'Normal': '#A8A878',
    'Fogo': '#F08030',
    'Água': '#6890F0',
    'Elétrico': '#F8D030',
    'Grama': '#78C850',
    'Gelo': '#98D8D8',
    'Lutador': '#C03028',
    'Veneno': '#A040A0',
    'Terra': '#E0C068',
    'Voador': '#A890F0',
    'Psíquico': '#F85888',
    'Inseto': '#A8B820',
    'Rocha': '#B8A038',
    'Fantasma': '#705898',
    'Dragão': '#7038F8',
    'Sombrio': '#705848',
    'Aço': '#B8B8D0',
    'Fada': '#EE99AC'
};

seletoresType.forEach(seletor => {
    seletor.addEventListener('change', () => {
        const tipo = seletor.value;
        const slot = seletor.closest('.pokemon-slot');
        
        if (tipo && coresPorTipo[tipo]) {
            const cor = coresPorTipo[tipo];
            slot.style.borderColor = cor;
            slot.style.background = `linear-gradient(135deg, ${cor}20 0%, #FFFFFF 100%)`;
            seletor.style.borderColor = cor;
        } else {
            slot.style.borderColor = '#DC143C';
            slot.style.background = 'linear-gradient(135deg, #FFE5E5 0%, #FFFFFF 100%)';
            seletor.style.borderColor = '#E0E0E0';
        }
    });
});

// Atualizar cores ao carregar
setTimeout(() => {
    seletoresType.forEach(seletor => {
        if (seletor.value) {
            seletor.dispatchEvent(new Event('change'));
        }
    });
}, 100);

// Contador de caracteres para textareas
const textareas = form.querySelectorAll('textarea');
textareas.forEach(textarea => {
    const contador = document.createElement('div');
    contador.style.cssText = `
        font-size: 0.85rem;
        color: #999;
        margin-top: 5px;
    `;
    
    function atualizarContador() {
        const caracteres = textarea.value.length;
        contador.textContent = `${caracteres} caracteres`;
    }
    
    textarea.addEventListener('input', atualizarContador);
    textarea.parentElement.appendChild(contador);
    atualizarContador();
});

// Função para exportar dados como JSON
function exportarFicha() {
    const dadosArmazenados = localStorage.getItem('fichaPokemon');
    if (dadosArmazenados) {
        const dados = JSON.parse(dadosArmazenados);
        const json = JSON.stringify(dados, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ficha-pokemon-${dados.nome || 'personagem'}.json`;
        a.click();
        mostrarNotificacao('💾 Ficha exportada como JSON!');
    } else {
        mostrarNotificacao('⚠️ Nenhuma ficha para exportar!');
    }
}

// Função para importar dados de JSON
function importarFicha(arquivo) {
    const leitor = new FileReader();
    leitor.onload = (e) => {
        try {
            const dados = JSON.parse(e.target.result);
            localStorage.setItem('fichaPokemon', JSON.stringify(dados));
            carregarDados();
            mostrarNotificacao('✅ Ficha importada com sucesso!');
        } catch (erro) {
            mostrarNotificacao('❌ Erro ao importar ficha!');
        }
    };
    leitor.readAsText(arquivo);
}

// Atalhos de teclado
document.addEventListener('keydown', (e) => {
    // Ctrl+S para salvar
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        salvarDados();
    }
    
    // Ctrl+P para imprimir
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        window.print();
    }
});

// Sons simples (opcional)
function reproduzirSom(frequencia, duracao) {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(frequencia, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duracao);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duracao);
    } catch (e) {
        // Silenciosamente ignorar
    }
}

// Som ao salvar
form.addEventListener('submit', () => {
    reproduzirSom(800, 0.1);
});

console.log('🔴⚪ Script da Ficha Pokémon carregado com sucesso!');
