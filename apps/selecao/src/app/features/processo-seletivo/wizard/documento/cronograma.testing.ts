import type { DocumentoDaConfiguracao } from '@uniplus/shared-data/selecao';

import { documentoSemNada } from './exemplos.testing';

/**
 * Um cronograma de três fases e duas etapas, com o que as telas não editam (homologação,
 * assinantes, importação, divulgação), para provar que o que a tela não toca volta intacto.
 */
const CRONOGRAMA_COMPLETO: DocumentoDaConfiguracao = {
  ...documentoSemNada(),
  identificacao: {
    nome: 'Processo',
    algoritmoContagemPrazo: { codigo: 'CONTAGEM', versao: 'v1' },
  },
  cronograma: {
    fases: [
      {
        chave: 'inscricao',
        faseCanonicaCodigo: 'INSCRICAO',
        inicio: '2027-01-10T03:00:00Z',
        fim: '2027-01-20T02:59:59Z',
        unidadeResponsavelCodigo: 'CEPS',
        unidadeResponsavelNome: 'Centro de Processos Seletivos',
        unidadeResponsavelSigla: 'CEPS',
      },
      {
        chave: 'avaliacao',
        faseCanonicaCodigo: 'AVALIACAO',
        regraDeHomologacao: { resultadoAtoCodigo: 'RESULTADO', alternativas: [] },
        assinantes: ['0196b3c2-8a10-7c3e-b5d2-6f1e4a9c2d71'],
      },
      {
        chave: 'resultado',
        faseCanonicaCodigo: 'RESULTADO_FINAL',
        faseConcluinteChave: 'avaliacao',
      },
    ],
  },
  etapas: [
    { chave: 'prova', nome: 'Prova', ordem: 1, faseChave: 'avaliacao', peso: 1 },
    { chave: 'redacao', nome: 'Redação', ordem: 2, faseChave: 'avaliacao', peso: 2 },
  ],
  importacao: { primeiraFaseDepoisDaImportacaoChave: 'resultado' },
  provaPresencial: { temProvaPresencial: false },
  divulgacao: { justificativa: 'Texto' },
  coleta: {
    regrasDerivacao: [
      { fatoCodigo: 'FAIXA', regras: [{ ordem: 0, contribui: 'A', quando: null }] },
    ],
  },
};

export function umCronogramaCompleto(): DocumentoDaConfiguracao {
  return structuredClone(CRONOGRAMA_COMPLETO);
}
