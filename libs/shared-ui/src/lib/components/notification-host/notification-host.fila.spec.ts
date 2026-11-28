import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';

import { type HostMontado, achar, incluirAvisos, montarHost } from './notification-host.testing';

function titulos(raiz: HTMLElement, seletor: string): string[] {
  return [...raiz.querySelectorAll(`${seletor} .toast__title`)].map((t) =>
    (t.textContent ?? '').trim(),
  );
}

const mais = (raiz: HTMLElement): HTMLButtonElement =>
  achar<HTMLButtonElement>(raiz, '.toast-mais');

function fechar(host: HostMontado, titulo: string): void {
  const cartoes = [...host.raiz.querySelectorAll('ui-aviso')];
  const cartao = cartoes.find(
    (c) => c.querySelector('.toast__title')?.textContent?.trim() === titulo,
  );
  achar<HTMLButtonElement>(cartao as HTMLElement, '.toast__close').click();
  host.fixture.detectChanges();
}

describe('NotificationHostComponent: fila e recolhimento', () => {
  let host: HostMontado;

  afterEach(() => {
    host.raiz.remove();
    TestBed.resetTestingModule();
  });

  describe('avisos à vista', () => {
    it('mostra 3 avisos, os mais novos, em tela normal', () => {
      host = montarHost(false);
      incluirAvisos(host.service, 5);
      host.fixture.detectChanges();
      expect(titulos(host.raiz, '.toast-region')).toEqual(['Aviso 3', 'Aviso 4', 'Aviso 5']);
      expect(mais(host.raiz).textContent?.trim()).toBe('Mais 2 avisos');
    });

    it('mostra só o mais novo em tela compacta', () => {
      host = montarHost(true);
      incluirAvisos(host.service, 3);
      host.fixture.detectChanges();
      expect(titulos(host.raiz, '.toast-region')).toEqual(['Aviso 3']);
      expect(mais(host.raiz).textContent?.trim()).toBe('Mais 2 avisos');
    });

    it('usa o singular com um recolhido', () => {
      host = montarHost(true);
      incluirAvisos(host.service, 2);
      host.fixture.detectChanges();
      expect(mais(host.raiz).textContent?.trim()).toBe('Mais 1 aviso');
    });

    it('não mostra "Mais N" quando tudo cabe', () => {
      host = montarHost(false);
      incluirAvisos(host.service, 3);
      host.fixture.detectChanges();
      expect(host.raiz.querySelector('.toast-mais')).toBeNull();
    });

    it('devolve um recolhido à vista quando um aviso com prazo expira', () => {
      host = montarHost(true);
      host.service.info('Antigo', undefined, { persistent: true });
      host.service.info('Novo');
      host.fixture.detectChanges();
      expect(titulos(host.raiz, '.toast-region')).toEqual(['Novo']);
      host.service.dismiss(2);
      host.fixture.detectChanges();
      expect(titulos(host.raiz, '.toast-region')).toEqual(['Antigo']);
      expect(host.raiz.querySelector('.toast-mais')).toBeNull();
    });
  });

  describe('lista recolhida', () => {
    function abrir(): void {
      host = montarHost(true);
      incluirAvisos(host.service, 3);
      host.fixture.detectChanges();
      mais(host.raiz).click();
      host.fixture.detectChanges();
    }

    it('liga o botão à lista e começa fechada', () => {
      host = montarHost(true);
      incluirAvisos(host.service, 3);
      host.fixture.detectChanges();
      const lista = host.raiz.querySelector('.toast-recolhidos') as HTMLElement;
      expect(mais(host.raiz).getAttribute('aria-expanded')).toBe('false');
      expect(mais(host.raiz).getAttribute('aria-controls')).toBe(lista.id);
      expect(lista.hidden).toBe(true);
    });

    it('abre com os avisos inteiros, cada um com copiar e fechar', () => {
      abrir();
      expect(mais(host.raiz).getAttribute('aria-expanded')).toBe('true');
      expect(titulos(host.raiz, '.toast-recolhidos')).toEqual(['Aviso 1', 'Aviso 2']);
      const cartoes = host.raiz.querySelectorAll('.toast-recolhidos .toast__close');
      expect(cartoes).toHaveLength(2);
    });

    it('fecha de novo no segundo clique', () => {
      abrir();
      mais(host.raiz).click();
      host.fixture.detectChanges();
      expect(mais(host.raiz).getAttribute('aria-expanded')).toBe('false');
      expect(host.raiz.querySelectorAll('.toast-recolhidos ui-aviso')).toHaveLength(0);
    });

    it('leva o foco ao "Mais N" ao fechar a lista com o foco dentro dela', () => {
      abrir();
      achar<HTMLButtonElement>(host.raiz, '.toast-recolhidos .toast__close').focus();
      mais(host.raiz).click();
      host.fixture.detectChanges();
      expect(document.activeElement).toBe(mais(host.raiz));
    });
  });

  describe('foco ao fechar', () => {
    const fecharDoCartao = (titulo: string): Element | null | undefined =>
      [...host.raiz.querySelectorAll('ui-aviso')]
        .find((c) => c.querySelector('.toast__title')?.textContent?.trim() === titulo)
        ?.querySelector('.toast__close');

    it('vai ao Fechar do próximo aviso à vista', () => {
      host = montarHost(false);
      incluirAvisos(host.service, 3);
      host.fixture.detectChanges();
      fechar(host, 'Aviso 1');
      expect(document.activeElement).toBe(fecharDoCartao('Aviso 2'));
    });

    it('vai ao "Mais N" quando nenhum outro está à vista', () => {
      host = montarHost(true);
      incluirAvisos(host.service, 3);
      host.fixture.detectChanges();
      fechar(host, 'Aviso 3');
      expect(document.activeElement).toBe(mais(host.raiz));
    });

    it('vai ao conteúdo principal quando não sobra aviso', () => {
      const principal = document.createElement('main');
      document.body.append(principal);
      host = montarHost(false);
      host.service.info('Único', undefined, { persistent: true });
      host.fixture.detectChanges();
      fechar(host, 'Único');
      expect(document.activeElement).toBe(principal);
      expect(principal.getAttribute('tabindex')).toBe('-1');
      principal.remove();
    });

    it('não falha sem conteúdo principal na página', () => {
      host = montarHost(false);
      host.service.info('Único', undefined, { persistent: true });
      host.fixture.detectChanges();
      expect(() => fechar(host, 'Único')).not.toThrow();
    });

    it('não move o foco ao agrupar uma repetição', () => {
      host = montarHost(false);
      incluirAvisos(host.service, 2);
      host.fixture.detectChanges();
      const botao = fecharDoCartao('Aviso 1') as HTMLElement;
      botao.focus();
      host.service.info('Aviso 2', 'Detalhe 2', { persistent: true });
      host.fixture.detectChanges();
      expect(document.activeElement).toBe(botao);
    });
  });
});
