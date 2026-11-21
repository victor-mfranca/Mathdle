-- Popula o banco com dados iniciais.
-- Roda automaticamente na primeira vez que o banco sobe (depois do init.sql).
--   docker compose exec -T banco psql -U mathdle -d mathdle < banco/seed.sql

INSERT INTO funcoes (data, nivel, tipo, a, b, c)
SELECT data, nivel, tipo, a, b,
       CASE WHEN tipo IN ('quadratica', 'cubica') THEN c ELSE 0 END
FROM (
    SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date + dia AS data,
           nivel,
           (CASE nivel
                WHEN 1 THEN ARRAY['linear']
                WHEN 2 THEN ARRAY['quadratica', 'logaritmica']
                ELSE        ARRAY['exponencial', 'cubica']
            END)[1 + floor(random() * CASE nivel WHEN 1 THEN 1 ELSE 2 END)::int] AS tipo,
           (ARRAY[-5,-4,-3,-2,-1,1,2,3,4,5])[1 + floor(random() * 10)::int]     AS a,
           floor(random() * 11)::int - 5                                        AS b,
           floor(random() * 11)::int - 5                                        AS c
    FROM generate_series(0, 30) AS dia
    CROSS JOIN generate_series(1, 3) AS nivel
) AS sorteio
ON CONFLICT (data, nivel) DO NOTHING;

-- Jogadores fictícios, de 7 dias atrás até hoje, para o ranking não ficar vazio.
-- Para tirar depois: DELETE FROM partidas WHERE jogador LIKE '%(demo)';
INSERT INTO partidas (jogador, data, nivel, tentativas, acertou)
SELECT j.nome || ' (demo)',
       (now() AT TIME ZONE 'America/Sao_Paulo')::date - dia,
       nivel,
       1 + floor(random() * 6)::int,         -- 1 a 6 palpites
       random() < 0.75                       -- ~75% acertam
FROM (VALUES ('Ana'), ('Bruno'), ('Carla'), ('Diego'), ('Elisa'),
             ('Felipe'), ('Giovana'), ('Hugo')) AS j(nome)
CROSS JOIN generate_series(0, 7) AS dia
CROSS JOIN generate_series(1, 3) AS nivel
WHERE random() < 0.6;                        -- nem todo mundo joga todo dia