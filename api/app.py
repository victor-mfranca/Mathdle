import os
from datetime import datetime
from zoneinfo import ZoneInfo

import psycopg2
from flask import Flask, jsonify, request

from funcoes import TIPOS_POR_NIVEL, achar_contra_exemplo, calcular, sortear_funcao

app = Flask(__name__)


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
    con = conectar()
    cur = con.cursor()

    tipo, a, b, c = sortear_funcao(nivel)
    # ON CONFLICT: se outra pessoa já criou a função de hoje, não faz nada
    cur.execute(
        "INSERT INTO funcoes (data, nivel, tipo, a, b, c) VALUES (%s, %s, %s, %s, %s, %s) "
        "ON CONFLICT (data, nivel) DO NOTHING",
        (hoje(), nivel, tipo, a, b, c),
    )
    con.commit()

    cur.execute("SELECT tipo, a, b, c FROM funcoes WHERE data = %s AND nivel = %s", (hoje(), nivel))
    funcao = cur.fetchone()

    cur.close()
    con.close()
    return funcao


# ---------- Validações ----------

def ler_nivel(valor):
    """Converte o nível para inteiro e confere se é 1, 2 ou 3."""
    nivel = int(valor)
    if nivel not in TIPOS_POR_NIVEL:
        raise ValueError("Nível inválido")
    return nivel


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
    dados = request.get_json()
    try:
        nivel = ler_nivel(dados["nivel"])
        x = float(dados["x"])
    except (KeyError, ValueError, TypeError):
        return jsonify({"erro": "Envie um nível (1 a 3) e um número x"}), 400

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
    dados = request.get_json()
    try:
        nivel = ler_nivel(dados["nivel"])
        tipo_p = dados["tipo"]
        a_p = int(dados["a"])
        b_p = int(dados["b"])
        c_p = int(dados.get("c", 0))
    except (KeyError, ValueError, TypeError):
        return jsonify({"erro": "Palpite incompleto: envie tipo, a, b (e c, se houver)"}), 400

    if tipo_p not in TIPOS_POR_NIVEL[nivel]:
        return jsonify({"erro": "Esse tipo de função não existe neste nível"}), 400

    # Tipos com 2 coeficientes ignoram o c
    if tipo_p in ["linear", "logaritmica", "exponencial"]:
        c_p = 0

    certa = funcao_do_dia(nivel)
    chute = (tipo_p, a_p, b_p, c_p)

    if chute == tuple(certa):
        return jsonify({"acertou": True})

    # Errou: procura um x em que as duas funções dão resultados diferentes
    xs_vistos = dados.get("xs_vistos", [])
    x = achar_contra_exemplo(certa, chute, xs_vistos)
    resposta = {"acertou": False}
    if x is not None:
        resposta["dica"] = {
            "x": x,
            "y_certo": round(calcular(*certa, x), 2),
            "y_palpite": round(calcular(*chute, x), 2),
        }
    return jsonify(resposta)


@app.route("/api/resultado", methods=["POST"])
def salvar_resultado():
    """Salva o resultado da partida no banco."""
    dados = request.get_json()
    try:
        jogador = str(dados["jogador"]).strip()[:50] or "Anônimo"
        nivel = ler_nivel(dados["nivel"])
        tentativas = int(dados["tentativas"])
        acertou = bool(dados["acertou"])
    except (KeyError, ValueError, TypeError):
        return jsonify({"erro": "Dados do resultado incompletos"}), 400

    con = conectar()
    cur = con.cursor()
    cur.execute(
        "INSERT INTO partidas (jogador, data, nivel, tentativas, acertou) VALUES (%s, %s, %s, %s, %s)",
        (jogador, hoje(), nivel, tentativas, acertou),
    )
    con.commit()
    cur.close()
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
    cur = con.cursor()
    cur.execute(
        "SELECT jogador, tentativas FROM partidas "
        "WHERE data = %s AND nivel = %s AND acertou = TRUE "
        "ORDER BY tentativas, id LIMIT 10",
        (hoje(), nivel),
    )
    linhas = cur.fetchall()
    cur.close()
    con.close()
    return jsonify([{"jogador": j, "tentativas": t} for j, t in linhas])


if __name__ == "__main__":
    # host 0.0.0.0 para a API ser acessível de fora do container
    app.run(host="0.0.0.0", port=5000)
