import { DistribuicaoDeVagas, ModalidadeDaOferta } from '../../processo-seletivo.models';
import { decimalDoCampo, inteiroDoCampo } from '../../shared/numero-do-campo';

/**
 * Códigos de regra do ramo federal (Lei 12.711) no `rol_de_regras`: a
 * fórmula pura do art. 10 e a variação que soma AC_PCD a ela.
 *
 * O ramo federal muda o que o resto do formulário exige — referência
 * demográfica, regra de ajuste e o conjunto de modalidades —, então a tela
 * precisa reconhecê-lo pelo código, que é estável, e não pelo rótulo. Espelha
 * `RegraDistribuicaoVagasCodigo.EhRamoFederal` do uniplus-api: comparar com
 * um único literal deixaria a variação -COM-AC-PCD caindo no ramo
 * institucional, sem referência demográfica nem regra de ajuste.
 */
const REGRAS_RAMO_FEDERAL = ['DISTRIB-VAGAS-LEI-12711', 'DISTRIB-VAGAS-LEI-12711-COM-AC-PCD'];

/** Composições cuja quantidade o motor calcula; informá-las é recusado. */
const COMPOSICOES_CALCULADAS = ['DENTRO_DO_VR', 'RESIDUAL_DO_VO'];

/** Composições que o edital precisa fixar mesmo no ramo federal. */
const COMPOSICOES_DECLARADAS = ['RETIRA_DE', 'SUPLEMENTAR_AO_TOTAL'];

/** A que acresce vagas ao total da oferta em vez de disputar as que ela tem. */
const COMPOSICAO_SUPLEMENTAR = 'SUPLEMENTAR_AO_TOTAL';

/** A distribuição segue a Lei 12.711 (em alguma de suas variações). */
export function ehRamoFederal(regraDistribuicaoCodigo: string): boolean {
  return REGRAS_RAMO_FEDERAL.includes(regraDistribuicaoCodigo);
}

/**
 * A quantidade desta composição sai do total de vagas da oferta.
 *
 * A composição diz o que a modalidade é diante da oferta do curso, mas quem
 * decide se ela consome o total é o ramo da regra. Sob a Lei 12.711 a
 * suplementar acresce: o total publicado é o `VO_base` mais as suplementares,
 * e somá-la aqui recusaria o edital por oferecer justamente o que a Portaria
 * MEC 18/2012 art. 12 permite acrescentar. Fora dela não há cálculo algum — o
 * quadro é o que se publica, e o total publicado é a soma de tudo que ele
 * traz. Num certame exclusivo de indígenas e quilombolas, sem ampla
 * concorrência, são as suplementares que compõem o total: não há outro
 * conjunto a que elas se somem.
 */
function consomeOTotalDeVagas(composicaoVagas: string, federal: boolean): boolean {
  return !federal || composicaoVagas !== COMPOSICAO_SUPLEMENTAR;
}

/**
 * Soma das quantidades que o edital fixou e que saem do total da oferta.
 *
 * O que a regra calcula não entra: no ramo federal o quadro só guarda as
 * declaradas, e o resto vem da simulação. Quantidade malformada conta como
 * zero — a forma é recusada em outro lugar, e somá-la como `NaN` esconderia o
 * excesso real das outras.
 */
export function totalFixadoDoVo(
  distribuicao: DistribuicaoDeVagas,
  catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>,
): number {
  const federal = ehRamoFederal(distribuicao.regraDistribuicaoCodigo);

  return distribuicao.quadro.reduce((soma, item) => {
    const composicao = catalogo.get(item.modalidadeId)?.composicaoVagas;
    if (composicao === undefined || !consomeOTotalDeVagas(composicao, federal)) return soma;

    const quantidade = Number(item.quantidade.trim());
    return soma + (Number.isInteger(quantidade) && quantidade > 0 ? quantidade : 0);
  }, 0);
}

/**
 * O que o edital fixa não pode ultrapassar o total de vagas da oferta: as
 * quantidades declaradas dividem esse total, não o ampliam.
 *
 * Total malformado devolve `null` — a forma já é recusada em outro lugar, e
 * comparar contra ela produziria uma segunda mensagem sobre o mesmo campo.
 */
