import math
import os
from datetime import datetime
from zoneinfo import ZoneInfo

import psycopg2
from flask import Flask, jsonify, request

from funcoes import TIPOS_POR_NIVEL, achar_contra_exemplo, calcular, sortear_funcao

app = Flask(__name__)

# A partir deste palpite (errado), a resposta diz se cada coeficiente está menor, maior ou certo.
# Tem que bater com PALPITE_COM_CORES do frontend/script.js.
PALPITE_COM_CORES = 5


# ---------- Banco de dados ----------

def conectar():
    """Abre uma conexão com o PostgreSQL usando as variáveis do docker-compose."""
    return psycopg2.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        user=os.environ.get("DB_USER", "mathdle"),
        password=os.environ.get("DB_PASSWORD", "mathdle"),
        dbname=os.environ.get("DB_NAME", "mathdle"),
    )


def hoje():
    """Data de hoje no horário de Brasília (o container usa UTC por padrão)."""
    return datetime.now(ZoneInfo("America/Sao_Paulo")).date()


def funcao_do_dia(nivel):
    """
    Devolve (tipo, a, b, c) da função de hoje para o nível.
    Se ainda não existir, sorteia uma e salva no banco.
    """
    # Calcula a data uma vez só: se virar meia-noite entre o INSERT e o SELECT,
    # os dois continuam usando o mesmo dia.
    data = hoje()
    tipo, a, b, c = sortear_funcao(nivel)

    con = conectar()
    try:
        cur = con.cursor()
        # ON CONFLICT: se outra pessoa já criou a função de hoje, não faz nada
        cur.execute(
            "INSERT INTO funcoes (data, nivel, tipo, a, b, c) VALUES (%s, %s, %s, %s, %s, %s) "
            "ON CONFLICT (data, nivel) DO NOTHING",
            (data, nivel, tipo, a, b, c),
        )
        con.commit()

        cur.execute("SELECT tipo, a, b, c FROM funcoes WHERE data = %s AND nivel = %s", (data, nivel))
        return cur.fetchone()
    finally:
        # O finally roda sempre, mesmo se der erro acima: a conexão nunca fica aberta.
        # Fechar a conexão também fecha o cursor.
        con.close()


# ---------- Validações ----------

def ler_json():
    """
    Lê o corpo da requisição como JSON.
    Se não for JSON (ou não for um objeto {...}), devolve {} em vez de deixar o
    Flask responder com uma página HTML de erro. Aí a rota cai no KeyError e
    responde com {"erro": ...}, que é o que o frontend sabe mostrar.
    """
    dados = request.get_json(silent=True)
    return dados if isinstance(dados, dict) else {}


def ler_nivel(valor):
    """Converte o nível para inteiro e confere se é 1, 2 ou 3."""
    nivel = int(valor)
    if nivel not in TIPOS_POR_NIVEL:
        raise ValueError("Nível inválido")
    return nivel


# ---------- Dica de cores (a partir do 5º palpite) ----------

def comparar_valor(certo, chute):
    """Diz se o chute é menor, maior ou igual ao valor certo."""
    if chute < certo:
        return "menor"      # o frontend mostra "↑ aumente"
    elif chute > certo:
        return "maior"      # o frontend mostra "↓ diminua"
    else:
        return "certo"


def comparar_coeficientes(certa, chute):
    """
    Compara o palpite com a função certa, coeficiente por coeficiente.
    certa e chute são tuplas (tipo, a, b, c).
    """
    # Tipo errado: não fala dos coeficientes, para não entregar os de outro tipo
    if certa[0] != chute[0]:
        return {"tipo_certo": False}

    comparacao = {
        "tipo_certo": True,
        "a": comparar_valor(certa[1], chute[1]),
        "b": comparar_valor(certa[2], chute[2]),
    }
    # Só quadrática e cúbica usam o c
    if certa[0] in ["quadratica", "cubica"]:
        comparacao["c"] = comparar_valor(certa[3], chute[3])
    return comparacao


# ---------- Rotas da API ----------

@app.route("/api/jogo/<nivel>")
def info_jogo(nivel):
    """Informa os tipos de função possíveis no nível (sem revelar a função)."""
    try:
        nivel = ler_nivel(nivel)
    except ValueError:
        return jsonify({"erro": "Nível inválido"}), 400
    return jsonify({"nivel": nivel, "tipos": TIPOS_POR_NIVEL[nivel]})


@app.route("/api/consultar", methods=["POST"])
def consultar():
    """Recebe um x e devolve f(x) da função do dia."""
    dados = ler_json()
    try:
        nivel = ler_nivel(dados["nivel"])
        x = float(dados["x"])
    except (KeyError, ValueError, TypeError):
        return jsonify({"erro": "Envie um nível (1 a 3) e um número x"}), 400

    # float() aceita os textos "nan" e "inf". NaN não é JSON válido e quebraria a resposta.
    if not math.isfinite(x):
        return jsonify({"erro": "Envie um número x válido"}), 400

    if x < -10 or x > 10:
        return jsonify({"erro": "O x deve estar entre -10 e 10"}), 400

    tipo, a, b, c = funcao_do_dia(nivel)
    if tipo == "logaritmica" and x <= 0:
        return jsonify({"erro": "Nesta função, o x precisa ser maior que 0"}), 400

    y = calcular(tipo, a, b, c, x)
    return jsonify({"x": x, "y": round(y, 2)})


