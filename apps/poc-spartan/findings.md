# Findings — PoC Spartan UI + Gov.br DS + Zoneless

**Data:** 2026-04-09
**Branch:** `poc/17-spartan-govbr-ds`
**Issue:** uniplus-web#17
**Versões:** Angular 21.2.5, Nx 22.6.2, @spartan-ng/brain 0.0.1-alpha.665, @govbr-ds/core 3.7.0, Tailwind CSS 3.0.2

---

## Scorecard resumido

| Critério | Nota | Observação |
|---|---|---|
| Zoneless | ✅ OK | Funciona nativamente no Angular 21 |
| Spartan Brain — Tabs | ✅ OK | API limpa, a11y automático, keyboard nav |
| Spartan Brain — Select | ❌ Falhou | Renderiza inline sem BrnPopover; substituído por nativo |
| Spartan Brain — Radio | ❌ Falhou | Custom element sem indicador visual; substituído por nativo |
| Spartan Brain — Dialog | ❌ Falhou | Exige TemplateRef; implementado custom com signal |
| Spartan Brain — Checkbox | ⚠️ Não testado | Mesmo risco do Radio (custom element sem visual) |
| Gov.br DS tokens | ✅ OK | core-tokens.min.css + Tailwind = integração perfeita |
| Reactive Forms | ✅ OK | Tipagem forte, validação custom (CPF), zoneless compatível |
| CDK Table | ✅ OK | Renderiza e estiliza sem problemas |
| Testes unitários (Vitest) | ⚠️ Parcial | 16/16 passam, mas BrnSelect causa NG01203 em jsdom |
| Testes E2E (Playwright) | ⚠️ Parcial | 5/6 passam; dialog com signal não detectado |
| Bundle size | ✅ OK | 324 kB initial (83 kB gzip), abaixo do budget |
| Acessibilidade | ⚠️ Parcial | Tabs e radio group OK; dialog precisa ARIA manual |
| DX | ⚠️ Parcial | API intuitiva, mas documentação escassa e selectors inconsistentes |

**Resumo:** de 5 componentes Spartan brain testados, apenas 1 (Tabs) funcionou sem workarounds. Os outros 3 (Select, Radio, Dialog) precisaram ser substituídos por implementações nativas/custom.

---

## 1. Zoneless Mode

**Resultado: ✅ FUNCIONA**

- Angular 21.2.5 com `provideZonelessChangeDetection()` — app roda sem Zone.js
- Zone.js não está em polyfills nem é importado em lugar nenhum
- Change detection via signals funciona corretamente para todos os componentes
- Reactive Forms funcionam sem problemas no modo zoneless
- `@if`, `@for` com signals atualizam a view corretamente
- Angular 21 já gera apps sem `provideZoneChangeDetection` por padrão — zoneless é o modo nativo

**Impacto no ADR-017:** Confirma que manter Zone.js por causa do PrimeNG pode ser revisitado. Se descartarmos PrimeNG (que era a única dependência que exigia Zone.js), podemos adotar zoneless globalmente.

---

## 2. Spartan Brain — Análise por componente

### 2.1 Tabs — ✅ Funcionou

- API com attribute directives: `brnTabs`, `brnTabsList`, `brnTabsTrigger`, `brnTabsContent`
- Navegação por teclado (setas esquerda/direita) funciona automaticamente
- ARIA automático: `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`
- Atributo `data-[state=active]` permite estilização condicional via Tailwind
- Integração com template Angular limpa e intuitiva

**Esforço:** baixo. Funcionou conforme esperado.

### 2.2 Select — ❌ Falhou (substituído)

**Problema:** `BrnSelectContent` renderiza inline no fluxo do documento, sem overlay. A lista de opções fica visível permanentemente, quebrando o layout do formulário.

**Causa raiz:** O `BrnSelect` depende internamente do `BrnPopover` para posicionamento. Sem importar e configurar o `BrnPopover` (que por sua vez usa CDK Overlay), o content não se comporta como dropdown.

**Tentativa de solução:** Adicionamos classes CSS de posicionamento (`absolute`, `z-index`), mas não resolveu porque o posicionamento é gerenciado pelo `BrnPopover`, não por CSS.

**Solução adotada:** Substituído por `<select>` nativo estilizado com tokens Gov.br (`appearance-none` + seta SVG customizada via `background-image`).

**Impacto:** Perda do dropdown customizável com busca/filtro. Select nativo tem limitações de estilização (opções seguem o estilo do OS).

