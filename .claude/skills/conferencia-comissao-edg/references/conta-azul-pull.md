# Como puxar os orçamentos do Conta Azul (vendedor EDG)

O Conta Azul não tem export limpo na tela e raspar a interface é frágil (refs
"velhas", seletor de página que reseta, screenshot que trava). O caminho robusto
é chamar a **API interna** reaproveitando a sessão logada, via Claude-in-Chrome.

## Passos

1. Abrir/garantir o Conta Azul logado numa aba do Claude-in-Chrome e navegar para:
   `https://pro.contaazul.com/#/ca/vendas/servicos/orcamentos`

2. Instalar um interceptador de XHR (o app usa XMLHttpRequest, não fetch), pra
   capturar os headers autenticados de uma busca real:

```js
if (!window.__xhrPatched) {
  window.__xhrPatched = true; window.__caXhr = [];
  const O = XMLHttpRequest.prototype.open, S = XMLHttpRequest.prototype.send, H = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.open = function (m, u) { this.__m = m; this.__u = u; this.__h = {}; return O.apply(this, arguments); };
  XMLHttpRequest.prototype.setRequestHeader = function (k, v) { try { this.__h[k] = v; } catch (e) {} return H.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function (b) { try { if (this.__u && this.__u.includes('/sales/searches')) window.__caXhr.push({ headers: this.__h }); } catch (e) {} return S.apply(this, arguments); };
}
'ok';
```

3. Disparar uma busca (clicar numa aba "Todos/Vendas/Orçamentos" ou mudar o
   período) pra popular `window.__caXhr`. Confirmar que a aba tem o **filtro
   "Vendedor: EDG Gráfica"** aplicado (Mais filtros). O `ownersIds` do EDG é
   `38a17e8e-c657-4f97-84bf-18985f4dbbc1`.

4. Puxar todos os orçamentos EDG do período e baixar como JSON (o retorno do
   javascript_tool trunca strings grandes e bloqueia dígitos longos como CNPJ;
   por isso salvamos via download e lemos do disco):

```js
const cap = window.__caXhr[window.__caXhr.length - 1];
const headers = Object.assign({}, cap.headers, { 'Content-Type': 'application/json' });
const EDG = ["38a17e8e-c657-4f97-84bf-18985f4dbbc1"];
async function pull(types) {
  const body = { types, totals: "ALL", ownersIds: EDG, itemType: "SERVICE",
    period: { startDate: "2025-08-01", endDate: "2026-12-31" }, searchTerm: "" };
  const url = 'https://services.contaazul.com/contaazul-bff/sale/v1/sales/searches?page=1&page_size=2000';
  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), credentials: 'include' });
  return await r.json();
}
const prop = await pull(["SALE_PROPOSAL"]);           // Orçamentos
const sale = await pull(["SALE", "SCHEDULED_SALE"]);  // Vendas/faturados
const map = x => ({ d: x.date, n: x.number, c: x.customer && x.customer.name, t: x.total, s: x.situation && x.situation.description, ty: x.type });
const payload = { geradoEm: new Date().toISOString().slice(0,10), prop: prop.items.map(map), sale: sale.items.map(map) };
const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'ca_edg.json';
document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
JSON.stringify({ prop: prop.totalItems, sale: sale.totalItems });
```

> `new Date()` pode não estar disponível em alguns contextos de script; se der
> erro, troque `geradoEm` por uma data fixa string "AAAA-MM-DD".

5. O arquivo cai em `Downloads/ca_edg.json`. Copiar pra pasta de trabalho.

## Formato do `ca_edg.json`

```json
{ "geradoEm": "2026-07-21",
  "prop": [ { "d": "2026-07-14", "n": 43603, "c": "Princesa", "t": 21991.2, "s": "Aprovado", "ty": "SALE_PROPOSAL" } ],
  "sale": [ { "d": "...", "n": ..., "c": "...", "t": ..., "s": "Faturado", "ty": "SALE" } ] }
```

- `prop` = orçamentos (o que o Gabriel vendeu). `s: "Aprovado"` = fechado.
- `sale` = faturados por ele mesmo (esses NÃO geram comissão da gráfica, mas
  servem pra explicar orçamento que "sumiu": ele que faturou).
- O **número do orçamento aqui ≠ Nº OS da gráfica** — por isso a conciliação é
  por **cliente + valor**, nunca por número.