@app.route("/api/palpite", methods=["POST"])
def palpite():
    """Confere o palpite. Se errar, devolve um ponto onde as funções diferem."""
    dados = ler_json()
    try:
        nivel = ler_nivel(dados["nivel"])
        tipo_p = dados["tipo"]
        a_p = int(dados["a"])
        b_p = int(dados["b"])
        c_p = int(dados.get("c", 0))
    except (KeyError, ValueError, TypeError):
        return jsonify({"erro": "Palpite incompleto: envie tipo, a, b (e c, se houver)"}), 400

    # Número do palpite (1 a 6). Se não vier, vale 0 e as cores não aparecem.
    try:
        tentativa = int(dados.get("tentativa", 0))
    except (ValueError, TypeError):
        return jsonify({"erro": "A tentativa deve ser um número inteiro"}), 400

    if tipo_p not in TIPOS_POR_NIVEL[nivel]:
        return jsonify({"erro": "Esse tipo de função não existe neste nível"}), 400

    # Tipos com 2 coeficientes ignoram o c
    if tipo_p in ["linear", "logaritmica", "exponencial"]:
        c_p = 0

    # Mesma faixa usada no sorteio. Também evita números gigantes que estourariam o cálculo.
    if not all(-5 <= coef <= 5 for coef in (a_p, b_p, c_p)):
        return jsonify({"erro": "Os coeficientes devem ser inteiros de -5 a 5"}), 400

    # xs_vistos precisa ser uma lista de números (ex.: [1, 2.5, -3])
    xs_vistos = dados.get("xs_vistos", [])
    if not isinstance(xs_vistos, list) or not all(isinstance(v, (int, float)) for v in xs_vistos):
        return jsonify({"erro": "xs_vistos deve ser uma lista de números"}), 400

    certa = funcao_do_dia(nivel)
    chute = (tipo_p, a_p, b_p, c_p)

    if chute == tuple(certa):
        return jsonify({"acertou": True})

    # Errou: procura um x em que as duas funções dão resultados diferentes
    x = achar_contra_exemplo(certa, chute, xs_vistos)
    resposta = {"acertou": False}
    if x is not None:
        resposta["dica"] = {
            "x": x,
            "y_certo": round(calcular(*certa, x), 2),
            "y_palpite": round(calcular(*chute, x), 2),
        }

    # Do 5º palpite em diante, também diz se cada coeficiente está menor, maior ou certo
    if tentativa >= PALPITE_COM_CORES:
        resposta["comparacao"] = comparar_coeficientes(certa, chute)
    return jsonify(resposta)


@app.route("/api/resultado", methods=["POST"])
def salvar_resultado():
    """Salva o resultado da partida no banco."""
    dados = ler_json()
    try:
        jogador = str(dados["jogador"]).strip()[:50] or "Anônimo"
        nivel = ler_nivel(dados["nivel"])
        tentativas = int(dados["tentativas"])
        acertou = dados["acertou"]
    except (KeyError, ValueError, TypeError):
        return jsonify({"erro": "Dados do resultado incompletos"}), 400

    # Cada partida tem no máximo 6 palpites. Sem isso, dava para mandar 0 e ficar em 1º.
    if tentativas < 1 or tentativas > 6:
        return jsonify({"erro": "O número de tentativas deve ser de 1 a 6"}), 400

    # Não usamos bool(): em Python, bool("false") é True (todo texto não vazio é True).
    if not isinstance(acertou, bool):
        return jsonify({"erro": "O campo acertou deve ser true ou false"}), 400

    con = conectar()
    try:
        cur = con.cursor()
        cur.execute(
            "INSERT INTO partidas (jogador, data, nivel, tentativas, acertou) VALUES (%s, %s, %s, %s, %s)",
            (jogador, hoje(), nivel, tentativas, acertou),
        )
        con.commit()
    finally:
        con.close()
    return jsonify({"ok": True})


@app.route("/api/ranking/<nivel>")
def ranking(nivel):
    """Top 10 de hoje no nível: quem acertou com menos tentativas."""
    try:
        nivel = ler_nivel(nivel)
    except ValueError:
        return jsonify({"erro": "Nível inválido"}), 400

    con = conectar()
    try:
        cur = con.cursor()
        cur.execute(
            "SELECT jogador, tentativas FROM partidas "
            "WHERE data = %s AND nivel = %s AND acertou = TRUE "
            "ORDER BY tentativas, id LIMIT 10",
            (hoje(), nivel),
        )
        linhas = cur.fetchall()
    finally:
        con.close()
    return jsonify([{"jogador": j, "tentativas": t} for j, t in linhas])


# ---------- Erros em JSON ----------
# Sem isto, o Flask responde erros com uma página HTML, e o frontend
# (que sempre faz resposta.json()) não consegue mostrar a mensagem.

@app.errorhandler(404)
def rota_nao_encontrada(erro):
    return jsonify({"erro": "Rota não encontrada"}), 404


@app.errorhandler(405)
def metodo_nao_permitido(erro):
    return jsonify({"erro": "Método não permitido nesta rota"}), 405


@app.errorhandler(500)
def erro_interno(erro):
    # Também é chamado quando acontece uma exceção não tratada (ex.: banco fora do ar)
    return jsonify({"erro": "Erro interno no servidor. Tente novamente."}), 500


if __name__ == "__main__":
    # host 0.0.0.0 para a API ser acessível de fora do container
    app.run(host="0.0.0.0", port=5000)
