import {
  OPERADOR_DIFERENTE,
  OPERADOR_NAO_EM,
  type CondicaoNoWire,
  type FatoDoCatalogo,
} from '../editor-de-condicoes/condicoes-de-fatos';

/**
 * O conteúdo de um formulário — o do modelo, na Configuração, e o do processo, na Seleção — na
 * forma das entradas da API (ADR-0136). Os tipos são estruturais: os DTOs gerados satisfazem esta
 * forma, nos dois sentidos, sem que a biblioteca dependa deles.
 *
 * A gravação substitui o conteúdo inteiro, então o que o editor não edita viaja como veio: as
 * funções daqui copiam o item com `...item` e só trocam o que a edição muda.
 *
 * O que as funções espelham da API — a ordem global, a citação só de fato anterior, o campo que
 * precisa ser obrigatório sempre — evita oferecer o que seria recusado. A API continua a
 * autoridade: confere tudo de novo, e a recusa dela aparece no item ou no resumo.
 */

/** Um predicado em forma normal disjuntiva: as cláusulas valem por OU, as condições de cada uma por E. */
export type PredicadoNoWire = readonly (readonly CondicaoNoWire[])[] | null;

export interface OpcoesCondicionadas {
  readonly quando: PredicadoNoWire;
  readonly valores: readonly string[];
}

export interface RestricaoDeValor {
  readonly tipo: string;
  readonly minimo?: null | number | string;
  readonly maximo?: null | number | string;
  readonly entradas?: null | readonly OpcoesCondicionadas[];
  readonly fatos?: null | readonly string[];
}

export interface Impedimento {
  readonly quando: PredicadoNoWire;
  readonly mensagem: null | string;
}

export interface ItemDoFormulario {
  readonly fatoCodigo: string;
  readonly ordem: number | string;
  readonly rotulo: string;
  readonly tipoRenderizacao: string;
  readonly obrigatoriedade: null | string;
  /** A exibição do item: ele só aparece quando o predicado vale. */
  readonly precondicao: PredicadoNoWire;
  readonly etapaCodigo?: null | string;
  readonly predicadoObrigatoriedade?: PredicadoNoWire;
  readonly ajuda?: null | string;
  readonly pedirConfirmacao: boolean;
  readonly restricoes?: null | readonly RestricaoDeValor[];
  readonly impedimento?: null | Impedimento;
}

export interface EtapaDoFormulario {
  readonly codigo: string;
  readonly ordem: number | string;
  readonly tipo: string;
  readonly bloco: null | string;
  readonly titulo: string;
  readonly descricao: null | string;
  readonly aviso: null | string;
  readonly exibicao?: PredicadoNoWire;
}

export interface GrupoDoFormulario {
  readonly codigo: string;
  readonly ordem: number | string;
  readonly rotulo: string;
  readonly etapaCodigo: null | string;
  readonly minimo: number | string;
  readonly maximo: null | number | string;
  readonly exibicao: PredicadoNoWire;
  readonly obrigatoriedade: null | string;
  readonly predicadoObrigatoriedade: PredicadoNoWire;
  readonly subitens: readonly ItemDoFormulario[];
  readonly incluiCandidato: boolean;
}

export interface TermoDoFormulario {
  readonly codigo: string;
  readonly ordem: number | string;
  readonly termoId: string;
  readonly versaoId: string;
  readonly exibicao: PredicadoNoWire;
  readonly obrigatoriedade: string;
  readonly predicadoObrigatoriedade: PredicadoNoWire;
}

export interface ConteudoDoFormulario {
  readonly titulo: null | string;
  readonly etapas: null | readonly EtapaDoFormulario[];
  readonly itens: null | readonly ItemDoFormulario[];
  readonly termos: null | readonly TermoDoFormulario[];
  readonly pressupostos: null | readonly string[];
  readonly grupos?: null | readonly GrupoDoFormulario[];
}

/** O que o editor precisa saber de um fato do catálogo para oferecê-lo como campo. */
export interface FatoDoFormulario extends FatoDoCatalogo {
  readonly cardinalidade: string;
  readonly fonteValores: null | string;
  readonly escopo: string;
  readonly ativo: boolean;
}

/** Um termo de consentimento que o formulário pode exigir, com as versões promovidas — a mais nova primeiro. */
export interface TermoDisponivel {
  readonly termoId: string;
  readonly nome: string;
  readonly versoes: readonly { readonly versaoId: string; readonly rotulo: string }[];
}

/** O desfecho de uma edição que a tela pode recusar: o conteúdo novo, ou o motivo da recusa. */
export type ResultadoDaEdicao =
  | { readonly ok: true; readonly conteudo: ConteudoDoFormulario }
  | { readonly ok: false; readonly recusa: string };

export const TIPO_SECAO = 'SECAO';
export const TIPO_BLOCO = 'BLOCO';
export const OBRIGATORIEDADE_SEMPRE = 'SEMPRE';
export const OBRIGATORIEDADE_NUNCA = 'NUNCA';
export const OBRIGATORIEDADE_QUANDO = 'QUANDO';

/** A seção dos dados básicos da inscrição: a API a acrescenta e não deixa alterá-la. */
export const SECAO_DADOS_BASICOS = 'DADOS_BASICOS';
export const BLOCO_REVISAO_E_ACEITE = 'REVISAO_E_ACEITE';
export const BLOCO_COMPROVACAO_DOCUMENTAL = 'COMPROVACAO_DOCUMENTAL';
export const BLOCO_MODALIDADES_CALCULADAS = 'MODALIDADES_CALCULADAS';

export const FINALIDADE_INSCRICAO = 'INSCRICAO';

/** Os tetos da API (`FormaDoItem`, `FormaDaEtapa`): os dados básicos contam no total de itens. */
export const LIMITES_DO_FORMULARIO = {
  itens: 200,
  rotulo: 300,
  ajuda: 1000,
  tituloDaEtapa: 300,
  textoDaEtapa: 2000,
  tituloDoFormulario: 300,
} as const;

export interface OpcaoDoFormulario {
  readonly valor: string;
  readonly rotulo: string;
}

