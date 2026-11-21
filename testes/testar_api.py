"""
Testes da API do Mathdle (só biblioteca padrão do Python).

Como usar:
    1. Suba o projeto:  docker compose up --build
    2. Em outro terminal:  py testes/testar_api.py

Os testes chamam a API pelo Nginx (http://localhost:8080/api), igual ao navegador.
Atenção: o teste de /api/resultado grava uma partida "TESTE" (com acertou = false,
então ela não aparece no ranking).
"""

import json
import urllib.error
import urllib.request

BASE = "http://localhost:8080/api"

falhas = 0


def chamar(metodo, rota, corpo=None, texto_bruto=None, content_type="application/json"):
    """
    Faz a requisição e devolve (status, resposta).
    A resposta vem como dict/list se for JSON, ou como texto se não for.
    """
    dados = None
    if corpo is not None:
        dados = json.dumps(corpo).encode()
    elif texto_bruto is not None:
        dados = texto_bruto.encode()

    req = urllib.request.Request(BASE + rota, data=dados, method=metodo)
    if dados is not None:
        req.add_header("Content-Type", content_type)

    try:
        with urllib.request.urlopen(req) as resp:
            status, bruto = resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:   # 4xx e 5xx caem aqui
        status, bruto = e.code, e.read().decode()

    try:
        return status, json.loads(bruto)
    except json.JSONDecodeError:
        return status, bruto


def conferir(nome, condicao, detalhe=""):
    global falhas
    if condicao:
        print("  ok    ", nome)
    else:
        falhas += 1
        print("  FALHOU", nome, "->", detalhe)


def eh_erro(status, resposta, status_esperado=400):
    """Erro no formato combinado com o frontend: status certo e {"erro": "..."}."""
    return status == status_esperado and isinstance(resposta, dict) and "erro" in resposta


# ---------- GET /api/jogo/<nivel> ----------
print("GET /api/jogo")
s, r = chamar("GET", "/jogo/1")
conferir("nível 1 devolve tipos", s == 200 and r.get("tipos") == ["linear"], (s, r))
s, r = chamar("GET", "/jogo/4")
conferir("nível 4 é inválido", eh_erro(s, r), (s, r))
s, r = chamar("GET", "/jogo/abc")
conferir("nível 'abc' é inválido", eh_erro(s, r), (s, r))

# ---------- POST /api/consultar ----------
print("POST /api/consultar")
s, r = chamar("POST", "/consultar", {"nivel": 1, "x": 2})
conferir("x = 2 devolve x e y", s == 200 and "x" in r and "y" in r, (s, r))
s, r = chamar("POST", "/consultar", {"nivel": 1, "x": "3"})
conferir("x como texto '3' (como o frontend manda)", s == 200 and r.get("x") == 3, (s, r))
for x in [11, -10.5, "abc", "", "nan", "inf", "-inf", None]:
    s, r = chamar("POST", "/consultar", {"nivel": 1, "x": x})
    conferir(f"x = {x!r} é rejeitado", eh_erro(s, r), (s, r))
s, r = chamar("POST", "/consultar", {"x": 2})
conferir("sem nível é rejeitado", eh_erro(s, r), (s, r))
s, r = chamar("POST", "/consultar", {"nivel": 9, "x": 2})
conferir("nível 9 é rejeitado", eh_erro(s, r), (s, r))
s, r = chamar("POST", "/consultar", {"nivel": 2, "x": -1})
conferir("nível 2 com x = -1: ou funciona ou dá erro em JSON",
         (s == 200 and "y" in r) or eh_erro(s, r), (s, r))

# ---------- Corpo que não é JSON ----------
print("Corpo inválido")
s, r = chamar("POST", "/consultar", texto_bruto="nivel=1&x=2", content_type="text/plain")
conferir("texto puro devolve erro em JSON", eh_erro(s, r), (s, r))
s, r = chamar("POST", "/consultar", texto_bruto="{isto não é json", content_type="application/json")
conferir("JSON quebrado devolve erro em JSON", eh_erro(s, r), (s, r))
s, r = chamar("POST", "/consultar", corpo=[1, 2, 3])
conferir("lista no lugar de objeto devolve erro em JSON", eh_erro(s, r), (s, r))

