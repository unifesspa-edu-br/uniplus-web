import { todosOsCampos } from './citacoes';
import {
  FINALIDADE_INSCRICAO,
  LIMITES_DO_FORMULARIO,
  REGRAS_INICIAIS,
  apresentacaoDoCampo,
} from './constantes';
import {
  ConteudoDoFormulario,
  ESCOPO_CANDIDATO,
  ESCOPO_MEMBRO,
  EscopoDoCampo,
  FONTE_MUNICIPIOS,
  FatoDoFormulario,
  ItemDoFormulario,
  MULTIVALORADO,
} from './tipos';

const BINDINGS_DE_CAMPO = ['CAMPO_INSCRICAO:', 'CAMPO_FORMULARIO:'];

/**
 * O tipo de campo do fato, que a API confere contra o domínio e a cardinalidade
 * (`CoerenciaDoCampo`): nulo quando não há campo que o colete — texto, data e endereço só têm
 * resposta única.
 */
export function tipoDeCampoDe(
  fato: Pick<FatoDoFormulario, 'dominio' | 'cardinalidade' | 'fonteValores'>,
): string | null {
  const multivalorado = fato.cardinalidade.codigo === MULTIVALORADO;
  if (fato.dominio.codigo === 'OPCAO') {
    return tipoDeCampoDoCategorico(fato.fonteValores?.codigo ?? null, multivalorado);
  }
  return tipoDeCampoDoDominioSimples(fato.dominio.codigo, multivalorado);
}

function tipoDeCampoDoDominioSimples(dominio: string, multivalorado: boolean): string | null {
  switch (dominio) {
    case 'SIM_OU_NAO':
      return 'SIM_OU_NAO';
    case 'NUMERICO':
      return 'NUMERO';
    case 'TEXTO':
    case 'DATA':
    case 'ENDERECO':
      return multivalorado ? null : dominio;
    default:
      return null;
  }
}

function tipoDeCampoDoCategorico(
  fonteValores: null | string,
  multivalorado: boolean,
): string | null {
  if (fonteValores === FONTE_MUNICIPIOS) return multivalorado ? null : 'MUNICIPIO';
  return multivalorado ? 'ESCOLHA_MULTIPLA' : 'ESCOLHA_UNICA';
}

/**
 * O campo novo do fato: obrigatório e sem condição, com o nome do fato como rótulo. O de membro não
 * tem seção própria (`paginaCodigo` nulo): aparece onde o grupo aparece.
 */
export function campoNovo(
  fato: FatoDoFormulario,
  ordem: number,
  paginaCodigo: string | null,
): ItemDoFormulario {
  const rotulo = fato.nome.slice(0, LIMITES_DO_FORMULARIO.rotulo);
  const apresentacao = apresentacaoDoCampo(rotulo, tipoDeCampoDe(fato) ?? '');
  return { fatoCodigo: fato.codigo, ordem, paginaCodigo, apresentacao, regras: REGRAS_INICIAIS };
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
    tipoDeCampoDe(fato) !== null
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
  const presentes = fatosPresentes(conteudo);
  const livre = (fato: FatoDoFormulario): boolean =>
    !presentes.has(fato.codigo) && !indisponiveis.includes(fato.codigo);
  return catalogo
    .filter((fato) => fato.ativo && ehColetavel(fato, escopo) && livre(fato))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

// O pressuposto também: o fato vem do formulário anterior ou é coletado aqui, nunca os dois.
function fatosPresentes(conteudo: ConteudoDoFormulario): ReadonlySet<string> {
  return new Set([
    ...todosOsCampos(conteudo).map((campo) => campo.fatoCodigo),
    ...(conteudo.pressupostos ?? []),
  ]);
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
  const usados = fatosPresentes(conteudo);
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
    (fato) => fato.fonteValores?.codigo !== FONTE_MUNICIPIOS,
  );
}
