import { ComposicaoVagasCodigo, RegraRemanejamentoCodigo } from '@uniplus/shared-data/configuracao';

import { DistribuicaoDeVagas } from '../../processo-seletivo.models';

import { repetidos } from '../../shared/repetidos';
import { COMPOSICOES_CALCULADAS, COMPOSICOES_DECLARADAS } from './composicao-de-vagas';
import { ModalidadeDoCatalogo } from './modalidades-da-distribuicao';
import { ProblemaDaDistribuicao } from './problema-da-distribuicao';
import { inteiroDoCampo } from '../../shared/numero-do-campo';

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
export function problemasDeModalidadeForaDoCatalogo(
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
export function problemasDeModalidadeForaDoRol(
  distribuicao: DistribuicaoDeVagas,
  rol: readonly string[] | null,
): string[] {
  if (rol === null) return [];

  const codigosSelecionados = distribuicao.modalidades.map((modalidade) => modalidade.codigo);

  return [
    ...modalidadesExcedentes(distribuicao, codigosSelecionados, rol),
    ...modalidadesFaltantes(distribuicao, codigosSelecionados, rol),
  ];
}

function modalidadesExcedentes(
  distribuicao: DistribuicaoDeVagas,
  codigosSelecionados: readonly string[],
  rol: readonly string[],
): string[] {
  return codigosSelecionados
    .filter((codigo) => !rol.includes(codigo))
    .map(
      (codigo) =>
        `${codigo} não pertence ao rol que ${distribuicao.regraDistribuicaoCodigo} admite — a seleção desta oferta precisa corresponder exatamente ao rol da regra atual.`,
    );
}

function modalidadesFaltantes(
  distribuicao: DistribuicaoDeVagas,
  codigosSelecionados: readonly string[],
  rol: readonly string[],
): string[] {
  return rol
    .filter((codigo) => !codigosSelecionados.includes(codigo))
    .map(
      (codigo) =>
        `${codigo} pertence ao rol que ${distribuicao.regraDistribuicaoCodigo} exige e não está selecionada nesta oferta — a seleção desta oferta precisa corresponder exatamente ao rol da regra atual.`,
    );
}

export function problemasDeModalidades(
  distribuicao: DistribuicaoDeVagas,
  catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>,
  federal: boolean,
): string[] {
  const modalidadeIds = distribuicao.modalidades.map((modalidade) => modalidade.id);
  if (modalidadeIds.length === 0) return ['Selecione ao menos uma modalidade para esta oferta.'];

  const problemas: string[] = [];
  if (repetidos(modalidadeIds).length > 0)
    problemas.push('Cada modalidade só pode ser selecionada uma vez nesta oferta.');

  problemas.push(...problemasDeDependencia(modalidadeIds, catalogo, federal));
  return problemas;
}

interface ExigenciaDeCompanheira {
  readonly codigo: string | null;
  readonly papel: string;
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
  const selecionadas = modalidadeIds.map((id) => catalogo.get(id));
  const codigosSelecionados = new Set(selecionadas.map((modalidade) => modalidade?.codigo));

  return selecionadas
    .flatMap((modalidade) => (modalidade ? exigenciasDaModalidade(modalidade, federal) : []))
    .filter(({ codigo }) => codigo !== null && !codigosSelecionados.has(codigo))
    .map(({ de, papel, codigo }) => `${de} exige ${papel} (${codigo}) selecionado nesta oferta.`);
}

function exigenciasDaModalidade(modalidade: ModalidadeDoCatalogo, federal: boolean) {
  return [
    ...exigenciaDaRetirada(modalidade, federal),
    ...exigenciasDoRemanejamento(modalidade),
  ].map((exigencia) => ({ ...exigencia, de: modalidade.codigo }));
}

function exigenciaDaRetirada(
  modalidade: ModalidadeDoCatalogo,
  federal: boolean,
): ExigenciaDeCompanheira[] {
  return federal &&
    modalidade.composicaoVagas === ComposicaoVagasCodigo.RETIRADA_DE_OUTRA_MODALIDADE
    ? [{ codigo: modalidade.composicaoOrigemCodigo, papel: 'a origem da retirada' }]
    : [];
}

function exigenciasDoRemanejamento(modalidade: ModalidadeDoCatalogo): ExigenciaDeCompanheira[] {
  switch (modalidade.regraRemanejamento) {
    case RegraRemanejamentoCodigo.DESTINO_UNICO:
      return [{ codigo: modalidade.remanejamentoDestino, papel: 'o destino do remanejamento' }];
    case RegraRemanejamentoCodigo.CRUZADO:
      return [
        { codigo: modalidade.remanejamentoPar, papel: 'o par do remanejamento' },
        { codigo: modalidade.remanejamentoFallback, papel: 'o destino final do remanejamento' },
      ];
    default:
      return [];
  }
}

/**
 * A fronteira da quantidade depende da regra: fora do ramo federal toda
 * modalidade selecionada tem quantidade fixada pelo edital; nele, só as de
 * composição declarada, porque as demais são calculadas pelo motor.
 */
export function problemasDeQuadro(
  distribuicao: DistribuicaoDeVagas,
  catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>,
  federal: boolean,
): ProblemaDaDistribuicao[] {
  const selecionadas = new Set(distribuicao.modalidades.map((modalidade) => modalidade.id));
  const fixadas = new Map(distribuicao.quadro.map((item) => [item.modalidadeId, item.quantidade]));
  return [
    ...problemasDeRepeticaoNoQuadro(distribuicao),
    ...[...fixadas].flatMap(([modalidadeId, quantidade]) =>
      problemasDaQuantidadeFixada(modalidadeId, quantidade, selecionadas, catalogo),
    ),
    ...problemasDasModalidadesSelecionadas(selecionadas, fixadas, catalogo, federal),
  ];
}

function problemasDasModalidadesSelecionadas(
  selecionadas: ReadonlySet<string>,
  fixadas: ReadonlyMap<string, string>,
  catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>,
  federal: boolean,
): ProblemaDaDistribuicao[] {
  return [...selecionadas].flatMap((id) =>
    problemasDaModalidadeSelecionada(id, fixadas.has(id), catalogo, federal),
  );
}

function problemasDeRepeticaoNoQuadro(distribuicao: DistribuicaoDeVagas): ProblemaDaDistribuicao[] {
  const repetida = repetidos(distribuicao.quadro.map((item) => item.modalidadeId)).length > 0;
  return repetida
    ? [{ escopo: 'padrao', mensagem: 'O quadro não pode repetir a mesma modalidade.' }]
    : [];
}

/** O que o edital fixou precisa pertencer à oferta e ser inteiro não negativo. */
function problemasDaQuantidadeFixada(
  modalidadeId: string,
  quantidade: string,
  selecionadas: ReadonlySet<string>,
  catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>,
): ProblemaDaDistribuicao[] {
  if (!selecionadas.has(modalidadeId)) {
    return [problemaDeQuantidadeSemModalidade(modalidadeId, catalogo)];
  }

  const numero = inteiroDoCampo(quantidade);
  return numero === null || numero < 0
    ? [problemaDeQuantidadeInvalida(modalidadeId, catalogo)]
    : [];
}

function problemaDeQuantidadeInvalida(
  modalidadeId: string,
  catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>,
): ProblemaDaDistribuicao {
  return {
    escopo: 'preenchimento',
    mensagem: `Informe a quantidade de ${rotulo(modalidadeId, catalogo)} como inteiro não negativo.`,
  };
}

function problemaDeQuantidadeSemModalidade(
  modalidadeId: string,
  catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>,
): ProblemaDaDistribuicao {
  return {
    escopo: 'padrao',
    mensagem: `${rotulo(modalidadeId, catalogo)} tem quantidade fixada mas não está selecionada nesta oferta.`,
  };
}

/**
 * Quem declara a quantidade: o edital ou a regra. No ramo federal o motor
 * calcula as que derivam da reserva legal e do restante das vagas ofertadas, e fixá-las é recusado.
 */
function problemasDaModalidadeSelecionada(
  modalidadeId: string,
  temQuantidade: boolean,
  catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>,
  federal: boolean,
): ProblemaDaDistribuicao[] {
  const composicao = catalogo.get(modalidadeId)?.composicaoVagas;
  if (federal && composicao !== undefined && COMPOSICOES_CALCULADAS.includes(composicao)) {
    return temQuantidade ? [problemaDeQuantidadeCalculada(modalidadeId, catalogo)] : [];
  }

  return exigeQuantidadeDeclarada(composicao, federal) && !temQuantidade
    ? [problemaDeQuantidadeAusente(modalidadeId, catalogo)]
    : [];
}

function exigeQuantidadeDeclarada(
  composicao: ModalidadeDoCatalogo['composicaoVagas'] | undefined,
  federal: boolean,
): boolean {
  return !federal || (composicao !== undefined && COMPOSICOES_DECLARADAS.includes(composicao));
}

function problemaDeQuantidadeAusente(
  modalidadeId: string,
  catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>,
): ProblemaDaDistribuicao {
  return {
    escopo: 'preenchimento',
    mensagem: `Informe a quantidade de vagas de ${rotulo(modalidadeId, catalogo)}.`,
  };
}

function problemaDeQuantidadeCalculada(
  modalidadeId: string,
  catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>,
): ProblemaDaDistribuicao {
  return {
    escopo: 'oferta',
    mensagem: `A quantidade de ${rotulo(modalidadeId, catalogo)} é calculada pela Lei 12.711 — não pode ser fixada pelo edital.`,
  };
}

export function problemasDeReferencias(
  distribuicao: DistribuicaoDeVagas,
  federal: boolean,
): string[] {
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

function rotulo(modalidadeId: string, catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>): string {
  return catalogo.get(modalidadeId)?.codigo ?? 'a modalidade';
}
