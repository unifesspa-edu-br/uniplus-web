import type { FatoColetadoDto } from '@uniplus/shared-data/selecao';
import type { JsonDaApi } from '@uniplus/shared-e2e';

export type CampoColetado = JsonDaApi<FatoColetadoDto>;

/** O que varia entre os campos das fixtures; o resto vai na forma do contrato, sem regra nem ajuda. */
export interface DadosDoCampo {
  readonly fatoCodigo: string;
  readonly ordem: number;
  readonly rotulo: string;
  readonly tipoDeCampo: CampoColetado['apresentacao']['tipoDeCampo'];
  readonly paginaCodigo?: string;
  readonly obrigatoriedade?: CampoColetado['regras']['obrigatoriedade'];
  readonly ajuda?: string;
  readonly restricoes?: CampoColetado['regras']['restricoes'];
}

function apresentacaoDoCampo(dados: DadosDoCampo): CampoColetado['apresentacao'] {
  const { rotulo, tipoDeCampo, ajuda = null } = dados;
  return { rotulo, tipoDeCampo, ajuda, pedirConfirmacao: false };
}

function regrasDoCampo(dados: DadosDoCampo): CampoColetado['regras'] {
  return {
    exibicao: null,
    obrigatoriedade: dados.obrigatoriedade ?? { tipo: 'SEMPRE', predicado: null },
    restricoes: dados.restricoes ?? [],
    impedimento: null,
  };
}

/** O campo coletado do formulário como o detalhe do processo o devolve: apresentação e regras agrupadas. */
export function campoColetado(dados: DadosDoCampo): CampoColetado {
  return {
    fatoCodigo: dados.fatoCodigo,
    ordem: dados.ordem,
    paginaCodigo: dados.paginaCodigo ?? 'SECAO_1',
    apresentacao: apresentacaoDoCampo(dados),
    regras: regrasDoCampo(dados),
    formato: null,
    opcoes: null,
  };
}
