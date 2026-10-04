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
export type TipoDeDominio =
  | 'BOOLEANO'
  | 'NUMERICO'
  | 'CATEGORICO_ESTATICO'
  | 'CATEGORICO_DINAMICO';

/** Os operadores do predicado, nos tokens canônicos do wire. */
export const OPERADOR_IGUAL = 'IGUAL';
export const OPERADOR_DIFERENTE = 'DIFERENTE';
export const OPERADOR_EM = 'EM';
export const OPERADOR_NAO_EM = 'NAO_EM';
export const OPERADOR_MAIOR_IGUAL = 'MAIOR_IGUAL';
export const OPERADOR_MENOR_IGUAL = 'MENOR_IGUAL';

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
}

/** Um operador (ou resposta) oferecido para um fato, com a leitura que a tela faz dele. */
export interface OperadorEscolhivel {
  readonly valor: string;
  readonly rotulo: string;
}

/** A tripla que compara um fato do candidato a um valor em texto JSON. */
export interface CondicaoDeFato {
  readonly fato: string;
  readonly operador: string;
  readonly valor: string;
}

/** Uma condição que vive numa alternativa (cláusula) do predicado. */
export interface CondicaoEmClausula extends CondicaoDeFato {
  readonly clausula: number;
}

/** Uma condição junto com a posição que ela ocupa na lista — é por ela que a tela a edita. */
export interface CondicaoPosicionada<T extends CondicaoEmClausula = CondicaoEmClausula> {
  readonly indice: number;
  readonly condicao: T;
}

/** Uma alternativa: as condições que precisam valer JUNTAS para ela ser satisfeita. */
export interface ClausulaDeCondicoes<T extends CondicaoEmClausula = CondicaoEmClausula> {
  readonly numero: number;
  readonly condicoes: readonly CondicaoPosicionada<T>[];
}

/** A fonte dos valores do fato de município. */
const FONTE_GEO_MUNICIPIO = 'GEO_MUNICIPIO';

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
  const valores = fato.valoresDominio ?? null;
  const tipoDominio: TipoDeDominio | null =
    fato.dominio === 'BOOLEANO'
      ? 'BOOLEANO'
      : fato.dominio === 'NUMERICO'
        ? 'NUMERICO'
        : fato.dominio === 'CATEGORICO'
          ? valores !== null && valores.length > 0
            ? 'CATEGORICO_ESTATICO'
            : 'CATEGORICO_DINAMICO'
          : null;

  if (tipoDominio === null) return null;

  return {
    codigo: fato.codigo,
    nome: fato.nome,
    tipoDominio,
    valores: tipoDominio === 'CATEGORICO_ESTATICO' ? [...(valores ?? [])] : [],
    coletavel: BINDINGS_DE_CAMPO.some((prefixo) => fato.binding.startsWith(prefixo)),
  };
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
  const escolhiveis: FatoEscolhivel[] = [];

  for (const view of fatos) {
    if (omitidos.includes(view.codigo)) continue;

    const fato = fatoEscolhivel(view);
    if (fato === null) continue;

    if (fato.tipoDominio !== 'CATEGORICO_DINAMICO') {
      escolhiveis.push(fato);
      continue;
    }

    if (comMunicipios && view.fonteValores === FONTE_GEO_MUNICIPIO) {
      escolhiveis.push({ ...fato, municipio: true });
      continue;
    }

    const ofertados = dominiosDinamicos.get(fato.codigo) ?? [];
    if (ofertados.length === 0) continue;
    escolhiveis.push({ ...fato, valores: [...ofertados] });
  }

  return escolhiveis;
}

/** O nome de cada fato do catálogo, oferecido pelo editor ou não — para nomear a recusa. */
export function nomesDoCatalogo(fatos: readonly FatoDoCatalogo[]): ReadonlyMap<string, string> {
  return new Map(fatos.map((fato) => [fato.codigo, fato.nome]));
}

/** Os dois valores do domínio booleano, como o wire os escreve. */
export const VALOR_VERDADEIRO = 'true';
export const VALOR_FALSO = 'false';

/**
 * O que o operador escolhe num fato booleano. São duas opções fechadas, e não texto livre: um
 * campo de texto aqui aceitaria "Sim" e gravaria o oposto do que foi digitado.
 */
export const RESPOSTAS_BOOLEANAS: readonly OperadorEscolhivel[] = [
  { valor: VALOR_VERDADEIRO, rotulo: 'Sim' },
  { valor: VALOR_FALSO, rotulo: 'Não' },
];

