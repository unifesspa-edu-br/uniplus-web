import {
  PAPEL_DEFINITIVO,
  PAPEL_PRELIMINAR,
  type BancaRequeridaDaFase,
  type FaseDoCronograma,
} from '../../processo-seletivo.models';

import { problemasDaRegra } from '../../shared/deliberacao/conferencia-da-regra';
import type { CampoDaBanca } from '../../shared/deliberacao/recusas-da-regra';
import { repetidos } from '../../shared/repetidos';
import { problemasDoRecurso } from './problemas-do-recurso-da-fase';

/** Um campo da regra de deliberação da banca que ocupa a posição `n` entre as requeridas. */
export type CampoDaBancaRequerida = `bancasRequeridas.${number}.${CampoDaBanca}`;

/**
 * Onde a mensagem de recusa aparece. É a chave que liga a conferência — e a
 * recusa do servidor — ao controle que a exibe: sem ela, tudo cairia no
 * resumo genérico do topo, e quem preencheu não saberia qual campo corrigir.
 *
 * `null` é o que não pertence a campo nenhum, e continua indo para o resumo.
 */
export type CampoDaFase =
  | 'produtos'
  | 'emiteParecerIndividual'
  | 'bancasRequeridas'
  | CampoDaBancaRequerida
  | 'recurso.regra'
  | 'recurso.ancora'
  | 'recurso.admiteInstanciaSuperior';

export interface ProblemaDaFase {
  readonly campo: CampoDaFase | null;
  readonly mensagem: string;
}

/** O que a tela precisa saber sobre um tipo de ato para conferir um produto. */
export interface AtoDoCatalogo {
  readonly nome: string;
  readonly ehResultado: boolean;
}

/**
 * O que impede gravar a configuração desta fase, com o campo de cada recusa.
 *
 * Só entra aqui o que a tela consegue afirmar com o que tem em mãos. Vigência do
 * ato, existência do tipo de banca no cadastro e coerência da regra com o
 * `rol_de_regras` continuam sendo do servidor: repetir a conferência aqui daria
 * duas fontes para a mesma regra, e a que ficasse desatualizada recusaria o que
 * o servidor aceita.
 *
 * A ordem importa. Dentro de um assunto, a primeira recusa é a que orienta —
 * cobrar a unidade do prazo antes de existir prazo mandaria corrigir o campo
 * errado.
 */
export function problemasDaFase(
  fase: FaseDoCronograma,
  atoPorCodigo: ReadonlyMap<string, AtoDoCatalogo>,
  nomeDaBanca: (tipoBancaId: string) => string,
): readonly ProblemaDaFase[] {
  return [
    ...problemasDosProdutos(fase, atoPorCodigo),
    ...problemasDoParecer(fase),
    ...problemasDoRecurso(fase),
    ...problemasDasBancas(fase, nomeDaBanca),
    ...problemasDasRegrasDasBancas(fase),
  ];
}

function problemasDosProdutos(
  fase: FaseDoCronograma,
  atoPorCodigo: ReadonlyMap<string, AtoDoCatalogo>,
): readonly ProblemaDaFase[] {
  return [
    ...problemaDeProdutoEmBranco(fase),
    ...problemaDePublicacaoRepetida(fase),
    ...problemasDePapelEmAtoQueNaoEResultado(fase, atoPorCodigo),
  ];
}

function problemaDeProdutoEmBranco(fase: FaseDoCronograma): readonly ProblemaDaFase[] {
  if (!fase.produtos.some((produto) => produto.atoCodigo === '')) return [];
  return [
    {
      campo: 'produtos',
      mensagem: 'Escolha o tipo de ato de cada publicação declarada, ou remova a linha em branco.',
    },
  ];
}

// A chave é o par ato + papel, e não o ato sozinho: o catálogo nomeia a matéria,
// e a mesma matéria é publicada uma vez como preliminar — que abre o ciclo
// recursal — e outra como definitiva, que o encerra.
function problemaDePublicacaoRepetida(fase: FaseDoCronograma): readonly ProblemaDaFase[] {
  const declarados = fase.produtos
    .filter((produto) => produto.atoCodigo !== '')
    .map((produto) => `${produto.atoCodigo}\u0000${produto.papel ?? ''}`);
  if (repetidos(declarados).length === 0) return [];
  return [
    {
      campo: 'produtos',
      mensagem: 'A fase não pode declarar a mesma publicação duas vezes no mesmo papel.',
    },
  ];
}

