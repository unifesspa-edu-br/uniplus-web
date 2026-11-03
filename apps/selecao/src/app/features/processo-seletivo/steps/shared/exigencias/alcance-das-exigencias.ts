import type { ExigenciasDoRascunho } from '../../processo-seletivo.models';

import { exigenciasDaRaiz } from './consulta-das-exigencias';
import { folhaDe } from './exigencias-documentais';

/**
 * Materializa, em cada fase do cronograma, o documento que o operador declarou valer em todas.
 *
 * É na SERIALIZAÇÃO que isso acontece, e não só no clique: a fase acrescentada depois de a
 * intenção ter sido declarada também precisa receber a exigência, e uma materialização feita
 * uma vez só deixaria essa fase de fora sem nada na tela denunciando a ausência.
 *
 * O modelo vem das folhas de raiz — copiar uma alternativa de grupo mudaria o sentido dela.
 */
export function comAlcanceDeTodasAsFases(
  exigencias: ExigenciasDoRascunho,
  fasesVivas: readonly string[],
): ExigenciasDoRascunho {
  let resultado = exigencias;

  for (const tipoDocumentoId of exigencias.emTodasAsFases) {
    const folhaModelo = resultado.raizes.find(
      (no) => no.tipo === 'FOLHA' && no.documento?.tipoDocumentoId === tipoDocumentoId,
    );
    const modelo = folhaModelo?.documento;
    if (folhaModelo === undefined || modelo === undefined || modelo === null) continue;

    for (const faseCodigo of fasesVivas) {
      // Só declaração de RAIZ conta como "já tem". O mesmo documento pode estar na fase como
      // alternativa dentro de um grupo OU, e isso é outra coisa: ali ele é uma das saídas
      // possíveis, não uma exigência. Aceitar a folha do grupo como satisfeita transformava
      // "este documento é exigido" em "este documento serve", sem nada na tela dizendo.
      const jaTemNaRaiz = exigenciasDaRaiz(resultado).some(
        (exigencia) =>
          exigencia.tipoDocumentoId === tipoDocumentoId && exigencia.faseCodigo === faseCodigo,
      );
      if (jaTemNaRaiz) continue;

      // O formulário é próprio de cada declaração, como a fase e a etapa: o do modelo pode não ser
      // respondido na fase de destino, e herdá-lo travaria a fase numa recusa. A cópia nasce sem
      // declaração, e a fase de destino resolve o formulário que vale nela.
      // A repetição vai junto com o gatilho que a cópia leva: sem ela, a condição sobre campo do
      // grupo ficaria sem de quem ser lida, e "um por membro" viraria "um por candidato" em silêncio.
      // Se a repetição vale na fase de destino, quem diz é a conferência da fase, como para o gatilho.
      const copia = folhaDe({ ...modelo, faseCodigo, etapaId: null, finalidade: null });
      resultado = {
        ...resultado,
        raizes: [
          ...resultado.raizes,
          { ...copia, repetePorEntidade: folhaModelo.repetePorEntidade },
        ],
      };
    }
  }

  return resultado;
}
