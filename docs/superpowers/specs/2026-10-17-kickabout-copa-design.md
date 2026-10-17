# Kickabout — Modo copa (fase de grupos + mata-mata)

**Data:** 2026-10-17
**Base:** spec da v1 (`2026-10-15-kickabout-v1-design.md`). Tudo o que este documento não muda continua valendo: regras do confronto (5 duelos, 6º duelo e pênaltis no mata-mata), pontuação e desempate dos pontos corridos, títulos, estatísticas e permissões.
**Versão alvo:** v1.5.

## 1. Objetivo

Hoje o organizador escolhe entre eliminatória simples, eliminatória dupla e pontos corridos. Este documento acrescenta o formato **Copa**:
- uma fase de grupos sorteada (pontos corridos dentro de cada grupo);
- depois, um mata-mata sorteado entre os classificados;
- tudo no mesmo campeonato, com uma página, um pódio e um conjunto de títulos.

Decisões tomadas com o usuário:

| Tema | Decisão |
|---|---|
| Montagem dos grupos | Sorteio automático. O organizador escolhe quantos grupos (2, 4, 8, 16, 32 ou 64) e pode sortear de novo antes de iniciar. |
| Classificados | O organizador escolhe quantos passam por grupo (1 até o tamanho do menor grupo − 1). |
| Cruzamento | O mata-mata é sorteado. A única regra é que times do mesmo grupo não se enfrentam na primeira rodada do mata-mata. |
| Fases | Grupos em turno único ou ida e volta. Mata-mata em eliminatória simples, com disputa de 3º opcional. |
| Transição | O organizador sorteia o mata-mata quando os grupos terminam e pode sortear de novo ou desfazer enquanto nenhum jogo do mata-mata tiver resultado. |
| Arquitetura | Abordagem A: duas fases (stages) do brackets-manager no mesmo campeonato. |

Fora do escopo: mata-mata em eliminatória dupla, "melhores terceiros", grupos montados à mão e cabeças de chave.

## 2. Regras

### 2.1 Criação (rascunho)
- **Formato:** `cup`, exibido como "Copa (grupos + mata-mata)".
- **Opções:**
  - `groupCount`: 2, 4, 8, 16, 32 ou 64 (sempre uma potência de 2);
  - `qualifiersPerGroup`: inteiro, no mínimo 1;
  - `roundRobinMode`: `simple` (turno único) ou `double` (ida e volta), padrão `simple`;
  - `consolationFinal`: booleano, padrão `false`.
- **Inscrição:** a mesma dos outros formatos.

### 2.2 Tamanho dos grupos e limites
- `cupLayout(teamCount, groupCount)` distribui os times o mais parelho possível. Os tamanhos diferem em no máximo 1, e os primeiros grupos ficam com os maiores (10 times em 4 grupos dá 3, 3, 2 e 2).
- **Número de grupos fora da lista:** "O número de grupos precisa ser 2, 4, 8, 16, 32 ou 64."
- **Grupo pequeno demais:** cada grupo precisa de pelo menos 2 times, ou seja, `teamCount ≥ 2 × groupCount`. Mensagem: "Com N times, dá para ter no máximo X grupos.", onde X é o maior valor da lista que cabe.
- **Classificados demais:** precisa valer `qualifiersPerGroup ≤ tamanho do menor grupo − 1`. Mensagem: "Com N times em G grupos, passam no máximo Q por grupo."
- **Quando se valida:** no sorteio dos grupos e ao iniciar. No rascunho, salvar opções fora dos limites é permitido, porque a inscrição ainda pode mudar; o resumo na tela já avisa.

### 2.3 Sorteio dos grupos
- **Quando:** só em rascunho.
- **Como:** `drawGroups(teamIds, groupCount, random)` embaralha os times e preenche os grupos na ordem do layout.
- **Onde fica:** o resultado vai para `Tournament.groupDraw` (lista de grupos, cada um com a lista de ids de time na ordem sorteada).
- **Sortear de novo:** substitui a prévia.
- **O que apaga a prévia (`groupDraw = null`):** mudar a inscrição, o formato, `groupCount` ou `qualifiersPerGroup`.
- **Iniciar:**
  - exige `groupDraw` presente e coerente com a inscrição atual (mesmos times);
  - grava o `seed` de cada inscrição na ordem do sorteio (grupo A primeiro, depois B…), que é o último critério de desempate;
  - cria a fase 1.

