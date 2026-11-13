// ---------- Configurações do jogo ----------
const MAX_CONSULTAS = 5;
const MAX_PALPITES = 6;

// Como cada tipo aparece na tela e se usa o coeficiente c
const FORMULAS = {
    linear:      { texto: "f(x) = a·x + b",          usaC: false },
    quadratica:  { texto: "f(x) = a·x² + b·x + c",   usaC: true  },
    logaritmica: { texto: "f(x) = a·ln(x) + b",      usaC: false },
    exponencial: { texto: "f(x) = a·2^x + b",        usaC: false },
    cubica:      { texto: "f(x) = a·x³ + b·x + c",   usaC: true  },
};

// ---------- Estado da partida ----------
let nivel = 1;
let consultasFeitas = 0;
let palpitesFeitos = 0;
let pontos = [];        // lista de { x, y, origem }
let fimDeJogo = false;

// ---------- Funções auxiliares ----------
function el(id) {
    return document.getElementById(id);
}

function mostrarMensagem(texto, classe) {
    el("mensagem").textContent = texto;
    el("mensagem").className = "mensagem " + (classe || "");
}

// Envia JSON para a API e devolve a resposta já convertida
async function postar(url, dados) {
    const resposta = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
    });
    return resposta.json();
}

// ---------- Atualização da tela ----------
function atualizarTabela() {
    const tbody = el("tabela-pontos");
    tbody.innerHTML = "";
    for (const p of pontos) {
        const linha = document.createElement("tr");
        for (const valor of [p.x, p.y, p.origem]) {
            const celula = document.createElement("td");
            celula.textContent = valor;
            linha.appendChild(celula);
        }
        tbody.appendChild(linha);
    }
}

function atualizarContadores() {
    el("consultas-restantes").textContent = MAX_CONSULTAS - consultasFeitas;
    el("palpites-restantes").textContent = MAX_PALPITES - palpitesFeitos;
    el("btn-consultar").disabled = fimDeJogo || consultasFeitas >= MAX_CONSULTAS;
    el("btn-palpite").disabled = fimDeJogo;
}

function atualizarFormula() {
    const tipo = el("tipo").value;
    el("formula").textContent = FORMULAS[tipo].texto;
    el("campo-c").style.display = FORMULAS[tipo].usaC ? "inline" : "none";
}

async function carregarRanking() {
    const resposta = await fetch("/api/ranking/" + nivel);
    const lista = await resposta.json();
    const ol = el("ranking");
    ol.innerHTML = "";
    if (lista.length === 0) {
        ol.innerHTML = "<li>Ninguém acertou ainda hoje.</li>";
    }
    for (const item of lista) {
        const li = document.createElement("li");
        li.textContent = item.jogador + " - " + item.tentativas + " palpite(s)";
        ol.appendChild(li);
    }
}

// ---------- Ações do jogador ----------
async function escolherNivel(novoNivel) {
    nivel = novoNivel;
    consultasFeitas = 0;
    palpitesFeitos = 0;
    pontos = [];
    fimDeJogo = false;

    // Destaca o botão do nível escolhido
    document.querySelectorAll(".nivel").forEach(function (botao) {
        botao.classList.toggle("ativo", Number(botao.dataset.nivel) === nivel);
    });

    // Pergunta à API quais tipos de função existem neste nível
    const resposta = await fetch("/api/jogo/" + nivel);
    const info = await resposta.json();

    const select = el("tipo");
    select.innerHTML = "";
    for (const tipo of info.tipos) {
        const opcao = document.createElement("option");
        opcao.value = tipo;
        opcao.textContent = tipo;
        select.appendChild(opcao);
    }
    el("info-nivel").textContent = "Tipos possíveis: " + info.tipos.join(" ou ");

    atualizarFormula();
    atualizarTabela();
    atualizarContadores();
    mostrarMensagem("");
    carregarRanking();
}

async function consultar() {
    const x = el("valor-x").value;
    if (x === "") {
        mostrarMensagem("Digite um valor de x.", "erro");
        return;
    }

    const resposta = await postar("/api/consultar", { nivel: nivel, x: x });
    if (resposta.erro) {
        mostrarMensagem(resposta.erro, "erro");
        return;
    }

    consultasFeitas++;
    pontos.push({ x: resposta.x, y: resposta.y, origem: "consulta" });
    mostrarMensagem("");
    atualizarTabela();
    atualizarContadores();
}

async function chutar() {
    const dados = {
        nivel: nivel,
        tipo: el("tipo").value,
        a: el("coef-a").value,
        b: el("coef-b").value,
        c: el("coef-c").value || 0,
        xs_vistos: pontos.map(function (p) { return p.x; }),
    };

    const resposta = await postar("/api/palpite", dados);
    if (resposta.erro) {
        mostrarMensagem(resposta.erro, "erro");
        return;
    }

    palpitesFeitos++;

    if (resposta.acertou) {
        fimDeJogo = true;
        mostrarMensagem("Acertou em " + palpitesFeitos + " palpite(s)!", "acerto");
        await salvarResultado(true);
    } else {
        // A API manda um ponto onde o palpite e a função certa são diferentes
        if (resposta.dica) {
            pontos.push({ x: resposta.dica.x, y: resposta.dica.y_certo, origem: "dica" });
            mostrarMensagem(
                "Errou! Em x = " + resposta.dica.x + " seu palpite dá " +
                resposta.dica.y_palpite + ", mas a função certa dá " + resposta.dica.y_certo + ".",
                "erro"
            );
        }
        if (palpitesFeitos >= MAX_PALPITES) {
            fimDeJogo = true;
            mostrarMensagem("Fim de jogo! Seus palpites acabaram. Volte amanhã.", "erro");
            await salvarResultado(false);
        }
    }

    atualizarTabela();
    atualizarContadores();
}

async function salvarResultado(acertou) {
    await postar("/api/resultado", {
        jogador: el("jogador").value || "Anônimo",
        nivel: nivel,
        tentativas: palpitesFeitos,
        acertou: acertou,
    });
    carregarRanking();
}

// ---------- Ligando os botões ----------
document.querySelectorAll(".nivel").forEach(function (botao) {
    botao.addEventListener("click", function () {
        escolherNivel(Number(botao.dataset.nivel));
    });
});
el("btn-consultar").addEventListener("click", consultar);
el("btn-palpite").addEventListener("click", chutar);
el("tipo").addEventListener("change", atualizarFormula);

// Começa no nível 1
escolherNivel(1);
