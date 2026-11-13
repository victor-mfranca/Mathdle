# Mathdle

Jogo diário no navegador: o jogador consulta valores de x, vê f(x) e tenta descobrir a função do dia.
Projeto Final de Computação em Nuvem (PUC-Campinas, 2026).

## Serviços

| Serviço    | Tecnologia        | Função                                              |
|------------|-------------------|-----------------------------------------------------|
| `frontend` | Nginx (imagem)    | Serve a página e repassa `/api/` para a API         |
| `api`      | Python/Flask      | Lógica do jogo (implementação própria)              |
| `banco`    | PostgreSQL (imagem)| Guarda a função do dia e as partidas               |

## Como rodar

Pré-requisitos: Git e Docker Desktop instalados.

```bash
git clone <link-do-repositorio>
cd mathdle
docker compose up --build
```

Abra http://localhost:8080 no navegador.

Para parar: `Ctrl+C` e depois `docker compose down`.
Para apagar o banco e começar do zero: `docker compose down -v`.

## Estrutura

```
mathdle/
├── docker-compose.yml   # sobe os 3 serviços
├── banco/
│   └── init.sql         # cria as tabelas (roda na 1ª vez)
├── api/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app.py           # rotas da API
│   └── funcoes.py       # cálculo das funções e contra-exemplo
└── frontend/
    ├── nginx.conf
    ├── index.html
    ├── style.css
    └── script.js
```

## Rotas da API

| Método | Rota                  | O que faz                                          |
|--------|-----------------------|----------------------------------------------------|
| GET    | `/api/jogo/<nivel>`   | Tipos de função possíveis no nível                 |
| POST   | `/api/consultar`      | Recebe `{nivel, x}` e devolve `{x, y}`             |
| POST   | `/api/palpite`        | Recebe `{nivel, tipo, a, b, c, xs_vistos}`; devolve se acertou ou uma dica |
| POST   | `/api/resultado`      | Salva `{jogador, nivel, tentativas, acertou}`      |
| GET    | `/api/ranking/<nivel>`| Top 10 de hoje no nível                            |

## Níveis

| Nível | Tipos possíveis                                      |
|-------|------------------------------------------------------|
| 1     | linear `a·x + b`                                     |
| 2     | quadrática `a·x² + b·x + c` ou logarítmica `a·ln(x) + b` |
| 3     | exponencial `a·2^x + b` ou cúbica `a·x³ + b·x + c`   |

Coeficientes inteiros de -5 a 5 (a ≠ 0). O x vai de -10 a 10 (no log, x > 0).
