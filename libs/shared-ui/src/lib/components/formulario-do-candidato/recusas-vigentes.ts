import { computed, effect, type Signal, untracked } from '@angular/core';

import { exigenciaAtendida } from './atendimento-das-exigencias';
import type { DecisoesDaAvaliacao } from './decisoes-da-avaliacao';
import { chaveDoCampoDeDocumento, ehCampoDeDocumento } from './envio-de-documentos';
import { type ErroDoServidor, erroEm } from './formulario-do-candidato.model';
import type { PassoDoFormulario } from './passos-do-formulario';
import { contemOCampo } from './recusas-do-servidor';

/** De onde vêm as recusas, e para onde levar o candidato quando chegam novas. */
export interface FontesDasRecusas {
  /** As recusas que quem hospeda entregou: uma lista nova leva à seção da primeira. */
  readonly doServidor: Signal<readonly ErroDoServidor[]>;
  /** As que ainda não foram descartadas por uma resposta mudada. */
  readonly recebidas: Signal<readonly ErroDoServidor[]>;
  readonly decisoes: DecisoesDaAvaliacao;
  /** A chave do passo em que quem hospeda já apontou a recusa que lhe cabe. */
  readonly passoDaRecusa: Signal<string | null>;
  readonly irAoCampo: (campo: string) => void;
}

/**
 * As recusas do servidor que ainda valem. A de uma exigência documental deixa de valer quando a
 * avaliação a dá por atendida — ela ou, num grupo "um ou outro", pelo de outra alternativa.
 */
export class RecusasVigentes {
  readonly erros: Signal<readonly ErroDoServidor[]>;
  private ultimaListaDeErros: readonly ErroDoServidor[] = [];

  constructor(fontes: FontesDasRecusas) {
    this.erros = computed(() => recusasQueValem(fontes.recebidas(), fontes.decisoes));
    effect(() => {
      const erros = fontes.doServidor();
      const aposDoHost = fontes.passoDaRecusa() !== null;
      untracked(() => this.levarAoPrimeiroCampo(erros, aposDoHost, fontes.irAoCampo));
    });
  }

  /**
   * Só a lista nova leva a algum lugar: a mudança de `passoDaRecusa` sozinha não move ninguém. A recusa
   * que quem hospeda já apontou no passo dele prevalece: as demais seguem marcadas nas seções, mas o
   * candidato não é levado para longe do passo que o hospedeiro mostrou.
   */
  private levarAoPrimeiroCampo(
    erros: readonly ErroDoServidor[],
    aposDoHost: boolean,
    irAoCampo: (campo: string) => void,
  ): void {
    if (erros === this.ultimaListaDeErros) return;
    this.ultimaListaDeErros = erros;
    const [primeiro] = erros;
    if (primeiro && !aposDoHost) irAoCampo(primeiro.campo);
  }

  /** As recusas do campo, grupo ou termo de código dado, ou de dentro dele. */
  em(codigo: string): readonly ErroDoServidor[] {
    return this.erros().filter((e) => erroEm(e, codigo));
  }

  /** Quantas respostas da seção o servidor recusou; zero não mostra o aviso do topo. */
  daSecao(passo: PassoDoFormulario): number {
    return this.erros().filter((e) => contemOCampo(passo, e.campo)).length;
  }
}

/** A recusa de uma exigência documental deixa de valer quando a avaliação a dá por atendida. */
function recusasQueValem(
  todas: readonly ErroDoServidor[],
  decisoes: DecisoesDaAvaliacao,
): readonly ErroDoServidor[] {
  if (!todas.some((e) => ehCampoDeDocumento(e.campo))) return todas;
  const atendidas = new Set(
    Object.entries(decisoes.situacoes())
      .filter(([, situacao]) => situacao === 'SATISFEITA')
      .map(([chave]) => chave),
  );
  const arvore = decisoes.documentosDaAvaliacao()?.arvore ?? [];
  return todas.filter(
    (e) =>
      !ehCampoDeDocumento(e.campo) ||
      !exigenciaAtendida(chaveDoCampoDeDocumento(e.campo), arvore, atendidas),
  );
}
