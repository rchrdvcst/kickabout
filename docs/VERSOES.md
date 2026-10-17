# Kickabout — versões

Este documento registra o que cada versão entrega. A cada nova versão, acrescente uma seção no topo (a mais recente primeiro) dizendo o que mudou em relação à anterior; as seções antigas não são reescritas.

---

## v1.3 — 2026-10-17

Ajustes para celular pedidos depois da revisão de design.

- **Abas sem rolagem lateral:** no celular, as abas da página do campeonato (Chave/Tabela, Jogos, Times, Estatísticas) e da lista de campeonatos cabem na largura da tela, a partir de 320px. Cada aba tem o tamanho do próprio texto e as sobras se dividem entre elas.
- **Tag do time em cima do nome:**
  - nas linhas de confronto e nos placares de destaque, a tag aparece grande e o nome completo vem menor embaixo;
  - quando o time não tem escudo, a placa mostra só a inicial do nome, já que a tag está ao lado;
  - leitores de tela continuam ouvindo só o nome;
  - nas listas, nomes muito longos param em 2 linhas, com hífen e reticências, já que a tag identifica o time.
- **Tag com no máximo 3 caracteres:**
  - o cadastro do time passou a chamar o campo de "Tag (até 3 letras)", e a API recusa tags maiores;
  - a migração `20261017120000_team_tag_three_chars` cortou as tags existentes para os 3 primeiros caracteres.
- **Lista de duelos da página do confronto:** a coluna do número ("1º", "2º"…) ficou estreita, sem o espaço grande antes do nome do jogador. O "Desempate" foi para uma linha só dele, em cima do duelo.

---

## v1.2 — 2026-10-17

Revisão completa de design, com foco no organizador, que é quem mais usa o Kickabout. O plano e o diagnóstico estão em `docs/design/2026-10-17-revisao-de-design.md`. Nenhuma regra nem a API mudaram.

### Área do organizador
- **Mesa do organizador (`/admin`):** abre com **"Para lançar"**, os confrontos sem resultado ou com rascunho dos campeonatos em andamento, agrupados por campeonato. Cada linha leva direto à súmula. Os cadastros (campeonatos, times, jogadores, títulos) vêm depois.
- **Uma barra só:**
  - dentro do admin, o menu público sai e entra a faixa do organizador, com "Organizador", as seções e "Sair";
  - o topo mostra "Ver site";
  - no celular, as seções rolam para o lado e "Sair" fica sempre visível.
- **Campeonato:** os confrontos vêm primeiro e o "Encerrar" logo depois. "Renomear campeonato" fica recolhido no fim da página.
- **Súmula (lançar resultado):**
  - o título diz "Lançar resultado" ou "Corrigir resultado", em vez de repetir os nomes dos times;
  - o placar ao vivo fica preso no topo enquanto se preenche os duelos;
  - um cabeçalho mostra de que time é cada coluna;
  - no computador, cada duelo é uma linha numerada de 1 a 5 (6 no desempate);
  - no celular, cada duelo vira duas linhas, com o escudo do time na frente;
  - gols preenchidos ficam com a borda verde e os vazios mostram "–";
  - no celular, "Salvar rascunho" e "Confirmar resultado" ficam presos no fim da tela, lado a lado.

### Site público
- **Página inicial:** abaixo do placar do último resultado aparece a **barra dos duelos**, com a sigla de quem venceu cada duelo. Ela também aparece na página do confronto.
- **Verde = venceu:** na barra de duelos, ficam em verde os duelos ganhos pelo vencedor do confronto, como no placar. Os do outro time ficam em branco e os empates em cinza.
- **Confronto sem resultado:** o chip ("A jogar", "Parcial") aparece sozinho, fora da caixinha preta de placar.
- **"Encerrado":** passou a usar o verde-gramado da logo. O verde-limão ficou para o que pede ação e para o vencedor.

### Tipografia
- Escala de terça maior (×1,25) sobre 16px.
- Títulos de página em caixa normal (não mais em caixa alta), porque nomes de time longos viravam blocos de 4 linhas.
- Parágrafos limitados a 65 caracteres por linha.

---

## v1.1 — 2026-10-17

Novo visual do site, em modo escuro com a identidade da logo. Nenhuma regra ou funcionalidade mudou.

- **Cores:** fundo azul-noite de estádio, com uma luz de refletor no topo da página. O destaque passou a ser o verde-limão da logo (`#8CF014`). Âmbar e vermelho ficam só para status (rascunho, derrota, desempate).
- **Fontes:** Barlow e Barlow Condensed agora são carregadas de fato. Antes o site caía na fonte padrão do sistema. Títulos de página e placares usam o itálico pesado, como o "KICKABOUT" da logo.
- **Placar de destaque da página inicial e dos confrontos:** desenhado como um campo à noite, com linha do meio-campo, círculo central e faixa verde no topo. O placar do vencedor aparece em verde.
- **Listas de resultados:** cada placar fica numa caixinha escura que acende em verde ao passar o mouse.
- **Topo:** logo maior, menu em itálico e o link da página atual em verde, com sublinhado inclinado.
- **Botões, abas e números:** botões em verde-limão; a aba ativa em verde; os números de estatística ganharam um filete verde à esquerda.
- **Celular:** nomes longos de times quebram com hífen, em vez de no meio da palavra sem hífen. Placares e nomes das listas ficaram mais compactos. Continua sem rolagem horizontal a partir de 320px.

