// ---------- Configurações do jogo ----------
const MAX_CONSULTAS = 5;
const MAX_PALPITES = 6;
// A partir deste palpite (errado), a API diz se cada coeficiente está menor, maior ou certo.
// Tem que bater com a regra da API.
const PALPITE_COM_CORES = 5;

// Como cada tipo aparece na tela.
// "termos" diz o que acompanha cada coeficiente (a, b, c), usado para montar a fórmula com números.
// "calcular" serve só para desenhar a curva do PALPITE do jogador no gráfico.
// A função certa continua só na API: o navegador nunca sabe qual é.
const FORMULAS = {
    linear:      { nome: "Linear",      texto: "f(x) = a·x + b",        termos: ["x", ""],        calcular: (a, b, c, x) => a * x + b },
    quadratica:  { nome: "Quadrática",  texto: "f(x) = a·x² + b·x + c", termos: ["x²", "x", ""],  calcular: (a, b, c, x) => a * x * x + b * x + c },
    logaritmica: { nome: "Logarítmica", texto: "f(x) = a·ln(x) + b",    termos: ["ln(x)", ""],    calcular: (a, b, c, x) => a * Math.log(x) + b },
    exponencial: { nome: "Exponencial", texto: "f(x) = a·2^x + b",      termos: ["2^x", ""],      calcular: (a, b, c, x) => a * Math.pow(2, x) + b },
    cubica:      { nome: "Cúbica",      texto: "f(x) = a·x³ + b·x + c", termos: ["x³", "x", ""],  calcular: (a, b, c, x) => a * x * x * x + b * x + c },
};

// Cores usadas no gráfico (as mesmas do style.css)
const COR_CINZA = "#4a4642";
const COR_CINZA_CLARO = "#57514a";
const COR_VERMELHO = "#b8352f";
const COR_FUNDO = "rgba(227, 211, 181, 0.85)";  // bege do fundo, quase opaco

// ---------- Estado da partida ----------
let nivelEscolhido = 1;   // nível marcado na tela inicial
let nivel = 1;            // nível da partida atual
let consultasFeitas = 0;
let palpitesFeitos = 0;
let pontos = [];          // lista de { x, y, origem }
let ultimoPalpite = null; // { tipo, a, b, c } do último chute (para desenhar a curva)
let fimDeJogo = false;
let esperando = false;    // true enquanto espera a API responder (evita clique duplo)
let pistas = null;        // { tipo, valores, comparacao } do último palpite com cores

// ---------- Funções auxiliares ----------
function el(id) {
    return document.getElementById(id);
}

function mostrarMensagem(texto, classe) {
    el("mensagem").textContent = texto;
    el("mensagem").className = "mensagem " + (classe || "");
}

// Mostra o erro logo abaixo do campo certo e marca os campos como inválidos
function mostrarErro(idErro, texto, idsCampos) {
    el(idErro).textContent = texto;
    for (const id of idsCampos || []) {
        el(id).setAttribute("aria-invalid", "true");
    }
}

function limparErro(idErro, idsCampos) {
    el(idErro).textContent = "";
    for (const id of idsCampos) {
        el(id).removeAttribute("aria-invalid");
    }
}

function mostrarTela(id) {
    el("tela-inicio").classList.add("escondida");
    el("tela-jogo").classList.add("escondida");
    el(id).classList.remove("escondida");
}

// Busca dados na API (GET). Se o servidor não responder, devolve um { erro }.
async function pegar(url) {
    try {
        const resposta = await fetch(url);
        return await resposta.json();
    } catch (e) {
        return { erro: "Não foi possível falar com o servidor. Confira se o Docker está rodando e tente de novo." };
    }
}

// Envia JSON para a API (POST) e devolve a resposta já convertida
async function postar(url, dados) {
    try {
        const resposta = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(dados),
        });
        return await resposta.json();
    } catch (e) {
        return { erro: "Não foi possível falar com o servidor. Tente de novo." };
    }
}

// Confere se o texto do campo é um inteiro entre -5 e 5
function coeficienteValido(texto) {
    const n = Number(texto);
    return texto !== "" && Number.isInteger(n) && n >= -5 && n <= 5;
}

