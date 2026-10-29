import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import type { EventoDaTrilhaDto } from '@uniplus/shared-data/autorizacao';
import { origemDaFila } from './origens-do-pedido';
import { autorDoEvento, TrilhaDeAcessoComponent } from './trilha-de-acesso.component';

describe('autorDoEvento', () => {
  const sub = '6ab1f3f7-1c11-4f8e-9d52-6a1f0b2c0001';

  it('mostra o nome gravado quando a API o traz', () => {
    expect(autorDoEvento({ emissor: 'unifesspa', sub, nome: 'Diogo Bruno Filipe Souza' })).toBe(
      'Diogo Bruno Filipe Souza',
    );
  });

  it('cai no início do identificador quando o registro não tem nome', () => {
    expect(autorDoEvento({ emissor: 'unifesspa', sub, nome: null })).toBe('Pessoa 6ab1f3f7');
    expect(autorDoEvento({ emissor: 'unifesspa', sub })).toBe('Pessoa 6ab1f3f7');
    expect(autorDoEvento({ emissor: 'unifesspa', sub, nome: '  ' })).toBe('Pessoa 6ab1f3f7');
  });

  it('mantém o rótulo do verificador de documentos', () => {
    expect(autorDoEvento({ emissor: 'uniplus:sistema', sub: 'verificador' })).toBe(
      'Verificador de documentos',
    );
  });
});

describe('origemDaFila', () => {
  it('volta ao histórico quando a pessoa veio dele e aos próprios pedidos nos demais casos', () => {
    expect(origemDaFila('todos').rota).toBe('/acessos/historico');
    expect(origemDaFila('gestor').rota).toBe('/acessos/fila-do-gestor');
    expect(origemDaFila('inexistente').rota).toBe('/acessos/pedidos');
    expect(origemDaFila(null).rota).toBe('/acessos/pedidos');
  });
});

describe('TrilhaDeAcessoComponent', () => {
  const sha = 'a'.repeat(64);
  const anexo = '01a18900-0000-7000-8000-000000000001';
  const eventos: readonly EventoDaTrilhaDto[] = [
    {
      tipo: 'anexo_verificado',
      instante: '2026-10-29T15:00:00Z',
      autor: { emissor: 'uniplus:sistema', sub: 'verificador' },
      detalhe: `Anexo ${anexo}. SHA-256 do PDF: ${sha}.`,
    },
  ];

  function montar() {
    const fixture = TestBed.createComponent(TrilhaDeAcessoComponent);
    fixture.componentRef.setInput('eventos', eventos);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const linha = host.querySelector('tbody tr') as HTMLElement;
    return { fixture, host, linha };
  }

  it('corta o detalhe numa linha com reticências, sem tooltip, e não mostra o hash inteiro na lista', () => {
    const { host, linha } = montar();
    const celula = linha.querySelector('.cfg-trilha__detalhe') as HTMLElement;

    expect(linha.querySelector('[title]')).toBeNull();
    expect(celula.textContent).not.toContain(sha);
    expect(host.querySelector('.cfg-trilha__completo')).toBeNull();
  });

  it('abre o detalhe completo abaixo da linha com o clique e fecha com outro', () => {
    const { fixture, host, linha } = montar();

    linha.click();
    fixture.detectChanges();

    const completo = host.querySelector('.cfg-trilha__completo') as HTMLElement;
    expect(completo.textContent).toContain(sha);
    expect(completo.textContent).toContain(anexo);
    expect(completo.textContent).toContain('Verificador de documentos');
    expect(linha.getAttribute('aria-expanded')).toBe('true');

    linha.click();
    fixture.detectChanges();
    expect(host.querySelector('.cfg-trilha__completo')).toBeNull();
  });

  it('abre com o Enter na linha focada, sem rolar a página, e ignora o Enter vindo de dentro dela', () => {
    const { fixture, host, linha } = montar();
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });

    linha.dispatchEvent(enter);
    fixture.detectChanges();

    expect(enter.defaultPrevented).toBe(true);
    expect(host.querySelector('.cfg-trilha__completo')).not.toBeNull();

    linha
      .querySelector('td')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();
    expect(host.querySelector('.cfg-trilha__completo')).not.toBeNull();
  });
});
