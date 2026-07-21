---
name: conferencia-comissao-edg
description: >-
  Confere a comissão que a gráfica (EDG) pagou ao Gabriel contra o que ele
  vendeu no Conta Azul, achando comissão que faltou, percentual errado e
  parcela que sumiu — e gera a lista de cobrança. Use SEMPRE que o Gabriel
  mandar as planilhas "GRANDES POSSIBILIDADES ... comissao_venda ref <mês>.xlsx",
  ou pedir para "conferir a comissão", "conferência de comissão", "comissão da
  gráfica / da EDG", "ver o que a gráfica não me pagou", "montar a cobrança da
  comissão", ou quando quiser verificar um trabalho específico contra a comissão.
  O trabalho é 100% automático: o Gabriel só manda a planilha do mês e lê a
  resposta — ele NÃO mantém planilha na mão (isso era o processo antigo,
  exaustivo, que a skill existe para eliminar).
---

# Conferência de comissão da gráfica (EDG)

O Gabriel fecha trabalhos gráficos; a gráfica **EDG** imprime, na maioria fatura
direto pro cliente final, e paga uma **comissão %** a ele. Todo mês a EDG manda
uma planilha do que comissionou. O objetivo desta skill é conferir, sem trabalho
manual dele, se **tudo que ele vendeu virou comissão** e no **percentual certo** —
e cuspir uma **lista de cobrança** pra ele mandar pra EDG.

O Gabriel é **não técnico**. Fale sempre em português simples, explique os
achados em dinheiro (R$) e ação ("cobrar isso", "não precisa cobrar aquilo"), e
nunca despeje tabelões crus sem interpretar.

## O modelo mental (o que custou caro descobrir)

Antes de conciliar, entenda a estrutura — é onde mora quase todo erro:

- **A comissão é calculada sobre o RATEIO**, não sobre o título. Na planilha da
  gráfica: `Comissão = R$ Rateio OS × %`. O "R$ Título" é a nota cheia, que pode
  ser **rateada entre várias OS**.
- **O valor CHEIO do trabalho** está na descrição: `... / R$40.509,92` (o 2º
  número). Somar rateio subestima quando uma parcela caiu antes do 1º mês de dados.
- **A mesma OS é reusada em meses diferentes** para trabalhos recorrentes (ex:
  uma Lição mensal). Por isso agrupe por **OS + mês**, nunca só por OS.
- **Um trabalho vira VÁRIAS OS/notas**, e às vezes é faturado em **duas unidades
  diferentes** (ex: parte pra "Editora Promessa", parte pra "Convenção Batista").
  Então casar por valor gera falso-positivo — trate a lista automática como
  PISTA, e confirme caso a caso.
- **O número do orçamento no Conta Azul ≠ Nº OS da gráfica.** A ponte entre os
  dois sistemas é **cliente + valor** (validado ~66–88%), nunca o número.
- **Nem todo orçamento gera comissão.** O filtro certo é o **vendedor = "EDG
  Gráfica"** no Conta Azul (o que ele mesmo faturou não gera comissão, mas serve
  de rastreio).
- **Regra de tempo (confirmada pelo Gabriel):** cliente paga no mês M → a
  comissão cai na planilha "referente a M" (que ele recebe fisicamente em M+1).
  Ou seja, a planilha "ref junho" já cobre pagamentos de junho — não precisa
  esperar julho pra conferir junho.
- **O % varia por negociação, caso a caso** — NÃO é fixo por cliente. Então
  "percentual fora do padrão do cliente" é só pista, não erro provado; pra provar
  precisa do % combinado (descrição do orçamento ou e-mail da negociação).

## O achado mais valioso: padrão "só Parcela 2/2"

O furo mais comum e sistemático é a gráfica pagar a **2ª metade** de um trabalho
parcelado e **pular a 1ª**. Se um cliente só tem linhas "Parcela 2/2" e o mês
onde a "Parcela 1/2" deveria estar está **vazio** daquele cliente, é furo real.
O `reconcile.js` já detecta e alerta isso.

## Fluxo mensal (o que fazer quando o Gabriel manda a planilha)

Trabalhe numa pasta de trabalho (ex: o scratchpad da sessão). Não há Python no
Windows do Gabriel — use **Node** com o pacote `xlsx`.

1. **Preparar os scripts** (uma vez por sessão):
   ```bash
   cd <skill>/scripts && npm install   # instala xlsx
   ```