# ---------- POST /api/palpite ----------
print("POST /api/palpite")
palpite = {"nivel": 1, "tipo": "linear", "a": "1", "b": "0", "c": 0, "xs_vistos": [2]}
s, r = chamar("POST", "/palpite", palpite)
ok = s == 200 and (r.get("acertou") is True or
                   (r.get("acertou") is False and {"x", "y_certo", "y_palpite"} <= set(r.get("dica", {}))))
conferir("palpite válido devolve acertou (e dica se errou)", ok, (s, r))
for campo, valor in [("xs_vistos", "abc"), ("xs_vistos", 5), ("xs_vistos", [1, "a"]),
                     ("tipo", "cubica"), ("a", ""), ("a", "2.5"), ("a", 99), ("b", -6)]:
    s, r = chamar("POST", "/palpite", {**palpite, campo: valor})
    conferir(f"{campo} = {valor!r} é rejeitado", eh_erro(s, r), (s, r))
s, r = chamar("POST", "/palpite", {**palpite, "c": 99})
conferir("c é ignorado na linear (c = 99 não dá erro)", s == 200, (s, r))

# Dica de cores: só a partir do 5º palpite errado.
# a = 0 nunca é sorteado, então este palpite sempre erra.
errado = {**palpite, "a": "0"}
s, r = chamar("POST", "/palpite", {**errado, "tentativa": 1})
conferir("palpite errado na tentativa 1 não tem comparacao",
         s == 200 and r.get("acertou") is False and "comparacao" not in r, (s, r))
s, r = chamar("POST", "/palpite", {**errado, "tentativa": 5})
conferir("palpite errado na tentativa 5 tem comparacao com tipo_certo",
         s == 200 and "tipo_certo" in r.get("comparacao", {}), (s, r))
s, r = chamar("POST", "/palpite", {**palpite, "tentativa": "abc"})
conferir("tentativa = 'abc' é rejeitada", eh_erro(s, r), (s, r))

# ---------- POST /api/resultado ----------
print("POST /api/resultado")
resultado = {"jogador": "TESTE", "nivel": 1, "tentativas": 6, "acertou": False}
for campo, valor in [("tentativas", 0), ("tentativas", -3), ("tentativas", 7),
                     ("acertou", "false"), ("acertou", 1), ("nivel", 5)]:
    s, r = chamar("POST", "/resultado", {**resultado, campo: valor})
    conferir(f"{campo} = {valor!r} é rejeitado", eh_erro(s, r), (s, r))
s, r = chamar("POST", "/resultado", {"jogador": "TESTE"})
conferir("campos faltando são rejeitados", eh_erro(s, r), (s, r))
s, r = chamar("POST", "/resultado", resultado)
conferir("resultado válido é salvo", s == 200 and r == {"ok": True}, (s, r))

# ---------- GET /api/ranking/<nivel> ----------
print("GET /api/ranking")
s, r = chamar("GET", "/ranking/1")
conferir("ranking é uma lista de {jogador, tentativas}",
         s == 200 and isinstance(r, list) and all({"jogador", "tentativas"} <= set(i) for i in r), (s, r))
conferir("partida de teste (perdida) não aparece no ranking",
         isinstance(r, list) and all(i["jogador"] != "TESTE" for i in r), r)
s, r = chamar("GET", "/ranking/0")
conferir("nível 0 é inválido", eh_erro(s, r), (s, r))

# ---------- Rotas e métodos errados ----------
print("Rotas e métodos errados")
s, r = chamar("GET", "/nao-existe")
conferir("rota inexistente devolve 404 em JSON", eh_erro(s, r, 404), (s, r))
s, r = chamar("GET", "/consultar")
conferir("GET em rota POST devolve 405 em JSON", eh_erro(s, r, 405), (s, r))

print()
print("Tudo certo!" if falhas == 0 else f"{falhas} teste(s) falharam.")
