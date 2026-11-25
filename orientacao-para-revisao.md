# Orientação para revisão

Complementa o [`CONTRIBUTING.md`](CONTRIBUTING.md). Registra como as regras de arquitetura do `uniplus-web` são garantidas e o que fica para quem revisa.

Atualizado em 17/11/2026.

## Regra

Regra de arquitetura só vira verificação automática quando pode ser garantida de forma declarativa, legível e estável diante de refatoração. As formas aceitas são:

- **ESLint**: regras configuradas no `eslint.config.mjs` da raiz ou do projeto. Hoje a raiz já aplica `@nx/enforce-module-boundaries` e as métricas de tamanho e complexidade, com `linterOptions.noInlineConfig` para que nenhum comentário desligue regra. `no-restricted-imports`, `no-restricted-syntax` com seletores e `@angular-eslint/*` são as formas previstas para os substitutos abaixo. Quando um projeto redefine a regra original e a substituiria no bloco dele, a regra do núcleo é registrada com nome próprio (caso de `apoio-de-teste/arquivo-de-teste-fora-da-producao`, ADR-0032), que nenhum projeto redefine;
- **compilador do TypeScript**: tipos que tornam a violação impossível de compilar;
- **teste de comportamento**: unitário (Vitest) ou E2E (Playwright), que prova o efeito, e não a forma do código.

Não são aceitos:

- spec que lê o fonte (TypeScript, HTML, CSS) com `readFileSync`, `readdirSync` ou `import.meta.glob` e o confere com regex;
- spec que reimplementa uma regra que o ESLint ou o compilador já expressam;
- ferramenta própria mantida no repositório para cobrir regra de arquitetura;
- `eslint-disable` para fazer uma regra passar.

## Quando a regra não cabe

Siga esta ordem:

1. **Desenho.** Tipo, visibilidade ou ponto de entrada público tornam a violação impossível.
2. **Teste de comportamento.**
3. **Ferramenta pronta e configurada.** Só open source e gratuita, com licença compatível (MIT, Apache-2.0, BSD, MPL-2.0 ou LGPL), sem plano pago e com manutenção ativa conferida antes da adoção.
4. **Revisão.** A regra entra na lista "Conferido na revisão" abaixo.

## Transição da dívida existente

Os specs `*.fitness.spec.ts` da tabela abaixo leem o fonte como texto. Eles continuam valendo até serem substituídos, com estas regras:

- Um spec legado só é removido no mesmo PR em que o substituto fica implementado e verde. Proteção automática não pode ficar descoberta, nem por um commit.
- PR que altera um spec legado o migra para a forma aceita. A regra é desta orientação, e não das métricas do `CONTRIBUTING.md`.
- Spec com várias garantias só sai quando cada uma tem substituto ou retenção definida.
- Verificação nova nasce na forma aceita.

## Substitutos previstos

Salvo o que a tabela marca como já ativo, os substitutos abaixo não existem ainda. Cada um entra no PR que migra o spec correspondente. Garantia sem substituto equivalente fica retida no spec legado, reduzido só a ela.

| Verificação                                                             | O que protege                                                                                                                                                                                                                                                                                                                                                                  | Substituto previsto                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fronteira-das-bibliotecas/ponto-de-entrada-publico`                    | Aplicativos e bibliotecas importam pontos de entrada públicos descobertos nos pacotes ng-packagr; projetos internos seguem suas próprias fronteiras                                                                                                                                                                                                                            | Regra ativa no ESLint                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `libs/shared-data/src/lib/api/__fitness__/api-services.fitness.spec.ts` | Classe `@Injectable`; nenhum método público devolve `Promise`; método público que devolve `Observable` devolve `Observable<ApiResult<T>>`; import de `withVendorMime` vindo de `@uniplus/shared-core/http`; ocorrência de `withVendorMime` nos `this.http.get(...)`, contada por arquivo, com dois GETs de `versoes-do-perfil.api.ts` dispensados. Mutações ficam fora do spec | Decorator e `providedIn: 'root'`: `no-restricted-syntax` com seletores que exijam os dois, porque `@angular-eslint/use-injectable-provided-in` sozinho aceita classe sem decorator e outros valores. Origem do import: `no-restricted-imports`. Proibição de `Promise`: `no-restricted-syntax` sobre o tipo de retorno dos métodos públicos dos `*.api.ts`. Tipo `Observable<ApiResult<T>>` e uso de `withVendorMime` em cada chamada: sem forma declarativa equivalente definida; ficam retidos até haver desenho (por exemplo, cliente HTTP comum que só devolve `ApiResult` e aplica o cabeçalho) com teste unitário de cada serviço |

A proibição de importar `environments/environment` nos arquivos `app.config.ts` é uma regra ativa do ESLint, conforme a ADR-0021.

## Leituras de arquivo que continuam legítimas

Folhas de estilo e o primeicons.css são lidos com postcss.parse (apoio de @uniplus/shared-testing) para conferir acesso ao conteúdo, leitura, contraste, foco visível, sinais e impressão, além da regra de que a cor do tema vem de token. Acabamento visual, como espaçamento estético e ordem das declarações, não se confere por teste.

- `calendario-dias-uteis.api.spec.ts` lê o contrato OpenAPI (JSON) para derivar o DTO. É dado, não fonte.
- Os specs do formulário do candidato carregam casos de teste em JSON com `import.meta.glob`.
- `grafo-de-projetos-sem-ciclo.fitness.spec.ts` lê o grafo de projetos pela API do Nx (`readCachedProjectGraph`). É dado da ferramenta, não fonte, e o spec confere só a ausência de ciclo, inclusive o fechado por `implicitDependencies`, que o lint não vê. As restrições de tag entre projetos ficam só no `@nx/enforce-module-boundaries`.

## Conferido na revisão (não vira verificação automática)

1. Componente de página não usa `HttpClient`: o acesso HTTP passa pelos serviços de `@uniplus/shared-data`. Já é regra de ESLint em `apps/configuracao` (`no-restricted-imports` em `features`) e em `apps/selecao` (`no-restricted-syntax` contra `inject(HttpClient)` nas páginas). Nas demais apps, confira no diff.
2. Vocabulário institucional em texto exibido: confira no diff o termo usado em string de tela.
3. Tamanho de cada caso de teste e dos arquivos CSS, como já diz a seção "Revisão de código" do `CONTRIBUTING.md`.
4. Teste que usa o relógio controlado o liga antes de criar o componente ou o serviço cujo temporizador exercita: temporizador agendado antes fica no relógio real.

## Decisões pendentes
