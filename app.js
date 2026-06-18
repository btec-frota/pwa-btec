// 🔗 LINK OFICIAL DE INTEGRAÇÃO DA API BTEC CONSTRUÇÕES
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwhKsHHBVPh_P1jEtNW9efsexqt11bkh4CDQ_VucXSUivftqRC6RNT6hOmQ2UR2S21I/exec";

let db;
let configuracaoCampos = [];
// Objeto que guardará as informações automáticas vindas da planilha
let dadosValidacaoBtec = { 
    ultimoHorimetro: 0, 
    ultimoOdometro: 0, 
    linkEquipamento: "",
    tipoEquipamento: "", // Novo: Tipo/Modelo automático
    familiaFrota: ""     // Novo: Família automática caso não venha no QR Code
};

// 1. PERSISTÊNCIA OFFLINE (IndexedDB)
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
        // Pede as informações específicas do equipamento para a API
        fetch(`${GOOGLE_SCRIPT_URL}?prefixo=${prefixo}`)
            .then(res => res.json())
            .then(data => {
                configuracaoCampos = data.configuracao;
                dadosValidacaoBtec = data.validacao;
                
                // Salva no banco local para uso se o sinal cair na próxima vez
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

// 2. CONSTRUÇÃO DO FORMULÁRIO COM PREENCHIMENTO AUTOMÁTICO DE INFOS
function construirInterfaceDinamica(prefixo) {
    const urlParams = new URLSearchParams(window.location.search);
    
    // PREENCHIMENTO AUTOMÁTICO: Prioriza a Família que vem da planilha, senão usa a do link, senão 'TRANSPORTE'
    const familia = (dadosValidacaoBtec.familiaFrota || urlParams.get('familia') || "TRANSPORTE").toUpperCase();
    
    // Injeta os dados nos inputs escondidos e nos textos do topo
    document.getElementById('prefixo').value = prefixo;
    document.getElementById('familia').value = familia;
    document.getElementById('label-prefixo').textContent = prefixo;
    document.getElementById('label-familia').textContent = familia;
    
    const wrapper = document.getElementById('campos-dinamicos');
    wrapper.innerHTML = "";

    // Painel superior com atualizações automáticas sobre o veículo
    const painelMotorista = document.getElementById('painel-assistente-motorista');
    painelMotorista.classList.remove('hidden');
    
    const tipoTexto = dadosValidacaoBtec.tipoEquipamento ? ` do tipo <strong>${dadosValidacaoBtec.tipoEquipamento}</strong>` : "";
    painelMotorista.innerHTML = `👋 <strong>Olá, Motorista!</strong><br>Veículo ${prefixo}${tipoTexto} identificado com sucesso. Preencha as informações restantes abaixo.`;
    painelMotorista.style.borderLeftColor = "rgba(255,255,255,0.3)";

    // Preenchimento automático: Link de Manual/Documentação se existir na planilha
    if (dadosValidacaoBtec.linkEquipamento) {
        const btnLink = document.createElement('a');
        btnLink.href = dadosValidacaoBtec.linkEquipamento;
        btnLink.target = "_blank";
        btnLink.textContent = "📂 ACESSAR DOCUMENTAÇÃO / MANUAL DESTE VEÍCULO";
        btnLink.style = "display:block; text-align:center; background:#1f427b; color:#fff; padding:12px; border-radius:8px; margin-bottom:18px; font-weight:bold; text-decoration:none; border: 1px solid rgba(255,255,255,0.2); font-size:11px; letter-spacing: 0.5px;";
        wrapper.appendChild(btnLink);
    }
    
    // Monta apenas os campos configurados para a família desse veículo
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
                const placeholder = document.createElement('option'); placeholder.value = ""; placeholder.textContent = "Selecione...";
                inputField.appendChild(placeholder);
                item.opcoes.forEach(opt => {
                    const o = document.createElement('option'); o.value = opt; o.textContent = opt;
                    inputField.appendChild(o);
                });

                inputField.addEventListener('change', function() {
                    if(item.campo === "colaborador" && this.value) {
                        painelMotorista.innerHTML = `📋 <strong>Operador Ativo:</strong> ${this.value}.<br>Por favor, insira as medições. Lembre-se de preencher a Parte Diária Física!`;
                        painelMotorista.style.borderLeftColor = "var(--cor-sucesso)";
                    }
                });

            } else if (item.tipo === "textarea") {
                inputField = document.createElement('textarea');
                inputField.rows = 3;
            } else if (item.tipo === "file") {
                inputField = document.createElement('input');
                inputField.type = "file"; inputField.accept = "image/*";
                inputField.setAttribute("capture", "environment");
                
                const previewImg = document.createElement('img');
                previewImg.style = "max-width:100%; max-height:140px; display:none; margin-top:8px; border-radius:6px; border: 1px solid rgba(255,255,255,0.2);";
                group.appendChild(previewImg);

                inputField.addEventListener('change', function(e) {
                    const arquivo = e.target.files[0];
                    if (arquivo) {
                        const reader = new FileReader();
                        reader.onloadend = function() {
                            inputField.dataset.base64 = reader.result;
                            previewImg.src = reader.result;
                            previewImg.style.display = "block";
                            feedbackDiv.textContent = "✓ Imagem anexada com sucesso.";
                            feedbackDiv.className = "alerta-automatica alerta-valido";
                        }
                        reader.readAsDataURL(arquivo);
                    }
                });
            } else {
                inputField = document.createElement('input');
                inputField.type = "text";
                
                if (item.tipo === "number") {
                    inputField.setAttribute("inputmode", "decimal");
                    inputField.addEventListener("input", function() {
                        this.value = this.value.replace(/[^0-9.]/g, '');
                        if ((this.value.match(/\./g) || []).length > 1) this.value = this.value.replace(/\.+$/, "");
                        
                        // Validações cruzadas de histórico baseadas nas informações automáticas da planilha
                        gerarRespostasTextoParaMotoristas(item.campo, this.value, feedbackDiv, painelMotorista);
                    });
                }
            }
            
            inputField.id = `input_${item.campo}`;
            inputField.dataset.identificador = item.campo;
            if(item.obrigatorio) inputField.setAttribute("required", "true");
            
            group.appendChild(inputField);
            
            const feedbackDiv = document.createElement('div');
            feedbackDiv.className = "alerta-automatica";
            feedbackDiv.id = `feedback_${item.campo}`;
            group.appendChild(feedbackDiv);
            
            wrapper.appendChild(group);
        }
    });
}

