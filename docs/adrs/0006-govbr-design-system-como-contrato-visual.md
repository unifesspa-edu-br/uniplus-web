---
status: "accepted"
date: "2026-05-01"
decision-makers:
  - "Tech Lead (CTIC)"
  - "Diretora do CTIC"
---

# ADR-0006: Adoção do Gov.br Design System como contrato visual

## Contexto e enunciado do problema

O Uni+ é uma plataforma digital de processos institucionais mantida pela Unifesspa — autarquia federal integrante do SISP — e dirigida ao cidadão (candidatos, estudantes, servidores). Essa combinação enquadra o sistema no escopo obrigatório do **Padrão Digital de Governo** (Gov.br Design System), mantido pelo SERPRO.

Os instrumentos legais aplicáveis incluem o Decreto 9.756/2019 (portal gov.br obrigatório para autarquias federais), a Portaria SEI-MCOM 540/2020 (Padrão Digital obrigatório para administração direta, autárquica e fundacional), a IN SGD/ME 94/2022 (DS como padrão obrigatório em contratações TIC do SISP), a Lei 14.129/2021 (Governo Digital) e o e-MAG 3.1 (acessibilidade).

Não adotar o Gov.br DS implica risco formal de apontamento em auditorias TCU/CGU e descumprimento da Portaria 540.

## Drivers da decisão

- Obrigatoriedade legal para órgãos do SISP voltados ao cidadão.
- Identidade visual reconhecível pelos candidatos, alinhada ao portal gov.br.
- Acessibilidade WCAG 2.1 AA / e-MAG 3.1 incorporada por design.
- Independência em relação ao wrapper Angular oficial, que está em pre-release há 4+ anos com bugs documentados.

## Opções consideradas

- Adotar o Gov.br DS via tokens CSS oficiais (`@govbr-ds/core`) como contrato visual canônico.
- Adotar o wrapper oficial `@govbr-ds/webcomponents-angular` (Web Components via Stencil).
- Não adotar o Gov.br DS, usando paleta institucional própria.

## Resultado da decisão

**Escolhida:** adotar o Gov.br Design System como contrato visual canônico do `uniplus-web` por meio dos tokens CSS oficiais do pacote `@govbr-ds/core` 3.7.

Diretrizes derivadas da decisão:

1. Importar `@govbr-ds/core/dist/core-tokens.min.css` no `styles.css` global de cada app.
2. Não importar o runtime JS do `@govbr-ds/core` — apenas os tokens CSS.
3. **Não** consumir `@govbr-ds/webcomponents-angular`. O wrapper permanece em pre-release há mais de quatro anos, possui bugs documentados em roteamento SPA, não integra-se nativamente com Signals/Reactive Forms (são Web Components via Stencil) e tem catálogo limitado.
4. Permanecer na linha v3 dos tokens enquanto a v4 estiver em pre-release; reavaliar a migração quando a v4 atingir GA com janela de estabilidade ≥ 3 meses, migration guide oficial publicado e compatibilidade comprovada com a stack em uso.
5. Cumprir e-MAG 3.1 / WCAG 2.1 AA via componentes que herdem o focus ring oficial (dourado tracejado, 4 px, `#c2850c`) e contraste mínimo derivado dos próprios tokens.

A forma operacional de aplicar este contrato visual aos componentes UI é definida nas ADRs 0007 (PrimeNG unstyled) e 0008 (mapeamento Tailwind).

## Consequências

### Positivas

- Cumprimento da Portaria SEI-MCOM 540/2020, da IN SGD/ME 94/2022 e da Lei 14.129/2021.
- Identidade visual gov.br reconhecível, alinhada ao portal único do governo federal.
- Conformidade com WCAG 2.1 AA / e-MAG 3.1 herdada dos tokens, sem trabalho adicional por componente.
- Independência do wrapper Angular oficial, eliminando risco de bug em produção causado por pacote pre-release.

### Negativas

- Divergência declarada do wrapper oficial; em caso de auditoria que exija o pacote específico, será necessário apresentar a justificativa documentada (bugs, pre-release crônico) e os tokens como evidência primária.
- Necessidade de monitoramento ativo do roadmap v3 → v4 do `@govbr-ds/core`.

### Neutras

- A escolha pelos tokens CSS é compatível com qualquer biblioteca de componentes que aceite estilização via classes externas — não amarra o projeto a uma biblioteca específica.

## Confirmação

- `package.json` declara `@govbr-ds/core` em versão 3.7.x pinned.
- `styles.css` global de cada app importa `core-tokens.min.css`.
- Suíte de testes E2E inclui asserções visuais e de tokens (cores, tipografia, focus ring) para detectar regressões.

## Mais informações

- ADR-0007 define a biblioteca de componentes (PrimeNG unstyled).
- ADR-0008 define o mapeamento dos tokens via Tailwind `@theme`.
- Base legal: [Portaria SEI-MCOM 540/2020](https://www.gov.br/governodigital/pt-br/estrategias-e-governanca-digital/sisp/guia-do-gestor/guia-orientativo-de-padroes-e-fluxos-das-tecnologias-de-transformacao-digital/padrao-de-governo-digital-design-system), [IN SGD/ME 94/2022](https://www.gov.br/governodigital/pt-br/contratacoes-de-tic/instrucao-normativa-sgd-me-no-94-de-23-de-dezembro-de-2022), [Lei 14.129/2021](https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14129.htm), [Decreto 9.756/2019](https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2019/decreto/d9756.htm).
- Documentação: [Gov.br DS](https://www.gov.br/ds/home), [`@govbr-ds/core`](https://gitlab.com/govbr-ds).
- **Origem:** revisão da ADR interna Uni+ ADR-018 (não publicada), seção de adoção do DS.
