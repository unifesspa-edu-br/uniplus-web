import {
  PAPEL_DEFINITIVO,
  PAPEL_PRELIMINAR,
  type FaseDoCronograma,
} from '../../processo-seletivo.models';

import { problemasDoRecurso, produtosPreliminares } from './problemas-do-recurso-da-fase';

/** A fase encerra a matéria que abriu: do que ela publica não cabe mais recurso. */
export function publicaResultadoDefinitivo(produtos: FaseDoCronograma['produtos']): boolean {
  return produtos.some((produto) => produto.papel === PAPEL_DEFINITIVO);
}

/**
 * Onde a mensagem de recusa aparece. É a chave que liga a conferência — e a
 * recusa do servidor — ao controle que a exibe: sem ela, tudo cairia no
 * resumo genérico do topo, e quem preencheu não saberia qual campo corrigir.
 *
 * `null` é o que não pertence a campo nenhum, e continua indo para o resumo.
 */
export type CampoDaFase =
  | 'produtos'
  | 'faseConcluinteCodigo'
  | 'emiteParecerIndividual'
  | 'bancasRequeridas'
  | 'recurso.regra'
  | 'recurso.prazo'
  | 'recurso.ancora'
  | 'recurso.suspensividadePrimeiraInstancia'
  | 'recurso.admiteInstanciaSuperior'
  | 'recurso.suspensividadeSegundaInstancia';

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
  fases: readonly FaseDoCronograma[],
  atoPorCodigo: ReadonlyMap<string, AtoDoCatalogo>,
  nomeDaBanca: (tipoBancaId: string) => string,
): readonly ProblemaDaFase[] {
  return [
    ...problemasDosProdutos(fase, atoPorCodigo),
    ...problemasDaConclusao(fase, fases),
    ...problemasDoParecer(fase),
    ...problemasDoRecurso(fase),
    ...problemasDasBancas(fase, nomeDaBanca),
  ];
}

function problemasDosProdutos(
  fase: FaseDoCronograma,
  atoPorCodigo: ReadonlyMap<string, AtoDoCatalogo>,
): readonly ProblemaDaFase[] {
  const problemas: ProblemaDaFase[] = [];

  if (fase.produtos.some((produto) => produto.atoCodigo === '')) {
    problemas.push({
      campo: 'produtos',
      mensagem: 'Escolha o tipo de ato de cada publicação declarada, ou remova a linha em branco.',
    });
  }

  // A chave é o par ato + papel, e não o ato sozinho: o catálogo nomeia a matéria,
  // e a mesma matéria é publicada uma vez como preliminar — que abre o ciclo
  // recursal — e outra como definitiva, que o encerra.
  const declarados = fase.produtos
    .filter((produto) => produto.atoCodigo !== '')
    .map((produto) => `${produto.atoCodigo}\u0000${produto.papel ?? ''}`);
  if (new Set(declarados).size !== declarados.length) {
    problemas.push({
      campo: 'produtos',
      mensagem: 'A fase não pode declarar a mesma publicação duas vezes no mesmo papel.',
    });
  }

  // O catálogo é quem diz se um ato é resultado, e é essa marca que decide se a
  // publicação pode receber papel. Ato que o catálogo carregado não conhece não
  // é acusado aqui: quem arbitra é o servidor, e recusar por desconhecimento
  // bloquearia a edição de um cronograma que ele aceita.
  for (const produto of fase.produtos) {
    if (produto.papel === null) continue;
    const ato = atoPorCodigo.get(produto.atoCodigo);
    if (ato !== undefined && !ato.ehResultado) {
      problemas.push({
        campo: 'produtos',
        mensagem: `A publicação ${ato.nome} não é resultado no catálogo e não recebe papel preliminar nem definitivo.`,
      });
    }
  }

  return problemas;
}

/**
 * A conclusão do ciclo recursal, como o agregado a confere.
 *
 * Fase que publica preliminar e a definitiva da matéria conclui a si mesma e
 * nada declara; fase que publica preliminar sem definitiva própria precisa
 * apontar quem a conclui, e essa fase tem de estar no cronograma, publicar
 * definitiva e vir depois dela. Declarar concluinte sem publicar preliminar não
 * descreve travessia nenhuma.
 */
