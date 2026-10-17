# Kickabout v1 — Design

**Data:** 2026-10-15
**Status:** aprovado

## 1. Objetivo

Plataforma web para organizar campeonatos de **eFootball mobile** entre times (clubes da comunidade). As partidas acontecem dentro do jogo; o Kickabout **registra** resultados e estatísticas, gera chaves/tabelas e mantém o histórico de times, jogadores e títulos.

- **v1:** um único administrador (o dono do projeto) cadastra times, jogadores, campeonatos e resultados. O público acessa tudo em modo leitura, sem login.
- **Futuro:** plataforma aberta (qualquer pessoa cria conta, campeonatos e times). A v1 já modela "dono" em times e campeonatos para não exigir reescrita do banco.

### Critérios de sucesso da v1
1. Criar e conduzir até o fim campeonatos nos formatos **eliminatória simples**, **eliminatória dupla** e **round robin**.
2. Lançar o resultado de um confronto (5 duelos + desempate) pelo celular em poucos minutos.
3. Chave, classificação, estatísticas e títulos atualizados automaticamente a partir dos duelos lançados.
4. Páginas públicas de campeonato, confronto, time, jogador e painel de títulos.

### Fora do escopo da v1
Contas abertas, capitães de time, reporte/confirmação de resultado pelos times, notificações, upload de prints de resultado, E2E automatizado, deploy definitivo.

## 2. Regras do jogo

### 2.1 Confronto (Time A × Time B)
- Cada time escala **5 jogadores distintos** do seu elenco ativo, em ordem (1 a 5).
- São disputados **5 duelos individuais**: jogador 1A × 1B, 2A × 2B, …, 5A × 5B. Cada duelo tem placar próprio (gols).
- Vitória num duelo = **1 ponto** para o time do vencedor. Empate e derrota = 0.
- **Placar do confronto** = soma dos pontos de duelo de cada time (ex.: 3 × 1 com um duelo empatado; 2 × 2; 0 × 0).

### 2.2 Desempate do mata-mata (6º duelo)
- Só existe em fases eliminatórias (eliminatória simples e dupla), e só quando o placar do confronto após 5 duelos estiver **empatado**.
- Cada time indica **1 jogador qualquer do elenco ativo** (pode ser um dos 5 que já jogaram).
- Se o 6º duelo empatar no tempo normal, vai para **pênaltis**, registrados no próprio duelo (ex.: 1 × 1, pên. 5 × 4). Pênaltis não podem terminar empatados.
- O vencedor do 6º duelo (no placar ou nos pênaltis) soma 1 ponto, decidindo o confronto (ex.: 3 × 2).
- Um confronto de mata-mata **nunca** termina empatado.

### 2.3 Pontuação na classificação (round robin)
- Vitória no confronto = **3 pontos**; empate = **1 ponto**; derrota = 0.

### 2.4 Critérios de desempate da classificação (nesta ordem)
1. Pontos
2. **Confronto direto** — considerando apenas os confrontos entre os times empatados (vale para 2 ou mais times empatados; mini-tabela com os mesmos pontos 3/1/0)
3. **Vitórias em confrontos**
4. **Saldo de gols** — soma dos gols de todos os duelos (marcados − sofridos)
5. **Gols marcados** — soma dos gols de todos os duelos

Pênaltis do 6º duelo não contam como gols. Persistindo empate após todos os critérios, a ordem é a do seed.

### 2.5 Elenco
- Máximo de **20 jogadores ativos** por time.
- Um jogador pertence a no máximo um time por vez. Transferências encerram o vínculo anterior e abrem um novo; o histórico é preservado.

## 3. Arquitetura

Monorepo TypeScript (npm workspaces):

```
kickabout/
├── apps/
│   ├── api/        # Node + Fastify + Prisma + PostgreSQL; roda o brackets-manager.js
│   └── web/        # React + Vite, mobile-first; brackets-viewer.js para chaves
├── packages/
│   └── shared/     # regras de negócio puras + tipos/schemas compartilhados
└── docker-compose.yml  # Postgres local
```

### 3.1 Responsabilidades
- **`packages/shared`** — funções puras, sem I/O: placar do confronto a partir dos duelos, validação da escalação e do 6º duelo, cálculo de classificação com critérios de desempate, agregação de estatísticas. Schemas de validação (Zod) usados pela API e pelo web.
- **`apps/api`** — HTTP (Fastify), persistência (Prisma/Postgres), autenticação, orquestração com o brackets-manager.js. Chama `shared` para todas as regras.
- **`apps/web`** — UI pública e admin. Chama a API; usa `shared` para feedback ao vivo (ex.: placar calculado durante o lançamento), mas a decisão final é sempre do servidor.

