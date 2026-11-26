import { inject, Injectable, linkedSignal } from '@angular/core';
import type { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';

import type { FaseDoCronograma } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';

function origensDoRetrato(retrato: ProcessoSeletivoDto | null): ReadonlySet<string> {
  return new Set((retrato?.cronogramaFases ?? []).map((fase) => fase.faseCanonica.origemId));
}

/**
 * As fases canônicas que o servidor tem no cronograma do processo: as do último retrato lido e,
 * depois de uma gravação do cronograma, as que ela enviou. Gravar o cronograma não atualiza o
 * retrato; uma nova leitura do processo volta a valer sozinha.
 */
@Injectable()
export class FasesNoServidor {
  private readonly store = inject(ProcessoSeletivoStore);

  readonly origens = linkedSignal<ReadonlySet<string>>(() =>
    origensDoRetrato(this.store.remoteSnapshot()),
  );

  registrarGravadas(fases: readonly FaseDoCronograma[]): void {
    this.origens.set(new Set(fases.map((fase) => fase.faseCanonicaId)));
  }
}
