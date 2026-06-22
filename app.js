// CONFIGURAÇÃO CENTRAL DA CENTRAL BTEC
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwCuSg7QuzCwGnG42TGSrtcVl14lSaq_X5WEzOt4Fv93L7EgS13rah9MZyQp0wsJ564/exec";
// Captura de Elementos da Interface
const labelPrefixo = document.getElementById("txt-prefixo");
const labelFamilia = document.getElementById("txt-familia");
const painelAssistente = document.getElementById("assistente-ia");
const containerDinamico = document.getElementById("container-campos-dinamicos");
const barraRede = document.getElementById("status-rede");
const formulario = document.getElementById("form-registro");

let camposSalvosServidor = [];
let paramsGlobais = { prefixo: "BTEC-GERAL", familia: "GERAL" };

function obterParametrosURL() {
    const urlParams = new URLSearchParams(window.location.search);
    paramsGlobais.prefixo = urlParams.get("prefixo") || "BTEC-GERAL";
    paramsGlobais.familia = urlParams.get("familia") || "GERAL";
    
    labelPrefixo.textContent = paramsGlobais.prefixo.toUpperCase();
    labelFamilia.textContent = paramsGlobais.familia.toUpperCase();
}

function atualizarStatusRede() {
    if (navigator.onLine) {
        barraRede.textContent = "SISTEMA ONLINE (BTEC)";
        barraRede.className = "status-barra-rede online";
    } else {
        barraRede.textContent = "MODO OFFLINE - DADOS EM CACHE";
        barraRede.className = "status-barra-rede offline";
    }
}

async function carregarDadosIniciais(prefixo, familia) {
    try {
        atualizarStatusRede();
        const urlFinal = `${GOOGLE_SCRIPT_URL}?prefixo=${encodeURIComponent(prefixo)}&familia=${encodeURIComponent(familia)}`;
        
        painelAssistente.innerHTML = `⏳ Sincronizando dados patrimoniais...`;

        const response = await fetch(urlFinal);
        if (!response.ok) throw new Error();
        const dados = await response.json();

        camposSalvosServidor = dados.campos || [];
        
        // 🆕 INJEÇÃO COMPACTA E ELEGANTE DE MÚLTIPLAS INFORMAÇÕES ADICIONAIS
        if (dados.descricao && dados.descricao.trim() !== "") {
            labelPrefixo.innerHTML = `
                ${prefixo.toUpperCase()}
                <span style="display:block; font-size:10px; font-weight:normal; color:#94a3b8; margin-top:5px; text-transform:none; line-height:1.4; white-space:normal; font-style:italic;">
                    ${dados.descricao}
                </span>
            `;
        }

        // Sistema Inteligente de Alerta de Turno
        if (dados.jaRegistradoHoje) {
            painelAssistente.style.borderLeft = "4px solid #2196f3";
            painelAssistente.innerHTML = `🤖 Equipamento <strong>${prefixo}</strong> já realizou a inspeção matinal hoje. Os campos flexíveis foram configurados como <strong>opcionais</strong> para este turno.`;
        } else {
            painelAssistente.style.borderLeft = "4px solid #00e676";
            painelAssistente.innerHTML = `🤖 Primeiro registro do dia para o equipamento <strong>${prefixo}</strong>. O preenchimento dos campos com <span style="color:#ff4a4a">*</span> é <strong>obrigatório</strong>.`;
        }

        montarFormularioDinamico(camposSalvosServidor);
        
    } catch (erro) {
        painelAssistente.style.borderLeft = "4px solid #ff4a4a";
        painelAssistente.innerHTML = `❌ <strong>Erro de Link:</strong> Não foi possível sincronizar os dados com a planilha BTEC.`;
    }
}