### 3.2 Integração com brackets-manager.js (MIT)
- Cada **confronto** corresponde a uma **match** do brackets-manager; o placar da match é o placar de duelos do confronto.
- Formatos: `single_elimination` (opção de disputa de 3º lugar), `double_elimination` (opção de final com reset, `grandFinal: 'double'`), `round_robin` (turno único ou ida e volta).
- Copa (grupos + mata-mata): ver `2026-10-17-kickabout-copa-design.md`.
- O estado do brackets-manager de cada campeonato fica numa coluna JSON (`Tournament.bracket`). Cada operação abre uma transação, trava a linha do campeonato (`SELECT … FOR UPDATE`), carrega o JSON num banco em memória da biblioteca (`brackets-memory-db`), executa a operação e grava o JSON de volta na mesma transação.
- A biblioteca só aceita chaves de eliminação com tamanho potência de 2: o Kickabout completa a chave com **BYEs** (`size` = próxima potência de 2, `balanceByes`).
- A classificação do round robin é calculada pelo `shared` (critérios da seção 2.4), não pelo ranking padrão da biblioteca.
- O front usa **brackets-viewer.js** (ISC) para desenhar chaves de mata-mata.

## 4. Modelo de dados

| Entidade | Campos principais | Observações |
|---|---|---|
| **User** | id, email, passwordHash, role | v1: só o admin. Dono de times/campeonatos. |
| **Team** | id, name, shortName, crestUrl, ownerId | |
| **Player** | id, name, phone (único, formato E.164 `+55…`) | Nome + celular identificam o jogador (usados no BID do time). Visibilidade do celular: ver seção 5.3. |
| **TeamMembership** | id, teamId, playerId, joinedAt, leftAt? | Ativo quando `leftAt` é nulo. Limite de 20 ativos por time; 1 vínculo ativo por jogador. |
| **Tournament** | id, name, format, status (`draft` → `in_progress` → `finished`), options (JSON: 3º lugar, reset na final, turnos), ownerId, bracket (JSON do brackets-manager) | |
| **TournamentEntry** | tournamentId, teamId, seed | Times inscritos. |
| **Fixture** | id, tournamentId, bmMatchId, teamAId, teamBId, scoreA?, scoreB?, winnerTeamId?, status (`draft`, `completed`), isKnockout, playedAt? | O confronto com resultado salvo. Confrontos sem resultado (`pending`) e a rodada vêm do bracket. |
| **Duel** | id, fixtureId, order (1–6), playerAId, playerBId, teamAId, teamBId, goalsA, goalsB, penaltiesA?, penaltiesB? | `teamAId/teamBId` gravam o time do jogador no momento do jogo. Pênaltis só no `order = 6`. |
| **Title** | id, teamId, tournamentId?, tournamentName, position (1, 2, 3), year | Gerado ao finalizar campeonato, ou cadastrado manualmente (histórico, sem `tournamentId`). |

Estatísticas **não são armazenadas** como totais: são calculadas a partir de `Duel` e `Fixture` (status `completed`). Corrigir um resultado atualiza tudo automaticamente.

## 5. Telas

Mobile-first em todas as telas.

### 5.1 Públicas (sem login)
- **Início** — campeonatos em andamento, últimos resultados, atalho para títulos.
- **Campeonatos** — lista com filtro por status.
- **Campeonato** — abas: *Chave/Tabela* (brackets-viewer no mata-mata; classificação no round robin), *Times*, *Jogos* (confrontos por rodada), *Estatísticas* (artilharia, mais vitórias em duelos, melhor aproveitamento).
- **Times do campeonato** (aba *Times*) — lista dos times inscritos (escudo + nome). Clicar no nome do time abre o **BID do time**.
- **BID do time** — lista de todos os jogadores ativos do time com **nome e número de celular**. O número é um link para o WhatsApp do jogador (`https://wa.me/<dígitos>`, ex.: `https://wa.me/5511987654321`). Uso principal: os confrontos são organizados em grupos de WhatsApp, e o BID permite conferir se o jogador escalado é quem está no grupo da partida.
- **Confronto** — placar de duelos e lista dos 5–6 duelos (jogadores, placar, pênaltis).
- **Time** — escudo, elenco atual (BID: nome + celular com link para WhatsApp), estatísticas (confrontos V/E/D, duelos V/E/D, gols), títulos, últimos confrontos, campeonatos disputados.
- **Jogador** — nome, time atual, histórico de times, estatísticas (duelos, V/E/D, gols marcados/sofridos, saldo, aproveitamento), histórico de duelos, títulos conquistados com o time.
- **Títulos** — ranking de times por títulos (campeão/vice/3º) e lista de campeões por campeonato.

### 5.2 Admin (login)
- **Times** — CRUD; gerenciar elenco com aviso ao atingir 20.
- **Jogadores** — cadastro (nome + celular), busca, transferência entre times.
- **Campeonatos** — criar (formato + opções) → inscrever times e definir seeds → gerar chave/tabela → acompanhar → finalizar (gera títulos).
- **Lançar resultado** — ver seção 6.
- **Títulos históricos** — cadastro manual.

