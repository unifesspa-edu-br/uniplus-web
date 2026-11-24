import {
  EfeitoNaAnaliseDoDocumentoCodigo,
  EscolhaDaValidadeCodigo,
  EscolhaDoPrazoDeEmissaoCodigo,
  TipoDaDataDeReferenciaCodigo,
  UnidadeDoPrazoDeEmissaoCodigo,
  type ModeloFormularioView,
} from '@uniplus/shared-data/configuracao';

/** Os requisitos como a leitura os devolve: cada escolha com o código e o rótulo. */
export const REQUISITOS_DO_LAUDO: ModeloFormularioView['conteudo']['conjuntoDeDocumentos']['documentosExigidos'][number]['requisitos'] =
  {
    prazoDeEmissao: {
      escolha: { codigo: EscolhaDoPrazoDeEmissaoCodigo.COM_PRAZO, rotulo: 'Com prazo' },
      valor: 90,
      unidade: { codigo: UnidadeDoPrazoDeEmissaoCodigo.DIAS, rotulo: 'Dias' },
      referencia: {
        tipo: {
          codigo: TipoDaDataDeReferenciaCodigo.FIM_DAS_INSCRICOES,
          rotulo: 'Fim das inscrições',
        },
        faseCodigo: null,
        data: null,
      },
      efeitoForaDoPrazo: {
        codigo: EfeitoNaAnaliseDoDocumentoCodigo.RECUSAR_DOCUMENTO,
        rotulo: 'Recusar documento',
      },
    },
    validade: {
      escolha: {
        codigo: EscolhaDaValidadeCodigo.EXIGE_DOCUMENTO_VALIDO,
        rotulo: 'Exige documento válido',
      },
      referencia: null,
      efeitoDoVencimento: {
        codigo: EfeitoNaAnaliseDoDocumentoCodigo.ACEITAR_COM_AVISO,
        rotulo: 'Aceitar com aviso',
      },
    },
  };
