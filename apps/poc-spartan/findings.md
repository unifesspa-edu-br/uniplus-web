# Findings — PoC Spartan UI + Gov.br DS + Zoneless

**Data:** 2026-04-09
**Branch:** `poc/17-spartan-govbr-ds`
**Issue:** uniplus-web#17

---

## 1. Zoneless Mode

**Resultado: FUNCIONA**

- Angular 21.2.5 com `provideZonelessChangeDetection()` — a app roda sem Zone.js
- Zone.js não está em polyfills nem é importado em lugar nenhum
- Change detection via signals funciona corretamente para todos os componentes
- Reactive Forms funcionam sem problemas no modo zoneless
- `@if`, `@for` com signals atualizam a view corretamente

**Observação:** O Angular 21 já gera apps sem `provideZoneChangeDetection` por padrão — o zoneless é o modo nativo. Isso confirma que o ADR-017 (manter Zone.js por causa do PrimeNG) pode ser revisitado.

---

## 2. Spartan Brain

**Resultado: VIÁVEL COM RESSALVAS**

### O que funcionou bem
- **Tabs** (`@spartan-ng/brain/tabs`): API limpa com attribute directives (`brnTabs`, `brnTabsList`, `brnTabsTrigger`, `brnTabsContent`). Navegação por teclado (setas) funciona out-of-the-box.
- **Select** (`@spartan-ng/brain/select`): Integração com `[formControl]` via ControlValueAccessor. Dropdown posiciona corretamente.
- **Radio Group** (`@spartan-ng/brain/radio-group`): Funciona com `[formControl]`, acessibilidade ARIA correta.

### Problemas encontrados
- **Dialog** (`@spartan-ng/brain/dialog`): O `BrnDialogContent` exige `TemplateRef` — não funciona com elementos DOM simples. A solução foi implementar um dialog custom com `@if` + signal, sem usar o brain do dialog. Isso é um gap significativo.
- **Selectors mistos:** Spartan usa uma mistura de element selectors (`brn-checkbox`, `brn-radio`) e attribute selectors (`[brnTabs]`, `[brnSelect]`). Não há padrão consistente — requer consulta à API de cada componente.
- **Select marca touched na inicialização** em testes jsdom — comportamento inesperado que dificulta testes de validação visual.

### Helm directives
- **Decisão:** Não criamos helm directives separadas na PoC. As classes Tailwind Gov.br foram aplicadas diretamente nos templates. Isso é mais simples mas menos reutilizável. Em produção, criar hlm-* directives centralizaria o estilo Gov.br.

---

## 3. Gov.br DS Tokens

**Resultado: FUNCIONA PERFEITAMENTE**

- O pacote `@govbr-ds/core` oferece `core-tokens.min.css` — arquivo dedicado apenas com CSS custom properties
- Mapeamento para Tailwind via `tailwind.config.js` funciona sem conflitos
- Cores, tipografia, espaçamento e border-radius aplicados consistentemente
- A fonte Rawline não está disponível publicamente — usamos Raleway (Google Fonts) como fallback visual similar
- **Zero conflito** entre tokens Gov.br e Spartan — porque Spartan não tem opinião visual

---

## 4. Bundle Size

| Métrica | PoC Spartan (zoneless) | App Selecao (zone.js + PrimeNG) |
|---|---|---|
| **Initial total (raw)** | **324.05 kB** | 276.34 kB |
| **Initial total (gzip)** | **83.46 kB** | 76.32 kB |
| Polyfills | 0 kB (sem zone.js) | 35.68 kB (zone.js) |
| Main chunk | 71.56 kB | 3.98 kB |
| Styles | 60.21 kB | 6.46 kB |
| Lazy (inscricao) | 199.58 kB (43.82 gzip) | — |

