import type { FormGroup } from '@angular/forms';

import type { EtapaPontuada, FaseDoCronograma } from '../../../processo-seletivo.models';
import type { ResultadoGravacao } from '../../../shared/cadastro-inicial.service';
import type { EtapaForm } from '../cronograma-form';

export type ProblemaDaGravacao = Extract<ResultadoGravacao, { ok: false }>['problem'];

/** O que uma gravação do cronograma escreve, congelado no instante em que o operador manda gravar. */
export interface ConteudoDaGravacao {
  readonly processoId: string;
  readonly geracao: number;
  readonly fases: readonly FaseDoCronograma[];
  readonly grupos: readonly FormGroup<EtapaForm>[];
  /** O que cada formulário de etapa valia ao enviar, na posição do grupo. */
  readonly etapasNoFormulario: readonly EtapaPontuada[];
  /** O que o comando leva: a etapa só com o que a tela pede dela. */
  readonly etapas: readonly EtapaPontuada[];
}
