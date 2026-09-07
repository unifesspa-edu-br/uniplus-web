import type { FaseDoCronograma } from '../processo-seletivo.models';
import { comoComandoDeFase } from '../steps/cronograma/cronograma-para-comando';
import type { CadastroInicialService, ResultadoGravacao } from './cadastro-inicial.service';

/**
 * Recusa do servidor quando a nova ordem troca a posição entre fases que já
 * existem, formando um ciclo que uma única gravação não consegue aplicar.
 */
export const PERMUTACAO_DE_ORDEM =
  'uniplus.selecao.fase_cronograma.permutacao_de_ordem_nao_suportada';

/**
 * A recusa de permutação descreve o que aconteceu, não o que fazer. Quem
 * reordenou duas fases precisa saber que o caminho é fazê-lo em duas gravações
 * — a informação que evita tentar de novo o mesmo movimento.
 */
export const ORIENTACAO_DE_PERMUTACAO =
  'Trocar duas fases de lugar exige duas gravações: mova uma delas para o fim da linha do tempo, grave, e então traga a outra para a posição desejada.';

/**
 * Grava o cronograma de fases, contornando o ciclo de ordem quando ele aparece.
 *
 * Reordenar é sempre uma permutação de `1..N`, e toda permutação não-trivial
 * fecha ciclo: cada fase precisa que a outra libere a posição primeiro, e o
 * servidor não persiste isso numa chamada. Mandar o operador "mover uma para o
 * fim" não resolvia — renumerar produz `1..N` de novo, e o ciclo volta.
 *
 * O que resolve é uma posição que ninguém ocupa. O domínio aceita qualquer
 * ordem positiva, não só a sequência fechada, então uma gravação intermediária
 * em `N+1..2N` esvazia as posições `1..N` e a seguinte as ocupa sem cadeia que
 * volte a si mesma. Duas chamadas em vez de uma, e só quando a primeira acusa.
 *
 * Vive fora dos passos porque **todo** caminho que substitui a coleção de fases
 * precisa dele: a reordenação fica no rascunho até alguém gravar, e quem grava
 * pode ser a linha do tempo ou a superfície de configuração da fase. O passo que
 * não carregasse o contorno devolveria a recusa crua, de uma tela onde nem dá
 * para reordenar.
 */
export async function gravarCronogramaFases(
  cadastro: CadastroInicialService,
  processoSeletivoId: string,
  fases: readonly FaseDoCronograma[],
): Promise<ResultadoGravacao> {
  const pretendida = await cadastro.definirCronogramaFases(
    processoSeletivoId,
    fases.map(comoComandoDeFase),
  );
  if (pretendida.ok || pretendida.problem.code !== PERMUTACAO_DE_ORDEM) return pretendida;

  // Deslocar pela quantidade de fases só serve se as ordens forem 1..N; o
  // domínio aceita qualquer ordem positiva, e uma lacuna faria a faixa "livre"
  // cair em cima de uma posição ocupada. Somar a maior ordem em uso põe todas
  // acima de qualquer uma que exista hoje.
  const deslocamento = Math.max(...fases.map((fase) => fase.ordem));
  const emOrdemLivre = fases.map((fase) => ({ ...fase, ordem: fase.ordem + deslocamento }));

  const intermediaria = await cadastro.definirCronogramaFases(
    processoSeletivoId,
    emOrdemLivre.map(comoComandoDeFase),
  );
  if (!intermediaria.ok) return intermediaria;

  return cadastro.definirCronogramaFases(processoSeletivoId, fases.map(comoComandoDeFase));
}
