# Revisão de design — Kickabout (2026-10-17)

Feita com a skill `frontend-design`, sobre a v1.1 (tema escuro). Branch `feat/design-review`.

## Brief (confirmado com o cliente)

- **Assunto:** campeonatos de eFootball mobile entre times de amigos. Cada confronto tem 5 duelos 1 × 1, mais um 6º de desempate no mata-mata.
- **Quem mais usa:** o organizador. Ele cadastra times e elencos, cria campeonatos e, principalmente, lança resultados duelo a duelo logo depois dos jogos, muitas vezes pelo celular. O público (jogadores e torcida) só consulta de vez em quando.
- **Trabalho principal:** para o organizador, lançar o resultado rápido e sem erro. Para o público, ver o último resultado.
- **Abertura da página inicial:** o último resultado em destaque.
- **Escopo:** visual e estrutura do site público e da área do organizador. API e regras não mudam.

## Diagnóstico

1. **Área do organizador sem foco no trabalho principal.**
   - A página inicial é uma lista de 4 links.
   - Na página do campeonato, a primeira coisa é o formulário "Nome", e os confrontos a lançar ficam abaixo.
   - Não existe um lugar que diga "isto está esperando resultado".
2. **Duas barras de navegação empilhadas no admin.** O menu público fica em cima e as abas do admin embaixo, com "Títulos" cortado a 375px e "Sair" solto numa linha só dele.
3. **Súmula (formulário de resultado) sem identidade.**
   - Os campos de jogador não dizem de que time são, a não ser pela palavra "Jogador".
   - No celular, o placar ao vivo some da tela enquanto o organizador preenche.
   - Os botões de confirmar ficam no fim de uma página longa.
4. **O 5 × 1 do Kickabout não aparece na página inicial.** O destaque mostra só o placar total; a barra de duelos, que é o que torna o produto diferente, fica só na página do confronto.
5. **Título em caixa alta quebra com nomes longos.** "ASSOCIAÇÃO ATLÉTICA TIGRES DO NORTE PAULISTA 0548 CONTRA…" vira um bloco de 4 linhas.
6. **"A jogar" dentro da caixinha preta de placar** parece um placar quebrado.
7. **Decoração que não informa nada:** o filete verde nas estatísticas.

## Plano

### Cores (base mantida da v1.1, com papéis mais claros)

| Nome | Hex | Papel |
|---|---|---|
| Noite | `#0A0F1C` | fundo |
| Arquibancada | `#111A2C` | superfícies (campos, linhas, súmula) |
| Placa | `#19243A` | superfície elevada, botões secundários |
| Cal | `#F1F5F9` | texto e linhas do campo (como cal na grama) |
| Volt | `#8CF014` | **ação e destaque**: botões principais, "falta lançar", vencedor |
| Gramado | `#00C030` | **concluído**: chip "Encerrado", confirmações |

O âmbar (`#FFC23D`) fica só para parcial/rascunho e o vermelho (`#FF5C5C`) só para derrota e ações perigosas.

**Mudança em relação à v1.1:** o verde-limão deixa de ser usado para "concluído". Ele passa a querer dizer "precisa da sua ação" ou "venceu", e o verde-gramado da logo assume o "concluído".

### Tipografia

- **Barlow Condensed** (itálico 700/800): títulos, placares, nomes de time nos placares e menu. É o mesmo gesto inclinado do "KICKABOUT" da logo.
- **Barlow** (400–700): texto, formulários e tabelas.
- **Escala:** terça maior (×1,25) sobre 16px:
  - 12,8
  - **16**
  - 20
  - 25
  - 31,25
  - 39
  - 61 (só o placar do destaque)
- **Títulos:** em caixa normal, não em caixa alta, porque nomes de time são longos.
- **Parágrafos:** até 65 caracteres por linha.
- **Rótulos:** nenhum em caixa alta.

### Layout

**Página inicial (público):** o último resultado, com o placar e logo abaixo a **barra dos 5 duelos**. É o que só o Kickabout tem.

```
Copa Demo, Final
┌────────────────────────────────────────────┐
│    [TIG]          1 × 0          [FAL]      │  ← placar de transmissão
│  Tigres do Norte  │  (círculo)   Falcões    │
└────────────────────────────────────────────┘
 ▬▬▬▬ ▬▬▬▬ ▬▬▬▬ ▬▬▬▬ ▬▬▬▬                     ← 5 duelos, cor do vencedor
Resultados recentes
 [PAN] Panteras        3 × 2        Falcões [FAL]
Em andamento
 Reabrir 187                Eliminatória simples, 4 times
```

