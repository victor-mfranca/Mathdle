import math
import random

# Quais tipos de função existem em cada nível
TIPOS_POR_NIVEL = {
    1: ["linear"],
    2: ["quadratica", "logaritmica"],
    3: ["exponencial", "cubica"],
}


def calcular(tipo, a, b, c, x):
    """Calcula f(x) para o tipo de função e coeficientes informados."""
    if tipo == "linear":
        return a * x + b
    if tipo == "quadratica":
        return a * x**2 + b * x + c
    if tipo == "logaritmica":
        return a * math.log(x) + b          # log natural (ln), só vale para x > 0
    if tipo == "exponencial":
        return a * 2**x + b
    if tipo == "cubica":
        return a * x**3 + b * x + c
    raise ValueError("Tipo de função desconhecido: " + tipo)


def sortear_funcao(nivel):
    """Sorteia um tipo do nível e coeficientes inteiros entre -5 e 5 (a nunca é 0)."""
    tipo = random.choice(TIPOS_POR_NIVEL[nivel])
    a = random.choice([n for n in range(-5, 6) if n != 0])
    b = random.randint(-5, 5)
    c = random.randint(-5, 5)
    # Tipos com só 2 coeficientes não usam o c
    if tipo in ["linear", "logaritmica", "exponencial"]:
        c = 0
    return tipo, a, b, c


def achar_contra_exemplo(certa, palpite, xs_vistos):
    """
    Procura um x em que a função certa e o palpite dão resultados diferentes.
    certa e palpite são tuplas (tipo, a, b, c).
    Retorna o x encontrado, ou None se não achar.
    """
    candidatos = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, -1, -2, -3, -4, -5, 0]

    # Se alguma das duas for logarítmica, só podemos usar x > 0
    if certa[0] == "logaritmica" or palpite[0] == "logaritmica":
        candidatos = [x for x in candidatos if x > 0]

    # Primeiro tenta valores que o jogador ainda não viu
    novos = [x for x in candidatos if x not in xs_vistos]

    for x in novos + candidatos:
        y_certo = calcular(*certa, x)
        y_palpite = calcular(*palpite, x)
        if abs(y_certo - y_palpite) > 0.001:
            return x
    return None
