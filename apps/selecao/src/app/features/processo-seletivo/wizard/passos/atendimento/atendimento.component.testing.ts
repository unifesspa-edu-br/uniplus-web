import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicial } from '../../shared/cadastro-inicial.service';
import { GravacaoDoProcesso } from '../../shared/gravacao/gravacao-do-processo';
import { AtendimentoPassoComponent } from './atendimento.component';

export const BASE = 'http://localhost:5000';
export const PROCESSO_ID = '01960000-0000-7000-0000-0000000009aa';
export const ROTA_ATENDIMENTO = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/atendimento-especializado`;

export const PCD_ID = '01960000-0000-7000-0000-0000000000d1';
export const OUTRA_CONDICAO_ID = '01960000-0000-7000-0000-0000000000d2';
export const RECURSO_ID = '01960000-0000-7000-0000-0000000000e1';
export const TIPO_ID = '01960000-0000-7000-0000-0000000000f1';

export const CONDICOES = [
  {
    id: PCD_ID,
    codigo: 'PCD',
    nome: 'Pessoa com deficiência',
    descricao: null,
    criadoEm: '2026-09-01T00:00:00Z',
  },
  {
    id: OUTRA_CONDICAO_ID,
    codigo: 'LACTANTE',
    nome: 'Lactante',
    descricao: null,
    criadoEm: '2026-09-01T00:00:00Z',
  },
];
export const RECURSOS = [
  {
    id: RECURSO_ID,
    codigo: 'LEDOR',
    nome: 'Ledor',
    descricao: 'Auxílio para leitura',
    criadoEm: '2026-09-01T00:00:00Z',
  },
];
export const TIPOS_DEFICIENCIA = [
  {
    id: TIPO_ID,
    codigo: 'VISUAL',
    nome: 'Deficiência visual',
    descricao: 'Cegueira ou baixa visão',
    permanente: true,
    criadoEm: '2026-09-01T00:00:00Z',
  },
];

export interface PassoDeAtendimento {
  readonly fixture: ComponentFixture<AtendimentoPassoComponent>;
  readonly store: ProcessoSeletivoStore;
  readonly controller: HttpTestingController;
}

const PROVEDORES = [
  ProcessoSeletivoStore,
  CadastroInicial,
  GravacaoDoProcesso,
  provideHttpClient(withInterceptors([apiResultInterceptor])),
  provideHttpClientTesting(),
  { provide: SELECAO_BASE_PATH, useValue: BASE },
  { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
];

export function responderCatalogos(controller: HttpTestingController): void {
  for (const requisicao of controller.match(() => true)) {
    const url = requisicao.request.url;
    if (url.includes('condicoes-atendimento')) requisicao.flush(CONDICOES);
    else if (url.includes('recursos-acessibilidade')) requisicao.flush(RECURSOS);
    else if (url.includes('tipos-deficiencia')) requisicao.flush(TIPOS_DEFICIENCIA);
    else requisicao.flush([]);
  }
}

async function configurarModulo(): Promise<void> {
  await TestBed.configureTestingModule({
    imports: [AtendimentoPassoComponent],
    providers: PROVEDORES,
  }).compileComponents();
}

/** Monta o passo com os três catálogos já respondidos e o processo identificado. */
export async function montarPassoDeAtendimento(): Promise<PassoDeAtendimento> {
  await configurarModulo();
  const fixture = TestBed.createComponent(AtendimentoPassoComponent);
  const store = TestBed.inject(ProcessoSeletivoStore);
  const controller = TestBed.inject(HttpTestingController);

  fixture.detectChanges();
  responderCatalogos(controller);
  fixture.detectChanges();

  store.processoSeletivoId.set(PROCESSO_ID);
  return { fixture, store, controller };
}
