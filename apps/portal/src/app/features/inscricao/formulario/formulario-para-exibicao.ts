import {
  TipoRenderizacaoCodigo,
  type FormularioRenderizavelDto,
} from '@uniplus/shared-data/selecao';

type Formulario = FormularioRenderizavelDto['formulario'];
type Campo = Formulario['coleta']['itens'][number];

const TIPO_DE_CONTROLE: Record<TipoRenderizacaoCodigo, string> = {
  [TipoRenderizacaoCodigo.NUMERO]: 'NUMERO',
  [TipoRenderizacaoCodigo.SIM_OU_NAO]: 'SIM_OU_NAO',
  [TipoRenderizacaoCodigo.ESCOLHA_UNICA]: 'ESCOLHA_UNICA',
  [TipoRenderizacaoCodigo.ESCOLHA_MULTIPLA]: 'ESCOLHA_MULTIPLA',
  [TipoRenderizacaoCodigo.TEXTO]: 'TEXTO',
  [TipoRenderizacaoCodigo.DATA]: 'DATA',
  [TipoRenderizacaoCodigo.ENDERECO]: 'ENDERECO',
  [TipoRenderizacaoCodigo.MUNICIPIO]: 'MUNICIPIO',
};

function campoParaExibicao(campo: Campo) {
  return {
    ...campo,
    apresentacao: {
      ...campo.apresentacao,
      tipoRenderizacao: TIPO_DE_CONTROLE[campo.apresentacao.tipoRenderizacao],
    },
  };
}

function coletaParaExibicao(coleta: Formulario['coleta']) {
  return {
    itens: coleta.itens.map(campoParaExibicao),
    grupos: coleta.grupos.map((grupo) => ({
      ...grupo,
      subitens: grupo.subitens.map(campoParaExibicao),
    })),
  };
}

export function formularioParaExibicao(formulario: Formulario) {
  return {
    ...formulario,
    coleta: coletaParaExibicao(formulario.coleta),
    pressupostos: {
      ...formulario.pressupostos,
      fatos: formulario.pressupostos.fatos.map((fato) => ({
        ...fato,
        tipoRenderizacao:
          fato.tipoRenderizacao === null ? null : TIPO_DE_CONTROLE[fato.tipoRenderizacao],
      })),
    },
  };
}