---

## v1.0 — 2026-10-17

Primeira versão: plataforma de campeonatos de eFootball mobile entre times. Um organizador (admin) cadastra tudo; o público acompanha sem login.

### Regras do jogo
- Confronto entre dois times = 5 duelos individuais (1 × 1), cada um com placar próprio; vitória no duelo vale 1 ponto e o placar do confronto é a soma.
- Mata-mata empatado depois dos 5 duelos: 6º duelo com qualquer jogador do elenco; se empatar, pênaltis (não podem terminar empatados).
- Pontos corridos: vitória 3, empate 1; desempate por pontos, confronto direto, vitórias, saldo de gols e gols marcados; depois, ordem do seed.
- Elenco com até 20 jogadores ativos; um jogador pertence a um time por vez; transferências preservam o histórico.

### Formatos de campeonato
- Eliminatória simples (com disputa de 3º lugar opcional), eliminatória dupla (com final com reset opcional) e pontos corridos (turno único ou ida e volta).
- Chaves com número de times que não é potência de 2 são completadas com BYEs.

### Site público (sem login)
- **Início:** último resultado em destaque, resultados recentes, campeonatos em andamento e atalho para os títulos.
- **Campeonatos:** lista por situação (em andamento, encerrados, em preparação).
- **Campeonato:** abas Chave (desenho da chave) ou Tabela (classificação nos pontos corridos), Jogos (por rodada, com nomes em português), Times (link para o BID de cada time) e Estatísticas (artilharia, mais vitórias em duelos e melhor aproveitamento).
- **Confronto:** placar grande, barra dos duelos (6º em destaque) e lista dos duelos com pênaltis.
- **Times, time e BID:** elenco com nome e celular; o celular é um link para o WhatsApp do jogador. O celular só aparece nas listas de BID.
- **Jogador:** time atual, histórico de times, números, histórico de duelos e títulos.
- **Títulos:** ranking de times por títulos e pódio de cada campeonato.
- Mobile-first (funciona a partir de 320px), tema escuro, logo oficial; mensagens de erro em português.

### Área do organizador (`/admin`, com login)
- **Login** pelo link "Área do organizador" no rodapé; a sessão expirada leva de volta ao login e depois à mesma página.
- **Times:** cadastro e edição; elenco com remover, buscar e transferir jogador já cadastrado ou cadastrar um novo direto no time; contador "n de 20" e aviso de elenco cheio.
- **Jogadores:** busca por nome ou celular, cadastro, edição e troca de time.
- **Campeonatos:** criar com as opções do formato, inscrever times e ordenar os seeds, iniciar (com confirmação), acompanhar os confrontos e encerrar (gera campeão, vice e 3º).
- **Lançamento de resultado:** jogadores já escalados somem dos outros duelos, placar ao vivo, 6º duelo e pênaltis quando necessários, rascunho ou confirmação, validação das regras antes de enviar.
- **Correções:** pontos corridos podem ser corrigidos livremente; no mata-mata, um confronto com resultados seguintes lançados fica bloqueado e a tela mostra quais reabrir. **Reabrir** volta um resultado confirmado a rascunho.
- **Títulos históricos:** cadastro manual e exclusão (só dos manuais).

### Privacidade do celular
- `PHONE_VISIBILITY=public` (padrão da v1): BID público. Com `authenticated`, a API só envia celulares para quem está logado, e o site esquece esses dados ao sair.

### Como rodar
- Requisitos: Node 22.12 ou mais novo (testado no 24) e Docker.
- `docker compose up -d` (Postgres), `npm install`, `npm run db:migrate -w @kickabout/api` na primeira vez.
- Admin: definir `ADMIN_EMAIL` e `ADMIN_PASSWORD` em `apps/api/.env` e rodar `npm run create-admin -w @kickabout/api`.
- `npm run dev:api` e `npm run dev:web`; o site fica em http://localhost:5173.
- Testes: `npm test`; tipos: `npm run typecheck`.

### Tecnologia
- Monorepo npm workspaces: `packages/shared` (regras puras), `apps/api` (Fastify, Prisma, PostgreSQL, brackets-manager) e `apps/web` (React 19, Vite 8, React Router 7, TanStack Query, brackets-viewer).

### Limitações conhecidas
- Se o desenho da chave falhar, ele só volta recarregando a página (os confrontos continuam na aba Jogos).
- A busca de jogador com números também procura nos celulares.
- Fora da v1 (spec): contas abertas, capitães, reporte de resultado pelos times, notificações, prints de resultado, E2E automatizado e deploy definitivo.
