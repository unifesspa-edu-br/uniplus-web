# VLibras — bundle self-hosted

Widget VLibras vendorizado (não vem do CDN `vlibras.gov.br`) para atender à
CSP de produção (commit `48d1c56`). Consumido por `VlibrasLoaderComponent`
(`libs/shared-ui/src/lib/components/vlibras-loader/vlibras-loader.ts`).

## Patch manual em `vlibras-plugin.js` (Story #446 / Task #454)

O bundle webpack embute seu próprio `publicPath` (`o.p`) usado exclusivamente
para o lazy-load de `vlibras-plugin.chunk.js` — **não** é o mesmo `rootPath`
que `VlibrasLoaderComponent` passa para `new window.VLibras.Widget(rootPath)`
(esse último só afeta os assets carregados pelo `Player`, via chunk já
carregado).

Vendorizado originalmente como:

```js
o.p = "/assets/shared-ui/vlibras/", (() => { ...
```

Absoluto e hardcoded — ignora `<base href>`, então quebraria o carregamento
do chunk sob subpath (`/portal/`, `/selecao/` etc., Feature #444). Corrigido
para derivar do `<script>` que efetivamente carregou o bundle (mesmo valor
que `VlibrasLoaderComponent.scriptSrc()` resolve, já relativo ao base href):

```js
o.p = (document.currentScript && document.currentScript.src ? document.currentScript.src.replace(/[^/]*$/, "") : "/assets/shared-ui/vlibras/"), (() => { ...
```

`document.currentScript` é válido durante a execução síncrona de topo do
próprio `<script>` (mesmo com `async = true`), técnica equivalente ao
`output.publicPath: 'auto'` de builds webpack mais recentes.

**Ao atualizar o bundle vendorizado**: reaplicar este patch — buscar a única
ocorrência de `o.p = "..."` perto do fim do arquivo minificado e substituir
pela expressão acima. `node --check vlibras-plugin.js` valida a sintaxe.
