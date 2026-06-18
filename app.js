// CONFIGURAÇÃO: Insira aqui a URL gerada no "Deploy" do seu Google Apps Script
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/SEU_SCRIPT_ID/exec";

// Elementos da Interface (DOM)
const statusRede = document.getElementById("status-rede");
const labelPrefixo = document.getElementById("label-prefixo");
const labelFamilia = document.getElementById("label-familia");
const inputPrefixoHidden = document.getElementById("prefixo");
const inputFamiliaHidden = document.getElementById("familia");
const painelAssistente = document.getElementById("painel-assistente-motorista");
const containerCamposDinamicos = document.getElementById("campos-dinamicos");
const formRegistro = document.getElementById("form-registro");
const telaSucesso = document.getElementById("tela-sucesso");
const msgSucesso = document.getElementById("msg-sucesso");

// 🌐 1. MONITOR DE CONEXÃO (ONLINE / OFFLINE)
function atualizarStatusRede() {
    if (navigator.onLine) {
        statusRede.textContent = "SISTEMA ONLINE (BTEC)";
        statusRede.className = "online";
    } else {
        statusRede.textContent = "SISTEMA OFFLINE (MODO CACHE)";
        statusRede.className = "offline";
    }
}
window.addEventListener("online", atualizarStatusRede);
window.addEventListener("offline", atualizarStatusRede);

// 🔍 2. CAPTURAR PARÂMETROS DO QR CODE (URL)
function obterParametrosURL() {
    const urlParams = new URLSearchParams(window.location.search);
    // Caso não venha parâmetro no QR Code, assume o padrão "BTEC-GERAL" e "TRANSPORTE"
    const prefixo = urlParams.get("prefixo") || "BTEC-GERAL";
    const familia = urlParams.get("familia") || "TRANSPORTE";

    labelPrefixo.textContent = prefixo.toUpperCase();
    labelFamilia.textContent = familia.toUpperCase();
    inputPrefixoHidden.value = prefixo;
    inputFamiliaHidden.value = familia;

    carregarFormularioDinamico(prefixo, familia);
}

// 📥 3. REQUISITAR CAMPOS DINÂMICOS DA PLANILHA
async function carregarFormularioDinamico(prefixo, familia) {
    try {
        atualizarStatusRede();
        containerCamposDinamicos.innerHTML = "<p style='text-align:center; font-size:13px; color:var(--cor-subtext);'>A carregar checklist da frota...</p>";

        const urlFinal = `${GOOGLE_SCRIPT_URL}?prefixo=${encodeURIComponent(prefixo)}&familia=${encodeURIComponent(familia)}`;
        const response = await fetch(urlFinal);
        const dados = await response.json();

        montarFormularioNaTela(dados.campos);
        
        // Exibe mensagem de boas-vindas personalizada no Assistente
        painelAssistente.innerHTML = `👋 <strong>Olá, Motorista!</strong><br>Veículo <strong>${prefixo}</strong> identificado com sucesso. Preencha as informações restantes abaixo.`;
        painelAssistente.classList.remove("hidden");

    } catch (erro) {
        console.error("Erro ao carregar dados online, a tentar cache local...", erro);
        containerCamposDinamicos.innerHTML = "<p style='text-align:center; color:var(--btec-vermelho-alerta); font-size:12px;'>Falha ao conectar com o servidor. Verifique a internet.</p>";
    }
}

// 🏗️ 4. CONSTRUIR OS ELEMENTOS HTML DE FORMA DINÂMICA
function montarFormularioNaTela(campos) {
    containerCamposDinamicos.innerHTML = ""; // Limpa o carregando

    if (!campos || campos.length === 0) {
        containerCamposDinamicos.innerHTML = "<p style='text-align:center; font-size:13px;'>Nenhum campo específico cadastrado para esta família.</p>";
        return;
    }

    campos.forEach(campo => {
        const formGroup = document.createElement("div");
        formGroup.className = "form-group";

        // Cria a etiqueta (Label)
        const label = document.createElement("label");
        label.setAttribute("for", campo.id);
        label.innerHTML = campo.obrigatorio ? `${campo.label} <span style="color:var(--btec-vermelho-alerta)">*</span>` : campo.label;
        formGroup.appendChild(label);

        let inputElement;

        // Estrutura de decisão com base no TIPO (Coluna C em minúsculas)
        if (campo.tipo === "select") {
            inputElement = document.createElement("select");
            
            // Opção inicial vazia para forçar a escolha
            const optPlaceholder = document.createElement("option");
            optPlaceholder.value = "";
            optPlaceholder.textContent = "Selecione uma opção...";
            optPlaceholder.disabled = true;
            optPlaceholder.selected = true;
            inputElement.appendChild(optPlaceholder);

            // Injeta os itens da lista suspensa (Coluna F)
            campo.opcoes.forEach(opcao => {
                const opt = document.createElement("option");
                opt.value = opacity = opcao;
                opt.textContent = opcao;
                inputElement.appendChild(opt);
            });

        } else if (campo.tipo === "textarea") {
            inputElement = document.createElement("textarea");
            inputElement.rows = 3;
            inputElement.placeholder = "Digite as observações aqui...";

        } else if (campo.tipo === "file") {
            inputElement = document.createElement("input");
            inputElement.type = "file";
            inputElement.accept = "image/*"; // Ativa o gatilho nativo da câmera no telemóvel
            
        } else {
            // Padrão para "text" e "number"
            inputElement = document.createElement("input");
            inputElement.type = campo.tipo; // "text" ou "number"
            inputElement.placeholder = `Introduza o valor para ${campo.label.toLowerCase()}`;
        }

        // Configura atributos básicos
        inputElement.id = campo.id;
        inputElement.name = campo.id;
        
        if (campo.obrigatorio) {
            inputElement.required = true;
        }

        // Injeta VALOR_PADRAO se existir (Coluna G)
        if (campo.valorPadrao && campo.tipo !== "file" && campo.tipo !== "select") {
            inputElement.value = campo.valorPadrao;
        }

        formGroup.appendChild(inputElement);
        containerCamposDinamicos.appendChild(formGroup);
    });
}

// 📤 5. PROCESSAR E ENVIAR O FORMULÁRIO (SUCESSO COMPARTILHADO ONLINE/OFFLINE)
formRegistro.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const btnEnvio = document.getElementById("btn-finalizar");
    btnEnvio.disabled = true;
    btnEnvio.textContent = "A enviar dados...";

    const pacoteRegistro = {
        prefixo: inputPrefixoHidden.value,
        familia: inputFamiliaHidden.value,
        respostas: {}
    };

    // Recolhe dinamicamente os valores de cada input presente no formulário
    const inputs = containerCamposDinamicos.querySelectorAll("input, select, textarea");
    
    for (let input of inputs) {
        if (input.type === "file") {
            if (input.files.length > 0) {
                // Caso tenha foto, converte para string binária (Base64) antes do upload
                pacoteRegistro.respostas[input.id] = await converterParaBase64(input.files[0]);
            } else {
                pacoteRegistro.respostas[input.id] = "";
            }
        } else {
            pacoteRegistro.respostas[input.id] = input.value;
        }
    }

    // Executa a transmissão
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            mode: "no-cors", // Necessário devido às restrições de CORS nativas do Apps Script
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(pacoteRegistro)
        });

        // Caso 1: Sucesso com internet direta para a planilha mestre
        exibirJanelaSucesso("O seu checklist foi transmitido diretamente para a central da gerência com sucesso!");
        formRegistro.reset();

    } catch (erro) {
        console.warn("Falha de rede. Salvando em segundo plano (Modo Offline)...", erro);