export function problemaDeSomaDoQuadro(
  distribuicao: DistribuicaoDeVagas,
  catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>,
): string | null {
  const informado = distribuicao.voBase.trim();
  if (!/^[1-9]\d*$/.test(informado)) return null;

  const total = Number(informado);
  const fixado = totalFixadoDoVo(distribuicao, catalogo);

  return fixado > total
    ? `As quantidades fixadas somam ${fixado} e passam do total de ${total} vagas da oferta.`
    : null;
}

/**
 * O que a tela precisa saber de uma modalidade para validar a distribuição:
 * como sua quantidade é obtida e de quais outras modalidades ela depende.
 * Tudo vem do catálogo de Configuração; nada é decidido aqui.
 */
export interface ModalidadeDoCatalogo {
  readonly id: string;
  readonly codigo: string;
  readonly composicaoVagas: string;
  readonly composicaoOrigemCodigo: string | null;
  readonly regraRemanejamento: string | null;
  readonly remanejamentoDestino: string | null;
  readonly remanejamentoPar: string | null;
  readonly remanejamentoFallback: string | null;
}

/** O que o edital declara uma vez e vale para todas as ofertas do quadro. */
export interface PadraoDoEdital {
  readonly regraDistribuicaoCodigo: string;
  readonly regraDistribuicaoVersao: string;
  readonly regraAjusteCodigo: string | null;
  readonly regraAjusteVersao: string | null;
  readonly referenciaReservaDemograficaId: string | null;
  readonly modalidades: readonly ModalidadeDaOferta[];
  readonly pr: string;
}

/**
 * A oferta segue o padrão que a tela apresenta.
 *
 * O contrato guarda regra, percentual e referência por oferta, então um
 * processo gravado por outro caminho pode trazer ofertas divergentes. A tela
 * mostra o padrão da primeira e enviaria os valores de cada uma: sem comparar,
 * o operador confirmaria um quadro e gravaria outro.
 */
export function seguemOMesmoPadrao(
  distribuicao: DistribuicaoDeVagas,
  padrao: PadraoDoEdital,
): boolean {
  return (
    distribuicao.regraDistribuicaoCodigo === padrao.regraDistribuicaoCodigo &&
    distribuicao.regraDistribuicaoVersao === padrao.regraDistribuicaoVersao &&
    distribuicao.regraAjusteCodigo === padrao.regraAjusteCodigo &&
    distribuicao.regraAjusteVersao === padrao.regraAjusteVersao &&
    distribuicao.referenciaReservaDemograficaId === padrao.referenciaReservaDemograficaId &&
    distribuicao.pr === padrao.pr &&
    mesmasModalidades(distribuicao.modalidades, padrao.modalidades)
  );
}

function mesmasModalidades(
  daOferta: readonly ModalidadeDaOferta[],
  doPadrao: readonly ModalidadeDaOferta[],
): boolean {
  if (daOferta.length !== doPadrao.length) return false;

  const noPadrao = new Set(doPadrao.map((modalidade) => modalidade.id));
  return daOferta.every((modalidade) => noPadrao.has(modalidade.id));
}

/**
 * Confronta o total de vagas do processo com o que o ato de autorização
 * concede à oferta.
 *
 * É regra do cadastro, não da Lei de Cotas: por isso vive fora de
 * `problemasDaDistribuicao`, que trata das invariantes da própria
 * distribuição. Oferta sem vagas autorizadas registradas não impõe teto — a
 * ausência do dado não é permissão nem proibição.
 *
 * Total malformado devolve `null`: a forma já é recusada em outro lugar, e
 * empilhar duas mensagens sobre o mesmo campo não ajuda quem preenche.
 */
export function problemaDeVagasAutorizadas(
  voBase: string,
  vagasAutorizadas: number | null,
): string | null {
  const informado = voBase.trim();
  if (vagasAutorizadas === null || !/^[1-9]\d*$/.test(informado)) return null;

  const total = Number(informado);
  return total > vagasAutorizadas
    ? `O total de vagas (${total}) passa das ${vagasAutorizadas} autorizadas para a oferta.`
    : null;
}

