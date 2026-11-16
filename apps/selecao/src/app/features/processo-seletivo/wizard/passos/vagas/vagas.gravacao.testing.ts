import { HttpTestingController } from '@angular/common/http/testing';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import {
  abrirPasso,
  criarPassoDeVagas,
  PassoDeVagas,
  simuladaComUmaModalidade,
} from './passo-de-vagas.testing';
import { TelaDasVagas } from './tela-das-vagas.testing';
import { VagasPassoComponent } from './vagas.component';
import {
  ACEITA_AS_OPCOES,
  MODALIDADES,
  OFERTA,
  OFERTAS,
  OUTRA_OFERTA,
  PROCESSO_ID,
  ROTA_SIMULACAO,
  ServicosDasVagas,
  declararUmaOpcaoJaGravada,
  distribuicao,
} from './vagas.testing';

export interface PassoDeVagasEmGravacao {
  readonly componente: VagasPassoComponent;
  readonly store: ProcessoSeletivoStore;
  readonly controller: HttpTestingController;
  readonly servicos: ServicosDasVagas;
  readonly operador: TelaDasVagas;
  readonly elemento: HTMLElement;
  /**
   * A gravação exige a simulação: gravar sem simular é declarar um quadro que ninguém viu. A
   * conferência do operador é o diálogo que a página abre no instante de gravar, e não estado do
   * componente.
   */
  readonly simular: (ofertas: readonly string[]) => void;
}

/** O passo de vagas com duas ofertas no quadro e o processo já criado. */
export async function montarPassoEmGravacao(): Promise<PassoDeVagasEmGravacao> {
  const passo = await criarPassoDeVagas([ACEITA_AS_OPCOES]);
  declararUmaOpcaoJaGravada(passo.store);
  abrirPasso(passo, { ofertas: OFERTAS, modalidades: MODALIDADES });

  passo.store.processoSeletivoId.set(PROCESSO_ID);
  passo.store.patchObjectSection('vagas', {
    ofertas: [distribuicao(OFERTA), distribuicao(OUTRA_OFERTA)],
  });
  passo.fixture.detectChanges();
  return emGravacao(passo);
}

function emGravacao(passo: PassoDeVagas): PassoDeVagasEmGravacao {
  return {
    ...passo,
    componente: passo.fixture.componentInstance,
    operador: new TelaDasVagas(passo.fixture),
    elemento: passo.fixture.nativeElement as HTMLElement,
    simular: (ofertas) => simular(passo, ofertas),
  };
}

function simular(passo: PassoDeVagas, ofertas: readonly string[]): void {
  passo.servicos.simulacao.simular();
  passo.controller.expectOne(ROTA_SIMULACAO).flush(ofertas.map(simuladaComUmaModalidade));
}
