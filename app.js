const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzsLDGvP1dWjwZQuI87Hzx3tRYAjmsYuntHCZ4iCw0lQ2u6jJQHr593XQgGbl4KuEta/exec";

let db;
let configuracaoCampos = [];
let dadosValidacaoBtec = { ultimoHorimetro: 0, ultimoOdometro: 0 };

// 1. PERSISTÊNCIA ROBUSTA OFFLINE (IndexedDB de Alta Performance)
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
        // Puxa as configurações atuais e o histórico da máquina via API
        fetch(`${GOOGLE_SCRIPT_URL}?prefixo=${prefixo}`)
            .then(res => res.json())
            .then(data => {
                configuracaoCampos = data.configuracao;
                dadosValidacaoBtec = data.validacao;
                
                // Atualiza o banco local seguro para uso offline posterior
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

// 2. CONSTRUÇÃO DO FORMULÁRIO COMPLETO
function construirInterfaceDinamica(prefixo) {
    const urlParams = new URLSearchParams(window.location.search);
    const familia = (urlParams.get('familia') || "PIPA").toUpperCase();
    
    document.getElementById('prefixo').value = prefixo;
    document.getElementById('familia').value = familia;
    document.getElementById('label-prefixo').textContent = prefixo;
    document.getElementById('label-familia').textContent = familia;
    
    const wrapper = document.getElementById('campos-dinamicos');
    wrapper.innerHTML = "";
    
    configuracaoCampos.forEach(item => {
        if (item.familias.includes(familia)) {
            const group = document.createElement('div');
            group.className = "form-group";
            
            const label = document.createElement('label');
            label.textContent = item.label + (item.obrigatorio ? " *" : "");
            group.appendChild(label);
            
            let inputField;
            if (item.tipo === "select") {
                inputField = document.createElement('select');
                if(!item.valorPadrao) {
                    const placeholder = document.createElement('option'); placeholder.value = ""; placeholder.textContent = "Selecione uma opção...";
                    inputField.appendChild(placeholder);
                }
                item.opcoes.forEach(opt => {
                    const o = document.createElement('option'); o.value = opt; o.textContent = opt;
                    if(item.valorPadrao && opt.toLowerCase() === item.valorPadrao.toLowerCase()) o.setAttribute('selected', 'selected');
                    inputField.appendChild(o);
                });
            } else if (item.tipo === "textarea") {
                inputField = document.createElement('textarea');
                inputField.rows = 3;
                if(item.valorPadrao) inputField.value = item.valorPadrao;
            } else {
                inputField = document.createElement('input');
                inputField.type = "text"; // Mantido como text para filtragem cirúrgica via JS
                if(item.valorPadrao) inputField.value = item.valorPadrao;
                
                // 🛑 BLINDAGEM DE DIGITAÇÃO NUMÉRICA + TECLADO DECIMAL PARA CELULAR
                if (item.tipo === "number") {
                    inputField.setAttribute("inputmode", "decimal"); // Invoca o teclado numérico ideal com ponto/vírgula
                    
                    inputField.addEventListener("input", function() {
                        // Expulsa instantaneamente qualquer caractere que não seja número ou ponto decimal
                        this.value = this.value.replace(/[^0-9.]/g, '');
                        // Bloqueia a inserção de múltiplos pontos de quebra decimal
                        if ((this.value.match(/\./g) || []).length > 1) this.value = this.value.replace(/\.+$/, "");
                        
                        processarRespostasDeTextoAutomaticas(item.campo, this.value, feedbackDiv);
                    });
                }
            }
            
            inputField.id = `input_${item.campo}`;
            inputField.dataset.identificador = item.campo;
            if(item.obrigatorio) inputField.setAttribute("required", "true");
            
            group.appendChild(inputField);
            
            // Recipiente para exibição das mensagens automáticas do sistema
            const feedbackDiv = document.createElement('div');
            feedbackDiv.className = "alerta-automatica";
            feedbackDiv.id = `feedback_${item.campo}`;
            group.appendChild(feedbackDiv);
            
            wrapper.appendChild(group);
            
            if(item.valorPadrao) processarRespostasDeTextoAutomaticas(item.campo, item.valorPadrao, feedbackDiv);
        }
    });
}

// 🔄 INTELIGÊNCIA ARTIFICIAL DE CAMPO: RESPOSTAS AUTOMÁTICAS E VALIDAÇÃO CRUZADA
function processarRespostasDeTextoAutomaticas(campo, valor, elementoAlerta) {
    if(!valor) { elementoAlerta.textContent = ""; return; }
    const valorDigitado = Number(valor);
    
    if (campo === "horimetro") {
        const historico = dadosValidacaoBtec.ultimoHorimetro;
        if (valorDigitado < historico) {
            elementoAlerta.textContent = `❌ Inválido! O horímetro digitado é menor que o anterior (${historico}h).`;
            elementoAlerta.className = "alerta-automatica alerta-invalido";
        } else {
            elementoAlerta.textContent = `✓ Aceito (+ ${(valorDigitado - historico).toFixed(1)}h acumuladas desde o último registro).`;
            elementoAlerta.className = "alerta-automatica alerta-valido";
        }
    } 
    else if (campo === "odometro") {
        const historico = dadosValidacaoBtec.ultimoOdometro;
        if (valorDigitado < historico) {
            elementoAlerta.textContent = `❌ Inválido! A quilometragem informada é menor que o histórico (${historico} km).`;
            elementoAlerta.className = "alerta-automatica alerta-invalido";
        } else {
            elementoAlerta.textContent = `✓ Aceito (+ ${valorDigitado - historico} km rodados acumulados).`;
            elementoAlerta.className = "alerta-automatica alerta-valido";
        }
    }
}

// 3. BLOQUEIO PROTETIVO E SALVAMENTO EM BANCO LOCAL (OFFLINE FIRST)
document.getElementById('form-registro').addEventListener('submit', function(e) {
    e.preventDefault();
    
    let impedirEnvio = false;
    document.querySelectorAll('#campos-dinamicos input').forEach(input => {
        if(input.dataset.identificador === "horimetro" && Number(input.value) < dadosValidacaoBtec.ultimoHorimetro) impedirEnvio = true;
        if(input.dataset.identificador === "odometro" && Number(input.value) < dadosValidacaoBtec.ultimoOdometro) impedirEnvio = true;
    });
    
    if(impedirEnvio) {
        alert("Atenção: Não é permitido salvar medições inferiores ao histórico do veículo!");
        return;
    }
    
    const mapaRespostas = {};
    document.querySelectorAll('#campos-dinamicos input, #campos-dinamicos select, #campos-dinamicos textarea').forEach(input => {
        mapaRespostas[input.dataset.identificador] = input.value;
    });
    
    const pacote = {
        prefixo: document.getElementById('prefixo').value,
        familia: document.getElementById('familia').value,
        respostas: mapaRespostas,
        dataHora: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
    };
    
    const tx = db.transaction(["registros"], "readwrite");
    tx.objectStore("registros").add(pacote);
    
    tx.oncomplete = function() {
        document.getElementById('msg-sucesso').textContent = navigator.onLine 
            ? "Conectado! Registro integrado e sincronizado em tempo real com a engenharia." 
            : "Você está Offline! O checklist foi salvo de forma oculta na memória e será descarregado automaticamente ao entrar no pátio.";
        document.getElementById('tela-sucesso').classList.remove('hidden');
    };
});

function atualizarIndicadorConexao() {
    const status = document.getElementById('status-rede');
    if (navigator.onLine) {
        status.textContent = "● BTEC Conectado"; status.className = "online";
        sincronizarFilaOcultaComNuvem();
    } else {
        status.textContent = "● Modo Campo (Offline)"; status.className = "offline";
    }
}

// 4. DESCARREGAMENTO EM LOTE E AUTODESTRUIÇÃO DO CACHE LOCAL
function sincronizarFilaOcultaComNuvem() {
    if(!navigator.onLine || !db) return;
    const tx = db.transaction(["registros"], "readwrite");
    const store = tx.objectStore("registros");
    const obterFila = store.getAll();
    
    obterFila.onsuccess = function() {
        const filaPendentes = obterFila.result;
        if(filaPendentes.length === 0) return;
        
        filaPendentes.forEach(registro => {
            fetch(GOOGLE_SCRIPT_URL, {
                method: "POST",
                mode: "no-cors",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(registro)
            }).then(() => {
                // Elimina estritamente o item enviado da memória para zerar sobrecargas no aparelho
                const txDelecao = db.transaction(["registros"], "readwrite");
                txDelecao.objectStore("registros").delete(registro.id);
            });
        });
    };
}

function fecharSucesso() {
    document.getElementById('tela-sucesso').classList.add('hidden');
    document.getElementById('form-registro').reset();
    gerenciarFluxoDeRede();
}

if ('serviceWorker' in navigator) { navigator.serviceWorker.register('sw.js'); }