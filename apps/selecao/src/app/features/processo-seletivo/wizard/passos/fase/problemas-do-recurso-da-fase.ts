import {
  PAPEL_PRELIMINAR,
  type FaseDoCronograma,
  type RecursoDaFase,
} from '../../processo-seletivo.models';
import { MENSAGEM_DA_INSTANCIA_SUPERIOR_EM_ABERTO } from '../../shared/configuracao-do-recurso/parametros-do-recurso';

import type { CampoDaFase, ProblemaDaFase } from './configuracao-da-fase';

/** Os produtos preliminares da fase — os únicos que podem ancorar o prazo. */
export function produtosPreliminares(
  produtos: FaseDoCronograma['produtos'],
): FaseDoCronograma['produtos'] {
  return produtos.filter((produto) => produto.papel === PAPEL_PRELIMINAR);
}

const MENSAGEM_SEM_PRELIMINAR =
  'A fase admite recurso e não publica nenhum resultado preliminar. Declare a publicação preliminar de que cabe recurso.';
const MENSAGEM_SEM_ANCORA =
  'Escolha a publicação preliminar de cuja divulgação corre o prazo de recurso.';
const MENSAGEM_ANCORA_FORA_DA_FASE =
  'O prazo de recurso precisa contar de um resultado preliminar publicado por esta própria fase.';

function recusa(campo: CampoDaFase, mensagem: string): readonly ProblemaDaFase[] {
  return [{ campo, mensagem }];
}

export function problemasDoRecurso(fase: FaseDoCronograma): readonly ProblemaDaFase[] {
  const regra = fase.regraRecurso;
  if (regra === null) return [];

  return [
    ...problemasDaRegraDeContagem(regra),
    ...problemasDaAncoraDeclarada(fase),
    ...problemasDaInstanciaSuperior(regra),
  ];
}

function problemasDaRegraDeContagem(regra: RecursoDaFase): readonly ProblemaDaFase[] {
  return regra.regraCodigo === ''
    ? recusa('recurso.regra', 'Escolha a regra que rege a contagem do prazo de recurso.')
    : [];
}

function problemasDaInstanciaSuperior(regra: RecursoDaFase): readonly ProblemaDaFase[] {
  return regra.admiteInstanciaSuperior === null
    ? recusa('recurso.admiteInstanciaSuperior', MENSAGEM_DA_INSTANCIA_SUPERIOR_EM_ABERTO)
    : [];
}

/**
 * A âncora é escolhida, não derivada: uma fase publica legitimamente gabarito e
 * resultado preliminares e admite recurso contra qualquer um deles, e eleger um
 * em silêncio contaria o prazo da publicação errada.
 */
function problemasDaAncoraDeclarada(fase: FaseDoCronograma): readonly ProblemaDaFase[] {
  const regra = fase.regraRecurso;
  if (regra === null) return [];

  const preliminares = produtosPreliminares(fase.produtos);
  if (preliminares.length === 0) return recusa('produtos', MENSAGEM_SEM_PRELIMINAR);
  return problemasDaAncoraEscolhida(regra.atoAncoraCodigo, preliminares);
}

function problemasDaAncoraEscolhida(
  codigo: string,
  preliminares: FaseDoCronograma['produtos'],
): readonly ProblemaDaFase[] {
  if (codigo === '') return recusa('recurso.ancora', MENSAGEM_SEM_ANCORA);
  return preliminares.some((produto) => produto.atoCodigo === codigo)
    ? []
    : recusa('recurso.ancora', MENSAGEM_ANCORA_FORA_DA_FASE);
}
