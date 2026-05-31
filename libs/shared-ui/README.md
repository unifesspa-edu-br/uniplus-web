# shared-ui

Biblioteca Angular de componentes reutilizáveis do Uni+ Web.

## Contrato Visual

A fonte canônica é o `uniplus-ds` CSS-only. Esta lib fornece wrappers Angular `ui-*` e publica a foundation global em:

- `src/styles/tokens.css`
- `src/styles/base.css`
- `src/styles/components.css`

Os apps importam esses arquivos em `apps/<app>/src/styles.css` antes do Tailwind. Imports TypeScript devem usar `@uniplus/shared-ui`.

## Desenvolvimento

- Standalone components.
- `ChangeDetectionStrategy.OnPush`.
- Inputs/outputs/models com signals.
- Componentes sem dependência de domínio, HTTP, auth ou `shared-data`.
- `ControlValueAccessor` apenas para controles reais.

## Testes

```bash
npx nx run shared-ui:vite:test -- --run
npx nx run shared-ui:lint
npx nx run shared-ui:build
```