/**
 * Traduz a composição como o detalhe do processo a emite.
 *
 * O catálogo de Configuração publica o token canônico (`RETIRA_DE`), mas o
 * detalhe de Seleção serializa o nome do membro do enum (`RetiraDe`) — a
 * assimetria de contrato registrada em uniplus-api#1294. O resto da tela
 * compara com o canônico, então a grafia do detalhe se resolve aqui.
 *
 * Composição fora do vocabulário devolve `null`: o que a tela não reconhece é
 * ausência de informação, não uma composição a inventar.
 */
export function decodificarComposicaoVagas(valor: string): string | null {
  const procurada = semGrafia(valor);
  return (
    [...COMPOSICOES_CALCULADAS, ...COMPOSICOES_DECLARADAS].find(
      (composicao) => semGrafia(composicao) === procurada,
    ) ?? null
  );
}

/** Ignora o que separa as duas grafias do mesmo token: o `_` e a caixa. */
function semGrafia(valor: string): string {
  return valor.replace(/_/g, '').toLowerCase();
}

/**
 * A quantidade desta composição é fixada pelo edital, e não calculada pela
 * regra. Fora do ramo federal o edital fixa todas; dentro dele, o motor calcula
 * o que deriva do VR e do residual, e informá-las é recusado.
 */
export function quantidadeEhDeclarada(composicaoVagas: string, federal: boolean): boolean {
  return !federal || COMPOSICOES_DECLARADAS.includes(composicaoVagas);
}

/**
 * As modalidades do catálogo que o rol admitido de uma regra reconhece.
 *
 * A regra determina o rol — não filtra uma escolha do operador dentro dele.
 * `null` é rol aberto (`DISTRIB-VAGAS-INSTITUCIONAL`, ou nenhuma regra ainda
 * escolhida): devolve o catálogo inteiro, mantendo a seleção livre.
 */
export function modalidadesDoRol<T extends { readonly codigo: string }>(
  catalogo: readonly T[],
  rol: readonly string[] | null,
): readonly T[] {
  return rol === null ? catalogo : catalogo.filter((modalidade) => rol.includes(modalidade.codigo));
}

const PR_MINIMO = 0.5;
const PR_MAXIMO = 1;
const CASAS_DECIMAIS_PR = 4;

/**
 * Antecipa as invariantes que o agregado declara, para o operador não
 * descobri-las depois de preencher a tela inteira.
 *
 * Não replica o cálculo do quadro: `vrNominal`, `vrFinal`, `estouro` e
 * `capadoEmVo` vêm da simulação, e reimplementar a Lei de Cotas aqui seria a
 * divergência mais provável desta tela. A API é árbitra.
 */
/**
 * De onde vem cada recusa, e por isso onde ela deve ser dita.
 *
 * `padrao` vale para todas as ofertas — repeti-la por linha faria o operador
 * ler três vezes que falta um campo só. `preenchimento` é campo vazio, já
 * marcado na própria célula. `oferta` é o que só aquela linha tem.
 */
export type EscopoDoProblema = 'padrao' | 'preenchimento' | 'oferta';

export interface ProblemaDaDistribuicao {
  readonly escopo: EscopoDoProblema;
  readonly mensagem: string;
}

export function problemasDaDistribuicao(
  distribuicao: DistribuicaoDeVagas,
  catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>,
  rol: readonly string[] | null = null,
): ProblemaDaDistribuicao[] {
  const federal = ehRamoFederal(distribuicao.regraDistribuicaoCodigo);
  const excesso = problemaDeSomaDoQuadro(distribuicao, catalogo);

  return [
    ...comEscopo('preenchimento', problemasDeVoBase(distribuicao.voBase)),
    ...comEscopo('padrao', problemasDePr(distribuicao.pr)),
    ...comEscopo('padrao', problemasDeModalidades(distribuicao, catalogo, federal)),
    ...comEscopo('oferta', problemasDeModalidadeForaDoCatalogo(distribuicao, catalogo)),
    ...comEscopo('oferta', problemasDeModalidadeForaDoRol(distribuicao, rol)),
    ...problemasDeQuadro(distribuicao, catalogo, federal),
    ...comEscopo('padrao', problemasDeReferencias(distribuicao, federal)),
    ...comEscopo('oferta', excesso === null ? [] : [excesso]),
  ];
}