2. **Ler as planilhas da gráfica** (todas as `...comissao_venda ref <mês>.xlsx`,
   geralmente em `C:/Users/gabri/Downloads`):
   ```bash
   node parse_grafica.js "C:/Users/gabri/Downloads" grafica.json
   ```

3. **Puxar os orçamentos EDG do Conta Azul** → `ca_edg.json`. Siga
   `references/conta-azul-pull.md` (via Claude-in-Chrome; a sessão do Gabriel já
   fica logada). Filtre pelo vendedor **EDG**.

4. **Conciliar** — cruza tudo, atualiza o controle interno e gera a cobrança:
   ```bash
   node reconcile.js grafica.json ca_edg.json control.json cobranca.xlsx
   ```
   O `reconcile.js` imprime: (a) **visão por cliente** (vendido vs comissionado —
   a mais confiável); (b) **alerta de "só parcela 2/2"**; (c) **suspeitos**
   graduados por confiança (1-ALTA são os mais prováveis). E salva `cobranca.xlsx`
   + `control.json` (memória do que já foi resolvido, pra não re-perguntar).

5. **Verificar caso a caso** os suspeitos de prioridade ALTA — este é o passo que
   dá certeza. Peça ao Gabriel as **notas** de um orçamento suspeito e rode:
   ```bash
   node buscar.js grafica.json 7818 7816 122 123
   ```
   Se as notas aparecem na planilha → foi comissionado (não cobrar). Se não
   aparecem em nenhum mês → furo real (cobrar). Foi assim que fechamos os casos
   reais.

6. **Apresentar ao Gabriel**: só a resposta. Uma tabela curta de **cobrança**
   (cliente, trabalho, base, comissão a cobrar) e o que **não** precisa cobrar
   (já pago) e o que está **pendente** (recente, ainda vai cair). Marque no
   `control.json` o que ele confirmar como resolvido/cobrado.

## Interpretando os suspeitos (evite acusação errada)

Um item na lista **não é** automaticamente "a gráfica te roubou". Antes de mandar
cobrar, descarte as causas inocentes:

1. **Foi pago picado** — o trabalho virou 3-5 OS/notas cujos valores não somam
   igual ao orçamento. Confirme com `buscar.js` pelas notas/valores.
2. **Você faturou** — se há uma venda faturada (`sale`) de mesmo valor, o Gabriel
   faturou e não gera comissão da EDG. (O `reconcile.js` já sinaliza.)
3. **Ainda vai cair** — orçamento recente; pela regra do tempo a comissão vem no
   mês seguinte. Marque como pendente, não como furo.
4. **Anterior aos dados** — se a 1ª parcela cairia num mês cuja planilha o Gabriel
   ainda não mandou, peça essa planilha antes de concluir.

O que sobra depois desses filtros é cobrança de verdade.

## Formato da resposta ao Gabriel

Sempre feche com uma tabela de cobrança assim:

```
| Cliente | Trabalho (orçamento/notas) | Base faltante | Comissão a cobrar | Status |
```

E uma frase pronta pra ele mandar pra EDG, ex.:
> "Na Promessa, as comissões das PRIMEIRAS parcelas não estão entrando — só as
> segundas. Dez, mar e mai não têm nenhum lançamento da Promessa. Favor lançar as
> parcelas 1/2 em atraso."

## Arquivos da skill

- `scripts/parse_grafica.js` — lê as planilhas da gráfica → `grafica.json`.
- `scripts/reconcile.js` — conciliação + alerta parcela-2/2 + cobrança + controle.
- `scripts/buscar.js` — busca caso-a-caso por nota/valor (o mais confiável).
- `scripts/lib.js` — funções e o mapa de nomes de cliente (estenda quando surgir
  cliente novo cujo nome difere entre gráfica e Conta Azul).
- `references/conta-azul-pull.md` — como puxar os orçamentos EDG via API interna.
- `control.json` (gerado) — memória do que já foi conferido/cobrado.

## Extras úteis

- **Erro a favor da gráfica também conta** — às vezes ela paga a MAIS (ex: um
  R$309 onde caberia R$1,51). Vale avisar o Gabriel antes que a EDG desconte.
- **Ajuste as datas de corte** em `reconcile.js` (`recente`/`antigo`) conforme o
  mês corrente for avançando.
