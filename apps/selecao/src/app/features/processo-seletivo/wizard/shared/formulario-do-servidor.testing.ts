import {
  BlocoSistemaCodigo,
  TipoEtapaFormularioCodigo,
  TipoObrigatoriedadeCodigo,
  FinalidadeFormularioCodigo,
  type FatoColetadoDto,
  type FormularioDto,
  TipoRenderizacaoCodigo,
} from '@uniplus/shared-data/selecao';

type EtapaDoServidor = FormularioDto['etapas'][number];

/** A seção ou o bloco como o servidor devolve a etapa de um formulário. */
export function etapaDoServidor(
  codigo: string,
  ordem: number,
  bloco: BlocoSistemaCodigo | null = null,
  titulo: string = codigo,
): EtapaDoServidor {
  return {
    codigo,
    ordem,
    tipo: bloco === null ? TipoEtapaFormularioCodigo.SECAO : TipoEtapaFormularioCodigo.BLOCO,
    bloco,
    apresentacao: { titulo, descricao: null, aviso: null },
    exibicao: null,
  };
}

const SEM_FORMATO_NEM_OPCOES: Pick<FatoColetadoDto, 'regras' | 'formato' | 'opcoes'> = {
  regras: {
    exibicao: null,
    obrigatoriedade: { tipo: TipoObrigatoriedadeCodigo.SEMPRE, predicado: null },
    restricoes: [],
    impedimento: null,
  },
  formato: null,
  opcoes: null,
};

function apresentacaoDoCampo(
  rotulo: string,
  tipoRenderizacao: TipoRenderizacaoCodigo,
): FatoColetadoDto['apresentacao'] {
  return { rotulo, tipoRenderizacao, ajuda: null, pedirConfirmacao: false };
}

/** O campo obrigatório de um fato como o servidor o devolve, sem restrição nem impedimento. */
export function campoDoServidor(
  fatoCodigo: string,
  ordem: number,
  etapaCodigo: string,
  tipoRenderizacao = TipoRenderizacaoCodigo.TEXTO,
): FatoColetadoDto {
  return {
    fatoCodigo,
    ordem,
    etapaCodigo,
    apresentacao: apresentacaoDoCampo(fatoCodigo, tipoRenderizacao),
    ...SEM_FORMATO_NEM_OPCOES,
  };
}

/** O formulário de inscrição de uma fase, sem modelo de origem, termos nem grupos. */
export function formularioDoServidor(extra: Partial<FormularioDto> = {}): FormularioDto {
  return {
    finalidade: { codigo: FinalidadeFormularioCodigo.INSCRICAO, rotulo: 'Inscrição' },
    faseId: null,
    titulo: null,
    modeloOrigem: null,
    etapas: [],
    coleta: { itens: [], grupos: [] },
    termos: [],
    ...extra,
  };
}