function problemasDaConclusao(
  fase: FaseDoCronograma,
  fases: readonly FaseDoCronograma[],
): readonly ProblemaDaFase[] {
  const publicaPreliminar = produtosPreliminares(fase.produtos).length > 0;
  const declarada = fase.faseConcluinteCodigo;

  if (!publicaPreliminar) {
    return declarada === null
      ? []
      : [
          {
            campo: 'faseConcluinteCodigo',
            mensagem:
              'Só fase que publica resultado preliminar declara quem conclui o ciclo recursal dela.',
          },
        ];
  }

  if (declarada === null) {
    return publicaResultadoDefinitivo(fase.produtos)
      ? []
      : [
          {
            campo: 'faseConcluinteCodigo',
            mensagem:
              'A fase publica resultado preliminar e não publica o definitivo: declare qual fase conclui o ciclo recursal.',
          },
        ];
  }

  if (declarada === fase.codigo) {
    return [
      {
        campo: 'faseConcluinteCodigo',
        mensagem:
          'A fase não conclui a si mesma por declaração: para encerrar o próprio ciclo, ela publica o resultado definitivo.',
      },
    ];
  }

  const concluinte = fases.find((outra) => outra.codigo === declarada);
  if (concluinte === undefined) {
    return [
      {
        campo: 'faseConcluinteCodigo',
        mensagem: `A fase ${declarada} não está no cronograma e não pode concluir o ciclo recursal desta.`,
      },
    ];
  }

  if (!publicaResultadoDefinitivo(concluinte.produtos)) {
    return [
      {
        campo: 'faseConcluinteCodigo',
        mensagem: `A fase ${declarada} não publica resultado definitivo e não conclui o ciclo recursal desta.`,
      },
    ];
  }

  if (concluinte.ordem <= fase.ordem) {
    return [
      {
        campo: 'faseConcluinteCodigo',
        mensagem: `A fase ${declarada} vem antes desta na linha do tempo e não pode encerrar o ciclo recursal dela.`,
      },
    ];
  }

  return [];
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
  const problemas: ProblemaDaFase[] = [];

  if (fase.bancasRequeridas.some((banca) => banca.tipoBancaId === '')) {
    problemas.push({
      campo: 'bancasRequeridas',
      mensagem: 'Escolha o tipo de cada banca requerida, ou remova a linha em branco.',
    });
  }

  const porTipo = new Map<string, string[][]>();
  for (const banca of fase.bancasRequeridas) {
    if (banca.tipoBancaId === '') continue;
    const recortes = porTipo.get(banca.tipoBancaId) ?? [];
    recortes.push([...banca.categoriasDocumentoIds].sort());
    porTipo.set(banca.tipoBancaId, recortes);
  }

  for (const [tipoBancaId, recortes] of porTipo) {
    if (recortes.length === 1) continue;

    const nome = nomeDaBanca(tipoBancaId);
    if (recortes.some((recorte) => recorte.length === 0)) {
      problemas.push({
        campo: 'bancasRequeridas',
        mensagem: `A fase requer mais de uma banca de ${nome}: cada uma precisa declarar as categorias de documento que julga.`,
      });
      continue;
    }

    const assinaturas = recortes.map((recorte) => recorte.join('|'));
    if (new Set(assinaturas).size !== assinaturas.length) {
      problemas.push({
        campo: 'bancasRequeridas',
        mensagem: `Duas bancas de ${nome} declaram o mesmo recorte de competência — não haveria como saber qual julga o quê.`,
      });
    }
  }

  return problemas;
}

/** Como a tela nomeia o papel de uma publicação nos seletores. */
export const PAPEIS_ESCOLHIVEIS = [
  { valor: '', rotulo: 'Não é resultado' },
  { valor: PAPEL_PRELIMINAR, rotulo: 'Resultado preliminar' },
  { valor: PAPEL_DEFINITIVO, rotulo: 'Resultado definitivo' },
] as const;
