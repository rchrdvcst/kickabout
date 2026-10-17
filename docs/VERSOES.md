# Kickabout — versões

Este documento registra o que cada versão entrega. A cada nova versão, acrescente uma seção no topo (a mais recente primeiro) dizendo o que mudou em relação à anterior; as seções antigas não são reescritas.

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