/**
 * Modalidade que a oferta guarda mas o cadastro não tem mais.
 *
 * A distribuição gravada é um instantâneo e preserva a modalidade mesmo depois
 * de o cadastro a excluir. A tela monta as colunas a partir do catálogo vivo,
 * então a quantidade dessa modalidade não aparece em lugar nenhum — e seguiria
 * no comando de gravação sem que ninguém a tivesse visto, fora do teto do
 * quadro por não haver composição que a classifique. Refazer a oferta é o que
 * devolve o quadro ao que a tela sabe mostrar.
 *
 * Catálogo vazio é catálogo ainda não carregado: sem ele não se afirma que uma
 * modalidade saiu do cadastro.
 */
function problemasDeModalidadeForaDoCatalogo(
  distribuicao: DistribuicaoDeVagas,
  catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>,
): string[] {
  if (catalogo.size === 0) return [];

  return distribuicao.modalidades
    .filter((modalidade) => !catalogo.has(modalidade.id))
    .map(
      (modalidade) =>
        `${modalidade.codigo} não está mais no cadastro de modalidades: remova esta oferta do quadro e configure-a novamente.`,
    );
}

/**
 * Modalidade que a oferta guarda mas o rol da regra atual não admite, ou que
 * o rol exige e a oferta não tem — as duas metades da mesma invariante: rol
 * fechado é conjunto EXATO, não teto (espelha
 * `ConfiguracaoDistribuicaoVagas.Criar` do uniplus-api).
 *
 * A distribuição gravada é um instantâneo: um processo hidratado pode trazer
 * uma seleção que já esteve certa e não está mais (regra reeditada no
 * catálogo, ou processo de antes desta tela derivar o rol). A seleção
 * derivada não esconde a divergência — quem preenche precisa saber que ela
 * existe. Nenhuma das duas mensagens prescreve remover ou marcar uma
 * modalidade avulsa: para rol fechado não há esse controle na tela (só o
 * rol inteiro é oferecido) — a saída é recompor a seleção pelo rol atual.
 *
 * `rol` nulo é rol aberto: nada fica de fora dele, nada falta dele.
 */
function problemasDeModalidadeForaDoRol(
  distribuicao: DistribuicaoDeVagas,
  rol: readonly string[] | null,
): string[] {
  if (rol === null) return [];

  const codigosSelecionados = distribuicao.modalidades.map((modalidade) => modalidade.codigo);

  const excedentes = codigosSelecionados
    .filter((codigo) => !rol.includes(codigo))
    .map(
      (codigo) =>
        `${codigo} não pertence ao rol que ${distribuicao.regraDistribuicaoCodigo} admite — a seleção desta oferta precisa corresponder exatamente ao rol da regra atual.`,
    );

  const faltantes = rol
    .filter((codigo) => !codigosSelecionados.includes(codigo))
    .map(
      (codigo) =>
        `${codigo} pertence ao rol que ${distribuicao.regraDistribuicaoCodigo} exige e não está selecionada nesta oferta — a seleção desta oferta precisa corresponder exatamente ao rol da regra atual.`,
    );

  return [...excedentes, ...faltantes];
}

function comEscopo(
  escopo: EscopoDoProblema,
  mensagens: readonly string[],
): ProblemaDaDistribuicao[] {
  return mensagens.map((mensagem) => ({ escopo, mensagem }));
}

function problemasDeVoBase(voBase: string): string[] {
  const numero = inteiroDe(voBase);
  return numero === null || numero <= 0
    ? ['Informe o total de vagas da oferta como número inteiro maior que zero.']
    : [];
}

function problemasDePr(pr: string): string[] {
  const numero = decimalDe(pr);
  if (numero === null) {
    return [
      'Informe o percentual de reserva no padrão desta distribuição — um número entre 0,5 e 1,0.',
    ];
  }

  const problemas: string[] = [];
  if (numero < PR_MINIMO || numero > PR_MAXIMO) {
    problemas.push('O percentual de reserva fica entre 0,5 e 1,0 (art. 10, II da Lei 12.711).');
  }
  if (casasDecimais(pr) > CASAS_DECIMAIS_PR) {
    problemas.push(`O percentual de reserva aceita no máximo ${CASAS_DECIMAIS_PR} casas decimais.`);
  }
  return problemas;
}

