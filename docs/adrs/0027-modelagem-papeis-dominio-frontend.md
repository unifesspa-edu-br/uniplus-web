---
status: "accepted"
date: "2026-06-24"
decision-makers:
  - "Tech Lead (CTIC)"
consulted:
  - "Frente de autorização (PBAC+ABAC)"
informed:
  - "Apps selecao, ingresso, portal e configuracao"
---

# ADR-0027: Modelagem de papéis de domínio no frontend — `UserRole` como contrato de display

## Contexto e enunciado do problema

A rota do app `configuracao` é protegida por `roleGuard('plataforma-admin')` (`apps/configuracao/src/app/app.routes.ts`) e o realm atribui esse papel ao usuário autorizado. Na revisão do PR #396 (issue #398) constatou-se que o papel `plataforma-admin` não era reconhecido na camada de exibição: o conjunto `DOMAIN_ROLES` — então duplicado em `layout.ts` e `user-header-info.component.ts` — listava apenas `admin | gestor | avaliador | candidato`, e o tipo `UserRole` (`libs/shared-auth/src/lib/models/user.model.ts`) também não o conhecia. Consequência: todo usuário legitimamente autorizado caía no fallback `@username` no header e na sidebar. O gate de acesso nunca foi afetado — o problema era puramente cosmético.

O PR #411 resolveu #398 incluindo `plataforma-admin` no union `UserRole`, centralizando `DOMAIN_ROLES` e `ROLE_LABELS` em `shared-auth` (origem única) e exibindo o rótulo pt-BR "Administrador da Plataforma". A decisão de modelagem, porém, ficou registrada apenas como nota informal na descrição do PR. Esta ADR a formaliza.

O ponto sensível levantado em #398 é que `plataforma-admin` é o **papel de autorização interina da Plataforma/CTIC**, ligado à frente de autorização **PBAC+ABAC** (políticas e atributos, não enum estático). Modelar `UserRole` como se fosse a fonte de verdade de autorização criaria débito conflitante com essa frente. Esta ADR decide o papel que o tipo `UserRole` ocupa no frontend para evitar esse débito.

## Drivers da decisão

- A exibição precisa de duas coisas: um filtro "este papel de realm é um papel de domínio que vale exibir" e um rótulo pt-BR legível por papel.
- A **autorização** não pode ser acoplada a um union estático: a frente PBAC+ABAC decidirá acesso por políticas/atributos, não por uma lista fixa de papéis.
- Origem única para a definição de papéis de domínio (já consolidada em `shared-auth` por #398), sem duplicação entre apps.
- Menor custo de mudança: `plataforma-admin` já existe no realm e o estado atual do código já o exibe.
- Não preservar artificialmente semântica enganosa: o nome `UserRole` não deve sugerir que é o modelo de autorização.

## Opções consideradas

- **A. Manter `plataforma-admin` no union `UserRole`, escopado explicitamente como contrato de _display_** — `UserRole`/`DOMAIN_ROLES`/`ROLE_LABELS` são apenas a tabela de papéis que a UI sabe rotular e exibir; a autorização permanece em `roleGuard`/claims do realm e migrará para PBAC+ABAC.
- **B. Separar papéis técnicos dos de negócio** — `UserRole` só com papéis de domínio de negócio (`admin | gestor | avaliador | candidato`) e um tipo distinto (`PlatformRole`/`TechnicalRole`) para `plataforma-admin`, com mapas de label separados.
- **C. Modelagem orientada a claims/políticas** — eliminar o union estático e derivar papéis exibíveis e decisões de acesso diretamente de claims/políticas, antecipando o modelo PBAC+ABAC no frontend.

## Resultado da decisão

**Escolhida:** "A. Manter `plataforma-admin` no union `UserRole`, escopado explicitamente como contrato de _display_", porque entrega a correção cosmética com o menor custo e, ao delimitar o papel do tipo, evita o débito conflitante com a frente PBAC+ABAC.

`UserRole`, `DOMAIN_ROLES` e `ROLE_LABELS` (em `libs/shared-auth/src/lib/models/user.model.ts`) são, por esta decisão, **artefatos de apresentação**: respondem "quais papéis de realm a UI reconhece como papéis de domínio" e "qual o rótulo pt-BR de cada um". Eles **não** são a fonte de verdade de autorização. As decisões de acesso continuam em `roleGuard` e nos guards/interceptors que leem os papéis crus do realm (`AuthService.roles()`), e serão substituídas pela frente PBAC+ABAC quando ela aterrissar — sem que `UserRole` precise modelar políticas.

Como a Opção A coincide com o estado já implementado pelo PR #411, **não há refactor pendente** decorrente desta ADR: ela ratifica e delimita o que já existe. Uma eventual renomeação para um nome mais explícito (ex.: `DisplayRole`/`KnownRoleLabel`) e a chegada do modelo PBAC+ABAC no frontend são decisões futuras, a serem registradas em ADR própria quando aquela frente avançar.

## Consequências

### Positivas

- Correção de #398 entregue com mudança mínima e origem única em `shared-auth`, sem duplicação entre apps.
- Autorização permanece desacoplada de um union estático — sem conflito com a frente PBAC+ABAC.
- Header e sidebar exibem o mesmo rótulo pt-BR de forma consistente.
- O escopo "display-only" do `UserRole` fica documentado, prevenindo uso indevido como modelo de acesso.

### Negativas

- O nome `UserRole` é levemente enganoso (sugere autorização); mitigado por esta ADR e por comentário no próprio arquivo do modelo.
- Um papel técnico (`plataforma-admin`) convive no mesmo union dos papéis de negócio, uma pequena impureza semântica aceita em favor da simplicidade.

### Neutras

- Quando a frente PBAC+ABAC avançar, esta decisão pode ser revisitada (renomeação e/ou derivação por claims) via nova ADR.
- `roleGuard` e demais guards seguem consumindo os papéis crus do realm, sem dependência de `UserRole`.

## Confirmação

As **tabelas de display** `DOMAIN_ROLES` e `ROLE_LABELS` devem ser referenciadas **apenas** por código de apresentação (header, sidebar e afins), nunca por guards, interceptors ou decisões de política de acesso. O **union `UserRole`** é um tipo, não uma tabela de exibição: além do código de apresentação, pode também restringir a tipagem de helpers de checagem de papel (ex.: `UserContextService.hasRole(role: UserRole)` / `hasAnyRole(...roles: UserRole[])`), que apenas delegam a `AuthService.hasRole` — isso constrange o argumento ao conjunto de papéis _conhecidos_, não modela política de acesso, e portanto é uso permitido.

Verificação por inspeção/fitness test: nenhum arquivo em `libs/shared-auth/src/lib/guards/` ou `.../interceptors/` deve importar `DOMAIN_ROLES`/`ROLE_LABELS`; as decisões de acesso (quem pode quê) usam `AuthService.roles()`/`hasRole` lendo os papéis crus do realm, sem consultar `DOMAIN_ROLES`/`ROLE_LABELS`.

## Mais informações

- Origem: revisão do PR #396 → issue #398 → PR #411 (implementação) → issue #416 (registro desta ADR).
- `libs/shared-auth/src/lib/models/user.model.ts` — definição de `UserRole`, `DOMAIN_ROLES`, `ROLE_LABELS`.
- `apps/configuracao/src/app/app.routes.ts` — `roleGuard('plataforma-admin')`.
- A frente de autorização **PBAC+ABAC** poderá emendar esta decisão; eventual revisão será registrada em ADR posterior.