// Monta a fórmula com os números no lugar das letras. Ex.: f(x) = 2·x² − 3·x + 1
function formulaComNumeros(tipo, coeficientes) {
    const termos = FORMULAS[tipo].termos;
    let texto = "";

    for (let i = 0; i < termos.length; i++) {
        const n = coeficientes[i];
        if (n === 0) continue;

        const valor = Math.abs(n);
        let termo;
        if (termos[i] === "") {
            termo = String(valor);                 // termo sem x (só o número)
        } else if (valor === 1) {
            termo = termos[i];                     // 1·x vira só x
        } else {
            termo = valor + "·" + termos[i];
        }

        if (texto === "") {
            texto = (n < 0 ? "−" : "") + termo;   // primeiro termo
        } else {
            texto += (n < 0 ? " − " : " + ") + termo;
        }
    }
    return "f(x) = " + (texto || "0");
}

// ---------- Atualização da tela ----------
function atualizarTabela() {
    const tbody = el("tabela-pontos");
    tbody.innerHTML = "";
    for (const p of pontos) {
        const linha = document.createElement("tr");
        linha.className = p.origem;
        for (const valor of [p.x, p.y, p.origem]) {
            const celula = document.createElement("td");
            celula.textContent = valor;
            linha.appendChild(celula);
        }
        tbody.appendChild(linha);
    }
    el("sem-pontos").classList.toggle("escondida", pontos.length > 0);
}

function atualizarContadores() {
    const semConsultas = fimDeJogo || consultasFeitas >= MAX_CONSULTAS;
    el("consultas-restantes").textContent = MAX_CONSULTAS - consultasFeitas;
    el("palpites-restantes").textContent = MAX_PALPITES - palpitesFeitos;
    el("btn-consultar").disabled = esperando || semConsultas;
    el("valor-x").disabled = semConsultas;
    el("btn-palpite").disabled = esperando || fimDeJogo;
    el("ajuda-x").textContent = semConsultas && !fimDeJogo
        ? "Suas consultas acabaram. Agora é com os palpites."
        : "Entre -10 e 10 (pode ser decimal).";
}

function atualizarFormula() {
    const tipo = el("tipo").value;
    el("formula").textContent = FORMULAS[tipo].texto;
    // Só mostra o campo c se a função tiver 3 coeficientes
    el("campo-c").style.display = FORMULAS[tipo].termos.length === 3 ? "" : "none";
}

// ---------- Pistas de cor (depois do 5º palpite) ----------
const CLASSES_PISTA = ["pista-certo", "pista-aumentar", "pista-diminuir", "pista-errado"];

// Pinta um campo e escreve o texto da pista embaixo dele
function marcarPista(idCampo, idTexto, tipoPista, texto) {
    if (idCampo) el(idCampo).classList.add("pista-" + tipoPista);
    el(idTexto).textContent = texto;
    el(idTexto).className = "pista pista-" + tipoPista;
}

function limparPistas() {
    for (const id of ["tipo", "coef-a", "coef-b", "coef-c"]) {
        el(id).classList.remove(...CLASSES_PISTA);
    }
    for (const id of ["pista-tipo", "pista-a", "pista-b", "pista-c", "pista-resumo"]) {
        el(id).textContent = "";
    }
}

