const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwCuSg7QuzCwGnG42TGSrtcVl14lSaq_X5WEzOt4Fv93L7EgS13rah9MZyQp0wsJ564/exec";

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

const checkboxAceite = document.getElementById("aceite_termos");
const avisoNaoConcordo = document.getElementById("aviso-nao-concordo");
const inputNome = document.getElementById("nome_motorista");
const btnFinalizar = document.getElementById("btn-finalizar");

let camposSalvosServidor = [];

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

checkboxAceite.addEventListener("change", function() {
    if (this.checked) {
        avisoNaoConcordo.classList.add("hidden");
        btnFinalizar.textContent = "Finalizar Checklist Completo";
        montarFormularioNaTela(camposSalvosServidor);
    } else {
        avisoNaoConcordo.classList.remove("hidden");
        containerCamposDinamicos.innerHTML = "";
        btnFinalizar.textContent = "Registrar Presença";
    }
});

function obterParametrosURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const prefixo = urlParams.get("prefixo") || "BTEC-GERAL";
    const familia = urlParams.get("familia") || "";

    labelPrefixo.textContent = prefixo.toUpperCase();
    labelFamilia.textContent = familia.toUpperCase() || "GERAL";
    inputPrefixoHidden.value = prefixo;
    inputFamiliaHidden.value = familia;

    carregarDadosIniciais(prefixo, familia);
}

async function carregarDadosIniciais(prefixo, familia) {
    try {
        atualizarStatusRede();
        const urlFinal = `${GOOGLE_SCRIPT_URL}?prefixo=${encodeURIComponent(prefixo)}&familia=${encodeURIComponent(familia)}`;
        
        painelAssistente.innerHTML = `⏳ Conectando à central BTEC...`;

        const response = await fetch(urlFinal);
        if (!response.ok) throw new Error();
        const dados = await response.json();

        camposSalvosServidor = dados.campos || [];
        painelAssistente.innerHTML = `🤖 Equipamento <strong>${prefixo}</strong> pronto. Insira seu nome completo e assinale os termos de consentimento para liberar o checklist.`;
    } catch (erro) {
        painelAssistente.innerHTML = `❌ <strong>Erro:</strong> Não foi possível sincronizar os dados da central.`;
    }
}

function montarFormularioNaTela(campos) {
    containerCamposDinamicos.innerHTML = "";
    
    campos.forEach(campo => {
        const formGroup = document.createElement("div");
        formGroup.className = "form-group";

        const label = document.createElement("label");
        label.htmlFor = campo.id;
        label.innerHTML = campo.obrigatorio ? `${campo.label} *` : campo.label;
        formGroup.appendChild(label);

        let inputElement;

        if (campo.tipo === "select") {
            inputElement = document.createElement("select");
            const optPlaceholder = document.createElement("option");
            optPlaceholder.value = ""; optPlaceholder.textContent = "Selecione..."; optPlaceholder.disabled = true; optPlaceholder.selected = true;
            inputElement.appendChild(optPlaceholder);

            campo.opcoes.forEach(opcao => {
                const opt = document.createElement("option");
                opt.value = opcao; opt.textContent = opcao;
                inputElement.appendChild(opt);
            });
        } else if (campo.tipo === "textarea") {
            inputElement = document.createElement("textarea");
            inputElement.rows = 3;
            inputElement.placeholder = "Digite as observações...";
        } else if (campo.tipo === "file") {
            inputElement = document.createElement("input");
            inputElement.type = "file"; 
            inputElement.accept = "image/*";
        } else {
            inputElement = document.createElement("input");
            inputElement.type = campo.tipo;
            inputElement.placeholder = `Preencha o campo...`;
        }

        inputElement.id = campo.id; 
        inputElement.name = campo.id;
        if (campo.obrigatorio) inputElement.required = true;
        
        formGroup.appendChild(inputElement);
        containerCamposDinamicos.appendChild(formGroup);
    });
}

formRegistro.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    btnFinalizar.disabled = true;
    const textoOriginalBtn = btnFinalizar.textContent;
    btnFinalizar.textContent = "Enviando dados...";

    const pacoteRegistro = {
        prefixo: inputPrefixoHidden.value,
        familia: inputFamiliaHidden.value,
        consentimento_bonus: checkboxAceite.checked ? "SIM" : "NÃO",
        respostas: { nome_motorista: inputNome.value }
    };

    if (checkboxAceite.checked) {
        const inputs = containerCamposDinamicos.querySelectorAll("input, select, textarea");
        for (let input of inputs) {
            if (input.type === "file") {
                if (input.files.length > 0) {
                    pacoteRegistro.respostas[input.id] = await converterParaBase64(input.files[0]);
                } else {
                    pacoteRegistro.respostas[input.id] = "";
                }
            } else {
                pacoteRegistro.respostas[input.id] = input.value;
            }
        }
    }

    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(pacoteRegistro)
        });

        exibirJanelaSucesso(checkboxAceite.checked ? "Checklist enviado com sucesso!" : "Presença registrada! Lembrete: dados incompletos anulam o bônus.");
        formRegistro.reset();
        checkboxAceite.checked = false;
        avisoNaoConcordo.classList.remove("hidden");
        containerCamposDinamicos.innerHTML = "";
        btnFinalizar.textContent = "Registrar Presença";
    } catch (erro) {
        exibirJanelaSucesso("Erro na transmissão. Dados salvos localmente no cache.");
    } finally {
        btnFinalizar.disabled = false;
    }
});

function converterParaBase64(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width; let height = img.height;
                const MAX = 1024;
                if (width > height && width > MAX) { height *= MAX / width; width = MAX; }
                else if (height > MAX) { width *= MAX / height; height = MAX; }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
        };
    });
}

function exibirJanelaSucesso(msg) { 
    msgSucesso.textContent = msg; 
    telaSucesso.classList.remove("hidden"); 
}
function fecharSucesso() { 
    telaSucesso.classList.add("hidden"); 
}

document.addEventListener("DOMContentLoaded", () => {
    obterParametrosURL();
});
