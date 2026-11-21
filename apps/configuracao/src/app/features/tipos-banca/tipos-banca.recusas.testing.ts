import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  CONFIGURACAO_BASE_PATH,
  TipoBancaDto,
  TipoDeBancaCodigo,
} from '@uniplus/shared-data/configuracao';
import { expect } from 'vitest';
import { EdicaoDosTiposBanca } from './edicao-dos-tipos-banca';
import { TiposBancaPage } from './tipos-banca.page';
import { tipoDeBanca } from './tipos-banca.testing';

const BASE = 'http://localhost:5000';
export const LISTA = `${BASE}/api/configuracao/tipos-banca`;
const FASES = `${BASE}/api/configuracao/fases-canonicas`;
export const ESCRITA = `${BASE}/api/configuracao/admin/tipos-banca/b2`;
export const TITULO_DA_LISTA = '#cfg-tipos-banca-list-title';
export const banca = tipoDeBanca(TipoDeBancaCodigo.BANCA_ENTREVISTA, {
  id: 'b2',
  faseTipica: null,
});

export const problema = (status: number, corpo: object) =>
  [
    JSON.stringify({ type: 'about:blank', title: 'Falha', status, ...corpo }),
    { status, statusText: 'Erro', headers: { 'content-type': 'application/problem+json' } },
  ] as const;
export const sucesso = () => [null, { status: 204, statusText: 'No Content' }] as const;

/** A página de tipos de banca montada, e as ações que os cenários de recusa repetem. */
export class PaginaDeRecusas {
  readonly fixture = TestBed.createComponent(TiposBancaPage);
  readonly edicao = this.fixture.debugElement.injector.get(EdicaoDosTiposBanca);
  readonly controller = TestBed.inject(HttpTestingController);
  private readonly appRef = TestBed.inject(ApplicationRef);

  async propagar(): Promise<void> {
    await Promise.resolve();
    this.appRef.tick();
    this.fixture.detectChanges();
  }

  elemento<T extends HTMLElement>(seletor: string): T {
    const encontrado = this.fixture.nativeElement.querySelector(seletor) as T | null;
    expect(encontrado, seletor).not.toBeNull();
    return encontrado as T;
  }

  editar(): HTMLButtonElement {
    return this.elemento(`button[aria-label="Editar tipo de banca ${banca.codigo.codigo}"]`);
  }

  lixeira(): HTMLButtonElement {
    return this.elemento(`button[aria-label="Remover tipo de banca ${banca.codigo.codigo}"]`);
  }

  salvar(): HTMLButtonElement {
    return this.elemento('button[form="cfg-tipo-banca-form"]');
  }

  confirmar(): HTMLButtonElement {
    return this.elemento('[data-testid="confirm-dialog-confirm"]');
  }

  dialogo(): HTMLElement {
    return this.elemento('cfg-confirmacao-de-remocao');
  }

  botaoDoDialogo(nome: string): HTMLButtonElement {
    return [...this.dialogo().querySelectorAll('button')].find(
      (botao) => botao.textContent?.trim() === nome || botao.getAttribute('aria-label') === nome,
    ) as HTMLButtonElement;
  }

  statusDaPagina(): string {
    return this.elemento(':scope > span.sr-only[role="status"]').textContent ?? '';
  }

  async abrirEdicao(): Promise<void> {
    this.editar().focus();
    this.editar().click();
    await this.propagar();
    this.controller.expectOne((r) => r.url === FASES).flush([]);
    await this.propagar();
  }

  async enviar() {
    this.salvar().focus();
    this.salvar().click();
    await this.propagar();
    return this.controller.expectOne(ESCRITA);
  }

  async confirmarRemocao() {
    this.lixeira().focus();
    this.lixeira().click();
    await this.propagar();
    this.confirmar().click();
    await this.propagar();
    return this.controller.expectOne(ESCRITA);
  }

  async recarregarCom(itens: readonly TipoBancaDto[]): Promise<void> {
    await this.propagar();
    this.controller.expectOne((r) => r.url === LISTA).flush(itens);
    await this.propagar();
  }
}

function configurarModuloDeTeste(): void {
  TestBed.configureTestingModule({
    imports: [TiposBancaPage],
    providers: [
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
    ],
  });
}

/** A página com a lista carregada. */
export async function montarPaginaDeRecusas(): Promise<PaginaDeRecusas> {
  configurarModuloDeTeste();
  const pagina = new PaginaDeRecusas();
  pagina.fixture.detectChanges();
  pagina.controller.expectOne((r) => r.url === LISTA).flush([banca]);
  await pagina.propagar();
  return pagina;
}