function mostrarPistas() {
    limparPistas();
    if (!pistas) return;

    const comp = pistas.comparacao;
    const nomeTipo = FORMULAS[pistas.tipo].nome;
    const mesmoTipo = el("tipo").value === pistas.tipo;   // o select ainda mostra o tipo chutado?
    const resumo = [];

    // Tipo da função: só pinta o select se ele ainda estiver no tipo que foi chutado.
    // Se a API não mandar tipo_certo, simplesmente não mostra nada sobre o tipo.
    if (comp.tipo_certo === true) {
        marcarPista(mesmoTipo ? "tipo" : null, "pista-tipo", "certo", "✓ " + nomeTipo + " é o tipo certo");
        resumo.push(nomeTipo + " é o tipo certo");
    } else if (comp.tipo_certo === false) {
        marcarPista(mesmoTipo ? "tipo" : null, "pista-tipo", "errado", "✗ " + nomeTipo + " não é o tipo certo");
        resumo.push(nomeTipo + " não é o tipo certo");
    }

    // Coeficientes: só fazem sentido com o tipo certo e com ele selecionado
    if (comp.tipo_certo !== false && mesmoTipo) {
        for (const nome of ["a", "b", "c"]) {
            if (!comp[nome]) continue;          // tipo com 2 coeficientes não tem c
            const valor = pistas.valores[nome];
            if (comp[nome] === "menor") {
                marcarPista("coef-" + nome, "pista-" + nome, "aumentar", valor + " ↑ aumente");
                resumo.push(nome + " igual a " + valor + " precisa aumentar");
            } else if (comp[nome] === "maior") {
                marcarPista("coef-" + nome, "pista-" + nome, "diminuir", valor + " ↓ diminua");
                resumo.push(nome + " igual a " + valor + " precisa diminuir");
            } else {
                marcarPista("coef-" + nome, "pista-" + nome, "certo", valor + " ✓ certo");
                resumo.push(nome + " igual a " + valor + " está certo");
            }
        }
    }
    el("pista-resumo").textContent = "Dica extra: " + resumo.join("; ") + ".";
}

// Quais coeficientes estão "certo" nas pistas (só vale para o mesmo tipo de função)
function coeficientesCertos(p, tipo) {
    if (!p || p.tipo !== tipo || p.comparacao.tipo_certo === false) return [];
    return ["a", "b", "c"].filter(function (nome) { return p.comparacao[nome] === "certo"; });
}

// ---------- Efeitos de acerto (game juice) ----------
const MOVIMENTO_REDUZIDO = window.matchMedia("(prefers-reduced-motion: reduce)");
const CORES_FAISCA = ["#2fbf71", "#1c613c", "#7be0a5", "#f2c14e", "#ffffff"];

function esperar(ms) {
    return new Promise(function (resolver) { setTimeout(resolver, ms); });
}

// Reinicia uma animação CSS mesmo que a classe já esteja no elemento
function reiniciarAnimacao(elemento, classe) {
    elemento.classList.remove(classe);
    void elemento.offsetWidth;   // força o navegador a "esquecer" a animação anterior
    elemento.classList.add(classe);
}

function tremerTela(forca) {
    const jogo = document.querySelector(".jogo");
    jogo.style.setProperty("--forca", forca);
    reiniciarAnimacao(jogo, "tremendo");
    if (navigator.vibrate) navigator.vibrate(40);   // celular vibra de verdade; no PC não faz nada
}

// Faíscas saindo do ponto (x, y) da tela em direções aleatórias
function soltarFaiscas(x, y, quantidade) {
    const camada = el("efeitos");
    for (let i = 0; i < quantidade; i++) {
        const faisca = document.createElement("span");
        faisca.className = "faisca";
        const angulo = Math.random() * 2 * Math.PI;
        const distancia = 40 + Math.random() * 70;
        faisca.style.left = x + "px";
        faisca.style.top = y + "px";
        faisca.style.setProperty("--dx", Math.cos(angulo) * distancia + "px");
        faisca.style.setProperty("--dy", Math.sin(angulo) * distancia - 20 + "px");
        faisca.style.setProperty("--giro", (Math.random() * 720 - 360) + "deg");
        faisca.style.background = CORES_FAISCA[i % CORES_FAISCA.length];
        camada.appendChild(faisca);
        setTimeout(function () { faisca.remove(); }, 900);
    }
}

function mostrarSelo(x, y, texto) {
    const selo = document.createElement("span");
    selo.className = "selo-acerto";
    selo.textContent = texto;
    selo.style.left = x + "px";
    selo.style.top = y + "px";
    el("efeitos").appendChild(selo);
    setTimeout(function () { selo.remove(); }, 1000);
}

