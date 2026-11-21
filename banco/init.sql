-- Este script roda automaticamente na primeira vez que o banco sobe.

-- Função secreta de cada dia, uma por nível.
-- A API sorteia e grava aqui na primeira vez que alguém joga no dia.
CREATE TABLE funcoes (
    id     SERIAL PRIMARY KEY,
    data   DATE        NOT NULL,
    nivel  INTEGER     NOT NULL,
    tipo   VARCHAR(20) NOT NULL,   -- linear, quadratica, logaritmica, exponencial, cubica
    a      INTEGER     NOT NULL,
    b      INTEGER     NOT NULL,
    c      INTEGER     NOT NULL,
    UNIQUE (data, nivel)           -- só uma função por nível por dia
);

-- Resultado de cada partida (usado no ranking).
CREATE TABLE partidas (
    id         SERIAL PRIMARY KEY,
    jogador    VARCHAR(50) NOT NULL,
    data       DATE        NOT NULL,
    nivel      INTEGER     NOT NULL,
    tentativas INTEGER     NOT NULL,
    acertou    BOOLEAN     NOT NULL
);
