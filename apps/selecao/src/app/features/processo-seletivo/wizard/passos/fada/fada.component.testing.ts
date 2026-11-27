import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  CONFIGURACAO_BASE_PATH,
  TipoInstrumentoNormativoCodigo,
} from '@uniplus/shared-data/configuracao';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';

import { CatalogoDeFases } from '../cronograma/catalogos/catalogo-de-fases.service';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicial } from '../../shared/cadastro-inicial.service';
import { GravacaoDoProcesso } from '../../shared/gravacao/gravacao-do-processo';
import { CatalogosDeClassificacao } from '../classificacao/catalogos-de-classificacao.service';
import { BasesLegaisDoFada } from './bases-legais-do-fada.service';
import { FadaPassoComponent } from './fada.component';

export const BASE = 'http://localhost:5000';
export const PROCESSO_ID = '01960000-0000-7000-0000-0000000007aa';
export const ROTA_FADA = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/fada`;
export const ROTA_DAS_BASES = `${BASE}/api/configuracao/bases-legais-fada`;
export const ROTA_DOS_TIPOS = `${BASE}/api/configuracao/vocabularios/tipos-instrumento-normativo`;
export const BASE_LEGAL_ID = 'ba5e0000-0000-7000-8000-000000000001';
export const TIPO_DA_BASE = {
  codigo: TipoInstrumentoNormativoCodigo.PORTARIA,
  rotulo: 'Rótulo do tipo de teste',
};

const PROVEDORES = [
  ProcessoSeletivoStore,
  CadastroInicial,
  GravacaoDoProcesso,
  CatalogosDeClassificacao,
  CatalogoDeFases,
  provideHttpClient(withInterceptors([apiResultInterceptor])),
  provideHttpClientTesting(),
  { provide: SELECAO_BASE_PATH, useValue: BASE },
  { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
];

function configurarModuloDoPasso(): void {
  TestBed.configureTestingModule({ imports: [FadaPassoComponent], providers: PROVEDORES });
}

function responderAsLeiturasIniciais(fixture: ComponentFixture<FadaPassoComponent>): void {
  fixture.detectChanges();
  for (const requisicao of TestBed.inject(HttpTestingController).match(() => true)) {
    requisicao.flush([]);
  }
  fixture.detectChanges();
}

/** O passo de FADA montado, com as leituras iniciais respondidas vazias e o processo já cadastrado. */
export function montarPasso() {
  configurarModuloDoPasso();
  const fixture = TestBed.createComponent(FadaPassoComponent);
  responderAsLeiturasIniciais(fixture);
  const store = TestBed.inject(ProcessoSeletivoStore);
  store.processoSeletivoId.set(PROCESSO_ID);
  return {
    fixture,
    store,
    controller: TestBed.inject(HttpTestingController),
    componente: fixture.componentInstance,
    basesLegais: fixture.debugElement.injector.get(BasesLegaisDoFada),
  };
}
