# E2E da Seleção

## Roteiros da API

Os cenários que usam os roteiros da API exigem o caminho explícito dos arquivos da main da `uniplus-api`:

- `E2E_ROTEIRO_DO_PROCESSO`: caminho para `scripts/roteiro-processo-teste-inscricao.sh`, usado nos cenários de inscrição, projeção e acompanhamento.
- `E2E_ROTEIRO_DAS_NOTAS_DO_ENEM`: caminho para `scripts/roteiro-processo-teste-notas-do-enem.sh`, usado no cenário de notas do ENEM.

`MUNICIPIOS_DE_PROVA` é opcional: contém uma lista JSON de municípios com `codigoIbge` e `uf`, na ordem desejada. As respostas usam o primeiro município; quando vazia ou ausente, a variável usa o padrão do roteiro de inscrição.
