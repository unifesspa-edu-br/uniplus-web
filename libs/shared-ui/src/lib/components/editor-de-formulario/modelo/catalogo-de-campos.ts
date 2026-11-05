import { todosOsCampos } from './citacoes';
import { FINALIDADE_INSCRICAO } from './constantes';
import {
  ConteudoDoFormulario,
  ESCOPO_CANDIDATO,
  ESCOPO_MEMBRO,
  EscopoDoCampo,
  FONTE_GEO_MUNICIPIO,
  FatoDoFormulario,
  MULTIVALORADO,
} from './tipos';

const BINDINGS_DE_CAMPO = ['CAMPO_INSCRICAO:', 'CAMPO_FORMULARIO:'];

/**
 * O tipo de campo do fato, que a API confere contra o domínio e a cardinalidade
 * (`CoerenciaDoCampo`): nulo quando não há campo que o colete — texto, data e endereço só têm
 * resposta única.
 */
export function renderizacaoDe(
  fato: Pick<FatoDoFormulario, 'dominio' | 'cardinalidade' | 'fonteValores'>,
): string | null {
  const multivalorado = fato.cardinalidade === MULTIVALORADO;
  switch (fato.dominio) {
    case 'BOOLEANO':
      return 'BOOLEANO';
    case 'NUMERICO':
      return 'NUMERO';
    case 'TEXTO':
    case 'DATA':
    case 'ENDERECO':
      return multivalorado ? null : fato.dominio;
    case 'CATEGORICO':
      return renderizacaoDoCategorico(fato.fonteValores, multivalorado);
    default:
      return null;
  }
}

function renderizacaoDoCategorico(
  fonteValores: null | string,
  multivalorado: boolean,
): string | null {
  if (fonteValores === FONTE_GEO_MUNICIPIO) return multivalorado ? null : 'MUNICIPIO';
  return multivalorado ? 'SELECAO_MULTIPLA' : 'SELECAO_UNICA';
}

/**
 * Se o fato pode virar campo do formulário: perguntado ao candidato (vínculo de campo), do próprio
 * candidato — o de membro só existe dentro de um grupo — e com um tipo de campo que o colete.
 */
export function ehColetavel(
  fato: FatoDoFormulario,
  escopo: EscopoDoCampo = ESCOPO_CANDIDATO,
): boolean {
  return (
    BINDINGS_DE_CAMPO.some((prefixo) => fato.binding.startsWith(prefixo)) &&
    fato.escopo === escopo &&
    renderizacaoDe(fato) !== null
  );
}

/**
 * Os fatos que o administrador pode acrescentar: os coletáveis ativos que o formulário ainda não
 * tem — um fato aparece uma vez por formulário —, em ordem de nome.
 */
export function fatosParaAcrescentar(
  conteudo: ConteudoDoFormulario,
  catalogo: readonly FatoDoFormulario[],
  escopo: EscopoDoCampo = ESCOPO_CANDIDATO,
  indisponiveis: readonly string[] = [],
): readonly FatoDoFormulario[] {
  // O pressuposto também: o fato vem do formulário anterior ou é coletado aqui, nunca os dois.
  const presentes = new Set([
    ...todosOsCampos(conteudo).map((campo) => campo.fatoCodigo),
    ...(conteudo.pressupostos ?? []),
  ]);
  return catalogo
    .filter(
      (fato) =>
        fato.ativo &&
        ehColetavel(fato, escopo) &&
        !presentes.has(fato.codigo) &&
        !indisponiveis.includes(fato.codigo),
    )
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/**
 * Os fatos que podem ser pressupostos: os coletáveis ativos que o formulário não coleta nem já
 * pressupõe. A inscrição não tem pressuposto — nenhum formulário é respondido antes dela.
 */
export function pressupostosParaAcrescentar(
  conteudo: ConteudoDoFormulario,
  catalogo: readonly FatoDoFormulario[],
  finalidade: string,
): readonly FatoDoFormulario[] {
  if (finalidade === FINALIDADE_INSCRICAO) return [];
  const usados = new Set([
    ...todosOsCampos(conteudo).map((campo) => campo.fatoCodigo),
    ...(conteudo.pressupostos ?? []),
  ]);
  return catalogo
    .filter((fato) => fato.ativo && ehColetavel(fato) && !usados.has(fato.codigo))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/**
 * Os fatos de membro que podem entrar num grupo: os coletáveis de membro que o formulário ainda não
 * tem. O município fica de fora: a UF dele seria a de outro membro.
 */
export function fatosDeMembroParaAcrescentar(
  conteudo: ConteudoDoFormulario,
  catalogo: readonly FatoDoFormulario[],
  indisponiveis: readonly string[] = [],
): readonly FatoDoFormulario[] {
  return fatosParaAcrescentar(conteudo, catalogo, ESCOPO_MEMBRO, indisponiveis).filter(
    (fato) => fato.fonteValores !== FONTE_GEO_MUNICIPIO,
  );
}