### 2.4 Fase de grupos
- **Fase 1 do brackets-manager:** `round_robin` com `groupCount` grupos e `roundRobinMode`, com cada grupo contendo exatamente os times sorteados: `settings.manualOrdering` recebe uma lista de seeds por grupo (recurso da biblioteca para pontos corridos).
- **Confrontos:**
  - `isKnockout = false`, ou seja, 5 duelos sem desempate, e empate vale;
  - pontuação e desempate dos pontos corridos (spec v1, seção de regras), aplicados **dentro de cada grupo**.
- **Classificados:** as `qualifiersPerGroup` primeiras posições de cada grupo, depois de todos os jogos do grupo confirmados.

### 2.5 Sorteio do mata-mata
- **Condições:** campeonato em andamento, todos os confrontos da fase 1 confirmados e nenhum confronto da fase 2 com resultado (confirmado ou rascunho).
- **Como sortear:** `drawKnockout(qualified, random)` recebe os classificados, cada um com seu grupo, e devolve a ordem de seeding da chave:
  - o tamanho é a próxima potência de 2 do total; as posições que sobram são BYE (`null`);
  - os BYEs são sorteados entre os classificados; nenhum confronto da primeira rodada pode ter os dois times do mesmo grupo;
  - com `groupCount ≥ 2` e o mesmo número de classificados por grupo, sempre existe solução, e o algoritmo tenta de novo até encontrá-la;
  - a primeira rodada é tudo o que a regra controla; o resto da chave sai do pareamento natural da eliminatória.
- **Fase 2 do brackets-manager:** `single_elimination` com essa ordem em `settings.manualOrdering` (lista única; a biblioteca ignora `seedOrdering` e não rebalanceia os BYEs) e `consolationFinal` (só quando há pelo menos 4 classificados, como hoje).
- **Sortear de novo:** apaga a fase 2 (`manager.delete.stage`) e cria outra; mesmas condições.
- **Desfazer:** apaga a fase 2 e os rascunhos de confronto dela; mesmas condições.

### 2.6 Correções
- **Fase 1, antes do sorteio do mata-mata:** reabrir e corrigir como nos pontos corridos de hoje.
- **Fase 1, depois do sorteio do mata-mata:** salvar ou reabrir dá `409 GROUPS_LOCKED`, com a mensagem "Desfaça o sorteio do mata-mata para corrigir jogos dos grupos."
- **Fase 2:** reabrir como na eliminatória simples de hoje, incluindo a checagem de confrontos seguintes.

### 2.7 Encerramento, títulos e estatísticas
- **Encerrar:** exige a fase 2 criada e completa (finais com resultado e BYEs resolvidos).
- **Pódio:** sai da fase 2, com a mesma regra da eliminatória simples (`eliminationPodium`). Sem disputa de 3º, não há 3º colocado.
- **Estatísticas:** contam os duelos das duas fases, como hoje com todos os confrontos.

## 3. Arquitetura

### 3.1 Dados (Prisma)
- **Enum `TournamentFormat`:** ganha o valor `cup`.
- **Tabela `Tournament`:** ganha `groupDraw Json?`.
- **`options`:** passa a aceitar `groupCount` e `qualifiersPerGroup`.
- **`bracket`:** continua o export completo do brackets-manager, que passa a ter 1 ou 2 fases.
- **Migração:** uma, com o valor novo no enum e a coluna nova.

### 3.2 Regras puras (`packages/shared`)
- `GROUP_COUNTS = [2, 4, 8, 16, 32, 64]`
- `cupLayout(teamCount, groupCount): { sizes: number[]; maxQualifiers: number } | { error: string }`
- `drawGroups<T>(items: T[], groupCount: number, random: () => number): T[][]`
- `drawKnockout<T>(qualified: { item: T; group: number }[], random: () => number): (T | null)[]`

Todas recebem `random` (como `Math.random`) para os testes usarem uma sequência fixa.

### 3.3 API
- **Fase de cada partida:** um helper `phaseOf(data, match)` devolve `groups` ou `knockout` pelo tipo da fase (stage) da partida. Os pontos que hoje usam `format !== 'round_robin'` para decidir `isKnockout` passam a usar a fase da partida:
  - `fixtures/detail.ts`;
  - `fixtures/save-result.ts`;
  - `fixtures/reopen-result.ts`.
- **Endpoints novos (admin):**
  - `POST /tournaments/:id/group-draw` devolve `{ groups: TeamRef[][] }`;
  - `POST /tournaments/:id/knockout-draw` devolve o campeonato atualizado;
  - `DELETE /tournaments/:id/knockout-draw` devolve o campeonato atualizado.