**Esforço de workaround:** ~30 min. Reescrever o template inteiro, remover imports do Spartan, criar estilização do select nativo.

**Nota para PoC Zard UI:** Verificar se o `zrd-select`/`zrd-combobox` renderiza corretamente como dropdown.

### 2.3 Radio Group — ❌ Falhou (substituído)

**Problema:** O elemento `<brn-radio>` é um custom element sem conteúdo visual. Não renderiza nenhum indicador (círculo, dot). As classes Tailwind aplicadas no host (`border-2 rounded-full`, pseudo-elementos `::after`) não surtiram efeito visível.

**Causa raiz:** O `brn-radio` é um custom element Angular (`brn-radio` element selector) que encapsula apenas comportamento ARIA e ControlValueAccessor. O indicador visual deveria vir de uma helm directive separada — que não criamos na PoC.

**Solução adotada:** Substituído por `<input type="radio">` nativo com `sr-only` (visually hidden) + `<span class="govbr-radio-indicator">` adjacente, estilizado via CSS com `input:checked + .indicator`.

**Impacto:** Funcional e acessível, mas perdemos a abstração Spartan. Cada radio precisa de markup manual para o indicador.

**Esforço de workaround:** ~45 min. Criar CSS customizado para o indicador, refatorar todo o template, testar estados (hover, focus, checked).

**Nota para PoC Zard UI:** Verificar se o `zrd-radio` renderiza o indicador visual completo.

### 2.4 Dialog — ❌ Falhou (substituído)

**Problema:** `BrnDialogContent` lança `Error: NG0201: No provider for TemplateRef found` ao ser usado como elemento DOM direto (`<div brnDialogContent>`).

**Causa raiz:** O `BrnDialogContent` espera ser usado dentro de um `<ng-template>`, não como attribute directive em um elemento DOM. A documentação do Spartan não deixa isso claro — a API parece aceitar ambos, mas internamente depende de `TemplateRef` via `inject()`.

