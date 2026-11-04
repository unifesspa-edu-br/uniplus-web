import type { ExigenciaDeDocumento, ExigenciasDoRascunho } from '../../processo-seletivo.models';

import type { RestricaoDeArquivo } from './arquivo-da-exigencia';

import { exigenciasDaRaiz, type RepeticaoDaExigencia } from './consulta-das-exigencias';
import { comExigenciaNaRaiz, exigenciaNova, folhaDe } from './exigencias-documentais';

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

/** O que o alcance entre fases precisa saber do documento e do edital para se materializar. */
export interface ContextoDoAlcance {
  readonly fases: readonly string[];
  /** A fase em que o operador está: é nela que o modelo de raiz nasce, se faltar. */
  readonly faseAberta: string;
  /** A exigência do documento na fase aberta. */
  readonly modelo: ExigenciaDeDocumento;
  readonly repeticao: RepeticaoDaExigencia | null;
  readonly restricao: RestricaoDeArquivo | undefined;
}

/**
 * Troca "vale em todas as fases" pelo recorte explícito, materializando antes: largar o alcance
 * sem materializar tiraria o documento também de toda fase que só o tinha por herança.
 */
export function recortadoPorFase(
  exigencias: ExigenciasDoRascunho,
  id: string,
  contexto: ContextoDoAlcance,
): ExigenciasDoRascunho {
  return {
    ...materializadoEmTodasAsFases(exigencias, id, contexto),
    emTodasAsFases: exigencias.emTodasAsFases.filter((item) => item !== id),
  };
}

/** Devolve o documento ao regime de acompanhar todas as fases do edital. */
export function valendoEmTodasAsFases(
  exigencias: ExigenciasDoRascunho,
  id: string,
  contexto: ContextoDoAlcance,
): ExigenciasDoRascunho {
  const alinhadas = alinhadoAFaseAberta(exigencias, id, contexto);
  return {
    ...materializadoEmTodasAsFases(alinhadas, id, contexto),
    emTodasAsFases: alinhadas.emTodasAsFases.includes(id)
      ? alinhadas.emTodasAsFases
      : [...alinhadas.emTodasAsFases, id],
  };
}

/**
 * Alinha todas as declarações de raiz do documento à da fase aberta.
 *
 * "Vale em todas as fases" quer dizer a MESMA declaração em toda fase. Ligar o regime sobre
 * declarações que já divergiam deixava a tela anunciando uma coisa e a gravação enviando
 * outra, e a releitura ao reabrir o processo perdia a marca porque as declarações não batem.
 *
 * Fase, etapa e formulário ficam como estão: são próprios de cada declaração — cada fase responde
 * os seus formulários —, e é por isso que a comparação que relê a intenção também os ignora.
 */
function alinhadoAFaseAberta(
  exigencias: ExigenciasDoRascunho,
  id: string,
  { modelo, repeticao }: ContextoDoAlcance,
): ExigenciasDoRascunho {
  return {
    ...exigencias,
    raizes: exigencias.raizes.map((no) =>
      no.tipo === 'FOLHA' && no.documento !== null && no.documento.tipoDocumentoId === id
        ? {
            ...no,
            repetePorEntidade:
              repeticao?.herdada === true ? no.repetePorEntidade : (repeticao?.grupo ?? null),
            documento: {
              ...modelo,
              faseCodigo: no.documento.faseCodigo,
              etapaId: no.documento.etapaId,
              finalidade: no.documento.finalidade,
            },
          }
        : no,
    ),
  };
}

/**
 * Garante uma exigência do documento em cada fase do cronograma, copiando o que já foi
 * declarado numa delas: quem marcou "todas as fases" depois de configurar a exigência numa delas
 * está dizendo que é a mesma exigência, não uma nova.
 */
function materializadoEmTodasAsFases(
  exigencias: ExigenciasDoRascunho,
  id: string,
  { fases, faseAberta, restricao }: ContextoDoAlcance,
): ExigenciasDoRascunho {
  const temModelo = exigenciasDaRaiz(exigencias).some(
    (exigencia) => exigencia.tipoDocumentoId === id,
  );
  // O modelo é semeado na RAIZ, não por `comExigencia`: quando o documento só existe como
  // alternativa dentro de um grupo OU, aquela substituiria a folha do grupo e a raiz
  // continuaria sem modelo. Nasce na fase ABERTA, onde o operador espera ver o que replica.
  const base = temModelo
    ? exigencias
    : comExigenciaNaRaiz(exigencias, exigenciaNova(id, faseAberta, restricao));

  return comAlcanceDeTodasAsFases({ ...base, emTodasAsFases: [id] }, fases);
}
