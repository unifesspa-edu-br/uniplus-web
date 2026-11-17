import {
  AbrangenciaDaBaseLegal,
  AplicabilidadeDaExigencia,
  OperadorDaCondicao,
  ReferenciaDaIdadeMaxima,
  TipoDeNoDaArvore,
  UnidadeDaIdadeMaxima,
  type DocumentoDaConfiguracao,
} from '@uniplus/shared-data/selecao';

import { documentoSemNada } from './exemplos.testing';

/**
 * Duas exigências, uma árvore com nó de `ordem` fora de sequência e um nó vazio, e os campos que o
 * catálogo preenche, para provar que o que o passo não edita volta intacto.
 */
const EXIGENCIAS_COMPLETAS: DocumentoDaConfiguracao = {
  ...documentoSemNada(),
  documentosExigidos: {
    exigencias: [
      {
        chave: 'documento-de-identificacao',
        tipoDocumentoCodigo: 'DOCUMENTO_IDENTIFICACAO',
        tipoDocumentoNome: 'Documento de identificação',
        tipoDocumentoCategoria: 'IDENTIFICACAO',
        fatosComprovados: ['IDENTIDADE'],
        faseChave: 'inscricao',
        aplicabilidade: AplicabilidadeDaExigencia.Geral,
        obrigatorio: true,
        formatosPermitidos: { qualquer: true },
      },
      {
        chave: 'comprovante-de-renda',
        tipoDocumentoCodigo: 'COMPROVANTE_RENDA',
        faseChave: 'inscricao',
        etapaChave: 'prova',
        aplicabilidade: AplicabilidadeDaExigencia.Condicional,
        condicaoGatilho: [
          [{ fato: 'SOLICITA_ISENCAO', operador: OperadorDaCondicao.IGUAL, valor: true }],
        ],
        basesLegais: [
          { referencia: 'Decreto 6.593/2008', abrangencia: AbrangenciaDaBaseLegal.FEDERAL },
        ],
        idadeMaximaEmissao: {
          valor: 90,
          unidade: UnidadeDaIdadeMaxima.DIAS,
          referenciaTipo: ReferenciaDaIdadeMaxima.FIM_INSCRICAO,
        },
        tamanhoMaximoBytes: 5242880,
      },
    ],
    arvoreDeSatisfacao: [
      {
        ordem: 4,
        tipo: TipoDeNoDaArvore.E,
        filhos: [
          { tipo: TipoDeNoDaArvore.FOLHA, exigenciaChave: 'documento-de-identificacao' },
          {
            ordem: 9,
            tipo: TipoDeNoDaArvore.FOLHA,
            exigenciaChave: 'comprovante-de-renda',
            quantidadeMinima: 2,
          },
        ],
      },
      { tipo: TipoDeNoDaArvore.OU, filhos: [] },
    ],
  },
};

export function umDocumentoComExigencias(): DocumentoDaConfiguracao {
  return structuredClone(EXIGENCIAS_COMPLETAS);
}
