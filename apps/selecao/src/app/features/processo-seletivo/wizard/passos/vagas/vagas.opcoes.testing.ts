import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture } from '@angular/core/testing';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import {
  abrirPasso,
  criarPassoDeVagas,
  PassoDeVagas,
  simuladaComUmaModalidade,
} from './passo-de-vagas.testing';
import { VagasPassoComponent } from './vagas.component';
import {
  BASE,
  MODALIDADES,
  OFERTAS,
  PROCESSO_ID,
  ROTA_SIMULACAO,
  distribuicao,
} from './vagas.testing';

export const ROTA_OPCOES = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/opcoes-de-curso`;
export const ROTA_PROCESSO_RELIDO = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}`;
export const SEM_CORPO = { status: 204, statusText: 'No Content' };
export const proximoTick = () => new Promise((resolve) => setTimeout(resolve, 0));

export const recusa422 = (code: string) => ({
  body: { type: 'about:blank', title: 'Recusado.', status: 422, code, traceId: 'trace-1' },
  opts: {
    status: 422,
    statusText: 'Unprocessable Entity',
    headers: { 'content-type': 'application/problem+json' },
  },
});

export interface PassoDeOpcoesDeCurso {
  readonly componente: VagasPassoComponent;
  readonly fixture: ComponentFixture<VagasPassoComponent>;
  readonly store: ProcessoSeletivoStore;
  readonly controller: HttpTestingController;
  readonly tela: HTMLElement;
  readonly campo: () => HTMLSelectElement;
  readonly escolherNumero: (numero: string) => void;
  /** Põe as ofertas no quadro e deixa o quadro simulado. */
  readonly ofertas: (...ids: string[]) => void;
  /** O número que o servidor tem gravado, na leitura mais recente. */
  readonly gravado: (numero: number) => void;
  readonly encerrar: () => void;
}

/** O passo de vagas, anexado ao documento para que o foco se aplique, com o processo já criado. */
export async function montarPassoDeOpcoes(): Promise<PassoDeOpcoesDeCurso> {
  const passo = await criarPassoDeVagas();
  const tela = passo.fixture.nativeElement as HTMLElement;
  document.body.appendChild(tela);

  abrirPasso(passo, { ofertas: OFERTAS, modalidades: MODALIDADES });
  passo.store.processoSeletivoId.set(PROCESSO_ID);
  return diante(passo, tela);
}

function diante(passo: PassoDeVagas, tela: HTMLElement): PassoDeOpcoesDeCurso {
  const { fixture, store } = passo;
  const campo = () => tela.querySelector('#f-opcoes-curso') as HTMLSelectElement;

  return {
    ...passo,
    componente: fixture.componentInstance,
    tela,
    campo,
    escolherNumero: (numero) => escolherNumero(fixture, campo(), numero),
    ofertas: (...ids) => colocarOfertas(passo, ids),
    gravado: (numero) => store.opcoesDeCursoGravadas.set(numero),
    encerrar: () => encerrar(passo, tela),
  };
}

function encerrar(passo: PassoDeVagas, tela: HTMLElement): void {
  passo.controller.verify();
  tela.remove();
}

function escolherNumero(
  fixture: ComponentFixture<VagasPassoComponent>,
  campo: HTMLSelectElement,
  numero: string,
): void {
  campo.value = numero;
  campo.dispatchEvent(new Event('change'));
  fixture.detectChanges();
}

function colocarOfertas(passo: PassoDeVagas, ids: readonly string[]): void {
  passo.store.patchObjectSection('vagas', { ofertas: ids.map(distribuicao) });
  passo.fixture.detectChanges();
  passo.servicos.simulacao.simular();
  passo.controller.expectOne(ROTA_SIMULACAO).flush(ids.map(simuladaComUmaModalidade));
  passo.fixture.detectChanges();
}