**Solução adotada:** Implementação custom: componente com `signal<boolean>` para visibilidade, `@if` para renderização condicional, ARIA manual (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`).

**Problema adicional (E2E):** O dialog custom com `@if` + signal não foi detectado pelo Playwright após click no botão trigger. O `[role="dialog"]` não aparecia no DOM mesmo após `waitForTimeout`. Possível timing de change detection em zoneless — o signal atualiza mas o DOM não reflete a tempo para o Playwright. Teste marcado como `fixme`.

**Impacto:** Sem overlay gerenciado pelo CDK (focus trap, escape to close, click outside). Precisamos implementar manualmente ou usar CDK Dialog diretamente.

**Esforço de workaround:** ~1h. Implementar dialog, overlay, botões, ARIA, lógica de abrir/fechar, testar. E ainda assim o E2E ficou com problemas.

**Nota para PoC Zard UI:** Verificar se o `zrd-dialog` renderiza overlay + conteúdo + fecha com Escape/click-outside.

### 2.5 Checkbox — ⚠️ Não testado

O `brn-checkbox` usa element selector (mesmo padrão do `brn-radio`). **Risco alto** de apresentar o mesmo problema: custom element sem indicador visual.

### 2.6 Contagem de esforço em workarounds

| Componente | Problema | Workaround | Tempo estimado |
|---|---|---|---|
| Select | Inline sem overlay | Select nativo | ~30 min |
| Radio | Sem visual | Input nativo + CSS | ~45 min |
| Dialog | TemplateRef error | Implementação custom | ~1h |
| **Total** | | | **~2h15** |

Para uma PoC com 5 componentes, gastar 2h15 em workarounds é significativo. Em produção com 20-30 componentes, o custo acumulado seria relevante.

---

## 3. Gov.br DS Tokens

**Resultado: ✅ FUNCIONA PERFEITAMENTE**

- O pacote `@govbr-ds/core` oferece `core-tokens.min.css` — arquivo dedicado com **apenas** CSS custom properties (cores, tipografia, espaçamento)
- Mapeamento para Tailwind via `tailwind.config.js` funciona sem conflitos
- Cores institucionais (`--blue-warm-vivid-70` = `#1351B4`), feedback (success, danger, warning), neutros — todos disponíveis
- Tipografia, espaçamento (escala 4px) e border-radius mapeados como utilities Tailwind (`govbr-*`)
- **Zero conflito** entre tokens Gov.br e Spartan — porque Spartan não tem opinião visual

### Problemas encontrados
- **Fonte Rawline:** não está disponível publicamente (Google Fonts, CDNs). Usamos Raleway como fallback (visualmente similar). Em produção, verificar se a Unifesspa hospeda Rawline ou se o SERPRO disponibiliza via CDN Gov.br.
- **Logo Gov.br:** A URL `https://www.gov.br/ds/assets/img/govbr-logo-small.png` retorna erro. Substituída por SVG inline. Em produção, usar o SVG oficial do Gov.br DS ou o CDN do SERPRO.

---

## 4. Layout e CSS

### Problemas encontrados e soluções

| Problema | Causa | Solução | Tempo |
|---|---|---|---|
| Footer flutuante (não fica no bottom) | Layout sem flexbox vertical | `host: { class: 'flex flex-col min-h-screen' }` + `flex-1` no main + `mt-auto` no footer | ~10 min |
| Logo Gov.br não carrega | URL externa inacessível | SVG inline no header | ~15 min |
| Select sem seta dropdown | `<select>` nativo com `appearance-none` perde a seta | SVG data URI como `background-image` via Tailwind arbitrary value | ~15 min |

---

## 5. Bundle Size

| Métrica | PoC Spartan (zoneless) | App Selecao (zone.js + PrimeNG) |
|---|---|---|
| **Initial total (raw)** | **324.05 kB** | 276.34 kB |
| **Initial total (gzip)** | **83.46 kB** | 76.32 kB |
| Polyfills | 0 kB (sem zone.js) | 35.68 kB (zone.js) |
| Main chunk | 71.56 kB | 3.98 kB |
| Styles | 60.21 kB | 6.46 kB |
| Lazy (inscricao) | 199.58 kB (43.82 gzip) | — |

**Análise:**
- O initial bundle da PoC (324 kB) inclui Angular + CDK + Spartan brain no main chunk + tokens Gov.br nos styles
- O app selecao tem initial menor (276 kB) porque todo o conteúdo é lazy-loaded e os styles são mínimos
- Ambos estão **bem abaixo** do budget de 500 kB warning / 1 MB error
- A remoção do Zone.js economiza ~36 kB (11.57 kB gzip) de polyfills
- Styles da PoC são maiores (60 kB vs 6 kB) porque incluem todos os tokens Gov.br — em produção com PurgeCSS, seria menor

---

## 6. Testabilidade

### 6.1 Testes unitários (Vitest) — 16/16 passando

| Aspecto | Resultado | Observação |
|---|---|---|
| `provideZonelessChangeDetection()` no TestBed | ✅ OK | Funciona sem problemas |
| `fixture.whenStable()` após signals | ✅ OK | Necessário após mudanças de estado |
| `fixture.detectChanges()` | ✅ OK | Continua funcionando para forçar re-render |
| Componentes com `input.required` | ⚠️ Workaround | Precisa de host component wrapper nos testes |
| `runInInjectionContext()` para testar lógica | ✅ OK | Alternativa quando template não renderiza |
| BrnSelect em jsdom | ❌ Falhou | `NG01203: No value accessor` — BrnSelect precisa de providers específicos que não funcionam em jsdom |

**Observação sobre BrnSelect em testes:** Ao renderizar um componente que contém `BrnSelect` via TestBed, o jsdom não consegue resolver o `ControlValueAccessor`. Workaround: testar a lógica de negócio separadamente com `runInInjectionContext()`, ou mockar o componente filho.

### 6.2 Testes E2E (Playwright) — 5/6 (1 skipped)

| Teste | Resultado | Observação |
|---|---|---|
| Header Gov.br visível | ✅ OK | |
| 3 tabs renderizadas | ✅ OK | Seletores `button[brnTabsTrigger="..."]` funcionam |
| Preencher dados pessoais | ✅ OK | Inputs nativos interagem normalmente |
| Validação de campos | ✅ OK | Mensagens de erro aparecem ao blur |
| Navegação entre tabs | ✅ OK | Click nas tabs alterna conteúdo |
| Dialog de confirmação | ❌ Skipped | `[role="dialog"]` não detectado após click — timing de signal em zoneless |

**Observação sobre Dialog E2E:** O Playwright não encontra o `[role="dialog"]` no DOM mesmo após `waitForTimeout(500ms)`. Hipótese: o signal `visivel.set(true)` atualiza, mas o change detection zoneless não processou a view a tempo. Pode ser resolvido com `page.waitForSelector` ou investigando se o `@if` precisa de um tick adicional.

**Observação geral:** Playwright interage normalmente com componentes Spartan brain — sem Shadow DOM, sem barreiras. Os attribute selectors (`brnTabsTrigger`) funcionam como seletores CSS padrão.

---

## 7. Acessibilidade

| Componente | ARIA automático | Keyboard nav | Observação |
|---|---|---|---|
| Spartan Tabs | ✅ `role="tablist/tab"`, `aria-selected`, `aria-controls` | ✅ Setas esquerda/direita | Totalmente automático |
| Radio nativo | ✅ `role="radiogroup"` via `role` attr manual | ✅ Tab + setas | ARIA manual, mas funciona |
| Select nativo | ✅ Nativo do browser | ✅ Nativo do browser | Sem customização ARIA necessária |
| Dialog custom | ⚠️ Manual (`role="dialog"`, `aria-modal`, `aria-labelledby`) | ❌ Sem focus trap, sem Escape | Precisa CDK a11y para produção |
| Focus visible | ✅ Customizado com anel azul Gov.br | — | Via `*:focus-visible` global |

**Gap crítico:** O dialog custom não tem focus trap (foco pode escapar para elementos atrás do overlay) nem fecha com Escape. Em produção, seria necessário usar `CdkTrapFocus` e listener de Escape — ou usar CDK Dialog diretamente.

---

## 8. DX (Developer Experience)

### Pontos positivos
- API de attribute directives é intuitiva para desenvolvedores Angular
- Tailwind + tokens Gov.br = velocidade alta para estilizar novos componentes
- Standalone components + signals = código limpo e moderno
- Tree-shaking funciona — importar apenas os brains necessários
- Subpath exports (`@spartan-ng/brain/tabs`) são organizados

### Pontos negativos
- **Documentação escassa** — não existe referência de API pública. Precisei inspecionar `node_modules/@spartan-ng/brain/*/index.d.ts` para descobrir selectors, inputs, outputs e como cada componente deve ser usado.
- **Inconsistência de selectors** — uns são element selectors (`brn-checkbox`, `brn-radio`), outros são attribute selectors (`[brnTabs]`, `[brnSelect]`). Não há padrão documentado.
- **Versão alpha** (0.0.1-alpha.665) — API pode quebrar entre releases. Sem changelog estruturado.
- **Sem test harnesses** — Angular Material oferece `MatButtonHarness`, `MatSelectHarness`, etc. Spartan não tem equivalente, tornando testes de componentes complexos mais trabalhosos.
- **Composição entre brains não óbvia** — o Select depende do Popover, o Dialog depende de TemplateRef. Essas dependências não são documentadas; só se descobre no runtime.

### Tempo gasto na PoC

| Etapa | Tempo |
|---|---|
| Setup (branch, deps, scaffold, zoneless) | ~30 min |
| Tailwind + tokens Gov.br | ~20 min |
| Componentes que funcionaram (tabs, layout, table, form) | ~1h30 |
| **Workarounds de componentes Spartan** | **~2h15** |
| Testes unitários | ~45 min |
| Testes E2E | ~30 min |
| Correções visuais pós-teste manual | ~40 min |
| Documentação (findings) | ~30 min |
| **Total** | **~7h** |

O tempo em workarounds (2h15) representou ~32% do tempo total. Em um projeto real com mais componentes, esse percentual pode crescer.

---

## 9. Recomendação

### Adotar Spartan Brain + Gov.br DS tokens? **VIÁVEL, mas com ressalvas significativas**

**A favor:**
- Zoneless funciona — podemos descartar Zone.js e PrimeNG
- Tokens Gov.br se integram perfeitamente via Tailwind
- Bundle size competitivo
- Sem identidade visual de terceiro para "lutar contra"
- Tabs brain é excelente — prova que o conceito funciona

**Contra:**
- 3 de 5 brains testados falharam e precisaram de workarounds (Select, Radio, Dialog)
- Documentação praticamente inexistente — alto custo de descoberta
- Alpha version sem garantia de estabilidade
- Sem test harnesses — testabilidade de componentes complexos é inferior ao Angular Material
- Dialog sem focus trap / escape — precisa de CDK a11y adicional

**Veredicto:** A abordagem headless + Gov.br tokens é correta. A questão é se o **Spartan** é o headless certo, ou se a **Zard UI** (que é Angular-native com Tailwind v4) resolve os problemas encontrados aqui. A PoC #18 vai responder isso.

### Próximos passos
1. **Executar PoC Zard UI** (issue #18) — validar se Select, Radio e Dialog funcionam sem workarounds
2. **Comparar findings** lado a lado: Spartan vs Zard UI
3. Decisão final → ADR-018
4. Revisitar ADR-017 (Zone.js) — independente da lib, zoneless funciona
