import type { FaseDoCronograma } from '../../../processo-seletivo.models';
import type { CadastroInicial, ResultadoGravacao } from '../../../shared/cadastro-inicial.service';
import { comoComandoDeFase } from '../cronograma-para-comando';

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
 * As fases com a ordem deslocada para acima de qualquer uma em uso. Deslocar pela quantidade de
 * fases só serve se as ordens forem 1..N; o domínio aceita qualquer ordem positiva, e uma lacuna
 * faria a faixa "livre" cair em cima de uma posição ocupada.
 */
function emOrdemLivre(fases: readonly FaseDoCronograma[]): readonly FaseDoCronograma[] {
  const deslocamento = Math.max(...fases.map((fase) => fase.ordem));
  return fases.map((fase) => ({ ...fase, ordem: fase.ordem + deslocamento }));
}

async function gravarEConfirmar(
  cadastro: CadastroInicial,
  processoSeletivoId: string,
  fases: readonly FaseDoCronograma[],
  aoConfirmar: (gravadas: readonly FaseDoCronograma[]) => void,
): Promise<ResultadoGravacao> {
  const resultado = await cadastro.definirCronogramaFases(
    processoSeletivoId,
    fases.map(comoComandoDeFase),
  );
  if (resultado.ok) aoConfirmar(fases);
  return resultado;
}

/**
 * Grava o cronograma de fases, contornando o ciclo de ordem quando ele aparece.
 *
 * Reordenar é sempre uma permutação de `1..N`, e toda permutação não-trivial
 * fecha ciclo: cada fase precisa que a outra libere a posição primeiro, e o
 * servidor não persiste isso numa chamada. O domínio aceita qualquer ordem
 * positiva, então uma gravação intermediária em `N+1..2N` esvazia as posições
 * `1..N` e a seguinte as ocupa sem cadeia que volte a si mesma. Três chamadas
 * com o mesmo conjunto de fases na mesma sequência, mudando só a ordem, e só
 * quando a primeira acusa o ciclo: a posição `fases[i]` de uma recusa vale para
 * a mesma fase nas três.
 *
 * Cada chamada que o servidor confirma substitui as fases dele; `aoConfirmar` recebe o conjunto
 * dessa chamada, para quem acompanha o que o servidor tem não perder o que uma chamada intermediária
 * já gravou quando a seguinte falha.
 */
export async function gravarCronogramaFases(
  cadastro: CadastroInicial,
  processoSeletivoId: string,
  fases: readonly FaseDoCronograma[],
  aoConfirmar: (gravadas: readonly FaseDoCronograma[]) => void,
): Promise<ResultadoGravacao> {
  const gravar = (daVez: readonly FaseDoCronograma[]) =>
    gravarEConfirmar(cadastro, processoSeletivoId, daVez, aoConfirmar);
  const pretendida = await gravar(fases);
  if (pretendida.ok || pretendida.problem.code !== PERMUTACAO_DE_ORDEM) return pretendida;

  const intermediaria = await gravar(emOrdemLivre(fases));
  return intermediaria.ok ? gravar(fases) : intermediaria;
}