// O catálogo é quem diz se um ato é resultado, e é essa marca que decide se a
// publicação pode receber papel. Ato que o catálogo carregado não conhece não
// é acusado aqui: quem arbitra é o servidor, e recusar por desconhecimento
// bloquearia a edição de um cronograma que ele aceita.
function problemasDePapelEmAtoQueNaoEResultado(
  fase: FaseDoCronograma,
  atoPorCodigo: ReadonlyMap<string, AtoDoCatalogo>,
): readonly ProblemaDaFase[] {
  return fase.produtos.flatMap((produto) => {
    const ato = produto.papel === null ? undefined : atoPorCodigo.get(produto.atoCodigo);
    return ato === undefined || ato.ehResultado ? [] : [papelEmAtoQueNaoEResultado(ato)];
  });
}

function papelEmAtoQueNaoEResultado(ato: AtoDoCatalogo): ProblemaDaFase {
  return {
    campo: 'produtos',
    mensagem: `A publicação ${ato.nome} não é resultado no catálogo e não recebe papel preliminar nem definitivo.`,
  };
}

function problemasDoParecer(fase: FaseDoCronograma): readonly ProblemaDaFase[] {
  if (!fase.emiteParecerIndividual) return [];
  const publicaResultado = fase.produtos.some((produto) => produto.papel !== null);

  return publicaResultado
    ? []
    : [
        {
          campo: 'emiteParecerIndividual',
          mensagem:
            'A fase promete parecer individual e não publica nenhum resultado. Declare a publicação, ou tire a promessa.',
        },
      ];
}

/**
 * As bancas requeridas e o recorte de competência de cada uma.
 *
 * O recorte só é obrigatório quando o mesmo tipo de banca aparece mais de uma
 * vez na fase — é ele que diz qual das duas julga o quê. Com uma banca só, o
 * recorte vazio significa "julga tudo o que a fase exige".
 */
function problemasDasBancas(
  fase: FaseDoCronograma,
  nomeDaBanca: (tipoBancaId: string) => string,
): readonly ProblemaDaFase[] {
  const recortesPorTipo = [...recortesDeCompetenciaPorTipo(fase)].flatMap(
    ([tipoBancaId, recortes]) => problemaDoRecorte(nomeDaBanca(tipoBancaId), recortes),
  );
  return [...problemaDeBancaEmBranco(fase), ...recortesPorTipo];
}

function problemaDeBancaEmBranco(fase: FaseDoCronograma): readonly ProblemaDaFase[] {
  if (!fase.bancasRequeridas.some((banca) => banca.tipoBancaId === '')) return [];
  return [
    {
      campo: 'bancasRequeridas',
      mensagem: 'Escolha o tipo de cada banca requerida, ou remova a linha em branco.',
    },
  ];
}

function problemasDasRegrasDasBancas(fase: FaseDoCronograma): readonly ProblemaDaFase[] {
  return fase.bancasRequeridas.flatMap(problemasDaRegraDaBanca);
}

function problemasDaRegraDaBanca(
  banca: BancaRequeridaDaFase,
  posicao: number,
): readonly ProblemaDaFase[] {
  if (banca.regraDeDeliberacao === null) return [];
  return problemasDaRegra(banca.regraDeDeliberacao).map(({ campo, mensagem }) => ({
    campo: `bancasRequeridas.${posicao}.${campo}`,
    mensagem,
  }));
}

function recortesDeCompetenciaPorTipo(fase: FaseDoCronograma): ReadonlyMap<string, string[][]> {
  const porTipo = new Map<string, string[][]>();
  for (const banca of fase.bancasRequeridas) {
    if (banca.tipoBancaId === '') continue;
    const recortes = porTipo.get(banca.tipoBancaId) ?? [];
    recortes.push([...banca.categoriasDocumentoIds].sort());
    porTipo.set(banca.tipoBancaId, recortes);
  }
  return porTipo;
}

function problemaDoRecorte(nome: string, recortes: readonly string[][]): readonly ProblemaDaFase[] {
  if (recortes.length === 1) return [];
  const mensagem = mensagemDoRecorte(nome, recortes);
  return mensagem === null ? [] : [{ campo: 'bancasRequeridas', mensagem }];
}

function mensagemDoRecorte(nome: string, recortes: readonly string[][]): string | null {
  if (recortes.some((item) => item.length === 0)) {
    return `A fase requer mais de uma banca de ${nome}: cada uma precisa declarar as categorias de documento que julga.`;
  }
  if (repetidos(recortes.map((item) => item.join('|'))).length === 0) return null;
  return `Duas bancas de ${nome} declaram o mesmo recorte de competência — não haveria como saber qual julga o quê.`;
}

/** Como a tela nomeia o papel de uma publicação nos seletores. */
export const PAPEIS_ESCOLHIVEIS = [
  { valor: '', rotulo: 'Não é resultado' },
  { valor: PAPEL_PRELIMINAR, rotulo: 'Resultado preliminar' },
  { valor: PAPEL_DEFINITIVO, rotulo: 'Resultado definitivo' },
] as const;