function problemasDeModalidades(
  distribuicao: DistribuicaoDeVagas,
  catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>,
  federal: boolean,
): string[] {
  const modalidadeIds = distribuicao.modalidades.map((modalidade) => modalidade.id);
  if (modalidadeIds.length === 0) return ['Selecione ao menos uma modalidade para esta oferta.'];

  const problemas: string[] = [];
  if (new Set(modalidadeIds).size !== modalidadeIds.length) {
    problemas.push('Cada modalidade só pode ser selecionada uma vez nesta oferta.');
  }

  problemas.push(...problemasDeDependencia(modalidadeIds, catalogo, federal));
  return problemas;
}

/**
 * Modalidade que retira de outra, ou que remaneja para outra, exige a
 * companheira selecionada na mesma oferta — senão a regra não tem como ser
 * aplicada quando a vaga sobrar.
 */
function problemasDeDependencia(
  modalidadeIds: readonly string[],
  catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>,
  federal: boolean,
): string[] {
  const codigosSelecionados = new Set(
    modalidadeIds.map((id) => catalogo.get(id)?.codigo).filter((codigo) => codigo !== undefined),
  );

  const exigencias = modalidadeIds.flatMap((id) => {
    const modalidade = catalogo.get(id);
    if (modalidade === undefined) return [];

    return [
      ...(federal && modalidade.composicaoVagas === 'RETIRA_DE'
        ? [{ codigo: modalidade.composicaoOrigemCodigo, papel: 'a origem da retirada' }]
        : []),
      ...(modalidade.regraRemanejamento === 'DESTINO_UNICO'
        ? [{ codigo: modalidade.remanejamentoDestino, papel: 'o destino do remanejamento' }]
        : []),
      ...(modalidade.regraRemanejamento === 'CRUZADO'
        ? [
            { codigo: modalidade.remanejamentoPar, papel: 'o par do remanejamento' },
            { codigo: modalidade.remanejamentoFallback, papel: 'o fallback do remanejamento' },
          ]
        : []),
    ].map((exigencia) => ({ ...exigencia, de: modalidade.codigo }));
  });

  return exigencias
    .filter(({ codigo }) => codigo !== null && !codigosSelecionados.has(codigo))
    .map(({ de, papel, codigo }) => `${de} exige ${papel} (${codigo}) selecionado nesta oferta.`);
}

/**
 * A fronteira da quantidade depende da regra: fora do ramo federal toda
 * modalidade selecionada tem quantidade fixada pelo edital; nele, só as de
 * composição declarada, porque as demais são calculadas pelo motor.
 */
function problemasDeQuadro(
  distribuicao: DistribuicaoDeVagas,
  catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>,
  federal: boolean,
): ProblemaDaDistribuicao[] {
  const selecionadas = new Set(distribuicao.modalidades.map((modalidade) => modalidade.id));
  const fixadas = new Map(distribuicao.quadro.map((item) => [item.modalidadeId, item.quantidade]));
  const repetida = fixadas.size !== distribuicao.quadro.length;

  return [
    ...(repetida
      ? [{ escopo: 'padrao' as const, mensagem: 'O quadro não pode repetir a mesma modalidade.' }]
      : []),
    ...[...fixadas].flatMap(([modalidadeId, quantidade]) =>
      problemasDaQuantidadeFixada(modalidadeId, quantidade, selecionadas, catalogo),
    ),
    ...[...selecionadas].flatMap((modalidadeId) =>
      problemasDaModalidadeSelecionada(modalidadeId, fixadas.has(modalidadeId), catalogo, federal),
    ),
  ];
}

