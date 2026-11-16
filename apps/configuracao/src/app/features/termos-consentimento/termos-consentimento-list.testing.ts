import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  CONFIGURACAO_BASE_PATH,
  TermoConsentimentoResumoDto,
} from '@uniplus/shared-data/configuracao';
import { vi } from 'vitest';
import { TermosConsentimentoStore } from './termos-consentimento.store';
import { TermosConsentimentoListPage } from './termos-consentimento-list.page';

const BASE = 'http://localhost:5000';
export const URL = `${BASE}/api/configuracao/termos-consentimento`;

export function termoResumo(
  over: Partial<TermoConsentimentoResumoDto> = {},
): TermoConsentimentoResumoDto {
  return {
    id: over.id ?? crypto.randomUUID(),
    codigo: 'TERMO_DE_PRIVACIDADE_LGPD',
    nome: 'Termo de Privacidade LGPD',
    formaAceiteRascunho: 'REGISTRO_DIGITAL_COM_LOG_IP',
    revisado: true,
    criadoEm: '2026-08-13T10:00:00Z',
    ...over,
  };
}

export const LGPD = termoResumo({ id: 'id-lgpd', nome: 'Termo LGPD' });
export const USO_IMAGEM = termoResumo({
  id: 'id-uso-imagem',
  nome: 'Uso de Imagem',
  revisado: false,
});

export const comProximo = (cursor: string): Record<string, string> => ({
  Link: `<http://localhost:5000/x?cursor=${cursor}&direction=next>; rel="next"`,
});

const problemaDeListagem = (status: number) =>
  [
    { type: 'about:blank', title: 'Falha ao listar', status, code: 'uniplus.erro' },
    {
      status,
      statusText: 'Erro',
      headers: { 'Content-Type': 'application/problem+json' },
    },
  ] as const;

/** A página de listagem de termos, criada pelo teste quando ele escolhe como a lista responde. */
export class CenarioDaLista {
  fixture!: ComponentFixture<TermosConsentimentoListPage>;
  store!: TermosConsentimentoStore;
  controller!: HttpTestingController;

  constructor() {
    TestBed.configureTestingModule({
      imports: [TermosConsentimentoListPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([{ path: 'termos-consentimento', children: [] }]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
  }

  encerrar(): void {
    vi.useRealTimers();
    this.controller.verify();
  }

  async propagar(): Promise<void> {
    await Promise.resolve();
    TestBed.inject(ApplicationRef).tick();
    this.fixture.detectChanges();
  }

  botao(texto: string): HTMLButtonElement {
    const botoes = [...(this.fixture.nativeElement as HTMLElement).querySelectorAll('button')];
    return botoes.find((item) => item.textContent?.trim() === texto) as HTMLButtonElement;
  }

  /** Renderiza a página e deixa o pedido da primeira página pendente. */
  criar(): void {
    this.fixture = TestBed.createComponent(TermosConsentimentoListPage);
    this.store = this.fixture.debugElement.injector.get(TermosConsentimentoStore);
    this.controller = TestBed.inject(HttpTestingController);
    this.fixture.detectChanges();
  }

  async montar(
    itens: readonly TermoConsentimentoResumoDto[] = [LGPD, USO_IMAGEM],
    headers?: Record<string, string>,
  ): Promise<void> {
    this.criar();
    const req = this.controller.expectOne((r) => r.url === URL && r.params.get('limit') === '50');
    req.flush([...itens], { headers });
    await this.propagar();
    await this.propagar();
  }

  async montarComFalha(status: number): Promise<void> {
    this.criar();
    this.controller.expectOne((r) => r.url === URL).flush(...problemaDeListagem(status));
    await this.propagar();
  }
}
