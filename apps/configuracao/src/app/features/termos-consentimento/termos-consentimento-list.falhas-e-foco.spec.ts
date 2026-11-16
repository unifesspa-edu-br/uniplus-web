import { TestBed } from '@angular/core/testing';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  TEXTO_TENTANDO,
  situacaoDoBotao,
} from '../../shared/foco/situacao-da-nova-tentativa.testing';
import { CenarioDaLista, LGPD, URL } from './termos-consentimento-list.testing';

describe('TermosConsentimentoListPage — falhas, apresentação e foco', () => {
  let c: CenarioDaLista;

  beforeEach(() => {
    c = new CenarioDaLista();
  });

  afterEach(() => c.encerrar());

  it('exibe erro ao falhar carregamento e permite tentar novamente', async () => {
    c.criar();

    const req1 = c.controller.expectOne((r) => r.url === URL);
    req1.flush(
      { type: 'https://uniplus.dev/erros/500', title: 'Erro de conexão', status: 500 },
      {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'Content-Type': 'application/problem+json' },
      },
    );

    await c.propagar();
    expect(c.store.errorMessage()).toBeTruthy();

    c.store.tentarNovamente();
    await c.propagar();
    const req2 = c.controller.expectOne((r) => r.url === URL);
    req2.flush([LGPD]);
    await c.propagar();

    expect(c.store.errorMessage()).toBeNull();
    expect(c.store.termos().length).toBe(1);
  });

  it('expõe legenda acessível descrevendo a tabela', async () => {
    await c.montar();
    c.fixture.detectChanges();

    const caption = c.fixture.nativeElement.querySelector('table > caption');
    expect(caption).not.toBeNull();
    expect(caption?.classList.contains('sr-only')).toBe(true);
    expect(caption?.textContent?.replace(/\s+/gu, ' ').trim()).toBe(
      'Termos de consentimento, com forma de aceite e status de revisão',
    );
  });

  it('a ação de abrir possui ícone, tooltip, nome acessível e leva ao termo', async () => {
    await c.montar();
    c.fixture.detectChanges();

    const link = c.fixture.nativeElement.querySelector(
      'ui-icon-button[icon="pi-folder-open"] a[aria-label="Abrir termo de consentimento Termo LGPD"]',
    );

    expect(link).not.toBeNull();
    expect(link?.querySelector('i')?.classList.contains('pi-folder-open')).toBe(true);
    expect(link?.getAttribute('data-tooltip')).toBe('Abrir termo de consentimento');
    expect(link?.getAttribute('href')).toMatch(/id-lgpd$/u);
  });

  const avisos = (): string[] =>
    TestBed.inject(NotificationService)
      .notifications()
      .map((item) => item.title);

  it('avisa por toast quando a leitura falha com 5xx', async () => {
    await c.montarComFalha(500);
    expect(avisos()).toEqual(['Falha ao listar']);
  });

  it('não avisa por toast quando a leitura falha com 4xx', async () => {
    await c.montarComFalha(404);
    expect(avisos()).toEqual([]);
    expect(c.fixture.nativeElement.textContent).toContain('Falha ao listar');
  });

  it('"Tentar novamente" fica indisponível durante a carga e leva o foco ao título quando dá certo', async () => {
    await c.montarComFalha(500);
    const tentar = c.botao('Tentar novamente');
    tentar.focus();
    tentar.click();
    await c.propagar();
    expect(c.botao('Tentar novamente')).toBe(tentar);
    expect(tentar.getAttribute('aria-disabled')).toBe('true');
    expect(situacaoDoBotao(tentar)).toBe(TEXTO_TENTANDO);
    expect(document.activeElement).toBe(tentar);
    tentar.click();
    c.controller.expectOne((r) => r.url === URL).flush([LGPD]);
    await c.propagar();
    await c.propagar();
    expect(c.fixture.nativeElement.textContent).not.toContain('Falha ao listar');
    expect(document.activeElement).toBe(c.fixture.nativeElement.querySelector('h2[tabindex="-1"]'));
  });

  it('não pede nada enquanto a lista carrega: página, nova tentativa e limpeza', async () => {
    c.criar();
    c.store.proximaPagina();
    c.store.paginaAnterior();
    c.store.tentarNovamente();
    c.store.limparFiltros();
    await c.propagar();
    c.controller.expectOne((r) => r.url === URL).flush([LGPD]);
    await c.propagar();
  });

  it('leva o foco ao título da lista quando a página abre sem foco', async () => {
    (document.activeElement as HTMLElement | null)?.blur();
    await c.montar();
    expect(document.activeElement).toBe(c.fixture.nativeElement.querySelector('h2[tabindex="-1"]'));
  });

  it('não toma o foco de quem já o tem em outro controle', async () => {
    const externo = document.createElement('button');
    document.body.append(externo);
    externo.focus();
    await c.montar();
    expect(document.activeElement).toBe(externo);
    externo.remove();
  });
});