### 5.3 Visibilidade do celular
- O celular aparece **apenas nas listas de BID** (elenco na página do time e tela *BID do time*) e no admin. Não aparece em páginas de jogador, confronto, estatísticas ou títulos.
- **v1:** BID público (sem login).
- **Futuro:** BID visível só para usuários logados. Para isso não exigir mudança de código, a visibilidade é controlada por configuração da API: `PHONE_VISIBILITY=public | authenticated` (v1: `public`). Com `authenticated`, as respostas da API omitem o campo `phone` para visitantes sem sessão, e o front mostra só o nome.
- O consentimento para exibir o número é dado fora do sistema, quando o time e o jogador decidem participar do campeonato. O Kickabout não registra consentimento.

## 6. Fluxo de lançamento de resultado

1. Admin abre um confronto pendente.
2. Seleciona os 5 jogadores de cada time (elenco ativo), em ordem. Jogadores já selecionados somem da lista.
3. Digita o placar de cada duelo; o placar do confronto é calculado ao vivo.
4. Se for mata-mata e o confronto estiver empatado, aparece o **6º duelo** (qualquer jogador do elenco). Se o 6º duelo empatar, os campos de pênaltis passam a ser obrigatórios.
5. **Salvar rascunho** — permitido a qualquer momento; não conta em estatísticas nem na chave (`status = draft`).
6. **Confirmar resultado** — o servidor valida, grava duelos e confronto, atualiza a match no brackets-manager (avançando o vencedor) — tudo numa **única transação**.

### 6.1 Correções
- **Round robin:** edição livre; estatísticas e classificação se recalculam.
- **Mata-mata:** edição permitida apenas enquanto os confrontos seguintes que dependem dele (o do vencedor e, na eliminatória dupla, também o do perdedor na chave inferior) não tiverem resultado confirmado. Caso contrário, a API retorna erro listando os confrontos que precisam ser desfeitos antes. Para desfazer, o admin **reabre** o confronto seguinte (`POST /tournaments/:id/fixtures/:matchId/reopen`): o resultado volta a rascunho (duelos mantidos), sai da chave, da classificação e das estatísticas, e libera a correção do anterior. Só com o campeonato em andamento.

### 6.2 Finalização
Ao terminar todos os confrontos, o admin finaliza o campeonato: status `finished` e geração dos registros de **Title** (1º, 2º e, quando houver, 3º).

## 7. Tratamento de erros

Validações sempre no servidor (as do front são apenas conveniência). Erros retornam `400` com código e mensagem em português, associados ao campo quando aplicável:

- jogador fora do elenco ativo do time;
- jogador repetido nos duelos 1–5 do mesmo time;
- 6º duelo fora do mata-mata ou com confronto não empatado;
- 6º duelo empatado sem pênaltis, ou pênaltis empatados;
- pênaltis informados em duelos 1–5;
- time com 20 jogadores ativos ao adicionar outro;
- celular duplicado ou em formato inválido;
- edição de resultado de mata-mata bloqueada por confrontos posteriores.

Remover jogador do elenco nunca apaga dados: encerra o vínculo (`leftAt`).

## 8. Autenticação (v1)

- Um usuário admin criado por script de seed (email e senha via variáveis de ambiente).
- Senha com hash **argon2**; sessão em cookie **httpOnly**, `secure` em produção, `sameSite=lax`.
- Rotas de escrita exigem sessão; rotas de leitura são públicas. O celular só é retornado pelos endpoints de BID, conforme `PHONE_VISIBILITY` (seção 5.3).

## 9. Testes

- **`packages/shared`** — testes unitários (Vitest), escritos com **TDD**: pontuação de duelos, placar do confronto, regras do 6º duelo e pênaltis, classificação com todos os critérios — incluindo confronto direto com **3+ times empatados** — e agregação de estatísticas.
- **`apps/api`** — testes de integração contra Postgres real (Docker): criar campeonato → gerar chave → lançar resultados → avanço na chave → finalizar → títulos, nos três formatos; validações da seção 7; bloqueio de edição no mata-mata; celular presente só nos endpoints de BID e omitido para visitantes quando `PHONE_VISIBILITY=authenticated`.
- **`apps/web`** — testes de componentes (Vitest + Testing Library) do formulário de lançamento de resultado.
- E2E (Playwright): fora da v1.

## 10. Ambiente

- Node 20+, npm workspaces, TypeScript estrito.
- Postgres local via `docker-compose.yml`.
- Deploy definido ao fim da v1 (candidatos: Railway/Render/Fly para a API; Vercel/Netlify para o web).

## 11. Decisões registradas

| Decisão | Escolha |
|---|---|
| Arquitetura | Monorepo TS, API e web separados (abordagem A) |
| Motor de chaves | brackets-manager.js (MIT) + brackets-viewer.js (ISC) |
| Mata-mata | Jogo único por confronto |
| Eliminatória dupla | Final com reset opcional por campeonato |
| Round robin | Turno único ou ida e volta, configurável |
| Jogador | Nome + celular (único); celular visível no BID com link para WhatsApp |
| Visibilidade do celular | v1 pública; depois só logados, via `PHONE_VISIBILITY` |
| Estatísticas | Calculadas a partir dos duelos, não armazenadas |
| Títulos históricos | Cadastro manual permitido |
