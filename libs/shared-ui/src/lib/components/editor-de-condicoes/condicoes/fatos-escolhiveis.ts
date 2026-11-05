/**
 * Condições sobre fatos do candidato: o predicado em forma normal disjuntiva que o gatilho de
 * uma exigência documental, o critério de desempate e a regra de um item de formulário
 * escrevem. As CLÁUSULAS se combinam por OU; as condições de dentro de uma cláusula, por E.
 *
 * O que este módulo decide — quais operadores cada fato admite, que forma o valor tem, o que
 * a condição alcança — é espelho do que o servidor confere (ADR-0111), e por isso cada regra
 * daqui tem contrapartida no validador de predicado do domínio. O que ele NÃO faz é escrever a
 * lista de fatos: ela é catálogo institucional e chega pela API.
 *
 * Nada aqui conhece o modelo de um módulo: as funções trabalham sobre a tripla
 * `{fato, operador, valor}` e, quando há alternativas, sobre a lista de condições com o número
 * da cláusula em que cada uma vive.
 */

/** Os quatro domínios que o vocabulário distingue, no formato que o wire usa. */
export type TipoDeDominio = 'BOOLEANO' | 'NUMERICO' | 'CATEGORICO_ESTATICO' | 'CATEGORICO_DINAMICO';

/**
 * O que o editor precisa saber de um fato do catálogo. É estrutural de propósito: o DTO da
 * API satisfaz esta forma sem que a biblioteca dependa dele.
 */
export interface FatoDoCatalogo {
  readonly codigo: string;
  readonly nome: string;
  readonly dominio: string;
  readonly valoresDominio?: readonly string[] | null;
  readonly binding: string;
  /** De onde vêm os valores do categórico (`GEO_MUNICIPIO`, `PROCESSO`...); nulo nos demais. */
  readonly fonteValores?: string | null;
  /** Os valores do categórico com a descrição que o cadastro deu a cada um, quando há. */
  readonly valoresDominioDeclarados?: readonly ValorDoCatalogo[] | null;
  /** Se a proteção de dados aprovou a proteção do fato; sem a aprovação, o fato não aceita vínculo novo. */
  readonly protecaoAprovada?: boolean;
}

/** Um valor do domínio declarado no catálogo, com a descrição que a tela mostra no lugar do código. */
export interface ValorDoCatalogo {
  readonly codigo: string;
  readonly descricao?: string | null;
}

/**
 * Um fato do catálogo na forma que a tela precisa: o domínio resolvido em um dos quatro
 * tipos, e os valores que ele aceita quando são conhecidos de antemão.
 */
export interface FatoEscolhivel {
  readonly codigo: string;
  readonly nome: string;
  readonly tipoDominio: TipoDeDominio;
  /** Os valores declarados, quando o domínio é categórico estático; vazio nos demais. */
  readonly valores: readonly string[];
  /** A descrição de cada valor que tem uma, pelo código; o valor sem descrição se mostra pelo código. */
  readonly rotulos?: ReadonlyMap<string, string>;
  /**
   * Se o fato é perguntado ao candidato no formulário. O derivado — modalidade, faixa
   * etária, renda — resolve por outro caminho e nunca vira campo.
   */
  readonly coletavel: boolean;
  /**
   * O valor é um município, escolhido pela busca no Geo e gravado pelo código IBGE. O domínio não
   * é enumerado: o servidor confere só a forma do código (ADR-0090).
   */
  readonly municipio?: boolean;
  /** A proteção de dados do fato aguarda aprovação: ele aparece na escolha, mas só se mantém onde já está citado. */
  readonly aguardaProtecao?: boolean;
}

/** A fonte dos valores do fato de município. */
export const FONTE_GEO_MUNICIPIO = 'GEO_MUNICIPIO';

/** Os prefixos de binding que marcam o fato perguntado ao candidato no formulário. */
const BINDINGS_DE_CAMPO = ['CAMPO_INSCRICAO:', 'CAMPO_FORMULARIO:'];

