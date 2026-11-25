import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicial } from '../../shared/cadastro-inicial.service';
import { GravacaoDoProcesso } from '../../shared/gravacao/gravacao-do-processo';
import { PagamentoPassoComponent } from './pagamento.component';

export const BASE = 'http://localhost:5000';
export const PROCESSO_ID = '01960000-0000-7000-0000-0000000007aa';
export const ROTA_FUNDAMENTOS = `${BASE}/api/selecao/fundamentos-isencao`;
export const ROTA_TAXA = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/taxa-inscricao`;

export const CATALOGO = [
  {
    codigo: 'CADASTRO_UNICO',
    nome: 'Cadastro Único',
    descricao: 'Baixa renda inscrita no CadÚnico.',
  },
  { codigo: 'DOACAO_MEDULA_OSSEA', nome: 'Doação de medula óssea', descricao: 'Candidato doador.' },
  {
    codigo: 'CARENCIA_SOCIOECONOMICA',
    nome: 'Carência socioeconômica',
    descricao: 'Renda até 1,5 salário mínimo e ensino médio em escola pública.',
  },
];

export function problema(status: number, code: string, title: string) {
  return {
    body: { type: 'about:blank', title, status, code, traceId: 'trace-1' },
    opts: { status, statusText: title, headers: { 'Content-Type': 'application/problem+json' } },
  };
}

export async function montarPagamento() {
  await configurarPagamento();

  const fixture = TestBed.createComponent(PagamentoPassoComponent);
  const componente = fixture.componentInstance;
  const store = TestBed.inject(ProcessoSeletivoStore);
  const controller = TestBed.inject(HttpTestingController);
  const host = fixture.nativeElement as HTMLElement;
  const detectar = () => fixture.detectChanges();

  controller.expectOne(ROTA_FUNDAMENTOS).flush(CATALOGO);
  detectar();
  store.processoSeletivoId.set(PROCESSO_ID);
  return { componente, store, controller, host, detectar };
}

async function configurarPagamento(): Promise<void> {
  await TestBed.configureTestingModule({
    imports: [PagamentoPassoComponent],
    providers: [
      ProcessoSeletivoStore,
      CadastroInicial,
      GravacaoDoProcesso,
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      { provide: SELECAO_BASE_PATH, useValue: BASE },
    ],
  }).compileComponents();
}

export function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
