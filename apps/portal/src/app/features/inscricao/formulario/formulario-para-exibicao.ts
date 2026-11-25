import {
  TipoDeCampoCodigo,
  type FormularioApresentadoDoProcessoDto,
} from '@uniplus/shared-data/selecao';

type Formulario = FormularioApresentadoDoProcessoDto['formulario'];
type Campo = Formulario['coleta']['itens'][number];

const TIPO_DE_CONTROLE: Record<TipoDeCampoCodigo, string> = {
  [TipoDeCampoCodigo.NUMERO]: 'NUMERO',
  [TipoDeCampoCodigo.SIM_OU_NAO]: 'SIM_OU_NAO',
  [TipoDeCampoCodigo.ESCOLHA_UNICA]: 'ESCOLHA_UNICA',
  [TipoDeCampoCodigo.ESCOLHA_MULTIPLA]: 'ESCOLHA_MULTIPLA',
  [TipoDeCampoCodigo.TEXTO]: 'TEXTO',
  [TipoDeCampoCodigo.DATA]: 'DATA',
  [TipoDeCampoCodigo.ENDERECO]: 'ENDERECO',
  [TipoDeCampoCodigo.MUNICIPIO]: 'MUNICIPIO',
};

function campoParaExibicao(campo: Campo) {
  return {
    ...campo,
    apresentacao: {
      ...campo.apresentacao,
      tipoDeCampo: TIPO_DE_CONTROLE[campo.apresentacao.tipoDeCampo],
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
        tipoDeCampo: fato.tipoDeCampo === null ? null : TIPO_DE_CONTROLE[fato.tipoDeCampo],
      })),
    },
  };
}