// Efeito completo em um coeficiente. "ordem" 0, 1, 2... deixa cada acerto seguido mais forte
function efeitoAcerto(nome, ordem) {
    const caixa = el("campo-" + nome);
    const r = el("coef-" + nome).getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;

    reiniciarAnimacao(caixa, "pulo-acerto");
    soltarFaiscas(x, y, 14 + ordem * 8);
    mostrarSelo(x, r.top - 6, ordem === 0 ? "CERTO!" : "CERTO! x" + (ordem + 1));
    tremerTela(3 + ordem * 3);
}

// Toca os efeitos um depois do outro, como um combo
async function comemorarAcertos(nomes) {
    if (MOVIMENTO_REDUZIDO.matches) return;
    for (let i = 0; i < nomes.length; i++) {
        efeitoAcerto(nomes[i], i);
        await esperar(280);
    }
    if (nomes.length > 0) await esperar(300);
}

function atualizarTudo() {
    atualizarTabela();
    atualizarContadores();
    desenharGrafico();
}

// ---------- Gráfico (canvas, sem biblioteca) ----------

// Escolhe um espaçamento "redondo" para as linhas do eixo y (1, 2, 5, 10, 20, 50...)
function passoBonito(intervalo) {
    const bruto = intervalo / 6;
    const potencia = Math.pow(10, Math.floor(Math.log10(bruto)));
    const r = bruto / potencia;
    if (r < 1.5) return potencia;
    if (r < 3.5) return 2 * potencia;
    if (r < 7.5) return 5 * potencia;
    return 10 * potencia;
}

// Calcula de onde até onde vai o eixo y, a partir dos pontos já vistos
function limitesY() {
    if (pontos.length === 0) {
        return { min: -10, max: 10, passo: 2 };
    }
    const ys = pontos.map(function (p) { return p.y; });
    let min = Math.min(0, ...ys);
    let max = Math.max(0, ...ys);
    if (max - min < 10) {
        // Pontos muito próximos: abre um pouco para não ficar tudo numa linha
        min -= 5;
        max += 5;
    }
    const folga = (max - min) * 0.1;
    const passo = passoBonito(max - min + 2 * folga);
    return {
        min: Math.floor((min - folga) / passo) * passo,
        max: Math.ceil((max + folga) / passo) * passo,
        passo: passo,
    };
}

// Texto que o leitor de tela lê no lugar do gráfico
function resumoDoGrafico() {
    if (pontos.length === 0) {
        return "Gráfico vazio. Nenhum ponto consultado ainda.";
    }
    const lista = pontos.map(function (p) {
        return "(" + p.x + ", " + p.y + ")" + (p.origem === "dica" ? " dica" : "");
    });
    let texto = "Gráfico com " + pontos.length + " ponto(s): " + lista.join("; ") + ".";
    if (ultimoPalpite) {
        texto += " Curva tracejada do último palpite: " +
            formulaComNumeros(ultimoPalpite.tipo, [ultimoPalpite.a, ultimoPalpite.b, ultimoPalpite.c]) + ".";
    }
    return texto;
}

