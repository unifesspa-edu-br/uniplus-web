import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { PERMISSAO, PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  AUTORIZACAO_BASE_PATH,
  JanelaDeMigracaoApi,
  type JanelaDeMigracaoDto,
} from '@uniplus/shared-data/autorizacao';
import { UnidadesApi } from '@uniplus/shared-data/organizacao';
import { provideMensagensDeAcesso } from '../mensagens-de-acesso';
import { ok } from '../testes';
import { JanelaDaMigracaoPage } from './janela-da-migracao.page';
import { PERFIL } from './janela.testing';

export const GESTAO_DE_ACESSOS = PERMISSAO.autorizacao.perfisAprovarFuncional;
export const PROTECAO_DE_DADOS = PERMISSAO.autorizacao.perfisAprovarProtecaoDeDados;
export const URL_DA_JANELA = `http://api.test/api/autorizacao/perfis/${PERFIL}/janela`;

export const api = {
  enviarLote: vi.fn(),
  decidirRetida: vi.fn(),
  decidirProtecaoDeDados: vi.fn(),
  encerrar: vi.fn(),
};
export const notificacoes = { success: vi.fn(), errorFromProblem: vi.fn() };

export function presente<T>(valor: T | null | undefined): T {
  if (valor == null) throw new Error('elemento ausente');
  return valor;
}

export interface PaginaDaJanela {
  readonly fixture: ComponentFixture<JanelaDaMigracaoPage>;
  readonly host: HTMLElement;
  readonly http: HttpTestingController;
  /** Responde a leitura pendente da janela e assenta a tela. */
  readonly responder: (janela: JanelaDeMigracaoDto) => Promise<void>;
  /** Recusa a leitura pendente da janela e assenta a tela. */
  readonly falhar: (status: number, code?: string) => Promise<void>;
  readonly assentar: () => Promise<void>;
}

/** Monta a página da janela com as permissões informadas, sem responder a leitura. */
export function montarJanela(
  concedidas: readonly string[] = [GESTAO_DE_ACESSOS, PROTECAO_DE_DADOS],
): PaginaDaJanela {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      provideMensagensDeAcesso(),
      { provide: AUTORIZACAO_BASE_PATH, useValue: 'http://api.test' },
      { provide: JanelaDeMigracaoApi, useValue: api },
      { provide: NotificationService, useValue: notificacoes },
      { provide: PermissoesService, useValue: {
          tem: (c: string) => concedidas.includes(c),
          temAlguma: (...c: string[]) => c.some((x) => concedidas.includes(x)),
        },
      },
      { provide: UnidadesApi, useValue: { listar: () => of(ok(UNIDADES)) } },
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(JanelaDaMigracaoPage);
  fixture.componentRef.setInput('id', PERFIL);
  const host = fixture.nativeElement as HTMLElement;
  document.body.appendChild(host);
  const assentar = async (): Promise<void> => {
    await new Promise((resolver) => setTimeout(resolver));
    TestBed.inject(ApplicationRef).tick();
    await new Promise((resolver) => setTimeout(resolver));
    TestBed.inject(ApplicationRef).tick();
  };
  const responder = async (proxima: JanelaDeMigracaoDto): Promise<void> => {
    await assentar();
    http.expectOne(URL_DA_JANELA).flush(proxima);
    await assentar();
  };
  const falhar = async (status: number, code = 'uniplus.x'): Promise<void> => {
    await assentar();
    http.expectOne(URL_DA_JANELA).flush(
      { title: 'Falhou', status, code, type: 'about:blank', traceId: '' },
      { status, statusText: 'Erro', headers: { 'Content-Type': 'application/problem+json' } },
    );
    await assentar();
  };
  fixture.detectChanges();
  return { fixture, host, http, responder, falhar, assentar };
}

/** Abre a página da janela com a leitura respondida e as permissões informadas. */
export async function abrirJanela(
  janela: JanelaDeMigracaoDto,
  concedidas: readonly string[] = [GESTAO_DE_ACESSOS, PROTECAO_DE_DADOS],
): Promise<PaginaDaJanela> {
  const pagina = montarJanela(concedidas);
  await pagina.responder(janela);
  return pagina;
}

const UNIDADES = [{ id: 'unidade-1', nome: 'Centro de Seleção', sigla: 'CEPS' }] as const;

export const botao = (raiz: ParentNode, texto: string): HTMLButtonElement | undefined =>
  [...raiz.querySelectorAll('button')].find((b) => b.textContent?.trim().startsWith(texto));

export function linhaDe(host: HTMLElement, concessaoId: string): HTMLElement {
  return presente(host.querySelector<HTMLElement>(`tr[data-concessao-id="${concessaoId}"]`));
}

export function escolher(linha: HTMLElement, opcao: 'Migrar' | 'Recusar'): void {
  const radio = [...linha.querySelectorAll('label.radio')].find((l) =>
    l.textContent?.includes(opcao),
  );
  presente(radio?.querySelector('input')).click();
}
