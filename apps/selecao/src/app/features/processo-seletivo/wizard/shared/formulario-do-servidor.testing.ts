import {
  BlocoSistemaCodigo,
  TipoPaginaFormularioCodigo,
  TipoObrigatoriedadeCodigo,
  FinalidadeFormularioCodigo,
  type FatoColetadoDto,
  type FormularioDto,
  TipoDeCampoCodigo,
} from '@uniplus/shared-data/selecao';

type PaginaDoServidor = FormularioDto['paginas'][number];

/** A seção ou o bloco como o servidor devolve a página de um formulário. */
export function paginaDoServidor(
  codigo: string,
  ordem: number,
  bloco: BlocoSistemaCodigo | null = null,
  titulo: string = codigo,
): PaginaDoServidor {
  return {
    codigo,
    ordem,
    tipo: bloco === null ? TipoPaginaFormularioCodigo.SECAO : TipoPaginaFormularioCodigo.BLOCO,
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
  tipoDeCampo: TipoDeCampoCodigo,
): FatoColetadoDto['apresentacao'] {
  return { rotulo, tipoDeCampo, ajuda: null, pedirConfirmacao: false };
}

/** O campo obrigatório de um fato como o servidor o devolve, sem restrição nem impedimento. */
export function campoDoServidor(
  fatoCodigo: string,
  ordem: number,
  paginaCodigo: string,
  tipoDeCampo = TipoDeCampoCodigo.TEXTO,
): FatoColetadoDto {
  return {
    fatoCodigo,
    ordem,
    paginaCodigo,
    apresentacao: apresentacaoDoCampo(fatoCodigo, tipoDeCampo),
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
    paginas: [],
    coleta: { itens: [], grupos: [] },
    termos: [],
    ...extra,
  };
}