/**
 * Os operadores que o domínio do fato admite.
 *
 * "Não é" acompanha "é" em todo domínio; "é um de" e "não é nenhum de" só nos categóricos, que
 * são os únicos com lista de valores. A diferença entre "não é feminino" e "é masculino" é
 * real e importa: a primeira alcança também quem declarou intersexo.
 */
export function operadoresDoFato(fato: FatoEscolhivel): readonly OperadorEscolhivel[] {
  switch (fato.tipoDominio) {
    case 'BOOLEANO':
      return [
        { valor: OPERADOR_IGUAL, rotulo: 'é' },
        { valor: OPERADOR_DIFERENTE, rotulo: 'não é' },
      ];
    case 'NUMERICO':
      return [
        { valor: OPERADOR_IGUAL, rotulo: 'é igual a' },
        { valor: OPERADOR_DIFERENTE, rotulo: 'é diferente de' },
        { valor: OPERADOR_MAIOR_IGUAL, rotulo: 'é maior ou igual a' },
        { valor: OPERADOR_MENOR_IGUAL, rotulo: 'é menor ou igual a' },
      ];
    default:
      return [
        { valor: OPERADOR_IGUAL, rotulo: 'é' },
        { valor: OPERADOR_DIFERENTE, rotulo: 'não é' },
        { valor: OPERADOR_EM, rotulo: 'é um de' },
        { valor: OPERADOR_NAO_EM, rotulo: 'não é nenhum de' },
      ];
  }
}

/** Se o operador compara contra uma LISTA de valores, e não contra um só. */
export function comparaComLista(operador: string): boolean {
  return operador === OPERADOR_EM || operador === OPERADOR_NAO_EM;
}

/**
 * Uma condição recém-declarada sobre um fato: o primeiro operador que o domínio dele admite,
 * e nenhum valor escolhido ainda.
 *
 * Nasce sem valor de propósito. Semeá-la com o primeiro valor do domínio gravaria uma
 * afirmação que ninguém fez — e a conferência da tela cobra o valor em seguida, em vez de
 * deixar a gravação ser recusada pelo servidor.
 */
export function condicaoNova(fato: FatoEscolhivel, clausula: number): CondicaoEmClausula {
  return {
    clausula,
    fato: fato.codigo,
    operador: operadoresDoFato(fato)[0].valor,
    valor: '',
  };
}

/** O valor escalar da condição, como texto — vazio quando ela ainda não tem valor. */
export function valorEscalarDe(condicao: CondicaoDeFato): string {
  const valor = interpretar(condicao.valor);
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'number' || typeof valor === 'boolean') return condicao.valor.trim();
  // Texto que não é JSON vale por si — é assim que o servidor o recebe, e é o que preserva o
  // que está sendo digitado antes de virar número completo.
  if (valor === undefined && condicao.valor !== '') return condicao.valor;
  return '';
}

/** Os valores da condição de lista — vazio quando ela ainda não tem nenhum. */
export function valoresDeListaDe(condicao: CondicaoDeFato): readonly string[] {
  const valor = interpretar(condicao.valor);
  if (!Array.isArray(valor)) return [];
  return valor.filter((item): item is string => typeof item === 'string');
}

/**
 * A condição com o valor trocado, escrito na forma JSON que o domínio de cada fato exige:
 * texto entre aspas no categórico, número cru no numérico, `true`/`false` no booleano.
 */
export function comValorEscalar<T extends CondicaoDeFato>(
  condicao: T,
  fato: FatoEscolhivel,
  valor: string,
): T {
  if (valor === '') return { ...condicao, valor: '' };

  if (fato.tipoDominio === 'BOOLEANO') {
    // Só os dois tokens do domínio são aceitos. Qualquer outra coisa volta ao estado sem
    // valor, que a conferência acusa — tratar o não reconhecido como "não" gravaria
    // silenciosamente o oposto do que foi escrito, e o servidor aceitaria, porque é booleano
    // JSON válido.
    return {
      ...condicao,
      valor: valor === VALOR_VERDADEIRO || valor === VALOR_FALSO ? valor : '',
    };
  }

  if (fato.tipoDominio === 'NUMERICO') {
    // O que foi escrito é guardado como veio, e a conferência acusa o que o domínio recusa —
    // ele só aceita inteiro. Truncar aqui gravava um número diferente do que ficava na tela:
    // quem digitava 1412.50 via 1412.50 e gravava 1412, sem nada dizer.
    return { ...condicao, valor: valor.trim() };
  }

  return { ...condicao, valor: JSON.stringify(valor) };
}

