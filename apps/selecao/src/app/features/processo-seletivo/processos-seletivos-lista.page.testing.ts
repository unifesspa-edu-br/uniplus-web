import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  ProcessoSeletivoResumoDto,
  SELECAO_BASE_PATH,
  StatusProcessoCodigo,
} from '@uniplus/shared-data/selecao';

import { ProcessosSeletivosListaPage } from './processos-seletivos-lista.page';

const BASE = 'http://localhost:5000';
export const URL_LISTA = `${BASE}/api/selecao/processos-seletivos`;

const PERMISSOES_PADRAO: readonly string[] = ['selecao:processos:configurar'];

/** Permissões de quem está autenticado — o atalho de cadastro depende delas. */
export const concedidas = signal<readonly string[]>(PERMISSOES_PADRAO);
const permissoesStub = { tem: (codigo: string) => concedidas().includes(codigo) };

const PROCESSO_EM_RASCUNHO: ProcessoSeletivoResumoDto = {
  id: '019f41cf-69fd-759a-ac6d-09acabc1b027',
  nome: 'Vestibular 2026.1',
  tipoProcesso: {
    origemId: '019f41cf-69fd-759a-ac6d-09acabc1b028',
    codigo: 'VESTIBULAR',
    nome: 'Vestibular',
  },
  status: { codigo: StatusProcessoCodigo.RASCUNHO, rotulo: 'Rascunho' },
  criadoEm: '2026-08-20T13:23:42.707136+00:00',
};

export function processo(
  overrides: Partial<ProcessoSeletivoResumoDto> = {},
): ProcessoSeletivoResumoDto {
  return { ...PROCESSO_EM_RASCUNHO, ...overrides };
}

function configurarOTestBed(): void {
  TestBed.configureTestingModule({
    imports: [ProcessosSeletivosListaPage],
    providers: [
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: SELECAO_BASE_PATH, useValue: BASE },
      { provide: PermissoesService, useValue: permissoesStub },
    ],
  });
}

export class CenarioDaListaDeProcessos {
  fixture: ComponentFixture<ProcessosSeletivosListaPage>;
  component: ProcessosSeletivosListaPage;
  readonly controller: HttpTestingController;
  private readonly appRef: ApplicationRef;

  private constructor() {
    this.fixture = TestBed.createComponent(ProcessosSeletivosListaPage);
    this.component = this.fixture.componentInstance;
    this.controller = TestBed.inject(HttpTestingController);
    this.appRef = TestBed.inject(ApplicationRef);
  }

  static preparar(): CenarioDaListaDeProcessos {
    concedidas.set(PERMISSOES_PADRAO);
    configurarOTestBed();
    const cenario = new CenarioDaListaDeProcessos();
    cenario.fixture.detectChanges();
    return cenario;
  }

  async propagar(): Promise<void> {
    await Promise.resolve();
    this.appRef.tick();
  }

  async responderLista(itens: readonly ProcessoSeletivoResumoDto[], link?: string): Promise<void> {
    const req = this.controller.expectOne((r) => r.url === URL_LISTA);
    req.flush(itens, { headers: link ? { Link: link } : undefined });
    await this.propagar();
    this.fixture.detectChanges();
  }

  tela(): HTMLElement {
    return this.fixture.nativeElement as HTMLElement;
  }

  nomesNaTabela(): string[] {
    return Array.from(this.tela().querySelectorAll<HTMLTableRowElement>('tbody tr')).map(
      (linha) => linha.querySelector('td')?.textContent?.trim().split('\n')[0] ?? '',
    );
  }

  /** Sai da listagem e volta, como quem foi ao cadastro e concluiu. */
  voltarAListagem(): void {
    this.fixture.destroy();
    this.fixture = TestBed.createComponent(ProcessosSeletivosListaPage);
    this.component = this.fixture.componentInstance;
    this.fixture.detectChanges();
  }
}