export const FINALIDADES: readonly OpcaoDoFormulario[] = [
  { valor: FINALIDADE_INSCRICAO, rotulo: 'Inscrição' },
  { valor: 'ISENCAO_TAXA', rotulo: 'Isenção da taxa de inscrição' },
  { valor: 'HABILITACAO', rotulo: 'Habilitação' },
];

export const OBRIGATORIEDADES: readonly OpcaoDoFormulario[] = [
  { valor: OBRIGATORIEDADE_SEMPRE, rotulo: 'Obrigatório' },
  { valor: OBRIGATORIEDADE_NUNCA, rotulo: 'Opcional' },
  { valor: OBRIGATORIEDADE_QUANDO, rotulo: 'Obrigatório conforme respostas anteriores' },
];

export const BLOCOS: readonly OpcaoDoFormulario[] = [
  { valor: BLOCO_COMPROVACAO_DOCUMENTAL, rotulo: 'Comprovação documental' },
  { valor: BLOCO_MODALIDADES_CALCULADAS, rotulo: 'Modalidades calculadas' },
  { valor: BLOCO_REVISAO_E_ACEITE, rotulo: 'Revisão e aceite' },
];

/** Os blocos que a finalidade admite: as modalidades calculadas só fazem sentido na inscrição. */
export function blocosAdmitidos(finalidade: string): readonly OpcaoDoFormulario[] {
  return BLOCOS.filter((bloco) => bloco.valor !== BLOCO_MODALIDADES_CALCULADAS || finalidade === FINALIDADE_INSCRICAO);
}

/**
 * O conteúdo com que um formulário nasce: só a revisão e aceite, que toda finalidade exige como
 * última etapa. Na inscrição, a API acrescenta a seção dos dados básicos.
 */
export function conteudoInicial(): ConteudoDoFormulario {
  return {
    titulo: null,
    etapas: [
      {
        codigo: BLOCO_REVISAO_E_ACEITE,
        ordem: 0,
        tipo: TIPO_BLOCO,
        bloco: BLOCO_REVISAO_E_ACEITE,
        titulo: 'Revisão e aceite',
        descricao: null,
        aviso: null,
        exibicao: null,
      },
    ],
    itens: [],
    termos: [],
    pressupostos: [],
    grupos: [],
  };
}

const BINDINGS_DE_CAMPO = ['CAMPO_INSCRICAO:', 'CAMPO_FORMULARIO:'];
const FONTE_GEO_MUNICIPIO = 'GEO_MUNICIPIO';
const FONTE_GEO_UF = 'GEO_UF';
const MULTIVALORADO = 'MULTIVALORADO';

/**
 * O tipo de campo do fato, que a API confere contra o domínio e a cardinalidade
 * (`CoerenciaDoCampo`): nulo quando não há campo que o colete — texto, data e endereço só têm
 * resposta única.
 */
export function renderizacaoDe(fato: Pick<FatoDoFormulario, 'dominio' | 'cardinalidade' | 'fonteValores'>): string | null {
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
      if (fato.fonteValores === FONTE_GEO_MUNICIPIO) return multivalorado ? null : 'MUNICIPIO';
      return multivalorado ? 'SELECAO_MULTIPLA' : 'SELECAO_UNICA';
    default:
      return null;
  }
}

/**
 * Se o fato pode virar campo do formulário: perguntado ao candidato (vínculo de campo), do próprio
 * candidato — o de membro só existe dentro de um grupo — e com um tipo de campo que o colete.
 */
