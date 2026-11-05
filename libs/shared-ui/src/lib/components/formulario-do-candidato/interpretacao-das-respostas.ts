import { computed, type Signal } from '@angular/core';

import {
  BLOCO_MODALIDADES_CALCULADAS,
  type FormularioDoCandidato,
} from './formulario-do-candidato.model';
import {
  type InterpretacaoDoFormulario,
  interpretarFormulario,
} from './interpretador/interpretador';
import type { RespostaFixa } from './formulario-do-candidato.model';
import type { SimulacaoDoFormulario } from './interpretador/regras-do-formulario';
import { type PassoDoFormulario, passosDo } from './passos-do-formulario';

/** O que a interpretação lê do formulário. */
export interface FontesDaInterpretacao {
  readonly formulario: Signal<FormularioDoCandidato>;
  readonly simulacao: () => SimulacaoDoFormulario;
  readonly concluidas: () => ReadonlySet<string>;
  readonly respostasFixas: Signal<Readonly<Partial<Record<string, RespostaFixa>>>>;
  /** O processo que não define pela inscrição as modalidades não tem o que mostrar no bloco delas. */
  readonly semDerivacao: () => boolean;
}

/**
 * As regras do formulário avaliadas contra as respostas dadas: o que o interpretador devolve e os passos
 * que dele saem. Também diz como os passos ficariam com outras etapas concluídas, sem concluí-las.
 */
export class InterpretacaoDasRespostas {
  readonly resultado: Signal<InterpretacaoDoFormulario>;
  readonly recusa = computed(() => {
    const interpretacao = this.resultado();
    return interpretacao.valida ? null : interpretacao.erro;
  });
  readonly passos: Signal<readonly PassoDoFormulario[]>;

  constructor(private readonly fontes: FontesDaInterpretacao) {
    this.resultado = computed(() => this.interpretar(fontes.concluidas()));
    this.passos = computed(() => {
      const interpretacao = this.resultado();
      return interpretacao.valida ? this.passosDa(interpretacao.avaliacao) : [];
    });
  }

  /** Os passos como ficariam com estas etapas concluídas; nulo quando as regras não se interpretam. */
  passosComEtapasConcluidas(etapas: ReadonlySet<string>): readonly PassoDoFormulario[] | null {
    const interpretacao = this.interpretar(etapas);
    return interpretacao.valida ? this.passosDa(interpretacao.avaliacao) : null;
  }

  private interpretar(etapasConcluidas: ReadonlySet<string>): InterpretacaoDoFormulario {
    const { formulario, simulacao, respostasFixas } = this.fontes;
    return interpretarFormulario(
      formulario().regras,
      { ...simulacao(), etapasConcluidas: [...etapasConcluidas] },
      new Set(Object.keys(respostasFixas())),
    );
  }

  private passosDa(avaliacao: Parameters<typeof passosDo>[1]): readonly PassoDoFormulario[] {
    const passos = passosDo(this.fontes.formulario(), avaliacao);
    return this.fontes.semDerivacao()
      ? passos.filter((p) => p.bloco !== BLOCO_MODALIDADES_CALCULADAS)
      : passos;
  }
}
