import { inject, Injectable, linkedSignal } from '@angular/core';
import { isApiOk } from '@uniplus/shared-core/http';
import { ProcessosSeletivosApi } from '@uniplus/shared-data/selecao';
import { firstValueFrom } from 'rxjs';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';

/**
 * O processo como o servidor o tem, da última leitura: a hidratação ou a releitura de uma
 * gravação, aplicação ou remoção deste passo.
 */
@Injectable()
export class LeituraDoProcessoNoFormularioService {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly api = inject(ProcessosSeletivosApi);

  readonly processoLido = linkedSignal(() => this.store.remoteSnapshot());

  /** Relê o processo e guarda a leitura, quando ela ainda é do processo em edição. */
  async ler(processoId: string) {
    const detalhe = await firstValueFrom(this.api.obter(processoId));
    if (isApiOk(detalhe) && detalhe.data.id === this.store.processoSeletivoId())
      this.processoLido.set(detalhe.data);
    return detalhe;
  }
}
