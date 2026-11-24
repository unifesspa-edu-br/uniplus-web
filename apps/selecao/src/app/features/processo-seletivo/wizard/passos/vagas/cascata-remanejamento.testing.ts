import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { EnvironmentProviders, Provider } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';

import { DistribuicaoDeVagas } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CascataRemanejamentoComponent } from './cascata-remanejamento.component';
import { CatalogosDeDistribuicao } from './catalogos-de-distribuicao.service';
import { federal } from './distribuicao-de-vagas.testing';
import { MODALIDADES_CASCATA } from './vagas.testing';

export const BASE = 'http://localhost:5000';
export const LB_PPI = '01960000-0000-7000-0000-0000000000b1';
export const LB_Q = '01960000-0000-7000-0000-0000000000b2';
export const AC = '01960000-0000-7000-0000-0000000000b3';

export const MODALIDADES = MODALIDADES_CASCATA.map((modalidade, indice) => ({
  ...modalidade,
  id: [LB_PPI, LB_Q, AC][indice],
}));

export const REGRA_CASCATA = {
  codigo: 'REMANEJ-CASCATA-LEI-12711',
  versao: 'v1',
  tipo: 'criterio_remanejamento',
  declaracaoDaRegra: {
    fallbackCodigo: 'AC',
    ordens: [{ origem: 'LB_PPI', destinos: ['LB_Q', 'AC'] }],
  },
  invariantes: ['origem sempre resolve pelo fallback'],
  baseLegal: 'Portaria MEC nº 704/2025',
  hash: 'hash-cascata-v1',
  modalidadesAdmitidas: null,
};

/** Uma versão anterior, que a listagem ativa não traz mais — só a busca direta a resolve. */
export const REGRA_CASCATA_ANTERIOR = {
  codigo: 'REMANEJ-CASCATA-LEI-12711',
  versao: 'v0',
  tipo: 'criterio_remanejamento',
  declaracaoDaRegra: {
    fallbackCodigo: 'AC',
    ordens: [{ origem: 'LB_PPI', destinos: ['LB_Q', 'AC'] }],
  },
  invariantes: [],
  baseLegal: 'Portaria MEC nº 704/2025 (redação anterior)',
  hash: 'hash-cascata-v0',
  modalidadesAdmitidas: null,
};

export function distribuicaoFederal(
  modalidades: DistribuicaoDeVagas['modalidades'],
): DistribuicaoDeVagas {
  return federal({ voBase: '100', regraDistribuicaoVersao: 'v1', modalidades, quadro: [] });
}

export interface CascataMontada {
  readonly componente: CascataRemanejamentoComponent;
  readonly fixture: ComponentFixture<CascataRemanejamentoComponent>;
  readonly store: ProcessoSeletivoStore;
  readonly controller: HttpTestingController;
  readonly elemento: HTMLElement;
  readonly detectar: () => void;
}

function providersDaCascata(): (Provider | EnvironmentProviders)[] {
  return [
    ProcessoSeletivoStore,
    CatalogosDeDistribuicao,
    provideHttpClient(withInterceptors([apiResultInterceptor])),
    provideHttpClientTesting(),
    { provide: SELECAO_BASE_PATH, useValue: BASE },
    { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
  ];
}

/** A seção da cascata com os catálogos de modalidades e de regras já respondidos. */
export async function montarCascata(): Promise<CascataMontada> {
  await TestBed.configureTestingModule({
    imports: [CascataRemanejamentoComponent],
    providers: providersDaCascata(),
  }).compileComponents();

  const fixture = TestBed.createComponent(CascataRemanejamentoComponent);
  const controller = TestBed.inject(HttpTestingController);

  fixture.componentInstance.catalogos.carregar();
  fixture.detectChanges();
  responderCatalogos(controller);
  fixture.detectChanges();
  return montada(fixture, controller);
}

function montada(
  fixture: ComponentFixture<CascataRemanejamentoComponent>,
  controller: HttpTestingController,
): CascataMontada {
  return {
    componente: fixture.componentInstance,
    fixture,
    store: TestBed.inject(ProcessoSeletivoStore),
    controller,
    elemento: fixture.nativeElement as HTMLElement,
    detectar: () => fixture.detectChanges(),
  };
}

function responderCatalogos(controller: HttpTestingController): void {
  for (const requisicao of controller.match(() => true)) {
    const url = requisicao.request.urlWithParams;
    if (url.includes('modalidades')) requisicao.flush(MODALIDADES);
    else if (url.includes('tipo=criterio_remanejamento')) requisicao.flush([REGRA_CASCATA]);
    else requisicao.flush([]);
  }
}