function desenharGrafico() {
    const canvas = el("grafico");
    const ctx = canvas.getContext("2d");
    canvas.setAttribute("aria-label", resumoDoGrafico());

    // Ajusta a resolução ao tamanho real na tela (fica nítido em qualquer monitor)
    const escala = window.devicePixelRatio || 1;
    const largura = canvas.clientWidth;
    const altura = canvas.clientHeight;
    if (largura === 0) return;   // tela escondida
    canvas.width = largura * escala;
    canvas.height = altura * escala;
    ctx.setTransform(escala, 0, 0, escala, 0, 0);
    ctx.clearRect(0, 0, largura, altura);

    // Área útil do gráfico (deixa espaço para os números dos eixos)
    const margem = { esq: 48, dir: 12, topo: 12, base: 28 };
    const areaL = largura - margem.esq - margem.dir;
    const areaA = altura - margem.topo - margem.base;

    const xMin = -10, xMax = 10;
    const y = limitesY();

    // Converte coordenadas da matemática para pixels
    function px(x) { return margem.esq + (x - xMin) / (xMax - xMin) * areaL; }
    function py(v) { return margem.topo + (y.max - v) / (y.max - y.min) * areaA; }

    ctx.font = "12px Segoe UI, Arial, sans-serif";
    ctx.fillStyle = COR_CINZA_CLARO;

    // Malha quadriculada (opacidade baixa)
    ctx.strokeStyle = "rgba(74, 70, 66, 0.16)";
    ctx.lineWidth = 1;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let x = xMin; x <= xMax; x++) {
        ctx.beginPath();
        ctx.moveTo(px(x), margem.topo);
        ctx.lineTo(px(x), margem.topo + areaA);
        ctx.stroke();
        if (x % 2 === 0) ctx.fillText(x, px(x), margem.topo + areaA + 8);
    }
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let v = y.min; v <= y.max + y.passo / 2; v += y.passo) {
        ctx.beginPath();
        ctx.moveTo(margem.esq, py(v));
        ctx.lineTo(margem.esq + areaL, py(v));
        ctx.stroke();
        ctx.fillText(Number(v.toFixed(6)), margem.esq - 8, py(v));
    }

    // Eixos x e y (passando pelo zero)
    ctx.strokeStyle = "rgba(74, 70, 66, 0.55)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(margem.esq, py(0));
    ctx.lineTo(margem.esq + areaL, py(0));
    ctx.moveTo(px(0), margem.topo);
    ctx.lineTo(px(0), margem.topo + areaA);
    ctx.stroke();

    // Sem pontos ainda: explica o que vai aparecer aqui
    if (pontos.length === 0) {
        ctx.fillStyle = COR_CINZA_CLARO;
        ctx.font = "15px Segoe UI, Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Os pontos que você consultar aparecem aqui.", margem.esq + areaL / 2, margem.topo + areaA / 4);
    }

    // A partir daqui, nada desenha fora da área do gráfico
    ctx.save();
    ctx.beginPath();
    ctx.rect(margem.esq, margem.topo, areaL, areaA);
    ctx.clip();

    // Curva do último palpite (tracejada)
    if (ultimoPalpite) {
        const f = FORMULAS[ultimoPalpite.tipo];
        ctx.strokeStyle = COR_CINZA_CLARO;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        let comecou = false;
        for (let i = 0; i <= 400; i++) {
            const x = xMin + (xMax - xMin) * i / 400;
            const valor = f.calcular(ultimoPalpite.a, ultimoPalpite.b, ultimoPalpite.c, x);
            if (!isFinite(valor)) {      // ex.: ln(x) com x ≤ 0
                comecou = false;
                continue;
            }
            // Limita o valor para não mandar o traço para o infinito
            const yPixel = Math.max(-5000, Math.min(5000, py(valor)));
            if (comecou) {
                ctx.lineTo(px(x), yPixel);
            } else {
                ctx.moveTo(px(x), yPixel);
                comecou = true;
            }
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Pontos: consulta = círculo cinza, dica = losango vermelho
    // (a forma também muda, para não depender só da cor)
    for (const p of pontos) {
        const cx = px(p.x);
        const cy = py(p.y);
        ctx.beginPath();
        if (p.origem === "dica") {
            ctx.fillStyle = COR_VERMELHO;
            ctx.moveTo(cx, cy - 8);
            ctx.lineTo(cx + 8, cy);
            ctx.lineTo(cx, cy + 8);
            ctx.lineTo(cx - 8, cy);
            ctx.closePath();
        } else {
            ctx.fillStyle = COR_CINZA;
            ctx.arc(cx, cy, 6, 0, 2 * Math.PI);
        }
        ctx.fill();

        // Valor escrito ao lado do ponto (acima; abaixo se estiver colado no topo)
        ctx.fillStyle = COR_CINZA;
        ctx.font = "12px Consolas, Courier New, monospace";
        ctx.textAlign = "center";
        const emCima = cy - margem.topo > 22;
        ctx.textBaseline = emCima ? "bottom" : "top";
        const rotulo = "(" + p.x + ", " + p.y + ")";
        const yRotulo = emCima ? cy - 10 : cy + 10;
        ctx.strokeStyle = COR_FUNDO;   // contorno da cor do fundo: o texto não some em cima da curva
        ctx.lineWidth = 3;
        ctx.strokeText(rotulo, cx, yRotulo);
        ctx.fillText(rotulo, cx, yRotulo);
    }
    ctx.restore();
}

// ---------- Ações do jogador ----------
function marcarNivel(novoNivel) {
    nivelEscolhido = novoNivel;
    document.querySelectorAll(".nivel").forEach(function (botao) {
        const ativo = Number(botao.dataset.nivel) === novoNivel;
        botao.classList.toggle("ativo", ativo);
        botao.setAttribute("aria-pressed", ativo ? "true" : "false");
    });
}

async function comecarPartida() {
    el("btn-jogar").disabled = true;
    // Pergunta à API quais tipos de função existem neste nível
    const info = await pegar("/api/jogo/" + nivelEscolhido);
    el("btn-jogar").disabled = false;
    if (info.erro) {
        el("erro-inicio").textContent = info.erro;
        return;
    }
    el("erro-inicio").textContent = "";

    nivel = nivelEscolhido;
    consultasFeitas = 0;
    palpitesFeitos = 0;
    pontos = [];
    ultimoPalpite = null;
    fimDeJogo = false;
    esperando = false;
    pistas = null;

    const select = el("tipo");
    select.innerHTML = "";
    for (const tipo of info.tipos) {
        const opcao = document.createElement("option");
        opcao.value = tipo;
        opcao.textContent = FORMULAS[tipo].nome;
        select.appendChild(opcao);
    }

    el("rotulo-nivel").textContent = "Nível " + nivel;
    for (const id of ["coef-a", "coef-b", "coef-c", "valor-x"]) {
        el(id).value = "";
    }
    limparErro("erro-consulta", ["valor-x"]);
    limparErro("erro-palpite", ["coef-a", "coef-b", "coef-c"]);
    limparPistas();
    el("btn-ver-resultado").classList.add("escondida");
    mostrarMensagem("Comece consultando alguns valores de x.");

    mostrarTela("tela-jogo");
    atualizarFormula();
    atualizarTudo();
    el("valor-x").focus();
}

async function consultar() {
    if (el("btn-consultar").disabled) return;
    limparErro("erro-consulta", ["valor-x"]);

    const x = el("valor-x").value;
    if (x === "") {
        mostrarErro("erro-consulta", "Digite um valor de x entre -10 e 10.", ["valor-x"]);
        el("valor-x").focus();
        return;
    }

    // Confere a faixa antes de gastar uma consulta na API (a API também confere)
    const numX = Number(x);
    if (!Number.isFinite(numX) || numX < -10 || numX > 10) {
        mostrarErro("erro-consulta", "O x deve estar entre -10 e 10.", ["valor-x"]);
        el("valor-x").focus();
        return;
    }

    esperando = true;
    atualizarContadores();
    const resposta = await postar("/api/consultar", { nivel: nivel, x: x });
    esperando = false;

    if (resposta.erro) {
        mostrarErro("erro-consulta", resposta.erro + ".", ["valor-x"]);
        atualizarContadores();
        el("valor-x").focus();
        return;
    }

    consultasFeitas++;
    pontos.push({ x: resposta.x, y: resposta.y, origem: "consulta" });
    mostrarMensagem("f(" + resposta.x + ") = " + resposta.y);

    el("valor-x").value = "";
    atualizarTudo();
    // Se ainda tem consulta, continua no x; se acabou, vai para o palpite
    el(consultasFeitas < MAX_CONSULTAS ? "valor-x" : "coef-a").focus();
}

async function chutar() {
    if (el("btn-palpite").disabled) return;

    const tipo = el("tipo").value;
    const usaC = FORMULAS[tipo].termos.length === 3;
    const campos = usaC ? ["coef-a", "coef-b", "coef-c"] : ["coef-a", "coef-b"];
    limparErro("erro-palpite", ["coef-a", "coef-b", "coef-c"]);

    // Confere os campos antes de gastar um palpite na API
    const invalidos = campos.filter(function (id) { return !coeficienteValido(el(id).value); });
    if (invalidos.length > 0) {
        const nomes = invalidos.map(function (id) { return id.slice(-1); }).join(", ");
        mostrarErro("erro-palpite", "Preencha " + nomes + " com um inteiro de -5 a 5.", invalidos);
        el(invalidos[0]).focus();
        return;
    }
    if (Number(el("coef-a").value) === 0) {
        mostrarErro("erro-palpite", "O a não pode ser 0.", ["coef-a"]);
        el("coef-a").focus();
        return;
    }

    const dados = {
        nivel: nivel,
        tipo: tipo,
        a: el("coef-a").value,
        b: el("coef-b").value,
        c: usaC ? el("coef-c").value : 0,
        xs_vistos: pontos.map(function (p) { return p.x; }),
        tentativa: palpitesFeitos + 1,   // a API usa para saber se já libera as cores
    };

    esperando = true;
    atualizarContadores();
    const resposta = await postar("/api/palpite", dados);
    esperando = false;

    if (resposta.erro) {
        mostrarErro("erro-palpite", resposta.erro + ".");
        atualizarContadores();
        return;
    }

    palpitesFeitos++;
    ultimoPalpite = {
        tipo: tipo,
        a: Number(dados.a),
        b: Number(dados.b),
        c: Number(dados.c),
    };

    if (resposta.acertou) {
        fimDeJogo = true;
        mostrarMensagem("✓ Acertou em " + palpitesFeitos + " palpite(s)!", "acerto");
        atualizarTudo();

        // Se as cores já estavam ligadas, tudo fica verde com efeito antes da tela de vitória
        if (pistas) {
            const antes = coeficientesCertos(pistas, tipo);
            const tudoCerto = { tipo_certo: true, a: "certo", b: "certo" };
            if (usaC) tudoCerto.c = "certo";
            pistas = { tipo: tipo, valores: { a: ultimoPalpite.a, b: ultimoPalpite.b, c: ultimoPalpite.c }, comparacao: tudoCerto };
            mostrarPistas();
            const novos = coeficientesCertos(pistas, tipo).filter(function (n) { return !antes.includes(n); });
            await comemorarAcertos(novos);
        }

        await salvarResultado(true);
        await mostrarFim(true);
        return;
    }

    // A API manda um ponto onde o palpite e a função certa são diferentes
    if (resposta.dica) {
        pontos.push({ x: resposta.dica.x, y: resposta.dica.y_certo, origem: "dica" });
        mostrarMensagem(
            "✗ Errou! Em x = " + resposta.dica.x + " seu palpite dá " +
            resposta.dica.y_palpite + ", mas a função certa dá " + resposta.dica.y_certo + ".",
            "erro"
        );
    } else {
        mostrarMensagem("✗ Errou!", "erro");
    }

    // A partir do 5º palpite a API compara cada coeficiente
    let festa = Promise.resolve();
    if (resposta.comparacao) {
        const antes = coeficientesCertos(pistas, tipo);   // os que já estavam certos não comemoram de novo
        pistas = {
            tipo: tipo,
            valores: { a: ultimoPalpite.a, b: ultimoPalpite.b, c: ultimoPalpite.c },
            comparacao: resposta.comparacao,
        };
        mostrarPistas();
        el("mensagem").textContent += " Dica extra: veja as cores nos campos do palpite.";
        const novos = coeficientesCertos(pistas, tipo).filter(function (n) { return !antes.includes(n); });
        festa = comemorarAcertos(novos);
    }

    if (palpitesFeitos >= MAX_PALPITES) {
        fimDeJogo = true;
        atualizarTudo();
        await festa;   // deixa os efeitos terminarem antes da tela de fim
        await salvarResultado(false);
        await mostrarFim(false);
        return;
    }

    atualizarTudo();
}

async function salvarResultado(acertou) {
    await postar("/api/resultado", {
        jogador: el("jogador").value.trim() || "Anônimo",
        nivel: nivel,
        tentativas: palpitesFeitos,
        acertou: acertou,
    });
}

async function carregarRanking() {
    const ol = el("ranking");
    ol.innerHTML = "<li>Carregando…</li>";
    const lista = await pegar("/api/ranking/" + nivel);
    ol.innerHTML = "";

    if (lista.erro) {
        ol.innerHTML = "<li>Não foi possível carregar o ranking.</li>";
        return;
    }
    if (lista.length === 0) {
        ol.innerHTML = "<li>Ninguém acertou ainda hoje.</li>";
        return;
    }
    for (const item of lista) {
        const li = document.createElement("li");
        li.textContent = item.jogador + " — " + item.tentativas + " palpite(s)";
        ol.appendChild(li);
    }
}

// ---------- Janela de fim de jogo ----------
function abrirFim() {
    el("fim").classList.remove("escondida");
    el("btn-outro-nivel").focus();
}

function fecharFim() {
    el("fim").classList.add("escondida");
    el("btn-ver-resultado").classList.remove("escondida");
    el("btn-ver-resultado").focus();
}

// Preenche e mostra o cartão de vitória ou derrota
async function mostrarFim(acertou) {
    const titulo = el("fim-titulo");
    if (acertou) {
        titulo.textContent = "✓ Você acertou!";
        titulo.className = "vitoria";
        el("fim-texto").textContent = "A função de hoje no nível " + nivel + " era:";
        el("fim-formula").textContent = formulaComNumeros(
            ultimoPalpite.tipo, [ultimoPalpite.a, ultimoPalpite.b, ultimoPalpite.c]
        );
    } else {
        titulo.textContent = "✗ Não foi dessa vez";
        titulo.className = "derrota";
        el("fim-texto").textContent = "Seus palpites acabaram. Amanhã tem uma função nova!";
        el("fim-formula").textContent = "";
    }

    el("fim-palpites").textContent = palpitesFeitos + "/" + MAX_PALPITES;
    el("fim-consultas").textContent = consultasFeitas + "/" + MAX_CONSULTAS;
    el("titulo-ranking").textContent = "Ranking de hoje — Nível " + nivel;
    abrirFim();
    await carregarRanking();
}

// ---------- Ligando os botões ----------
document.querySelectorAll(".nivel").forEach(function (botao) {
    botao.addEventListener("click", function () {
        marcarNivel(Number(botao.dataset.nivel));
    });
});

el("btn-jogar").addEventListener("click", comecarPartida);
el("btn-consultar").addEventListener("click", consultar);
el("btn-palpite").addEventListener("click", chutar);
el("tipo").addEventListener("change", function () {
    atualizarFormula();
    limparErro("erro-palpite", ["coef-a", "coef-b", "coef-c"]);
    mostrarPistas();   // as cores dos coeficientes só valem para o tipo que foi chutado
});

// Enter no campo x consulta; Enter num coeficiente chuta
el("valor-x").addEventListener("keydown", function (evento) {
    if (evento.key === "Enter") consultar();
});
for (const id of ["coef-a", "coef-b", "coef-c"]) {
    el(id).addEventListener("keydown", function (evento) {
        if (evento.key === "Enter") chutar();
    });
}

el("btn-voltar").addEventListener("click", function () {
    mostrarTela("tela-inicio");
    el("btn-jogar").focus();
});

el("btn-fechar").addEventListener("click", fecharFim);
el("btn-ver-resultado").addEventListener("click", abrirFim);

el("btn-outro-nivel").addEventListener("click", function () {
    el("fim").classList.add("escondida");
    mostrarTela("tela-inicio");
    el("btn-jogar").focus();
});

// Esc fecha a janela de fim; Tab fica preso dentro dela enquanto estiver aberta
document.addEventListener("keydown", function (evento) {
    if (el("fim").classList.contains("escondida")) return;
    if (evento.key === "Escape") {
        fecharFim();
    } else if (evento.key === "Tab") {
        const primeiro = el("btn-fechar");
        const ultimo = el("btn-outro-nivel");
        if (evento.shiftKey && document.activeElement === primeiro) {
            evento.preventDefault();
            ultimo.focus();
        } else if (!evento.shiftKey && document.activeElement === ultimo) {
            evento.preventDefault();
            primeiro.focus();
        }
    }
});

// Redesenha o gráfico se a janela mudar de tamanho
window.addEventListener("resize", desenharGrafico);
