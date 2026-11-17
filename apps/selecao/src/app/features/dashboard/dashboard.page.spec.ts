import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UserContextService } from '@uniplus/shared-auth/bootstrap';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { mockProblemDetails } from '@uniplus/shared-testing';
import { AnuncioDaConclusao } from '@uniplus/shared-ui/components';
import { SELECAO_BASE_PATH, type ProcessoSeletivoResumoDto } from '@uniplus/shared-data/selecao';

import {
  VESTIBULAR_2026,
  VESTIBULAR_2027,
} from '../acompanhamento/painel-de-processos/processos-do-painel.testing';
import { DashboardPage } from './dashboard.page';

const COLECAO = '/api/selecao/processos-seletivos';
const PRIMEIRA_PAGINA = COLECAO + '?limit=50';
const PROXIMA_PAGINA = COLECAO + '?cursor=PROX&direction=next';

describe('DashboardPage', () => {
  let fixture: ComponentFixture<DashboardPage>;
  let host: HTMLElement;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: '' },
        {
          provide: UserContextService,
          useValue: { isAuthenticated: signal(true), user: signal({ id: 'u1' }) },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DashboardPage);
    host = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function responderPrimeiraPagina(
    itens: readonly ProcessoSeletivoResumoDto[],
    proxima?: string,
  ): void {
    const headers = proxima ? { Link: `<${proxima}>; rel="next"` } : undefined;
    http.expectOne(PRIMEIRA_PAGINA).flush(itens, { headers });
    fixture.detectChanges();
  }

  function botao(seletor: string): HTMLButtonElement {
    const elemento = host.querySelector<HTMLButtonElement>(seletor);
    if (!elemento) throw new Error('Botão ausente no painel: ' + seletor);
    return elemento;
  }

  function avancarPagina(): void {
    responderPrimeiraPagina([VESTIBULAR_2026], PROXIMA_PAGINA);
    botao('[data-pager="next"]').click();
    fixture.detectChanges();
  }

  function recusarProximaPagina(status: number, code: string): void {
    http.expectOne(PROXIMA_PAGINA).flush(mockProblemDetails({ status, code }), {
      status,
      statusText: 'Falha na consulta',
    });
    fixture.detectChanges();
  }

  function reiniciarComFoco(): HTMLButtonElement {
    avancarPagina();
    recusarProximaPagina(410, 'uniplus.cursor.expirado');
    const atualizar = botao('[data-acao="atualizar-lista"]');
    atualizar.focus();
    atualizar.click();
    fixture.detectChanges();
    return atualizar;
  }

  const abrir = 'button[aria-label^="Abrir acompanhamento"]';

  it('sinaliza a espera antes de apresentar o resultado vazio', () => {
    expect(host.textContent).toContain('Carregando processos seletivos');
    expect(host.textContent).not.toContain('Nenhum processo seletivo encontrado');
    responderPrimeiraPagina([]);
    expect(host.textContent).toContain('Nenhum processo seletivo encontrado');
  });

  it('apresenta o processo e abre o acompanhamento do cartão escolhido', () => {
    responderPrimeiraPagina([VESTIBULAR_2026]);
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    expect(host.textContent).toContain(VESTIBULAR_2026.nome);
    botao(abrir).click();
    expect(navegar).toHaveBeenCalledWith(['/acompanhamento/processos', VESTIBULAR_2026.id]);
  });

  it('bloqueia a abertura dos cartões enquanto a página está sendo substituída', () => {
    avancarPagina();
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    expect(botao(abrir).getAttribute('aria-disabled')).toBe('true');
    botao(abrir).click();
    expect(navegar).not.toHaveBeenCalled();

    http.expectOne(PROXIMA_PAGINA).flush([VESTIBULAR_2027]);
    fixture.detectChanges();
    botao(abrir).click();
    expect(navegar).toHaveBeenCalledWith(['/acompanhamento/processos', VESTIBULAR_2027.id]);
  });

  it('preserva o foco durante a recuperação e o leva ao título quando chegam os dados', async () => {
    const atualizar = reiniciarComFoco();
    expect(document.activeElement).toBe(atualizar);
    expect(atualizar.getAttribute('aria-disabled')).toBe('true');
    expect(host.textContent).not.toContain(VESTIBULAR_2026.nome);
    atualizar.click();
    responderPrimeiraPagina([VESTIBULAR_2026]);
    await fixture.whenStable();
    expect(host.contains(atualizar)).toBe(false);
    expect(document.activeElement).toBe(host.querySelector('h1'));
  });

  it('respeita o foco escolhido durante a espera', async () => {
    reiniciarComFoco();
    const outroDestino = document.createElement('button');
    host.append(outroDestino);
    outroDestino.focus();
    responderPrimeiraPagina([]);
    await fixture.whenStable();
    expect(document.activeElement).toBe(outroDestino);
  });

  it('orienta o reinício sem atribuir um cursor inválido à expiração', async () => {
    avancarPagina();
    recusarProximaPagina(400, 'uniplus.cursor.invalido');
    expect(host.textContent).toContain('Atualize a lista para voltar ao início');
    expect(host.textContent).not.toContain('expirou');
    botao('[data-acao="atualizar-lista"]').click();
    responderPrimeiraPagina([VESTIBULAR_2027]);
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(host.textContent).toContain(VESTIBULAR_2027.nome);
    });
  });

  it('uma nova tentativa que recebe 410 informa a expiração sem anunciar sucesso', async () => {
    const anunciar = vi.spyOn(TestBed.inject(AnuncioDaConclusao), 'anunciar');
    avancarPagina();
    recusarProximaPagina(500, 'uniplus.client.http');
    const tentar = botao('ui-falha-de-leitura button');
    tentar.focus();
    tentar.click();
    fixture.detectChanges();
    host.querySelector('h1')?.focus();
    recusarProximaPagina(410, 'uniplus.cursor.expirado');
    await fixture.whenStable();
    expect(host.textContent).toContain('O tempo desta consulta expirou');
    expect(anunciar).not.toHaveBeenCalled();
  });
});