// 3. LOGICA DE RESPOSTAS TEXTUAIS COMPARATIVAS
function gerarRespostasTextoParaMotoristas(campo, valorDigitado, divAlertaLocal, divPainelSuperior) {
    if(!valorDigitado) { divAlertaLocal.textContent = ""; return; }
    const valor = Number(valorDigitado);
    
    if (campo === "odometro") {
        const ultimoOdometro = dadosValidacaoBtec.ultimoOdometro;
        if (valor < ultimoOdometro) {
            divAlertaLocal.textContent = `❌ KM inconsistente! Quilometragem menor que o último fechamento (${ultimoOdometro} km).`;
            divAlertaLocal.className = "alerta-automatica alerta-invalido";
            divPainelSuperior.innerHTML = `🚨 <strong>Erro Detectado:</strong> O odômetro está menor que o histórico consolidado (${ultimoOdometro} km). Corrija para conseguir enviar.`;
            divPainelSuperior.style.borderLeftColor = "var(--btec-vermelho-alerta)";
        } else {
            const diferencaKm = valor - ultimoOdometro;
            divAlertaLocal.textContent = `✓ Quilometragem válida.`;
            divAlertaLocal.className = "alerta-automatica alerta-valido";
            divPainelSuperior.innerHTML = `📈 <strong>Métricas de Viagem:</strong><br>O veículo rodou acumulados <strong>+${diferencaKm} km</strong> desde o último registro.`;
            divPainelSuperior.style.borderLeftColor = "var(--cor-sucesso)";
        }
    }
    
    if (campo === "horimetro") {
        const ultimoHorimetro = dadosValidacaoBtec.ultimoHorimetro;
        if (valor < ultimoHorimetro) {
            divAlertaLocal.textContent = `❌ Horímetro inválido! Abaixo do histórico real (${ultimoHorimetro}h).`;
            divAlertaLocal.className = "alerta-automatica alerta-invalido";
        } else {
            const horasTrabalhadas = valor - ultimoHorimetro;
            divAlertaLocal.textContent = `✓ Horímetro consistente.`;
            divAlertaLocal.className = "alerta-automatica alerta-valido";
            if (horasTrabalhadas > 14) {
                divAlertaLocal.textContent += ` ⚠️ Turno elevado detectado (+${horasTrabalhadas.toFixed(1)}h). Inspecione o nível do óleo.`;
            }
        }
    }
}

// 4. SUBMIT FIRST COM FILA DE TRANSMISSÃO
document.getElementById('form-registro').addEventListener('submit', function(e) {
    e.preventDefault();
    
    let impedirEnvio = false;
    document.querySelectorAll('#campos-dinamicos input').forEach(input => {
        if(input.dataset.identificador === "horimetro" && Number(input.value) < dadosValidacaoBtec.ultimoHorimetro) impedirEnvio = true;
        if(input.dataset.identificador === "odometro" && Number(input.value) < dadosValidacaoBtec.ultimoOdometro) impedirEnvio = true;
    });
    
    if(impedirEnvio) {
        alert("Erro Operacional: Impossível prosseguir com medições inferiores ao histórico consolidado!");
        return;
    }
    
    const mapaRespostas = {};
    document.querySelectorAll('#campos-dinamicos input, #campos-dinamicos select, #campos-dinamicos textarea').forEach(input => {
        if (input.type === "file") {
            mapaRespostas[input.dataset.identificador] = input.dataset.base64 || "";
        } else {
            mapaRespostas[input.dataset.identificador] = input.value;
        }
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
            ? "Conectado! Registro transmitido com sucesso para a planilha central." 
            : "Você está Offline! O checklist foi guardado na memória e subirá assim que regressar ao pátio.";
        document.getElementById('tela-sucesso').classList.remove('hidden');
    };
});

function atualizarIndicadorConexao() {
    const status = document.getElementById('status-rede');
    if (navigator.onLine) {
        status.textContent = "● Sistema Online (BTEC)"; status.className = "online";
        sincronizarFilaOcultaComNuvem();
    } else {
        status.textContent = "● Modo Campo (Sem Internet)"; status.className = "offline";
    }
}

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
