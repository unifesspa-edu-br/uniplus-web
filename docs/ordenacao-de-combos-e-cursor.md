# Ordenação de combos e tratamento do cursor

Referência para o time de frontend sobre **quais listagens já vêm ordenadas por
nome do servidor** (e não precisam de sort no cliente) e sobre o **contrato do
cursor de paginação** como string opaca.

Contexto: `uniplus-api#700` (PR `uniplus-api#714`) introduziu uma fundação
reutilizável de ordenação **keyset** sob o mesmo cursor opaco (ADR-0094). Estados
e cidades já adotaram ordenação alfabética por nome; o conteúdo interno do cursor
mudou (âncora passou de `Id` para a tupla `(sort key, Id)`), mas o cursor
**continua opaco** (AES-GCM, ADR-0026).

## Ordenação por listagem

| Listagem / combo | Endpoint | Ordem do servidor | Sort client-side? |
|---|---|---|---|
| Estados | `GET /api/estados` | alfabética por nome (ADR-0094) | **Não** — confiar no servidor |
| Cidades | `GET /api/cidades?uf=` | alfabética por nome (ADR-0094) | **Não** |
| Campus | `GET /api/campi` | por `Id` (ainda não-keyset) | Apenas se precisar exibir por nome |
| Local de Oferta | `GET /api/locais-oferta` | por `Id` (ainda não-keyset) | Apenas se precisar exibir por nome |
| Unidade | `GET /api/unidades` | por `Id` (ainda não-keyset) | A árvore ordena por nome no cliente (`montarArvore`) |

**Regra:** quando o backend passar a ordenar uma dessas listagens por nome (via a
fundação keyset, ADR-0094), **remova o sort client-side correspondente** — como
já vale para estados e cidades. Ordenar no cliente só reordena a **janela
paginada atual**, não dá ordem global sob paginação e pode embaralhar a sequência
do cursor.

## Cursor de paginação — string opaca

- O cursor é **AES-GCM opaco** (ADR-0026). O conteúdo interno mudou em
  `uniplus-api#700`, mas o cliente **nunca** o decifra.
- Leia o cursor **somente** do header `Link` (`rel="prev"` / `rel="next"`) via
  `extractPrevCursor` / `extractNextCursor`, e repasse com `cursorToString`
  (`@uniplus/shared-core/http`).
- O tipo `Cursor` é **branded** em compile time — atribuir uma `string` crua
  exige `createCursor(...)`, o que evita parse/comparação acidental com URLs.
- **Não** extraia `Id` do cursor nem assuma seu formato. Navegação bidirecional:
  envie `direction` (`'next'`/`'prev'`) casado ao cursor (ADR-0089).

## Verificação (issues #408 / #409) — estado em 2026-06-23

- **#408 (remover sort client-side de UF/cidade):** não há sort client-side a
  remover. O único seletor de cidade do front (`cfg-endereco-form`,
  `GET /api/cidades`) consome a ordem do servidor diretamente; não existe combo de
  UF/estados no frontend até aqui. A paginação por cursor preserva a ordem do
  servidor (navegação por substituição, ADR-0089/0026).
- **#409 (cursor como string opaca):** confirmado. Nenhum código decodifica,
  parseia ou inspeciona o cursor (sem `atob`/`JSON.parse`/`split`); o tipo
  branded `Cursor` reforça isso em compile time.

## Referências

- `uniplus-api#700` (PR `uniplus-api#714`)
- ADR-0094 (keyset ordenado) · ADR-0089 (navegação bidirecional) · ADR-0026
  (cursor opaco cifrado)
