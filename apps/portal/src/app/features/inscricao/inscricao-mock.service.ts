import { delay, Observable, of } from 'rxjs';
import { Injectable } from '@angular/core';

import { Inscricao, INSCRICOES_MOCK } from './inscricao-lista.mock';

@Injectable({ providedIn: 'root' })
export class InscricoesCandidatoMockService {
  listar(): Observable<readonly Inscricao[]> {
    return of(INSCRICOES_MOCK).pipe(delay(300));
  }
}