/** A condição de lista com os valores trocados. Lista vazia volta ao estado sem valor. */
export function comValoresDeLista<T extends CondicaoDeFato>(
  condicao: T,
  valores: readonly string[],
): T {
  return { ...condicao, valor: valores.length === 0 ? '' : JSON.stringify(valores) };
}

/**
 * A condição com o operador trocado. O valor é PRESERVADO quando as duas formas coincidem —
 * trocar "é" por "não é" não deveria apagar o valor escolhido —, e convertido quando não: de
 * escalar para lista de um item, e da lista de volta para o primeiro item dela.
 */
export function comOperador<T extends CondicaoDeFato>(
  condicao: T,
  fato: FatoEscolhivel,
  operador: string,
): T {
  if (comparaComLista(operador) === comparaComLista(condicao.operador)) {
    return { ...condicao, operador };
  }

  if (comparaComLista(operador)) {
    const escalar = valorEscalarDe(condicao);
    return comValoresDeLista({ ...condicao, operador }, escalar === '' ? [] : [escalar]);
  }

  const [primeiro] = valoresDeListaDe(condicao);
  return comValorEscalar({ ...condicao, operador }, fato, primeiro ?? '');
}

/**
 * Os números de cláusula que a lista usa, em ordem — `[1]` quando ela ainda não tem condição
 * nenhuma, que é a cláusula em que a primeira condição nascerá.
 */
export function numerosDeClausula(condicoes: readonly CondicaoEmClausula[]): readonly number[] {
  const numeros = [...new Set(condicoes.map((condicao) => condicao.clausula))].sort(
    (um, outro) => um - outro,
  );
  return numeros.length > 0 ? numeros : [1];
}

/**
 * As alternativas, na ordem, sem as condições sobre `fatoDoRecorte` — que a tela edita por um
 * controle próprio e mostraria aqui como uma segunda verdade sobre o mesmo recorte.
 */
export function clausulasDe<T extends CondicaoEmClausula>(
  condicoes: readonly T[],
  fatoDoRecorte = '',
): readonly ClausulaDeCondicoes<T>[] {
  const posicionadas = condicoes
    .map((condicao, indice) => ({ indice, condicao }))
    .filter(({ condicao }) => fatoDoRecorte === '' || condicao.fato !== fatoDoRecorte);

  const numeros = [...new Set(posicionadas.map(({ condicao }) => condicao.clausula))].sort(
    (um, outro) => um - outro,
  );

  return numeros.map((numero) => ({
    numero,
    condicoes: posicionadas.filter(({ condicao }) => condicao.clausula === numero),
  }));
}

/** A lista com uma condição a mais na alternativa indicada. */
export function comCondicaoEm<T extends CondicaoEmClausula>(
  condicoes: readonly T[],
  clausula: number,
  fato: FatoEscolhivel,
): readonly (T | CondicaoEmClausula)[] {
  return [...condicoes, condicaoNova(fato, clausula)];
}

/** A lista com UMA condição trocada, endereçada pela posição que a tela conhece. */
export function comCondicaoTrocadaEm<T extends CondicaoEmClausula>(
  condicoes: readonly T[],
  indice: number,
  condicao: T,
): readonly T[] {
  return condicoes.map((atual, posicao) => (posicao === indice ? condicao : atual));
}

/**
 * A lista sem aquela condição. A alternativa que fica sem nenhuma some junto, e as demais
 * são renumeradas: cláusula vazia não é exprimível no wire, e um buraco na numeração faria a
 * tela mostrar "alternativa 3" onde só há duas.
 */
export function semCondicaoEm<T extends CondicaoEmClausula>(
  condicoes: readonly T[],
  indice: number,
): readonly T[] {
  return renumerarClausulas(condicoes.filter((_, posicao) => posicao !== indice));
}

/**
 * A lista com uma alternativa a mais — a segunda via pela qual o predicado passa a valer,
 * combinada por OU com as que já existem.
 *
 * O recorte acompanha: ele vale para o predicado inteiro, e deixá-lo de fora da alternativa
 * nova a faria valer sem o recorte.
 */
