# Guia do projeto: Mathdle

Entrega do código e do PDF no Canvas: **26/11**. Impressão e agendamento da apresentação: até **26/11**, pessoalmente.
Apresentações: até **10/12**.

## Como o jogo funciona (todos precisam saber explicar)

1. Todo dia existe uma função secreta por nível, sorteada pela API e salva no banco. Todos os jogadores recebem a mesma.
2. O jogador digita um x (até 5 consultas) e a API devolve f(x).
3. O jogador escolhe o tipo da função e informa os coeficientes (até 6 palpites).
4. Se errar, a API devolve uma **dica**: um x em que o palpite e a função certa dão valores diferentes.
5. Ao terminar, o resultado vai para o banco e aparece no ranking do dia.

A função **nunca vai para o navegador**: só a API conhece. Por isso não dá para descobrir a resposta pelo F12.

### Por que 3 serviços

- **frontend (Nginx):** entrega os arquivos da página e repassa as chamadas `/api/` para a API.
- **api (Flask):** nosso serviço próprio, com toda a lógica do jogo.
- **banco (PostgreSQL):** guarda as funções do dia e as partidas.

---

## Cronograma

| Data   | Meta                                                             |
|--------|------------------------------------------------------------------|
| 16/11  | Todos rodaram o projeto na própria máquina (`docker compose up --build`) |
| 19/11  | Tarefas obrigatórias de cada dupla prontas                       |
| 21/11  | Extras (se houver tempo) e testes do jogo inteiro               |
| 23/11  | Rascunho completo do artigo; cada dupla revisa a sua seção      |
| 24/11  | Ensaio da apresentação; cada dupla explica sua parte às outras  |
| 25/11  | PDF final no Canvas, impressão em A4 e agendamento              |

---

## Frontend (2 pessoas)

Arquivos: `frontend/index.html`, `frontend/style.css`, `frontend/script.js`

**Já pronto:** escolha de nível, consulta de x, tabela de pontos, formulário de palpite, mensagens de acerto/erro, ranking.

**Obrigatório**
- [ ] Rodar o jogo e jogar os 3 níveis, anotando o que estiver confuso ou quebrado.
- [ ] Melhorar o visual (cores, layout, nome/logo do grupo). Manter simples.
- [ ] Adicionar uma explicação curta de "Como jogar" na página.
- [ ] Mostrar a tela de vitória/derrota de forma mais clara (ex.: revelar quantos palpites usou).
- [ ] Conferir que a página funciona no Chrome e no Firefox do PC.

**Extras (se sobrar tempo)**
- [ ] Gráfico com os pontos da tabela (ex.: biblioteca Chart.js).
- [ ] Salvar a partida no `localStorage` para não perder ao recarregar a página.

**Saber explicar na arguição:** o que é `fetch`, como o JavaScript chama a API e por que a página não sabe a função secreta.

---

## API em Flask (2 pessoas)

Arquivos: `api/app.py` (rotas) e `api/funcoes.py` (matemática)

**Já pronto:** sorteio da função do dia, rotas de consulta, palpite, resultado e ranking, validações básicas e contra-exemplo.

**Obrigatório**
- [ ] Ler e entender cada rota (tabela de rotas no README).
- [ ] Testar casos de erro: x fora de -10 a 10, x ≤ 0 no log, nível inválido, campos vazios.
- [ ] Revisar os tipos de função dos níveis 2 e 3 e decidir se ficam esses ou se trocam.
- [ ] Ajustar as mensagens de erro, se preciso.
- [ ] Escrever para a documentação um resumo das rotas e da lógica do contra-exemplo.

**Extras (se sobrar tempo)**
- [ ] Controlar o limite de consultas na API (hoje é controlado só no JavaScript).
- [ ] Rota de estatísticas: quantas pessoas jogaram e acertaram hoje por nível.

**Saber explicar na arguição:** o que é uma API REST, o que é JSON, como a função do dia é escolhida e por que o palpite é conferido comparando tipo e coeficientes.

---

## Banco + Docker (2 pessoas)

Arquivos: `banco/init.sql`, `docker-compose.yml`, `api/Dockerfile`, `frontend/nginx.conf`

**Pessoa 1: banco**
- [ ] Entender as tabelas `funcoes` e `partidas`.
- [ ] Mostrar como consultar o banco por dentro:
      `docker compose exec banco psql -U mathdle -c "SELECT * FROM funcoes;"`
- [ ] Desenhar o diagrama das tabelas para a documentação.

**Pessoa 2: Docker**
- [ ] Instalar o Docker Desktop e ajudar quem não conseguir rodar.
- [ ] Entender cada linha do `docker-compose.yml` e do `Dockerfile`.
- [ ] Desenhar o diagrama de arquitetura (navegador → Nginx → API → PostgreSQL) para a documentação e para os slides.
- [ ] Antes da entrega, testar do zero: `docker compose down -v` e depois `docker compose up --build`.

**Saber explicar na arguição:** diferença entre imagem e container, o que o docker-compose faz, o que é volume (por que o banco não some ao reiniciar), o `depends_on` com healthcheck e o proxy do Nginx.

---

## Documentação (1 pessoa)

Entrega: PDF no Canvas + cópia impressa em A4 (as duas **iguais**).

**Estrutura sugerida pelo professor**
1. Introdução: o que é o jogo e qual a motivação (jogos diários como Wordle e Termo).
2. Visão geral: como se joga e quais são os níveis.
3. Estrutura/arquitetura: os 3 serviços e como conversam (diagrama da dupla Docker).
4. Documentação dos componentes: frontend, API (rotas) e banco (tabelas).
5. Resultados e uso da aplicação: prints de uma partida, acerto, dica e ranking.
6. Referências bibliográficas.

**Tarefas**
- [ ] Montar o esqueleto do artigo já em 16/11.
- [ ] Pedir a cada dupla um resumo curto da sua parte até 21/11.
- [ ] Tirar os prints do jogo funcionando.
- [ ] Usar só referências reais e conferidas (documentação oficial do Flask, Docker, PostgreSQL e Nginx, e páginas do Wordle e do Termo). Não usar referências sugeridas por IA sem verificar.
- [ ] Enviar o PDF para todos lerem antes de imprimir.

---

## Lembretes da entrega

- Enviar no Canvas **só os arquivos do código**. Não enviar a pasta de dados do banco. O `init.sql` pode ir, porque só cria as tabelas.
- A apresentação vale 5 pontos, e 3 deles são de arguição, com pergunta para qualquer integrante. Todos precisam entender o projeto inteiro, não só a própria parte.
