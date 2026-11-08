# shared-inscricao

Apresentação do domínio da inscrição, compartilhada entre os apps (ADR-0030).

- Recebe o DTO pronto por entrada; quem lê a API é o container do app.
- Só importa **tipos** de `@uniplus/shared-data`.
- Cada conceito é um entry point secundário, como `@uniplus/shared-inscricao/comprovante`.

## Testes

```bash
npx nx run shared-inscricao:vite:test -- --run
npx nx run shared-inscricao:lint
npx nx run shared-inscricao:build
```
