// 🔗 LINK OFICIAL DE INTEGRAÇÃO DA API BTEC CONSTRUÇÕES
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzsLDGvP1dWjwZQuI87Hzx3tRYAjmsYuntHCZ4iCw0lQ2u6jJQHr593XQgGbl4KuEta/exec";

let db;
let configuracaoCampos = [];
let dadosValidacaoBtec = { ultimoHorimetro: 0, ultimoOdometro: 0, linkEquipamento: "" };

// 1. PERSISTÊNCIA ROBUSTA OFFLINE (IndexedDB de Alta Performance para Campo)
const request = indexedDB.open("BtecModuloFrotaDB", 1);
request.onupgradeneeded = function(e) {
    db = e.target.result;
    db.createObjectStore("registros", { keyPath: "id", autoIncrement: true });
    db.createObjectStore("configuracao", { keyPath: "id" });
};
request.onsuccess = function(e) {
    db = e.target.result;
    gerenciarFluxoDeRede();
};

function gerenciarFluxoDeRede() {
    atualizarIndicadorConexao();
    window.addEventListener('online', atualizarIndicadorConexao);
    window.addEventListener('offline', atualizarIndicadorConexao);
    
    const urlParams = new URLSearchParams(window.location.search);
    const prefixo = urlParams.get('prefixo') || "BTEC-GERAL";
    
    if (navigator.onLine) {
        // Puxa as configurações e o histórico da máquina via API usando seu link
        fetch(`${GOOGLE_SCRIPT_URL}?prefixo=${prefixo}`)
            .then(res => res.json())
            .then(data => {
                configuracaoCampos = data.configuracao;
                dadosValidacaoBtec = data.validacao;
                
                // Atualiza o cache local para garantir o funcionamento caso caia o sinal
                const tx = db.transaction(["configuracao"], "readwrite");
                tx.objectStore("configuracao").put({ id: "cache_operacional", configuracao: data.configuracao, validacao: data.validacao });
                
                construirInterfaceDinamica(prefixo);
            }).catch(() => carregarDadosDoCache(prefixo));
    } else {
        carregarDadosDoCache(prefixo);
    }
}

function carregarDadosDoCache(prefixo) {
    const tx = db.transaction(["configuracao"], "readonly");
    const req = tx.objectStore("configuracao").get("cache_operacional");
    req.onsuccess = function() {
        if(req.result) {
            configuracaoCampos = req.result.configuracao;
            dadosValidacaoBtec = req.result.validacao;
            construirInterfaceDinamica(prefixo);
        }
    };
}

// 2. CONSTRUÇÃO DO FORMULÁRIO DINÂMICO ADAPTADO PARA MOTORISTAS E OPERADORES
function construirInterfaceDinamica(prefixo) {
    const urlParams = new URLSearchParams(window.location.search);
    const familia = (urlParams.get('familia') || "TRANSPORTE").toUpperCase();
    
    document.getElementById('prefixo').value = prefixo;
    document.getElementById('familia').value = familia;
    document.getElementById('label-prefixo').textContent = prefixo;
    document.getElementById('label-familia').textContent = familia;
    
    const wrapper = document.getElementById('campos-dinamicos');
    wrapper.innerHTML = "";

    // Painel de Boas-Vindas Dinâmico do Assistente
    const painelMotorista = document.getElementById('painel-assistente-motorista');
    painelMotorista.classList.remove('hidden');
    painelMotorista.innerHTML = `👋 <strong>Olá, Motorista/Operador BTEC!</strong><br>Preencha os dados abaixo