export function comClausulaEm<T extends CondicaoEmClausula>(
  condicoes: readonly T[],
  fato: FatoEscolhivel,
  fatoDoRecorte = '',
): readonly (T | CondicaoEmClausula)[] {
  const numero = Math.max(...numerosDeClausula(condicoes)) + 1;
  const doRecorte =
    fatoDoRecorte === '' ? undefined : condicoes.find((condicao) => condicao.fato === fatoDoRecorte);

  return [
    ...condicoes,
    condicaoNova(fato, numero),
    ...(doRecorte === undefined ? [] : [{ ...doRecorte, clausula: numero }]),
  ];
}

/** A lista sem aquela alternativa inteira. */
export function semClausulaEm<T extends CondicaoEmClausula>(
  condicoes: readonly T[],
  numero: number,
): readonly T[] {
  return renumerarClausulas(condicoes.filter((condicao) => condicao.clausula !== numero));
}

/**
 * O que a condição alcança, na prosa que o operador lê antes de gravar.
 *
 * É o que torna consciente a escolha entre "não é feminino" e "é masculino": a primeira
 * também alcança quem declarou qualquer outro valor do domínio, e quem escreve a regra
 * precisa ver isso na tela, não descobrir depois pela reclamação de um candidato.
 */
export function alcanceDaCondicao(condicao: CondicaoDeFato, fato: FatoEscolhivel): string {
  if (fato.tipoDominio === 'BOOLEANO') return alcanceBooleano(condicao);
  if (fato.valores.length === 0) return '';

  const escolhidos = comparaComLista(condicao.operador)
    ? valoresDeListaDe(condicao)
    : [valorEscalarDe(condicao)].filter((valor) => valor !== '');
  if (escolhidos.length === 0) return '';

  const nega = condicao.operador === OPERADOR_DIFERENTE || condicao.operador === OPERADOR_NAO_EM;
  const alcancados = nega
    ? fato.valores.filter((valor) => !escolhidos.includes(valor))
    : fato.valores.filter((valor) => escolhidos.includes(valor));

  if (alcancados.length === 0) return 'Não alcança valor nenhum do domínio declarado.';
  return `Alcança ${alcancados.join(', ')}.`;
}

/**
 * O que a condição sobre um fato de sim-ou-não alcança, dito por extenso.
 *
 * "não é não" é o que o operador acaba de declarar quando escolhe "não" com a comparação
 * negada, e ler isso de volta em prosa é o que evita a dupla negação passar despercebida.
 */
function alcanceBooleano(condicao: CondicaoDeFato): string {
  const escolhido = valorEscalarDe(condicao);
  if (escolhido !== VALOR_VERDADEIRO && escolhido !== VALOR_FALSO) return '';

  const nega = condicao.operador === OPERADOR_DIFERENTE;
  const afirmativo = (escolhido === VALOR_VERDADEIRO) !== nega;
  return afirmativo ? 'Alcança quem respondeu que sim.' : 'Alcança quem respondeu que não.';
}

/**
 * O que impede UMA condição de ser gravada, ou `null` quando ela está íntegra. Espelha o
 * validador do domínio: fato fora do vocabulário, operador que o domínio não admite, valor
 * ausente e valor fora do domínio declarado.
 */
export function problemaDaCondicao(
  condicao: CondicaoDeFato,
  fatosPorCodigo: ReadonlyMap<string, FatoEscolhivel>,
  nomeNoCatalogo: ReadonlyMap<string, string> = new Map(),
): string | null {
  // Fato ainda não escolhido não é fato desconhecido: dizer que o fato "" não está no
  // catálogo manda procurar no cadastro o que só falta selecionar na tela.
  if (condicao.fato.trim() === '') return 'escolha o fato do candidato';

  const fato = fatosPorCodigo.get(condicao.fato);
  if (fato === undefined) {
    const nome = nomeNoCatalogo.get(condicao.fato);
    return nome === undefined
      ? `o fato "${condicao.fato}" não está no catálogo`
      : `"${nome}" não tem valor nenhum ofertado por este processo`;
  }

  if (!operadoresDoFato(fato).some((opcao) => opcao.valor === condicao.operador)) {
    return `"${fato.nome}" não admite a comparação escolhida`;
  }

  const vazia = comparaComLista(condicao.operador)
    ? valoresDeListaDe(condicao).length === 0
    : valorEscalarDe(condicao) === '';
  if (vazia) return `"${fato.nome}" está sem valor`;

  // O domínio numérico recusa decimal. Sem esta conferência o valor viajava e voltava recusado
  // pelo servidor, falando de um tipo que a tela não expõe.
  // A gramática exata de número inteiro do JSON: zero à esquerda não é número JSON válido, e
  // um `018` aprovado aqui voltaria do servidor como recusa de TIPO — uma mensagem sobre JSON
  // para quem só pôs um zero a mais.
  if (fato.tipoDominio === 'NUMERICO' && !/^-?(0|[1-9]\d*)$/.test(valorEscalarDe(condicao))) {
    return `"${fato.nome}" aceita número inteiro`;
  }

  if (fato.valores.length === 0) return null;

  const escolhidos = comparaComLista(condicao.operador)
    ? valoresDeListaDe(condicao)
    : [valorEscalarDe(condicao)];
  const foraDoDominio = escolhidos.filter((valor) => !fato.valores.includes(valor));

  return foraDoDominio.length > 0
    ? `"${fato.nome}" cita ${foraDoDominio.join(', ')}, fora do domínio declarado`
    : null;
}

