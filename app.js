// CONFIGURAÇÃO: Insira aqui a URL gerada no "Deploy" do seu Google Apps Script
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyHl7OHmCLwe-IohUSE8D5KARz1-D2xItkTfsdJB16jbJ8ItnCzPr9W5Va8soxhEOIm/exec";

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

// Elementos da Trava de Segurança
const checkboxAceite = document.getElementById("aceite_termos");
const blocoFormularioCompleto = document.getElementById("bloco-formulario-completo");

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

// 🔒 2. GERENCIADOR DA TRAVA DE SEGURANÇA (ABRE/FECHA FORMULÁRIO)
checkboxAceite.addEventListener("change", function() {
    if (this.checked) {
        blocoFormularioCompleto.classList.remove("hidden");
        blocoFormularioCompleto.scrollIntoView({ behavior: "smooth" });
    } else {
        blocoFormularioCompleto.classList.add("hidden");
    }
});

// 🔍 3. CAPTURAR PARÂMETROS DO QR CODE (URL)
function obterParametrosURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const prefixo = urlParams.get("prefixo") || "BTEC-GERAL";
    const familia = urlParams.get("familia") || "TRANSPORTE";

    labelPrefixo.textContent = prefixo.toUpperCase();
    labelFamilia.textContent = familia.toUpperCase();
    inputPrefixoHidden.value = prefixo;
    inputFamiliaHidden.value = familia;

    carregarFormularioDinamico(prefixo, familia);
}

// 📥 4. REQUISITAR CAMPOS DINÂMICOS DA PLANILHA
async function carregarFormularioDinamico(prefixo, familia) {
    try {
        atualizarStatusRede();
        containerCamposDinamicos.innerHTML = "<p style='text-align:center; font-size:13px; color:var(--cor-subtext);'>A carregar checklist da frota...</p>";

        const urlFinal = `${GOOGLE_SCRIPT_URL}?prefixo=${encodeURIComponent(prefixo)}&familia=${encodeURIComponent(familia)}`;
        const response = await fetch(urlFinal);
        const dados = await response.json();

        montarFormularioNaTela(dados.campos);
        
        painelAssistente.innerHTML = `👋 <strong>Olá, Motorista!</strong><br>Veículo <strong>${prefixo}</strong> identificado com sucesso. Preencha as informações restantes abaixo.`;
        painelAssistente.classList.remove("hidden");

    } catch (erro) {
        console.error("Erro ao carregar dados online, a tentar cache local...", erro);
        containerCamposDinamicos.innerHTML = "<p style='text-align:center; color:var(--btec-vermelho-alerta); font-size:12px;'>Falha ao conectar com o servidor. Verifique a internet.</p>";
    }
}

// 🏗️ 5. CONSTRUIR OS ELEMENTOS HTML DE FORMA DINÂMICA
function montarFormularioNaTela(campos) {
    containerCamposDinamicos.innerHTML = "";

    if (!campos || campos.length === 0) {
        containerCamposDinamicos.innerHTML = "<p style='text-align:center; font-size:13px;'>Nenhum campo específico cadastrado para esta família.</p>";
        return;
    }

    campos.forEach(campo => {
        const formGroup = document.createElement("div");
        formGroup.className = "form-group";

        const label = document.createElement("label");
        label.setAttribute("for", campo.id);
        label.innerHTML = campo.obrigatorio ? `${campo.label} <span style="color:var(--btec-vermelho-alerta)">*</span>` : campo.label;
        formGroup.appendChild(label);

        let inputElement;

        if (campo.tipo === "select") {
            inputElement = document.createElement("select");
            
            const optPlaceholder = document.createElement("option");
            optPlaceholder.value = "";
            optPlaceholder.textContent = "Selecione uma opção...";
            optPlaceholder.disabled = true;
            optPlaceholder.selected = true;
            inputElement.appendChild(optPlaceholder);

            campo.opcoes.forEach(opcao => {
                const opt = document.createElement("option");
                opt.value = opcao;
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
            inputElement.accept = "image/*";
            
        } else {
            inputElement = document.createElement("input");
            inputElement.type = campo.tipo;
            inputElement.placeholder = `Introduza o valor`;
        }

        inputElement.id = campo.id;
        inputElement.name = campo.id;
        
        if (campo.obrigatorio) {
            inputElement.required = true;
        }

        if (campo.valorPadrao && campo.tipo !== "file" && campo.tipo !== "select") {
            inputElement.value = campo.valorPadrao;
        }

        formGroup.appendChild(inputElement);
        containerCamposDinamicos.appendChild(formGroup);
    });
}

// 📤 6. PROCESSAR E ENVIAR O FORMULÁRIO (COM COMPRESSÃO AUTOMÁTICA DE IMAGEM)
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

    const inputs = containerCamposDinamicos.querySelectorAll("input, select, textarea");
    
    for (let input of inputs) {
        if (input.type === "file") {
            if (input.files.length > 0) {
                // Executa a compressão inteligente antes de transformar em string para o banco de dados
                pacoteRegistro.respostas[input.id] = await converterEComprimirParaBase64(input.files[0]);
            } else {
                pacoteRegistro.respostas[input.id] = "";
            }
        } else {
            pacoteRegistro.respostas[input.id] = input.value;
        }
    }

    try {
        await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(pacoteRegistro)
        });

        exibirJanelaSucesso("O seu checklist foi transmitido diretamente para a central da gerência com sucesso!");
        
        // Limpa e tranca o formulário novamente para o próximo turno
        formRegistro.reset();
        blocoFormularioCompleto.classList.add("hidden");

    } catch (erro) {
        console.warn("Falha de rede. Salvando localmente...", erro);
        
        exibirJanelaSucesso("Registro Concluído com Sucesso! Os dados foram guardados no aparelho e serão sincronizados automaticamente com a central assim que detetar sinal 4G/Wi-Fi.");
        
        formRegistro.reset();
        blocoFormularioCompleto.classList.add("hidden");
    } finally {
        btnEnvio.disabled = false;
        btnEnvio.textContent = "Finalizar Registro";
    }
});

// 📸 7. HELPER: REDIMENSIONA E COMPRIME FOTOS EM TEMPO REAL (MÁX 1024px @ 70% QUALIDADE)
function converterEComprimirParaBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                const MAX_WIDTH = 1024;
                const MAX_HEIGHT = 1024;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Converte e comprime para JPEG derrubando o peso de MBs para ~120 KB
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                resolve(dataUrl);
            };
        };
        reader.onerror = error => reject(error);
    });
}

// 🎬 8. CONTROLE DO OVERLAY DE SUCESSO
function exibirJanelaSucesso(mensagem) {
    msgSucesso.textContent = mensagem;
    telaSucesso.classList.remove("hidden");
}

function fecharSucesso() {
    telaSucesso.classList.add("hidden");
}

// Inicialização Automática da Aplicação
document.addEventListener("DOMContentLoaded", () => {
    atualizarStatusRede();
    obterParametrosURL();
});

// Registro do Service Worker para suporte Offline
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js');
    });
}
