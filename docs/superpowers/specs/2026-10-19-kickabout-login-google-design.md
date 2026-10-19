# Kickabout — Login com Google e papéis de usuário

**Data:** 2026-10-19
**Base:** spec da v1 (`2026-10-15-kickabout-v1-design.md`). Tudo o que este documento não muda continua valendo.
**Versão alvo:** v1.7 (primeira melhoria depois do fechamento da v1, tag `v1.6`).

## 1. Objetivo

Hoje só existe login por email e senha, e **todo usuário logado é organizador**: a checagem de admin da API só confere se há sessão. Este documento:
- acrescenta o **login com Google** como alternativa ao email e senha;
- abre o login para **qualquer pessoa com conta Google**;
- cria dois papéis, **organizador** (`admin`) e **usuário comum** (`user`);
- dá ao organizador uma tela para promover e rebaixar usuários.

Decisões tomadas com o usuário:

| Tema | Decisão |
|---|---|
| Quem entra com Google | Qualquer pessoa com conta Google. |
| Papel de quem entra pela primeira vez | Usuário comum. Não tem acesso ao admin e, por enquanto, não tem nenhum recurso próprio além de ficar logado. |
| Quem cria organizadores | Só um organizador. O primeiro é o admin que já existe (criado com `create-admin`). |
| Admin para usuário comum | Usuário comum não vê nenhum caminho para a área do organizador: nenhum link, botão ou texto, e `/admin` mostra "Página não encontrada". |
| Jeito de integrar | Abordagem A: botão oficial do Google (Google Identity Services) no site; a API verifica o token. Só precisa do Client ID, sem Client Secret. |

Fora do escopo:
- recursos para usuários comuns (vincular ao jogador, capitão lançar resultado);
- outros provedores (Apple, Facebook);
- cadastro com email e senha pelo site (o `create-admin` continua sendo o único jeito de criar uma conta com senha);
- trocar ou recuperar senha.

## 2. Dados

Migração `20261019120000_google_login` em `User`:
- `passwordHash` passa a ser **opcional** (`String?`), porque quem entra só pelo Google não tem senha;
- `googleId String? @unique`: o `sub` do token do Google, identificador fixo da conta;
- `name String?` e `avatarUrl String?`: copiados do Google a cada login;
- `lastLoginAt DateTime?`: atualizado a cada login, por Google ou senha;
- `role` continua `String`, com os valores `admin` e `user`. O padrão passa de `admin` para `user`. As linhas existentes continuam `admin`, e o `create-admin` grava `role: 'admin'` explicitamente.

O login por senha de um usuário sem `passwordHash` falha com a mesma mensagem de credencial errada ("Email ou senha inválidos."), sem revelar que a conta existe.

## 3. API

### 3.1 Configuração
- Variável nova `GOOGLE_CLIENT_ID` no `.env` da API (opcional). Entra em `AppConfig` como `googleClientId: string | null`.
- `GET /api/auth/config` → `{ googleClientId: string | null }`, público. O site lê daqui, então o mesmo build serve qualquer ambiente.
- Sem a variável, `POST /api/auth/google` responde 404 `GOOGLE_LOGIN_DISABLED` ("Login com Google não está habilitado.") e o site não mostra o botão.

### 3.2 `POST /api/auth/google`
Corpo: `{ credential: string }` (o ID token devolvido pelo botão do Google).

1. **Verificação:** a API confere o token com `google-auth-library` (`OAuth2Client.verifyIdToken`), que checa assinatura, emissor (`accounts.google.com`), destinatário (`aud` = `googleClientId`) e validade. Além disso, exige `email_verified === true` e um `email`.
   - Qualquer falha → 401 `GOOGLE_TOKEN_INVALID`, "Não foi possível entrar com o Google. Tente de novo."
   - A verificação entra no app como dependência (`AppDeps.verifyGoogleToken`), para os testes usarem um verificador falso. Em produção, `server.ts` passa a implementação real.