**Análise:**
- O initial bundle da PoC (324 kB) inclui o framework Angular + CDK + Spartan brain embutido no main chunk, além dos tokens Gov.br nos styles
- O app selecao tem initial menor (276 kB) porque todo o conteúdo é lazy-loaded
- Ambos estão **bem abaixo** do budget de 500 kB warning
- A remoção do Zone.js economiza ~36 kB (11.57 kB gzip) de polyfills
- Em produção, com lazy loading adequado, o bundle seria comparável

---

## 5. Testabilidade

### Testes unitários (Vitest)
- **16 testes passaram**, 3 arquivos de spec
- `provideZonelessChangeDetection()` no TestBed funciona corretamente
- `fixture.whenStable()` é necessário após mudanças de estado (signals)
- `fixture.detectChanges()` continua funcionando para forçar re-render
- **Problema:** Spartan Select causa `NG01203: No value accessor` ao renderizar o componente completo via TestBed — o `BrnSelect` precisa de providers específicos que não funcionam bem em jsdom. Workaround: testar lógica de negócio separadamente com `runInInjectionContext()`
- Componentes com signal `input.required` precisam de host component wrapper nos testes

### Testes E2E (Playwright)
- **5 de 6 testes passaram** (1 skipped — dialog)
- Playwright interage normalmente com Spartan brain components — sem Shadow DOM, sem barreiras
- Seletores de atributo (`button[brnTabsTrigger="dados-pessoais"]`) funcionam perfeitamente
- **Problema:** Dialog custom com `@if` + signal não foi detectado pelo Playwright após click. Precisa investigação adicional (possível timing de change detection em zoneless).

---

## 6. Acessibilidade

- Spartan brain tabs adiciona `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls` automaticamente
- Spartan radio group adiciona `role="radiogroup"`, `role="radio"` automaticamente
- Navegação por teclado (Tab, setas, Enter) funciona nos componentes Spartan
- `focus-visible` customizado com anel azul Gov.br funcionando
- Dialog custom precisa de `role="dialog"`, `aria-modal`, `aria-labelledby` manuais (sem brain)

---

## 7. DX (Developer Experience)

### Pontos positivos
- A API de attribute directives é intuitiva para desenvolvedores Angular
- Tailwind + tokens Gov.br = velocidade alta para estilizar
- Standalone components + signals = código limpo e moderno
- Tree-shaking funciona — importar apenas os brains necessários

### Pontos negativos
- **Documentação do Spartan é escassa** — precisei inspecionar `index.d.ts` para descobrir selectors e APIs
- **Inconsistência de selectors** (element vs attribute) confunde
- **Versão alpha** (0.0.1-alpha.665) — sem garantia de estabilidade de API
- **Sem test harnesses** — Angular Material oferece `MatButtonHarness`, Spartan não tem equivalente

---

## 8. Recomendação

### Adotar Spartan Brain + Gov.br DS tokens? **SIM, com caveats**

**Favorável:**
- Zoneless funciona — podemos descartar Zone.js e PrimeNG
- Tokens Gov.br se integram perfeitamente via Tailwind
- Bundle size competitivo
- Sem identidade visual de terceiro para lutar contra
- Acessibilidade embutida nos componentes headless

**Caveats:**
1. **Dialog brain não funcionou** — precisamos de implementação custom ou aguardar correção
2. **Documentação fraca** — a equipe precisará inspecionar tipos e fontes frequentemente
3. **Alpha version** — breaking changes são possíveis; pintar versão no package.json
4. **Testabilidade do Select em jsdom** — requer workarounds nos testes unitários
5. **Fonte Rawline** — verificar se a Unifesspa já hospeda ou se usamos Raleway

### Próximos passos
1. Comparar com a PoC da Zard UI (issue #18) antes da decisão final
2. Se aprovado, criar `libs/govbr-ui/` com helm directives reutilizáveis
3. Criar ADR-018 formalizando a decisão
4. Revisitar ADR-017 — com Spartan, Zone.js pode ser removido globalmente
