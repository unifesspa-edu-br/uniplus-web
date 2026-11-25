# `@uniplus/shared-data/geo`

Entrypoint público dos clientes e tipos do módulo Geo (resolução de endereço por
CEP e seletor de cidades).

DTOs são tipados a partir de `libs/shared-data/openapi/geo.openapi.json`,
sincronizado do repositório dedicado `unifesspa-geo-api` (ADR-0099 do `uniplus-api`).

Consumido pelo componente de endereço estruturado (`ui-endereco-form`) para
autofill por CEP (`GET /api/cep/{cep}`) e preenchimento manual via seletor de
cidade (`GET /api/cidades`) — ver ADR-0090 (composição no cliente / display
cache) e ADR-0096 (endereço como referência estruturada ao Geo).