export function ehColetavel(fato: FatoDoFormulario): boolean {
  return (
    BINDINGS_DE_CAMPO.some((prefixo) => fato.binding.startsWith(prefixo)) &&
    fato.escopo === 'CANDIDATO' &&
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
): readonly FatoDoFormulario[] {
  // O pressuposto também: o fato vem do formulário anterior ou é coletado aqui, nunca os dois.
  const presentes = new Set([...todosOsCampos(conteudo).map((campo) => campo.fatoCodigo), ...(conteudo.pressupostos ?? [])]);
  return catalogo
    .filter((fato) => fato.ativo && ehColetavel(fato) && !presentes.has(fato.codigo))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** As etapas em ordem. */
export function etapasEmOrdem(conteudo: ConteudoDoFormulario): readonly EtapaDoFormulario[] {
  return [...(conteudo.etapas ?? [])].sort((a, b) => Number(a.ordem) - Number(b.ordem));
}

/** Um item ou um grupo de uma seção, na posição que ocupa nela. */
export type EntradaDaSecao =
  | { readonly tipo: 'item'; readonly item: ItemDoFormulario }
  | { readonly tipo: 'grupo'; readonly grupo: GrupoDoFormulario };

/** Os itens e os grupos de uma seção, em ordem: a numeração é uma só para os dois. */
export function entradasDaSecao(conteudo: ConteudoDoFormulario, etapaCodigo: string): readonly EntradaDaSecao[] {
  const itens: EntradaDaSecao[] = (conteudo.itens ?? [])
    .filter((item) => item.etapaCodigo === etapaCodigo)
    .map((item) => ({ tipo: 'item', item }));
  const grupos: EntradaDaSecao[] = (conteudo.grupos ?? [])
    .filter((grupo) => grupo.etapaCodigo === etapaCodigo)
    .map((grupo) => ({ tipo: 'grupo', grupo }));
  return [...itens, ...grupos].sort((a, b) => ordemDa(a) - ordemDa(b));
}

/**
 * Numera de novo, sem buracos: as etapas pela posição, e os itens e grupos numa ordem única que
 * acompanha a das seções — a API recusa item de seção posterior antes de item de seção anterior.
 */
export function renumerar(conteudo: ConteudoDoFormulario): ConteudoDoFormulario {
  const etapas = etapasEmOrdem(conteudo);
  const ordemDoItem = new Map<string, number>();
  const ordemDoGrupo = new Map<string, number>();
  let proxima = 0;
  for (const etapa of etapas) {
    for (const entrada of entradasDaSecao(conteudo, etapa.codigo)) {
      if (entrada.tipo === 'item') ordemDoItem.set(entrada.item.fatoCodigo, proxima++);
      else ordemDoGrupo.set(entrada.grupo.codigo, proxima++);
    }
  }

  return {
    ...conteudo,
    etapas: etapas.map((etapa, indice) => ({ ...etapa, ordem: indice })),
    itens: (conteudo.itens ?? []).map((item) => ({ ...item, ordem: ordemDoItem.get(item.fatoCodigo) ?? proxima++ })),
    grupos: (conteudo.grupos ?? []).map((grupo) => ({ ...grupo, ordem: ordemDoGrupo.get(grupo.codigo) ?? proxima++ })),
  };
}

/** O item novo do fato, no fim da seção: obrigatório e sem condição, com o nome do fato como rótulo. */
export function acrescentarItem(
  conteudo: ConteudoDoFormulario,
  fato: FatoDoFormulario,
  etapaCodigo: string,
): ConteudoDoFormulario {
  const ultima = entradasDaSecao(conteudo, etapaCodigo).at(-1);
  const etapa = (conteudo.etapas ?? []).find((e) => e.codigo === etapaCodigo);
  const novo: ItemDoFormulario = {
    fatoCodigo: fato.codigo,
    // Logo depois da última entrada da seção — ou no começo dela, se vazia —; a renumeração fecha o buraco.
    ordem: ultima !== undefined ? ordemDa(ultima) + 0.5 : primeiraOrdemDaEtapa(conteudo, Number(etapa?.ordem ?? 0)) - 0.5,
    rotulo: fato.nome.slice(0, LIMITES_DO_FORMULARIO.rotulo),
    tipoRenderizacao: renderizacaoDe(fato) ?? '',
    obrigatoriedade: OBRIGATORIEDADE_SEMPRE,
    precondicao: null,
    etapaCodigo,
    predicadoObrigatoriedade: null,
    ajuda: null,
    pedirConfirmacao: false,
  };
  return renumerar({ ...conteudo, itens: [...(conteudo.itens ?? []), novo] });
}

/**
 * Acrescenta o campo do fato no fim da seção. O de município nasce restrito aos municípios da UF
 * respondida no campo de UF anterior mais próximo: a API recusa município sem a UF, e sem campo de
 * UF antes a tela recusa o acréscimo, em vez de criar um campo que não se grava.
 */
export function acrescentarCampo(
  conteudo: ConteudoDoFormulario,
  fato: FatoDoFormulario,
  etapaCodigo: string,
  catalogo: readonly FatoDoFormulario[],
): ResultadoDaEdicao {
  const comCampo = acrescentarItem(conteudo, fato, etapaCodigo);
  if (fato.fonteValores !== FONTE_GEO_MUNICIPIO) return { ok: true, conteudo: comCampo };

  const uf = ufsAnteriores(comCampo, catalogo, fato.codigo).at(-1);
  if (uf === undefined) {
    return { ok: false, recusa: `Acrescente antes o campo de UF: “${fato.nome}” escolhe entre os municípios da UF respondida antes.` };
  }
  const item = (comCampo.itens ?? []).find((i) => i.fatoCodigo === fato.codigo) as ItemDoFormulario;
  return { ok: true, conteudo: comItem(comCampo, { ...item, restricoes: [{ tipo: RESTRICAO_MUNICIPIOS_DA_UF, fatos: [uf.codigo] }] }) };
}

/**
 * Os campos de UF anteriores ao campo dado, do mais antigo ao mais próximo: o município cita a UF
 * respondida antes, de resposta única e com a lista de UFs do Geo.
 */
export function ufsAnteriores(
  conteudo: ConteudoDoFormulario,
  catalogo: readonly FatoDoFormulario[],
  fatoCodigo: string,
): readonly FatoDoFormulario[] {
  const ordem = Number((conteudo.itens ?? []).find((item) => item.fatoCodigo === fatoCodigo)?.ordem ?? Infinity);
  const porCodigo = new Map(catalogo.map((fato) => [fato.codigo, fato]));
  return [...(conteudo.itens ?? [])]
    .filter((item) => Number(item.ordem) < ordem)
    .sort((a, b) => Number(a.ordem) - Number(b.ordem))
    .flatMap((item) => {
      const fato = porCodigo.get(item.fatoCodigo);
      return fato?.fonteValores === FONTE_GEO_UF && fato.cardinalidade !== MULTIVALORADO ? [fato] : [];
    });
}

/** Troca o item pelo editado, sem mexer na ordem. */
export function comItem(conteudo: ConteudoDoFormulario, editado: ItemDoFormulario): ConteudoDoFormulario {
  return {
    ...conteudo,
    itens: (conteudo.itens ?? []).map((item) => (item.fatoCodigo === editado.fatoCodigo ? editado : item)),
  };
}

/** Troca a etapa pela editada, sem mexer na ordem. */
export function comEtapa(conteudo: ConteudoDoFormulario, editada: EtapaDoFormulario): ConteudoDoFormulario {
  return {
    ...conteudo,
    etapas: (conteudo.etapas ?? []).map((etapa) => (etapa.codigo === editada.codigo ? editada : etapa)),
  };
}

/** Uma seção nova, vazia, logo antes da revisão e aceite — que é sempre a última etapa. */
export function acrescentarSecao(conteudo: ConteudoDoFormulario, titulo: string): ConteudoDoFormulario {
  const codigos = new Set((conteudo.etapas ?? []).map((etapa) => etapa.codigo));
  let numero = 1;
  while (codigos.has(`SECAO_${numero}`)) numero++;
  return acrescentarEtapaAntesDaRevisao(conteudo, {
    codigo: `SECAO_${numero}`,
    ordem: 0,
    tipo: TIPO_SECAO,
    bloco: null,
    titulo,
    descricao: null,
    aviso: null,
    exibicao: null,
  });
}

/** Um bloco do sistema, logo antes da revisão e aceite. O código do bloco é o próprio token. */
export function acrescentarBloco(conteudo: ConteudoDoFormulario, bloco: OpcaoDoFormulario): ConteudoDoFormulario {
  return acrescentarEtapaAntesDaRevisao(conteudo, {
    codigo: bloco.valor,
    ordem: 0,
    tipo: TIPO_BLOCO,
    bloco: bloco.valor,
    titulo: bloco.rotulo,
    descricao: null,
    aviso: null,
    exibicao: null,
  });
}

/** Se a etapa fica onde está: os dados básicos abrem o formulário, e a revisão e aceite o fecha. */
export function etapaFixa(etapa: Pick<EtapaDoFormulario, 'codigo' | 'bloco'>): boolean {
  return etapa.codigo === SECAO_DADOS_BASICOS || etapa.bloco === BLOCO_REVISAO_E_ACEITE;
}

/** Se a etapa pode trocar de lugar com a vizinha na direção dada. */
export function podeMoverEtapa(conteudo: ConteudoDoFormulario, codigo: string, direcao: -1 | 1): boolean {
  const etapas = etapasEmOrdem(conteudo);
  const indice = etapas.findIndex((etapa) => etapa.codigo === codigo);
  const vizinha = etapas[indice + direcao];
  return indice >= 0 && vizinha !== undefined && !etapaFixa(etapas[indice]) && !etapaFixa(vizinha);
}

/**
 * Troca a etapa de lugar com a vizinha, levando os itens dela junto. Recusa o movimento que põe
 * um item antes de um fato que ele cita.
 */
export function moverEtapa(
  conteudo: ConteudoDoFormulario,
  codigo: string,
  direcao: -1 | 1,
  nomes: ReadonlyMap<string, string>,
): ResultadoDaEdicao {
  if (!podeMoverEtapa(conteudo, codigo, direcao)) return { ok: false, recusa: 'A etapa não pode ir nessa direção.' };
  const etapas = etapasEmOrdem(conteudo);
  const indice = etapas.findIndex((etapa) => etapa.codigo === codigo);
  const atual = etapas[indice];
  const vizinha = etapas[indice + direcao];
  const trocado = renumerar({
    ...conteudo,
    etapas: (conteudo.etapas ?? []).map((etapa) =>
      etapa.codigo === atual.codigo ? { ...etapa, ordem: vizinha.ordem } : etapa.codigo === vizinha.codigo ? { ...etapa, ordem: atual.ordem } : etapa,
    ),
  });
  return conferirOrdem(trocado, nomes);
}

/** Se o item pode trocar de lugar com a entrada vizinha da mesma seção. */
export function podeMoverItem(conteudo: ConteudoDoFormulario, fatoCodigo: string, direcao: -1 | 1): boolean {
  const item = (conteudo.itens ?? []).find((i) => i.fatoCodigo === fatoCodigo);
  if (item?.etapaCodigo == null || item.etapaCodigo === SECAO_DADOS_BASICOS) return false;
  const entradas = entradasDaSecao(conteudo, item.etapaCodigo);
  const indice = entradas.findIndex((e) => e.tipo === 'item' && e.item.fatoCodigo === fatoCodigo);
  return entradas[indice + direcao] !== undefined;
}

/**
 * Troca o item de lugar com a entrada vizinha da seção. Recusa o movimento que põe o item antes de
 * um fato que ele cita, ou que passa para depois dele um item que o cita.
 */
export function moverItem(
  conteudo: ConteudoDoFormulario,
  fatoCodigo: string,
  direcao: -1 | 1,
  nomes: ReadonlyMap<string, string>,
): ResultadoDaEdicao {
  if (!podeMoverItem(conteudo, fatoCodigo, direcao)) return { ok: false, recusa: 'O campo não pode ir nessa direção.' };
  const item = (conteudo.itens ?? []).find((i) => i.fatoCodigo === fatoCodigo) as ItemDoFormulario;
  const entradas = entradasDaSecao(conteudo, item.etapaCodigo as string);
  const indice = entradas.findIndex((e) => e.tipo === 'item' && e.item.fatoCodigo === fatoCodigo);
  const vizinha = entradas[indice + direcao];
  const ordemDoItem = item.ordem;
  const ordemDaVizinha = vizinha.tipo === 'item' ? vizinha.item.ordem : vizinha.grupo.ordem;

  const trocado = renumerar({
    ...conteudo,
    itens: (conteudo.itens ?? []).map((i) =>
      i.fatoCodigo === fatoCodigo
        ? { ...i, ordem: ordemDaVizinha }
        : vizinha.tipo === 'item' && i.fatoCodigo === vizinha.item.fatoCodigo
          ? { ...i, ordem: ordemDoItem }
          : i,
    ),
    grupos: (conteudo.grupos ?? []).map((g) =>
      vizinha.tipo === 'grupo' && g.codigo === vizinha.grupo.codigo ? { ...g, ordem: ordemDoItem } : g,
    ),
  });
  return conferirOrdem(trocado, nomes);
}

/**
 * Remove o item. Recusa quando outra regra do formulário cita o fato dele: a condição ficaria
 * citando fato que o formulário não coleta.
 */
export function removerItem(
  conteudo: ConteudoDoFormulario,
  fatoCodigo: string,
  nomes: ReadonlyMap<string, string>,
): ResultadoDaEdicao {
  const quem = quemCita(conteudo, fatoCodigo).find((citante) => citante.fatoCodigo !== fatoCodigo);
  if (quem !== undefined) {
    return { ok: false, recusa: `Não é possível remover “${nome(nomes, fatoCodigo)}”: ${quem.descricao} cita esse campo.` };
  }
  return { ok: true, conteudo: renumerar({ ...conteudo, itens: (conteudo.itens ?? []).filter((i) => i.fatoCodigo !== fatoCodigo) }) };
}

/** Remove a etapa. A seção com itens não sai: os itens ficariam sem seção. */
export function removerEtapa(conteudo: ConteudoDoFormulario, codigo: string): ResultadoDaEdicao {
  const etapa = (conteudo.etapas ?? []).find((e) => e.codigo === codigo);
  if (etapa === undefined || etapaFixa(etapa)) return { ok: false, recusa: 'Esta etapa não pode ser removida.' };
  if (entradasDaSecao(conteudo, codigo).length > 0) {
    return { ok: false, recusa: `Remova ou mova os campos de “${etapa.titulo}” antes de remover a seção.` };
  }
  return { ok: true, conteudo: renumerar({ ...conteudo, etapas: (conteudo.etapas ?? []).filter((e) => e.codigo !== codigo) }) };
}

/**
 * Os fatos que as condições de um item podem citar: os dos itens anteriores a ele — os dados
 * básicos inclusive — e os pressupostos, nunca o próprio. Uma condição sobre fato posterior
 * dependeria de resposta que o candidato ainda não deu.
 */
export function fatosCitaveisPeloItem(conteudo: ConteudoDoFormulario, fatoCodigo: string): ReadonlySet<string> {
  const item = (conteudo.itens ?? []).find((i) => i.fatoCodigo === fatoCodigo);
  const limite = item === undefined ? -Infinity : Number(item.ordem);
  return citaveisAntesDe(conteudo, limite, fatoCodigo);
}

/** Os fatos que a exibição de uma seção pode citar: os das seções anteriores e os pressupostos. */
export function fatosCitaveisPelaSecao(conteudo: ConteudoDoFormulario, etapaCodigo: string): ReadonlySet<string> {
  const etapa = (conteudo.etapas ?? []).find((e) => e.codigo === etapaCodigo);
  const limite = etapa === undefined ? -Infinity : primeiraOrdemDaEtapa(conteudo, Number(etapa.ordem));
  return citaveisAntesDe(conteudo, limite, null);
}

/**
 * Os fatos cujo campo precisa ser obrigatório sempre: o citado por negação (`DIFERENTE`, `NAO_EM`)
 * em qualquer regra, e o que tem impedimento. Sem resposta, todo operador dá falso, e a negação ou
 * o impedimento dariam resultado que o candidato não declarou (UNI-REQ-0074).
 */
export function fatosQueExigemResposta(conteudo: ConteudoDoFormulario): ReadonlySet<string> {
  const fatos = new Set<string>();
  for (const predicado of todosOsPredicados(conteudo)) {
    for (const condicao of (predicado ?? []).flat()) {
      if (condicao.operador === OPERADOR_DIFERENTE || condicao.operador === OPERADOR_NAO_EM) fatos.add(condicao.fato);
    }
  }
  for (const campo of todosOsCampos(conteudo)) {
    if (campo.impedimento != null) fatos.add(campo.fatoCodigo);
  }
  return fatos;
}

/**
 * Os fatos que um termo pode citar: todos os campos do formulário e os pressupostos — o termo é
 * aceito na revisão e aceite, depois de tudo respondido.
 */
export function fatosCitaveisPelosTermos(conteudo: ConteudoDoFormulario): ReadonlySet<string> {
  return citaveisAntesDe(conteudo, Infinity, null);
}

/** Os termos em ordem. */
export function termosEmOrdem(conteudo: ConteudoDoFormulario): readonly TermoDoFormulario[] {
  return [...(conteudo.termos ?? [])].sort((a, b) => Number(a.ordem) - Number(b.ordem));
}

/** Os termos que ainda podem ser exigidos: os que têm versão promovida e o formulário não exige. */
export function termosParaAcrescentar(
  conteudo: ConteudoDoFormulario,
  disponiveis: readonly TermoDisponivel[],
): readonly TermoDisponivel[] {
  const exigidos = new Set((conteudo.termos ?? []).map((termo) => termo.termoId));
  return disponiveis.filter((termo) => termo.versoes.length > 0 && !exigidos.has(termo.termoId));
}

/**
 * Exige o termo na versão mais nova, com aceite obrigatório, depois dos demais. O código do termo no
 * formulário vem do nome, em caixa alta e sem acento, e não repete o de outro termo.
 */
export function acrescentarTermo(conteudo: ConteudoDoFormulario, termo: TermoDisponivel): ConteudoDoFormulario {
  const termos = termosEmOrdem(conteudo);
  const novo: TermoDoFormulario = {
    codigo: codigoLivre(codigoDoNome(termo.nome), new Set(termos.map((t) => t.codigo))),
    // Depois da maior ordem gravada: a gravada pode ter buraco, e ordem repetida é recusada.
    ordem: Math.max(-1, ...termos.map((t) => Number(t.ordem))) + 1,
    termoId: termo.termoId,
    versaoId: termo.versoes[0]?.versaoId ?? '',
    exibicao: null,
    obrigatoriedade: OBRIGATORIEDADE_SEMPRE,
    predicadoObrigatoriedade: null,
  };
  return { ...conteudo, termos: [...termos, novo] };
}

/** Troca o termo pelo editado, sem mexer na ordem. */
export function comTermo(conteudo: ConteudoDoFormulario, editado: TermoDoFormulario): ConteudoDoFormulario {
  return { ...conteudo, termos: (conteudo.termos ?? []).map((termo) => (termo.codigo === editado.codigo ? editado : termo)) };
}

/** Troca o termo de lugar com o vizinho; a ordem dos termos não depende de citação. */
export function moverTermo(conteudo: ConteudoDoFormulario, codigo: string, direcao: -1 | 1): ConteudoDoFormulario {
  const termos = [...termosEmOrdem(conteudo)];
  const indice = termos.findIndex((termo) => termo.codigo === codigo);
  const alvo = indice + direcao;
  if (indice < 0 || alvo < 0 || alvo >= termos.length) return conteudo;
  [termos[indice], termos[alvo]] = [termos[alvo], termos[indice]];
  return { ...conteudo, termos: termos.map((termo, posicao) => ({ ...termo, ordem: posicao })) };
}

export function removerTermo(conteudo: ConteudoDoFormulario, codigo: string): ConteudoDoFormulario {
  return {
    ...conteudo,
    termos: termosEmOrdem(conteudo)
      .filter((termo) => termo.codigo !== codigo)
      .map((termo, posicao) => ({ ...termo, ordem: posicao })),
  };
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
  const usados = new Set([...todosOsCampos(conteudo).map((campo) => campo.fatoCodigo), ...(conteudo.pressupostos ?? [])]);
  return catalogo
    .filter((fato) => fato.ativo && ehColetavel(fato) && !usados.has(fato.codigo))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function acrescentarPressuposto(conteudo: ConteudoDoFormulario, fatoCodigo: string): ConteudoDoFormulario {
  return { ...conteudo, pressupostos: [...(conteudo.pressupostos ?? []), fatoCodigo] };
}

/** Remove o pressuposto. Recusa quando uma regra o cita: a condição ficaria sobre fato desconhecido. */
export function removerPressuposto(
  conteudo: ConteudoDoFormulario,
  fatoCodigo: string,
  nomes: ReadonlyMap<string, string>,
): ResultadoDaEdicao {
  const quem = quemCita(conteudo, fatoCodigo)[0];
  if (quem !== undefined) {
    return { ok: false, recusa: `Não é possível retirar “${nome(nomes, fatoCodigo)}”: ${quem.descricao} cita esse fato.` };
  }
  return { ok: true, conteudo: { ...conteudo, pressupostos: (conteudo.pressupostos ?? []).filter((fato) => fato !== fatoCodigo) } };
}

export const RESTRICAO_FAIXA_NUMERICA = 'FAIXA_NUMERICA';
export const RESTRICAO_TAMANHO_TEXTO = 'TAMANHO_TEXTO';
export const RESTRICAO_OPCOES_PERMITIDAS = 'OPCOES_PERMITIDAS';
export const RESTRICAO_OPCOES_DAS_RESPOSTAS = 'OPCOES_DAS_RESPOSTAS';
export const RESTRICAO_MUNICIPIOS_DA_UF = 'MUNICIPIOS_DA_UF';

export const RESTRICOES: readonly OpcaoDoFormulario[] = [
  { valor: RESTRICAO_FAIXA_NUMERICA, rotulo: 'Faixa de valores' },
  { valor: RESTRICAO_TAMANHO_TEXTO, rotulo: 'Tamanho do texto' },
  { valor: RESTRICAO_OPCOES_PERMITIDAS, rotulo: 'Opções permitidas' },
  { valor: RESTRICAO_OPCOES_DAS_RESPOSTAS, rotulo: 'Opções das respostas anteriores' },
  { valor: RESTRICAO_MUNICIPIOS_DA_UF, rotulo: 'Municípios da UF respondida' },
];

/** As casas decimais que a faixa admite: as do edital (`FormaDoItem.CasasDecimaisDaFaixa`). */
const CASAS_DECIMAIS_DA_FAIXA = 4;
const TIPOS_DE_SELECAO = new Set(['SELECAO_UNICA', 'SELECAO_MULTIPLA']);

/**
 * As restrições que o administrador pode acrescentar ao campo: a faixa no numérico, o tamanho no de
 * texto e as opções permitidas na seleção de valores conhecidos — uma por tipo. A do município é
 * posta pela própria tela, e as opções das respostas anteriores ficam para depois.
 */
export function restricoesParaAcrescentar(item: ItemDoFormulario, temValoresConhecidos: boolean): readonly OpcaoDoFormulario[] {
  const presentes = new Set((item.restricoes ?? []).map((restricao) => restricao.tipo));
  const cabe = (tipo: string): boolean =>
    (tipo === RESTRICAO_FAIXA_NUMERICA && item.tipoRenderizacao === 'NUMERO') ||
    (tipo === RESTRICAO_TAMANHO_TEXTO && item.tipoRenderizacao === 'TEXTO') ||
    (tipo === RESTRICAO_OPCOES_PERMITIDAS && TIPOS_DE_SELECAO.has(item.tipoRenderizacao) && temValoresConhecidos);
  return RESTRICOES.filter((restricao) => cabe(restricao.valor) && !presentes.has(restricao.valor));
}

/** A restrição recém-acrescentada, ainda sem limite nem valor: o problema dela orienta o preenchimento. */
export function restricaoNova(tipo: string): RestricaoDeValor {
  return tipo === RESTRICAO_OPCOES_PERMITIDAS
    ? { tipo, entradas: [{ quando: null, valores: [] }] }
    : { tipo, minimo: null, maximo: null };
}

/**
 * A restrição que a tela mostra sem editar e grava como veio: opções condicionadas a respostas
 * anteriores e opções formadas pelas respostas, que este editor ainda não declara.
 */
export function restricaoSoParaLeitura(restricao: RestricaoDeValor): boolean {
  return (
    restricao.tipo === RESTRICAO_OPCOES_DAS_RESPOSTAS ||
    (restricao.tipo === RESTRICAO_OPCOES_PERMITIDAS && (restricao.entradas ?? []).some((entrada) => (entrada.quando ?? []).length > 0))
  );
}

/** O que impede a restrição de ser gravada, nos termos da API (`RestricaoValor.Violacao`); nulo quando nada. */
export function problemaDaRestricao(restricao: RestricaoDeValor): string | null {
  const minimo = restricao.minimo ?? null;
  const maximo = restricao.maximo ?? null;
  switch (restricao.tipo) {
    case RESTRICAO_FAIXA_NUMERICA:
      if (minimo === null && maximo === null) return 'Informe ao menos um limite.';
      if ([minimo, maximo].some((limite) => limite !== null && !Number.isFinite(Number(limite)))) return 'Os limites são números.';
      if ([minimo, maximo].some((limite) => limite !== null && Number(Number(limite).toFixed(CASAS_DECIMAIS_DA_FAIXA)) !== Number(limite))) {
        return `Use no máximo ${CASAS_DECIMAIS_DA_FAIXA} casas decimais.`;
      }
      return minimo !== null && maximo !== null && Number(minimo) > Number(maximo) ? 'O mínimo é maior que o máximo.' : null;
    case RESTRICAO_TAMANHO_TEXTO:
      if (minimo === null && maximo === null) return 'Informe ao menos um limite.';
      if ([minimo, maximo].some((limite) => limite !== null && !(Number.isInteger(Number(limite)) && Number(limite) >= 0))) {
        return 'Os limites são números inteiros, a partir de zero.';
      }
      return minimo !== null && maximo !== null && Number(minimo) > Number(maximo) ? 'O mínimo é maior que o máximo.' : null;
    case RESTRICAO_OPCOES_PERMITIDAS:
      return (restricao.entradas ?? []).length === 0 || (restricao.entradas ?? []).some((entrada) => entrada.valores.length === 0)
        ? 'Escolha ao menos um valor permitido.'
        : null;
    case RESTRICAO_MUNICIPIOS_DA_UF:
      return (restricao.fatos ?? []).length === 1 ? null : 'Escolha o campo de UF de onde vêm os municípios.';
    default:
      return null;
  }
}

/** Os tipos de campo que o impedimento admite (`Impedimento.CabeNoCampo`), sem o município — ver `impedimentoCabe`. */
const CAMPOS_COM_IMPEDIMENTO = new Set(['BOOLEANO', 'NUMERO', 'SELECAO_UNICA', 'SELECAO_MULTIPLA']);

/**
 * Se o campo pode ter impedimento: só na inscrição — ele impede a inscrição —, num tipo de campo que
 * o admite e quando a condição consegue citar a resposta do próprio campo, que toda alternativa do
 * impedimento cita. O município e a seleção de valores dinâmicos não entram: o editor de condições
 * não tem a lista deles para oferecer.
 */
export function impedimentoCabe(finalidade: string, tipoRenderizacao: string, proprioFatoCitavel: boolean): boolean {
  return finalidade === FINALIDADE_INSCRICAO && CAMPOS_COM_IMPEDIMENTO.has(tipoRenderizacao) && proprioFatoCitavel;
}

/**
 * O item com o impedimento ligado: a condição inicial é sobre o próprio campo, e o campo fica
 * obrigatório sempre na mesma edição — em branco, o impedimento nunca se cumpriria (UNI-REQ-0074).
 */
export function comImpedimento(item: ItemDoFormulario, quando: PredicadoNoWire): ItemDoFormulario {
  return {
    ...item,
    impedimento: { quando, mensagem: item.impedimento?.mensagem ?? '' },
    obrigatoriedade: OBRIGATORIEDADE_SEMPRE,
    predicadoObrigatoriedade: null,
  };
}

/** Se alguma alternativa do impedimento deixou de citar o próprio campo — a API recusa (`ImpedimentoSemOProprioCampo`). */
export function alternativaSemOProprioCampo(quando: PredicadoNoWire, fatoCodigo: string): boolean {
  return (quando ?? []).length === 0 || (quando ?? []).some((clausula) => !clausula.some((condicao) => condicao.fato === fatoCodigo));
}

/** Quantos campos o formulário tem no teto da API: itens, grupos e campos de grupo (`QuantidadeNoTeto`). */
export function quantidadeNoTeto(conteudo: ConteudoDoFormulario): number {
  return (
    (conteudo.itens ?? []).length +
    (conteudo.grupos ?? []).reduce((total, grupo) => total + 1 + grupo.subitens.length, 0)
  );
}

/** O conteúdo sem a seção dos dados básicos: a API a repõe, e o envio que a altera é recusado. */
export function semDadosBasicos(conteudo: ConteudoDoFormulario): ConteudoDoFormulario {
  return {
    ...conteudo,
    etapas: (conteudo.etapas ?? []).filter((etapa) => etapa.codigo !== SECAO_DADOS_BASICOS),
    itens: (conteudo.itens ?? []).filter((item) => item.etapaCodigo !== SECAO_DADOS_BASICOS),
  };
}

/** As recusas da API distribuídas pelo que a tela mostra: o item, a etapa, ou o resumo. */
export interface RecusasDoConteudo {
  readonly porItem: ReadonlyMap<string, readonly string[]>;
  readonly porEtapa: ReadonlyMap<string, readonly string[]>;
  readonly porTermo: ReadonlyMap<string, readonly string[]>;
  readonly gerais: readonly string[];
}

/**
 * Distribui as recusas pelo índice que a API aponta na lista enviada (`conteudo.itens[3].rotulo`).
 * A recusa sem índice — a do grafo, que cita o fato só na mensagem — vai para o resumo.
 */
export function distribuirRecusas(
  recusas: readonly { readonly field: string; readonly message: string }[],
  enviado: ConteudoDoFormulario,
): RecusasDoConteudo {
  const porItem = new Map<string, string[]>();
  const porEtapa = new Map<string, string[]>();
  const porTermo = new Map<string, string[]>();
  const gerais: string[] = [];
  for (const recusa of recusas) {
    const item = elementoApontado(recusa.field, 'itens', enviado.itens ?? []);
    const etapa = elementoApontado(recusa.field, 'etapas', enviado.etapas ?? []);
    const termo = elementoApontado(recusa.field, 'termos', enviado.termos ?? []);
    if (item !== undefined) acumular(porItem, item.fatoCodigo, recusa.message);
    else if (etapa !== undefined) acumular(porEtapa, etapa.codigo, recusa.message);
    else if (termo !== undefined) acumular(porTermo, termo.codigo, recusa.message);
    else gerais.push(recusa.message);
  }
  return { porItem, porEtapa, porTermo, gerais };
}

function elementoApontado<T>(campo: string, lista: string, elementos: readonly T[]): T | undefined {
  const encontrado = new RegExp(`(?:^|\\.)${lista}\\[(\\d+)\\]`, 'iu').exec(campo);
  return encontrado === null ? undefined : elementos[Number(encontrado[1])];
}

function acumular(mapa: Map<string, string[]>, chave: string, mensagem: string): void {
  mapa.set(chave, [...(mapa.get(chave) ?? []), mensagem]);
}

function ordemDa(entrada: EntradaDaSecao): number {
  return Number(entrada.tipo === 'item' ? entrada.item.ordem : entrada.grupo.ordem);
}

/**
 * A ordem do primeiro item das etapas a partir da dada: a posição da etapa no grafo da API é a do
 * primeiro item dela. Sem item adiante, fica depois de todos.
 */
function primeiraOrdemDaEtapa(conteudo: ConteudoDoFormulario, ordemDaEtapa: number): number {
  const ordens = etapasEmOrdem(conteudo)
    .filter((etapa) => Number(etapa.ordem) >= ordemDaEtapa)
    .flatMap((etapa) => entradasDaSecao(conteudo, etapa.codigo).map(ordemDa));
  return ordens.length > 0 ? Math.min(...ordens) : Number.MAX_SAFE_INTEGER;
}

function acrescentarEtapaAntesDaRevisao(conteudo: ConteudoDoFormulario, nova: EtapaDoFormulario): ConteudoDoFormulario {
  const revisao = (conteudo.etapas ?? []).find((etapa) => etapa.bloco === BLOCO_REVISAO_E_ACEITE);
  const ordem = revisao === undefined ? Number.MAX_SAFE_INTEGER : Number(revisao.ordem) - 0.5;
  return renumerar({ ...conteudo, etapas: [...(conteudo.etapas ?? []), { ...nova, ordem }] });
}

function citaveisAntesDe(conteudo: ConteudoDoFormulario, limite: number, excluido: string | null): ReadonlySet<string> {
  const fatos = new Set(conteudo.pressupostos ?? []);
  for (const item of conteudo.itens ?? []) {
    if (Number(item.ordem) < limite) fatos.add(item.fatoCodigo);
  }
  if (excluido !== null) fatos.delete(excluido);
  return fatos;
}

/** Todos os campos: os itens e os campos dos grupos. */
export function todosOsCampos(conteudo: ConteudoDoFormulario): readonly ItemDoFormulario[] {
  return [...(conteudo.itens ?? []), ...(conteudo.grupos ?? []).flatMap((grupo) => grupo.subitens)];
}

function predicadosDoCampo(campo: ItemDoFormulario): readonly PredicadoNoWire[] {
  return [
    campo.precondicao,
    campo.predicadoObrigatoriedade ?? null,
    campo.impedimento?.quando ?? null,
    ...(campo.restricoes ?? []).flatMap((restricao) => (restricao.entradas ?? []).map((entrada) => entrada.quando)),
  ];
}

function fatosCitadosPeloCampo(campo: ItemDoFormulario): readonly string[] {
  return [
    ...predicadosDoCampo(campo).flatMap(fatosDoPredicado),
    ...(campo.restricoes ?? []).flatMap((restricao) => restricao.fatos ?? []),
  ];
}

function fatosDoPredicado(predicado: PredicadoNoWire): readonly string[] {
  return (predicado ?? []).flat().map((condicao) => condicao.fato);
}

function todosOsPredicados(conteudo: ConteudoDoFormulario): readonly PredicadoNoWire[] {
  return [
    ...todosOsCampos(conteudo).flatMap(predicadosDoCampo),
    ...(conteudo.etapas ?? []).map((etapa) => etapa.exibicao ?? null),
    ...(conteudo.grupos ?? []).flatMap((grupo) => [grupo.exibicao, grupo.predicadoObrigatoriedade]),
    ...(conteudo.termos ?? []).flatMap((termo) => [termo.exibicao, termo.predicadoObrigatoriedade]),
  ];
}

interface Citante {
  /** O fato do campo que cita, quando quem cita é um campo. */
  readonly fatoCodigo: string | null;
  /** Quem cita, para a frase de recusa. */
  readonly descricao: string;
}

function quemCita(conteudo: ConteudoDoFormulario, fato: string): readonly Citante[] {
  const citantes: Citante[] = [];
  for (const campo of todosOsCampos(conteudo)) {
    if (fatosCitadosPeloCampo(campo).includes(fato)) {
      citantes.push({ fatoCodigo: campo.fatoCodigo, descricao: `o campo “${campo.rotulo}”` });
    }
  }
  for (const etapa of conteudo.etapas ?? []) {
    if (fatosDoPredicado(etapa.exibicao ?? null).includes(fato)) citantes.push({ fatoCodigo: null, descricao: `a seção “${etapa.titulo}”` });
  }
  for (const grupo of conteudo.grupos ?? []) {
    if ([grupo.exibicao, grupo.predicadoObrigatoriedade].flatMap(fatosDoPredicado).includes(fato)) {
      citantes.push({ fatoCodigo: null, descricao: `o grupo “${grupo.rotulo}”` });
    }
  }
  for (const termo of conteudo.termos ?? []) {
    if ([termo.exibicao, termo.predicadoObrigatoriedade].flatMap(fatosDoPredicado).includes(fato)) {
      citantes.push({ fatoCodigo: null, descricao: `o termo ${termo.codigo}` });
    }
  }
  return citantes;
}

/**
 * Recusa a ordem em que um item, um grupo ou uma seção cita fato coletado por item que não vem
 * antes dele. Só os itens do formulário entram na conta: o pressuposto é conhecido antes, e o
 * derivado — cuja posição depende das dependências dele — fica com a API.
 */
function conferirOrdem(conteudo: ConteudoDoFormulario, nomes: ReadonlyMap<string, string>): ResultadoDaEdicao {
  const posicao = new Map((conteudo.itens ?? []).map((item) => [item.fatoCodigo, Number(item.ordem)]));
  const pressupostos = new Set(conteudo.pressupostos ?? []);
  const depoisDe = (fato: string, ordem: number): boolean =>
    !pressupostos.has(fato) && (posicao.get(fato) ?? -Infinity) >= ordem;

  const verificacoes: { readonly ordem: number; readonly citados: readonly string[]; readonly descricao: string }[] = [
    ...(conteudo.itens ?? []).map((item) => ({
      ordem: Number(item.ordem),
      citados: fatosCitadosPeloCampo(item).filter((fato) => fato !== item.fatoCodigo),
      descricao: `“${item.rotulo}”`,
    })),
    ...(conteudo.grupos ?? []).map((grupo) => ({
      ordem: Number(grupo.ordem),
      // Os campos do grupo também citam: o fato de membro não tem posição e não entra na conta.
      citados: [...[grupo.exibicao, grupo.predicadoObrigatoriedade].flatMap(fatosDoPredicado), ...grupo.subitens.flatMap(fatosCitadosPeloCampo)],
      descricao: `O grupo “${grupo.rotulo}”`,
    })),
    ...etapasEmOrdem(conteudo).map((etapa) => ({
      ordem: primeiraOrdemDaEtapa(conteudo, Number(etapa.ordem)),
      citados: fatosDoPredicado(etapa.exibicao ?? null),
      descricao: `A seção “${etapa.titulo}”`,
    })),
  ];

  for (const verificacao of verificacoes) {
    const fato = verificacao.citados.find((citado) => depoisDe(citado, verificacao.ordem));
    if (fato !== undefined) {
      return { ok: false, recusa: `${verificacao.descricao} cita “${nome(nomes, fato)}”, que ficaria depois. Mova primeiro o campo citado.` };
    }
  }
  return { ok: true, conteudo };
}

/** O código a partir do nome: sem acento, em caixa alta, com sublinhado no lugar do resto. */
function codigoDoNome(nome: string): string {
  const codigo = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '')
    .slice(0, 50);
  return codigo === '' ? 'TERMO' : codigo;
}

function codigoLivre(base: string, usados: ReadonlySet<string>): string {
  let codigo = base;
  for (let numero = 2; usados.has(codigo); numero++) codigo = `${base}_${numero}`;
  return codigo;
}

function nome(nomes: ReadonlyMap<string, string>, fato: string): string {
  return nomes.get(fato) ?? fato;
}
