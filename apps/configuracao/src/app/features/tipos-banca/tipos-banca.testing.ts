import {
  PapelDaBancaCodigo,
  TipoDeBancaCodigo,
  type TipoBancaDto,
} from '@uniplus/shared-data/configuracao';

const PAPEL_E_MARCAS = {
  papel: { codigo: PapelDaBancaCodigo.AVALIA_O_MERITO, rotulo: 'Avalia o mérito' },
  exigeDuasOuMaisBancas: false,
  encerraRecursoNaPrimeiraInstancia: false,
  tiposDeDecisaoJulgados: [],
};

/** O tipo de banca como a API o devolve, com os campos de papel preenchidos. */
export function tipoDeBanca(
  codigo: TipoDeBancaCodigo = TipoDeBancaCodigo.BANCA_ENTREVISTA,
  parcial: Partial<TipoBancaDto> = {},
): TipoBancaDto {
  return {
    id: '01960000-0000-7000-0000-0000000000b2',
    codigo: { codigo, rotulo: codigo },
    nome: 'Banca de Entrevista',
    faseTipica: 'Avaliação',
    descricao: null,
    ...PAPEL_E_MARCAS,
    criadoEm: '2026-06-10T12:00:00Z',
    ...parcial,
  };
}
