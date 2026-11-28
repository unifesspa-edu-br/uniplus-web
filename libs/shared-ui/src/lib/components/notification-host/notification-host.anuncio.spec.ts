import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { type HostMontado, achar, montarHost } from './notification-host.testing';

describe('NotificationHostComponent: anúncio ao leitor de tela', () => {
  let host: HostMontado;

  const regiao = (tipo: 'polido' | 'assertivo'): HTMLElement =>
    achar(host.raiz, `[data-testid="notification-host-anuncio-${tipo}"]`);
  const texto = (tipo: 'polido' | 'assertivo'): string => (regiao(tipo).textContent ?? '').trim();

  beforeEach(() => {
    host = montarHost(false);
  });

  afterEach(() => {
    host.raiz.remove();
    TestBed.resetTestingModule();
  });

  it('tem as duas regiões desde o início, escondidas da vista e vazias', () => {
    expect(regiao('polido').getAttribute('aria-live')).toBe('polite');
    expect(regiao('polido').getAttribute('role')).toBe('status');
    expect(regiao('assertivo').getAttribute('aria-live')).toBe('assertive');
    expect(regiao('assertivo').hasAttribute('role')).toBe(false);
    expect(regiao('polido').classList).toContain('sr-only');
    expect(regiao('assertivo').classList).toContain('sr-only');
    expect(texto('polido') + texto('assertivo')).toBe('');
  });

  it('anuncia só o acréscimo: região não atômica, só adições, um elemento por anúncio', () => {
    expect(regiao('polido').getAttribute('aria-atomic')).toBe('false');
    expect(regiao('polido').getAttribute('aria-relevant')).toBe('additions');
    expect(regiao('assertivo').getAttribute('aria-atomic')).toBe('false');
    expect(regiao('assertivo').getAttribute('aria-relevant')).toBe('additions');
    host.service.error('Falha A', undefined, { persistent: true });
    host.service.error('Falha B', undefined, { persistent: true });
    host.fixture.detectChanges();
    const itens = regiao('assertivo').querySelectorAll('[data-anuncio]');
    expect(itens).toHaveLength(2);
    expect(itens[0].textContent).toContain('Falha A');
    expect(itens[1].textContent).toContain('Falha B');
  });

  it('anuncia o aviso novo com título e detalhe só na região do seu tipo', () => {
    host.service.warning('Prazo curto', 'Termina hoje.', { persistent: true });
    host.fixture.detectChanges();
    expect(texto('assertivo')).toContain('Prazo curto');
    expect(texto('assertivo')).toContain('Termina hoje.');
    expect(texto('polido')).toBe('');
  });

  it('anuncia a informação na região educada', () => {
    host.service.info('Rascunho salvo', undefined, { persistent: true });
    host.fixture.detectChanges();
    expect(texto('polido')).toContain('Rascunho salvo');
    expect(texto('assertivo')).toBe('');
  });

  it('anuncia a repetição sem repetir o detalhe', () => {
    host.service.error('Falha de rede', 'Detalhe longo da falha.', { persistent: true });
    host.fixture.detectChanges();
    host.service.error('Falha de rede', 'Detalhe longo da falha.', { persistent: true });
    host.fixture.detectChanges();
    expect(texto('assertivo')).toContain('Repetido 2 vezes: Falha de rede');
    expect(texto('assertivo').match(/Detalhe longo/g)).toHaveLength(1);
  });

  it('nenhum cartão carrega papel ou aria-live', () => {
    host.service.error('Falha', 'detalhe', { persistent: true });
    host.service.info('Aviso', undefined, { persistent: true });
    host.fixture.detectChanges();
    const cartoes = host.raiz.querySelectorAll('ui-aviso');
    expect(cartoes).toHaveLength(2);
    cartoes.forEach((cartao) => {
      const anunciantes = [...cartao.querySelectorAll('[role], [aria-live]')];
      expect(anunciantes.every((e) => e.closest('ui-referencia-ao-suporte'))).toBe(true);
    });
  });

  it('não perde o primeiro de dois anúncios feitos antes da renderização', () => {
    host.service.error('Falha A', undefined, { persistent: true });
    host.service.warning('Alerta B', undefined, { persistent: true });
    host.fixture.detectChanges();
    expect(texto('assertivo')).toContain('Falha A');
    expect(texto('assertivo')).toContain('Alerta B');
  });

  it('tira do documento o anúncio que saiu da janela dos 20 últimos', () => {
    for (let i = 1; i <= 21; i++) host.service.error(`Falha ${i}`, undefined, { persistent: true });
    host.fixture.detectChanges();
    expect(texto('assertivo')).not.toContain('Falha 1 ');
    expect(texto('assertivo')).toContain('Falha 2');
    expect(texto('assertivo')).toContain('Falha 21');
  });
});