/**
 * Os problemas de uma lista de condições, na ordem. `ignorados` são os fatos que outro
 * controle da tela confere por conta própria.
 */
export function problemasDeCondicoes(
  condicoes: readonly CondicaoDeFato[],
  fatosPorCodigo: ReadonlyMap<string, FatoEscolhivel>,
  nomeNoCatalogo: ReadonlyMap<string, string> = new Map(),
  ignorados: readonly string[] = [],
): readonly string[] {
  const problemas: string[] = [];

  for (const condicao of condicoes) {
    if (ignorados.includes(condicao.fato)) continue;

    const problema = problemaDaCondicao(condicao, fatosPorCodigo, nomeNoCatalogo);
    if (problema !== null) problemas.push(problema);
  }

  return problemas;
}

/** Renumera as alternativas de 1 a N, preservando a ordem em que aparecem. */
export function renumerarClausulas<T extends CondicaoEmClausula>(
  condicoes: readonly T[],
): readonly T[] {
  const numeros = [...new Set(condicoes.map((condicao) => condicao.clausula))].sort(
    (um, outro) => um - outro,
  );
  const novoNumero = new Map(numeros.map((numero, indice) => [numero, indice + 1]));

  return condicoes.map((condicao) => ({
    ...condicao,
    clausula: novoNumero.get(condicao.clausula) ?? condicao.clausula,
  }));
}

/**
 * Uma condição na forma em que a API a recebe e a devolve: o valor é o JSON já interpretado
 * (`true`, `18`, `"PRETA"`, `["AC", "LB_PPI"]`), e não texto.
 */
export interface CondicaoNoWire {
  readonly fato: string;
  readonly operador: string;
  readonly valor: unknown;
}

/**
 * O predicado na forma aninhada da API — cláusulas combinadas por OU, cada uma com as condições
 * combinadas por E — para a lista que o editor edita, com o número da cláusula em cada condição.
 * Nulo ou vazio é predicado sem condição.
 */
export function deClausulasDoWire(
  clausulas: readonly (readonly CondicaoNoWire[])[] | null | undefined,
): readonly CondicaoEmClausula[] {
  return (clausulas ?? []).flatMap((condicoes, indice) =>
    condicoes.map((condicao) => ({
      clausula: indice + 1,
      fato: condicao.fato,
      operador: condicao.operador,
      valor: JSON.stringify(condicao.valor),
    })),
  );
}

/**
 * A lista do editor de volta à forma aninhada da API, uma cláusula por número, na ordem. O valor
 * que não é JSON segue como texto — é como o servidor o recebe, e a conferência da tela já o
 * cobrou antes de gravar.
 */
export function paraClausulasDoWire(condicoes: readonly CondicaoEmClausula[]): CondicaoNoWire[][] {
  return numerosDeClausula(condicoes)
    .map((numero) =>
      condicoes
        .filter((condicao) => condicao.clausula === numero)
        .map((condicao) => ({
          fato: condicao.fato,
          operador: condicao.operador,
          valor: interpretar(condicao.valor) ?? condicao.valor,
        })),
    )
    .filter((clausula) => clausula.length > 0);
}

/**
 * O valor da condição como JSON, ou `undefined` quando ele ainda não foi escrito ou não é
 * JSON. O chamador que lê escalar trata o texto cru como o próprio valor — é o que o servidor
 * faz ao receber, e é o que faz um número sendo digitado sobreviver ao caractere que ainda
 * não o completa.
 */
function interpretar(valor: string): unknown {
  if (valor === '') return undefined;
  try {
    return JSON.parse(valor);
  } catch {
    return undefined;
  }
}