function montarFormularioDinamico(campos) {
    containerDinamico.innerHTML = "";
    
    campos.forEach(campo => {
        const divCampo = document.createElement("div");
        divCampo.className = "campo-base";

        const label = document.createElement("label");
        label.innerHTML = `${campo.label} ${campo.obrigatorio ? '<span style="color:#ff4a4a">*</span>' : ''}`;
        divCampo.appendChild(label);

        let inputElement;

        if (campo.tipo === "select") {
            inputElement = document.createElement("select");
            const opPadrao = document.createElement("option");
            opPadrao.value = "";
            opPadrao.textContent = "Selecione uma opção...";
            inputElement.appendChild(opPadrao);

            campo.opcoes.forEach(op => {
                const option = document.createElement("option");
                option.value = op;
                option.textContent = op;
                inputElement.appendChild(option);
            });
        } else if (campo.tipo === "number") {
            inputElement = document.createElement("input");
            inputElement.type = "number";
            inputElement.inputMode = "numeric";
            inputElement.placeholder = "Digite valores numéricos";
        } else if (campo.tipo === "file") {
            inputElement = document.createElement("input");
            inputElement.type = "file";
            inputElement.accept = "image/*";
            inputElement.capture = "environment";
        } else {
            inputElement = document.createElement("input");
            inputElement.type = "text";
            inputElement.placeholder = "Digite a resposta";
        }

        inputElement.id = `dinamico-${campo.id}`;
        inputElement.required = campo.obrigatorio;
        divCampo.appendChild(inputElement);
        containerDinamico.appendChild(divCampo);
    });
}

// Envio do Formulário
formulario.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const btn = document.getElementById("btn-enviar");
    btn.disabled = true;
    btn.textContent = "ENVIANDO AO SERVIDOR...";

    const payload = {
        prefixo: paramsGlobais.prefixo,
        familia: paramsGlobais.familia,
        consentimento_bonus: document.getElementById("chk-termos").checked ? "SIM" : "NÃO",
        respostas: {
            nome_operador: document.getElementById("nome-motorista").value
        }
    };

    camposSalvosServidor.forEach(campo => {
        const el = document.getElementById(`dinamico-${campo.id}`);
        if (el) {
            if (campo.tipo === "file") {
                payload.respostas[campo.id] = el.files[0] ? `Arquivo anexado: ${el.files[0].name}` : "Nenhum arquivo enviado";
            } else {
                payload.respostas[campo.id] = el.value;
            }
        }
    });

    try {
        const res = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        alert("🚀 Registro enviado com sucesso à Central BTEC!");
        formulario.reset();
        window.location.reload();
    } catch (err) {
        alert("❌ Erro de conexão ao enviar dados. Tente novamente.");
    } finally {
        btn.disabled = false;
        btn.textContent = "REGISTRAR OPERAÇÃO";
    }
});

document.addEventListener("DOMContentLoaded", () => {
    obterParametrosURL();
    carregarDadosIniciais(paramsGlobais.prefixo, paramsGlobais.familia);

    // 🕒 DISPARADOR DO ALERTA APÓS AS 16h
    const horaAtual = new Date().getHours();
    if (horaAtual >= 16) {
        const alerta = document.createElement("div");
        alerta.style.background = "rgba(255, 74, 74, 0.15)";
        alerta.style.border = "1px solid #ff4a4a";
        alerta.style.padding = "14px";
        alerta.style.borderRadius = "8px";
        alerta.style.marginBottom = "18px";
        alerta.style.fontSize = "12px";
        alerta.style.color = "#ffffff";
        alerta.style.lineHeight = "1.5";
        alerta.innerHTML = `
            <strong>🚨 ALERTA DE HORÁRIO LIMITE EXCEDIDO:</strong><br>
            O horário padrão de fechamento diário da frota (16:00h) foi ultrapassado. 
            Este envio passará por auditoria manual da supervisão para validação do bônus.
        `;
        formulario.insertBefore(alerta, formulario.firstChild);
    }
});

window.addEventListener("online", atualizarStatusRede);
window.addEventListener("offline", atualizarStatusRede);