- **Endpoints alterados:**
  - **`POST /tournaments/:id/start`:** caminho da copa (seção 2.3).
  - **`GET /tournaments/:id`:**
    - inclui `groupDraw` (em rascunho, como `TeamRef[][]`);
    - inclui `knockoutDrawn`;
    - na copa, inclui `groupsPending` (quantos confrontos da fase 1 faltam confirmar).
  - **`GET /tournaments/:id/standings`:**
    - cada linha ganha `groupNumber`;
    - na copa, ganha também `qualified`;
    - nos pontos corridos, `groupNumber = 1` e `qualified` fica ausente;
    - os demais formatos continuam devolvendo `[]`.
  - **`GET /tournaments/:id/fixtures` e o detalhe:** cada confronto ganha `phase`.
  - **`POST /tournaments/:id/finish`:** caminho da copa (seção 2.7).
- **Erros novos:**

  | Código | HTTP | Quando |
  |---|---|---|
  | `CUP_LAYOUT_INVALID` | 409 | grupos ou classificados fora dos limites |
  | `GROUP_DRAW_REQUIRED` | 409 | iniciar sem sorteio, ou com sorteio que não bate com a inscrição |
  | `GROUPS_PENDING` | 409 | sortear o mata-mata antes do fim dos grupos ("Faltam N jogos dos grupos.") |
  | `KNOCKOUT_STARTED` | 409 | sortear de novo ou desfazer com resultado no mata-mata |
  | `KNOCKOUT_NOT_DRAWN` | 409 | desfazer sem sorteio, ou encerrar sem mata-mata |
  | `GROUPS_LOCKED` | 409 | corrigir jogo dos grupos depois do sorteio |

- **Concorrência:** as ações novas rodam na mesma transação com trava do campeonato (`lockTournament`) que o lançamento de resultado já usa.

### 3.4 Site
- **Tipos e fórmulas:** o formato `cup` entra em `FORMAT_LABEL` e nos tipos. `roundLabel` ganha os nomes da copa:
  - fase 1: "Grupo A, 1ª rodada";
  - fase 2: os nomes da eliminatória ("Quartas de final", "Semifinal", "Final", "Disputa de 3º lugar").
- **Página pública da copa:**
  - abas Grupos, Chave, Jogos, Times e Estatísticas;
  - **Grupos:** uma `StandingsTable` por grupo; os classificados têm um filete verde à esquerda e uma legenda "Os N primeiros de cada grupo vão para o mata-mata";
  - **Chave:** o `BracketView` só da fase 2; antes do sorteio, mostra o aviso com os jogos pendentes.
- **Admin:**
  - campos da copa no formulário do campeonato, com um resumo vivo do layout;
  - bloco "Sorteio dos grupos" no rascunho;
  - "Sortear mata-mata", "Sortear de novo" e "Desfazer sorteio do mata-mata" (com confirmação) na página do campeonato em andamento.
- **Página do confronto:** o contexto mostra a fase ("Copa X, Grupo B, 2ª rodada").

## 4. Testes

- **shared:**
  - `cupLayout`: tamanhos e limites;
  - `drawGroups`: parelho, sem perder nem repetir times;
  - `drawKnockout`: nenhum par do mesmo grupo na primeira rodada, com centenas de sementes e combinações de 2, 4, 8 e 16 grupos e 1 a 4 classificados, com e sem BYE; todos os classificados aparecem uma vez; quantidade certa de BYEs.
- **API (integração):**
  - fluxo completo: criar, sortear grupos, sortear de novo, iniciar, jogar os grupos, sortear o mata-mata, sortear de novo, desfazer, sortear, jogar, encerrar e conferir os títulos;
  - erros: limites, iniciar sem sorteio, sorteio desatualizado depois de mudar a inscrição, `GROUPS_PENDING`, `KNOCKOUT_STARTED`, `GROUPS_LOCKED`;
  - classificação por grupo com `qualified`;
  - `isKnockout` por fase (empate permitido nos grupos, 6º duelo exigido no mata-mata).
- **Site:**
  - abas da copa;
  - tabelas por grupo com classificados marcados;
  - aviso de jogos pendentes na aba Chave;
  - campos e resumo da copa no formulário;
  - sorteio dos grupos no rascunho;
  - botões do mata-mata conforme o estado.

## 5. Documentação
- **`docs/VERSOES.md`:** ganha a seção v1.5, descrevendo o modo copa.
- **Spec da v1:** ganha uma linha na seção de formatos apontando para este documento.
