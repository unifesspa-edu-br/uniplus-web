import type { LoteDeNotasDoEnemDto, OcorrenciaDoLoteDto } from '@uniplus/shared-data/selecao';

export const ID_DO_LOTE = '01960000-0000-7000-0000-0000000005dd';

function ocorrencia(
  tipo: OcorrenciaDoLoteDto['tipo'],
  sobrescritas: Partial<OcorrenciaDoLoteDto> = {},
): OcorrenciaDoLoteDto {
  return {
    tipo,
    inscricaoId: null,
    numeroDeInscricao: null,
    numerosDasLinhas: null,
    nomeDoCandidato: null,
    cpfMascarado: null,
    sexo: null,
    ofertas: null,
    ...sobrescritas,
  };
}

const ocorrencias = [
  ocorrencia(
    {
      codigo: 'INSCRITO_SEM_LINHA' as OcorrenciaDoLoteDto['tipo']['codigo'],
      rotulo: 'Inscrito sem linha',
    },
    { numeroDeInscricao: 'INS-0003' },
  ),
  ocorrencia(
    {
      codigo: 'LINHA_SEM_INSCRITO' as OcorrenciaDoLoteDto['tipo']['codigo'],
      rotulo: 'Linha sem inscrito',
    },
    { numerosDasLinhas: [14] },
  ),
];

const dadosDoLote: LoteDeNotasDoEnemDto = {
  id: ID_DO_LOTE,
  edicao: '2025',
  leiauteCodigo: 'RETORNO_20',
  leiauteVersao: '1',
  leiauteHash: 'h'.repeat(64),
  arquivoHash: 'a'.repeat(64),
  importadoPor: 'usuario-opaco',
  importadoPorNome: 'Diogo Bruno Filipe Souza',
  importadoEm: '2026-10-26T12:00:00Z',
  totalDeLinhas: 5,
  totalDeInscritosComNota: 2,
  totalDeLancamentos: 10,
  totalDeInscritosSemLinha: 1,
  totalDeLinhasSemInscrito: 1,
  totalDeInscritosEmConflito: 0,
  totalDeInscritosAusentes: 0,
  vigente: true,
  ausentes: null,
  ocorrencias,
};

export function lote(sobrescritas: Partial<LoteDeNotasDoEnemDto> = {}): LoteDeNotasDoEnemDto {
  return { ...dadosDoLote, ...sobrescritas };
}