/**
 * Traduz um fato do catálogo para o que a tela oferece, ou `null` quando o domínio dele não é
 * um dos quatro conhecidos.
 *
 * Categórico com valores declarados é ESTÁTICO — o domínio está no catálogo; sem eles é
 * DINÂMICO, e o domínio vem do que o próprio processo oferta. É a mesma leitura que o
 * comando faz ao montar o vocabulário, e descasá-la faria a tela oferecer operador que o
 * servidor recusa.
 */
export function fatoEscolhivel(fato: FatoDoCatalogo): FatoEscolhivel | null {
  const tipoDominio = tipoDoDominio(fato);
  if (tipoDominio === null) return null;
  const rotulos = rotulosDeclarados(fato);
  return {
    codigo: fato.codigo,
    nome: fato.nome,
    tipoDominio,
    valores: tipoDominio === 'CATEGORICO_ESTATICO' ? [...(fato.valoresDominio ?? [])] : [],
    coletavel: BINDINGS_DE_CAMPO.some((prefixo) => fato.binding.startsWith(prefixo)),
    ...(fato.protecaoAprovada === false ? { aguardaProtecao: true } : {}),
    ...(rotulos.size > 0 ? { rotulos } : {}),
  };
}

function tipoDoDominio(fato: FatoDoCatalogo): TipoDeDominio | null {
  switch (fato.dominio) {
    case 'BOOLEANO':
    case 'NUMERICO':
      return fato.dominio;
    case 'CATEGORICO':
      return (fato.valoresDominio ?? []).length > 0 ? 'CATEGORICO_ESTATICO' : 'CATEGORICO_DINAMICO';
    default:
      return null;
  }
}

function rotulosDeclarados(fato: FatoDoCatalogo): ReadonlyMap<string, string> {
  const rotulos = new Map<string, string>();
  for (const valor of fato.valoresDominioDeclarados ?? []) {
    const descricao = valor.descricao?.trim() ?? '';
    if (descricao !== '') rotulos.set(valor.codigo, descricao);
  }
  return rotulos;
}

/** Como a tela mostra um valor do fato: pela descrição do cadastro, ou pelo código quando não há. */
export function rotuloDoValor(fato: FatoEscolhivel, valor: string): string {
  return fato.rotulos?.get(valor) ?? valor;
}

/**
 * Os fatos que um editor oferece, na ordem do catálogo.
 *
 * Os fatos de domínio dinâmico só entram quando o chamador sabe dizer que valores o processo
 * oferta para eles: sem isso, a tela proporia um valor que o servidor recusaria por não
 * conseguir conferir o domínio. `omitidos` são os fatos que outro controle da tela já escreve.
 * O fato de município é a exceção: entra quando `comMunicipios` diz que o hospedeiro tem a busca
 * de onde a tela tira o valor.
 */
export function fatosEscolhiveis(
  fatos: readonly FatoDoCatalogo[],
  dominiosDinamicos: ReadonlyMap<string, readonly string[]> = new Map(),
  omitidos: readonly string[] = [],
  comMunicipios = false,
): readonly FatoEscolhivel[] {
  return fatos
    .filter((fato) => !omitidos.includes(fato.codigo))
    .map((fato) => oferecido(fato, dominiosDinamicos, comMunicipios))
    .filter((fato) => fato !== null);
}

function oferecido(
  view: FatoDoCatalogo,
  dominiosDinamicos: ReadonlyMap<string, readonly string[]>,
  comMunicipios: boolean,
): FatoEscolhivel | null {
  const fato = fatoEscolhivel(view);
  if (fato === null || fato.tipoDominio !== 'CATEGORICO_DINAMICO') return fato;
  if (comMunicipios && view.fonteValores === FONTE_GEO_MUNICIPIO) {
    return { ...fato, municipio: true };
  }
  const ofertados = dominiosDinamicos.get(fato.codigo) ?? [];
  return ofertados.length === 0 ? null : { ...fato, valores: [...ofertados] };
}

/** O nome de cada fato do catálogo, oferecido pelo editor ou não — para nomear a recusa. */
export function nomesDoCatalogo(fatos: readonly FatoDoCatalogo[]): ReadonlyMap<string, string> {
  return new Map(fatos.map((fato) => [fato.codigo, fato.nome]));
}
