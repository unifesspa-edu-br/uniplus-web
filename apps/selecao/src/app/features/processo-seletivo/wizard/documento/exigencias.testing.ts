import {
  AbrangenciaDaBaseLegal,
  AplicabilidadeDaExigencia,
  OperadorDaCondicao,
  ReferenciaDaIdadeMaxima,
  FormaDeComprovacaoDaConfiguracao,
  UnidadeDaIdadeMaxima,
  type DocumentoDaConfiguracao,
} from '@uniplus/shared-data/selecao';

import { documentoSemNada } from './exemplos.testing';

/**
 * Duas exigências, regras com documentos e um grupo vazio, e os campos que o
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
    regrasDeComprovacao: [
      {
        forma: FormaDeComprovacaoDaConfiguracao.TODOS_OS_ITENS,
        itens: [
          {
            forma: FormaDeComprovacaoDaConfiguracao.DOCUMENTO,
            exigenciaChave: 'documento-de-identificacao',
          },
          {
            forma: FormaDeComprovacaoDaConfiguracao.DOCUMENTO,
            exigenciaChave: 'comprovante-de-renda',
            quantidadeMinima: 2,
          },
        ],
      },
      { forma: FormaDeComprovacaoDaConfiguracao.QUANTIDADE_MINIMA_DE_ITENS, itens: [] },
    ],
  },
};

export function umDocumentoComExigencias(): DocumentoDaConfiguracao {
  return structuredClone(EXIGENCIAS_COMPLETAS);
}