/** O que o edital fixou precisa pertencer à oferta e ser inteiro não negativo. */
function problemasDaQuantidadeFixada(
  modalidadeId: string,
  quantidade: string,
  selecionadas: ReadonlySet<string>,
  catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>,
): ProblemaDaDistribuicao[] {
  if (!selecionadas.has(modalidadeId)) {
    return [
      {
        escopo: 'padrao',
        mensagem: `${rotulo(modalidadeId, catalogo)} tem quantidade fixada mas não está selecionada nesta oferta.`,
      },
    ];
  }

  const numero = inteiroDe(quantidade);
  return numero === null || numero < 0
    ? [
        {
          escopo: 'preenchimento',
          mensagem: `Informe a quantidade de ${rotulo(modalidadeId, catalogo)} como inteiro não negativo.`,
        },
      ]
    : [];
}

/**
 * Quem declara a quantidade: o edital ou a regra. No ramo federal o motor
 * calcula as que derivam do VR e do residual, e fixá-las é recusado.
 */
function problemasDaModalidadeSelecionada(
  modalidadeId: string,
  temQuantidade: boolean,
  catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>,
  federal: boolean,
): ProblemaDaDistribuicao[] {
  const composicao = catalogo.get(modalidadeId)?.composicaoVagas;
  const calculadaPelaRegra =
    federal && composicao !== undefined && COMPOSICOES_CALCULADAS.includes(composicao);

  if (calculadaPelaRegra) {
    return temQuantidade
      ? [
          {
            escopo: 'oferta',
            mensagem: `A quantidade de ${rotulo(modalidadeId, catalogo)} é calculada pela Lei 12.711 — não pode ser fixada pelo edital.`,
          },
        ]
      : [];
  }

  const exigeDeclaracao =
    !federal || (composicao !== undefined && COMPOSICOES_DECLARADAS.includes(composicao));

  return exigeDeclaracao && !temQuantidade
    ? [
        {
          escopo: 'preenchimento',
          mensagem: `Informe a quantidade de vagas de ${rotulo(modalidadeId, catalogo)}.`,
        },
      ]
    : [];
}

function problemasDeReferencias(distribuicao: DistribuicaoDeVagas, federal: boolean): string[] {
  const semRegra =
    distribuicao.regraDistribuicaoCodigo === '' || distribuicao.regraDistribuicaoVersao === '';

  return [
    ...(semRegra ? ['Escolha a regra de distribuição de vagas.'] : []),
    ...(federal ? exigenciasDaLei12711(distribuicao) : recusasForaDaLei12711(distribuicao)),
  ];
}

/** O que o ramo federal acrescenta às referências do edital. */
function exigenciasDaLei12711(distribuicao: DistribuicaoDeVagas): string[] {
  const semAjuste =
    distribuicao.regraAjusteCodigo === null || distribuicao.regraAjusteVersao === null;

  return [
    ...(distribuicao.referenciaReservaDemograficaId === null
      ? ['A distribuição pela Lei 12.711 exige a referência de reserva demográfica.']
      : []),
    ...(semAjuste
      ? ['A distribuição pela Lei 12.711 exige a regra de ajuste (art. 11, § único).']
      : []),
  ];
}

/** Fora do ramo federal, a referência demográfica não tem onde ser aplicada. */
function recusasForaDaLei12711(distribuicao: DistribuicaoDeVagas): string[] {
  return distribuicao.referenciaReservaDemograficaId === null
    ? []
    : ['A referência de reserva demográfica só se aplica à distribuição pela Lei 12.711.'];
}

/** Ofertas repetidas no mesmo processo — UNI-REQ-0134. */
export function ofertasRepetidas(distribuicoes: readonly DistribuicaoDeVagas[]): string[] {
  const vistas = new Set<string>();
  const repetidas = new Set<string>();

  for (const { ofertaCursoId } of distribuicoes) {
    if (vistas.has(ofertaCursoId)) repetidas.add(ofertaCursoId);
    vistas.add(ofertaCursoId);
  }

  return [...repetidas];
}

function rotulo(modalidadeId: string, catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>): string {
  return catalogo.get(modalidadeId)?.codigo ?? 'a modalidade';
}

// A gramática destes dois campos é a mesma dos demais campos numéricos do
// editor, e vive em `shared/numero-do-campo` para não divergir entre passos.
const inteiroDe = inteiroDoCampo;
const decimalDe = decimalDoCampo;

function casasDecimais(texto: string): number {
  const fracao = texto.trim().replace(',', '.').split('.')[1];
  return fracao?.length ?? 0;
}
