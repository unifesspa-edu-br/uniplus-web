import type { TipoBancaDto } from '@uniplus/shared-data/configuracao';
import type { JsonDaApi } from '@uniplus/shared-e2e';

/** O tipo de banca do cadastro como a API o devolve, com o papel de quem avalia o mérito. */
export function tipoDeBancaDoCadastro(
  parcial: Pick<JsonDaApi<TipoBancaDto>, 'id' | 'codigo' | 'nome' | 'faseTipica'>,
): JsonDaApi<TipoBancaDto> {
  return {
    ...parcial,
    descricao: null,
    papel: { codigo: 'AVALIA_O_MERITO', rotulo: 'Avalia o mérito' },
    exigeDuasOuMaisBancas: false,
    encerraRecursoNaPrimeiraInstancia: false,
    tiposDeDecisaoJulgados: [],
    criadoEm: '2026-08-30T12:00:00Z',
  };
}