2. **Conta:** dentro de uma transação, procura nesta ordem:
   - usuário com o mesmo `googleId`;
   - senão, usuário com o mesmo **email** (minúsculo). Ele ganha o `googleId` e mantém o papel; é assim que o organizador atual passa a entrar com Google;
   - senão, cria um usuário novo com `role: 'user'` e sem senha.
3. **Atualização:** grava `name`, `avatarUrl` e `lastLoginAt`.
4. **Sessão:** a mesma do login por senha (cookie `kb_session`, httpOnly, `sameSite: lax`, `secure` em produção).
5. **Resposta:** `{ user: AuthUser }`.

`AuthUser` passa a ser `{ id, email, name, avatarUrl, role }`, devolvido também por `POST /auth/login` e `GET /auth/me`.

### 3.3 Permissões
- `requireAdmin` passa a exigir `request.user.role === 'admin'`:
  - sem sessão → 401 `UNAUTHENTICATED` (como hoje);
  - logado sem ser organizador → 403 `FORBIDDEN`, "Sua conta não é de organizador."
- Todas as rotas que hoje usam `requireAdmin` continuam usando, sem mudar mais nada nelas.
- Com `PHONE_VISIBILITY=authenticated`, só organizador vê os celulares (a regra "logado" vira "organizador").

### 3.4 Usuários (só organizador)
- `GET /api/users` → lista `{ id, email, name, avatarUrl, role, hasPassword, hasGoogle, lastLoginAt, createdAt }`, do cadastro mais recente para o mais antigo.
- `PATCH /api/users/:id` com `{ role: 'admin' | 'user' }`:
  - 404 se o usuário não existir;
  - 409 `CANNOT_DEMOTE_SELF`, "Você não pode tirar o seu próprio papel de organizador.";
  - 409 `LAST_ADMIN`, "É preciso ter pelo menos um organizador." (checado dentro de uma transação com trava, para dois rebaixamentos simultâneos não zerarem os organizadores);
  - sucesso → o usuário atualizado.
- Ao rebaixar alguém, as sessões dele continuam válidas, mas a partir da próxima requisição ele é usuário comum (o papel é lido do banco a cada requisição).

## 4. Site

### 4.1 Entrar (`/entrar`)
- O link do rodapé "Área do organizador" vira **"Entrar"** (para `/entrar`) e só aparece para quem não está logado.
- A página mostra:
  - título "Entrar";
  - o botão oficial **"Fazer login com o Google"** (Google Identity Services, script `https://accounts.google.com/gsi/client` carregado só nesta página, tema escuro, texto em português);
  - um separador "ou" e, embaixo, o formulário de email e senha que já existe;
  - sem `googleClientId` na configuração, só o formulário.
- O texto "Área do organizador: cadastro de…" sai da página.
- **Depois de entrar:**
  - organizador → vai para o `voltar` (se houver) ou para `/admin`;
  - usuário comum → vai para o `voltar` só se ele não começar com `/admin`; senão, para a página inicial.
- Quem já está logado e abre `/entrar` vai direto para o mesmo destino.
- Erro do Google (token recusado, script que não carrega) aparece como mensagem acima do botão. Se o script não carregar: "Não foi possível carregar o login do Google. Use email e senha ou tente de novo."

### 4.2 Topo
- **Sem login:** como hoje.
- **Logado:** à direita do menu principal, um botão com a foto (ou a inicial do nome ou email, numa placa) e o primeiro nome. Ele abre um menu com:
  - **"Área do organizador"** (para `/admin`), só para organizador;
  - **"Sair"**.
- Usuário comum não vê nenhuma menção ao admin em nenhuma página.
- Dentro do admin, a faixa do organizador continua como hoje, com o item novo **"Usuários"**.

