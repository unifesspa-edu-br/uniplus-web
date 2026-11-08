# shared-inscricao

Apresentação do domínio da inscrição, compartilhada entre os apps (ADR-0030).

- O corpo do comprovante recebe o DTO pronto; o container `insc-comprovante-do-envio` orquestra a leitura por uma fonte que o app entrega, porque a lib não importa valor da shared-data.
- Só importa **tipos** de `@uniplus/shared-data`.
- Cada conceito é um entry point secundário, como `@uniplus/shared-inscricao/comprovante`.

## Testes

```bash
npx nx run shared-inscricao:vite:test -- --run
npx nx run shared-inscricao:lint
npx nx run shared-inscricao:build
```