**Barra do organizador:** uma única faixa abaixo do topo, que substitui o menu público dentro de `/admin`.

```
[logo]                                        Ver site
──────────────────────────────────────────────────────
Organizador │ Campeonatos  Times  Jogadores  Títulos   Sair
```

No celular, os links rolam para o lado e o "Sair" fica fixo à direita.

**Mesa do organizador (`/admin`):** abre com o que espera resultado.

```
Área do organizador
Para lançar                                   ← só campeonatos em andamento
 Copa Demo 0548
  [TIG] Tigres …      Parcial      Falcões [FAL] →  súmula
 Reabrir 187
  [ONC] Onças        A jogar     Panteras [PAN]
Cadastros
 Campeonatos   Criar, inscrever times, iniciar
 Times         Cadastro e elenco (BID)
 …
```

Alternativa considerada e descartada: um painel de números (total de times, jogadores, confrontos). É o "número grande com rótulo pequeno" genérico, e não ajuda o organizador a agir.

**Campeonato no admin:** confrontos primeiro; encerrar logo depois; renomear vai para um bloco recolhido no fim.

**Súmula (lançar resultado):** a peça em que o organizador passa mais tempo.

```
┌ Tigres 1 × 0 Falcões ─────────────── (fixo no topo ao rolar) ┐
  [TIG] Tigres do Norte              Falcões [FAL]   ← cabeçalho das colunas
  ① [TIG Jogador 1 ▾] [1] × [0] [FAL Jogador 1 ▾]
  ② [TIG Jogador 2 ▾] [2] × [2] [FAL Jogador 2 ▾]
  …
┌ [Salvar rascunho]  [Confirmar resultado] ─── (fixo embaixo no celular) ┐
```

No celular, cada duelo vira duas linhas, e cada linha começa com o escudo pequeno do time:

```
① 1º duelo
  [TIG] [Jogador ▾]  [1]
  [FAL] [Jogador ▾]  [0]
```

A numeração ①–⑤ se justifica: os duelos são uma sequência real.

**Confrontos sem resultado:** o chip ("A jogar", "Parcial") fica fora da caixinha preta de placar, que só aparece quando há placar.

### Princípios

1. **Uma peça ousada:** o placar de transmissão, com campo à noite, linha do meio-campo e círculo central. Ele aparece no destaque da página inicial, na página do confronto e, compacto, no topo da súmula. O resto fica quieto.
2. **O verde-limão é um verbo:** onde ele aparece, há algo a fazer ou alguém venceu.
3. **O duelo 1 × 1 é a unidade visual do produto:** a barra de 5 segmentos aparece onde há resultado.
4. **Primeiro o trabalho, depois os cadastros:** em toda tela do admin, o que espera ação vem antes do que é configuração.

## Revisão do plano contra o brief

- **Fundo quase preto com um único verde ácido** (clichê nº 2 da skill): o verde vem da logo, que é uma orientação do cliente, então fica. Para não cair no padrão:
  - o fundo é azul-noite, não preto;
  - há um segundo verde (gramado) com papel próprio;
  - o motivo visual vem do futebol (linhas de cal do campo), não de "tech".
- **Painel de números no admin:** descartado (ver acima).
- **Rótulo "Organizador" na barra:** a skill condena rótulos desnecessários. Este fica, porque informa o modo em que a pessoa está, e é o único.
- **Números ①–⑤ na súmula:** mantidos, porque é uma sequência real.
- **Filete verde nas estatísticas:** removido. Era decoração, e o "tirar um acessório" da skill se aplica.
- **Movimento:** só a entrada da barra de duelos, que já existe. Nada de animação em cada cartão.

## O que mudou durante a construção (autocrítica com capturas de tela)

- **Barra de duelos:** a primeira versão pintava de verde os duelos do time da esquerda. No placar, porém, o verde marca o vencedor, e as duas leituras se contradiziam. Agora fica verde o duelo ganho por quem venceu o confronto, e cada segmento mostra a sigla do time que o venceu.
- **Título da súmula:** "Time A contra Time B" repetia o placar e o cabeçalho das colunas. Virou "Lançar resultado" ou "Corrigir resultado", e os nomes continuam no título para leitores de tela.
- **Placar ao vivo na súmula:** sem escudos, porque eles já estão no cabeçalho das colunas. Ficou compacto para caber preso no topo.
- **Botões fixos no celular:** lado a lado, para não ocupar duas linhas.