### 4.3 `/admin` para quem não é organizador
- **Sem login:** continua levando para `/entrar?voltar=…`.
- **Usuário comum:** mostra a página padrão "Página não encontrada", a mesma de qualquer endereço inexistente, dentro do layout público. Não aparece "acesso negado".
- **Perdeu o papel durante a sessão:** a API responde 403 na próxima ação. O site trata 403 `FORBIDDEN` como o 401: busca `/auth/me` de novo, e o `AdminLayout` passa a mostrar "Página não encontrada".

### 4.4 Usuários (`/admin/usuarios`)
- Lista com foto ou inicial, nome (ou "Sem nome"), email, como entra ("Google", "Senha" ou "Google e senha"), último acesso ("Nunca entrou" se vazio) e papel ("Organizador" ou "Usuário").
- Botões:
  - **"Tornar organizador"** nas linhas de usuário comum;
  - **"Remover organizador"** nas linhas de organizador, menos na do próprio usuário logado;
  - se só houver um organizador, o botão dele (se não for o próprio) aparece desabilitado com o motivo (caso raro; a API garante a regra de qualquer forma).
- Os dois pedem confirmação em dois cliques (`ConfirmButton`), com os textos "Confirmar: tornar organizador" e "Confirmar: remover organizador".
- Erros da API aparecem acima da lista.

## 5. Configuração no Google Cloud (documentar no VERSOES e no README de deploy futuro)
1. Em console.cloud.google.com, criar um projeto e configurar a **tela de consentimento OAuth** (tipo "Externo", nome "Kickabout", email de suporte).
2. Em **Credenciais**, criar um **ID do cliente OAuth** do tipo "Aplicativo da Web".
3. Em **Origens JavaScript autorizadas**, adicionar `http://localhost:5173` (desenvolvimento) e o domínio de produção (`https://…`). Não precisa de URI de redirecionamento.
4. Copiar o **Client ID** para `GOOGLE_CLIENT_ID` em `apps/api/.env` e reiniciar a API.

## 6. Testes

**API:**
- `POST /auth/google`:
  - com verificador falso: cria usuário comum na primeira vez e reaproveita no segundo login (mesmo `googleId`);
  - vincula pelo email ao organizador existente, que continua `admin`;
  - atualiza nome e foto;
  - recusa token inválido e `email_verified: false` (401);
  - responde 404 sem `GOOGLE_CLIENT_ID`.
- `requireAdmin`: usuário comum recebe 403 numa rota de admin; sem sessão continua 401.
- Login por senha de usuário sem senha → 401 com a mensagem genérica.
- `GET/PATCH /users`: só organizador; promover; rebaixar; não rebaixar a si mesmo; não zerar organizadores, inclusive com dois pedidos simultâneos.
- `PHONE_VISIBILITY=authenticated`: usuário comum não recebe celulares.
- `create-admin` continua criando organizador (o padrão do banco mudou para `user`).

**Site:**
- `/entrar`: mostra o botão do Google só com `googleClientId`; o formulário de senha continua funcionando; o destino depois de entrar depende do papel.
  - O botão do Google é testado com um `window.google` falso que chama o callback com um token.
- Topo: usuário comum vê nome e "Sair", sem "Área do organizador"; organizador vê os dois; rodapé "Entrar" só sem login.
- `/admin` como usuário comum mostra "Página não encontrada" e não renderiza a faixa do organizador.
- `/admin/usuarios`: lista, promover, rebaixar com confirmação; sem botão de remover na própria linha.
- 403 numa ação do admin faz o site buscar `/auth/me` de novo.

## 7. Riscos
- **Escalada de privilégio:** a regra de papel precisa estar na API (o site só esconde). Os testes de 403 cobrem todas as famílias de rota de admin por amostragem (times, jogadores, campeonatos, resultados, títulos, usuários).
- **Conta Google com email de organizador:** só é vinculada porque o Google garante o email (`email_verified`). Sem essa checagem, alguém poderia assumir a conta do organizador.
- **Script de terceiros:** o `gsi/client` roda só em `/entrar`. Uma Content Security Policy, se for criada no deploy, precisa liberar `accounts.google.com`.
