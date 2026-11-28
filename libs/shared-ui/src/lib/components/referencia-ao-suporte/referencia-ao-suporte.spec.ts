import type { ComponentFixture } from '@angular/core/testing';
import type { ReferenciaAoSuporte } from '@uniplus/shared-core/http';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ReferenciaAoSuporteComponent } from './referencia-ao-suporte';
import { montar } from './referencia-ao-suporte.testing';

const CODIGO = 'uniplus.selecao.exemplo';
const IDENTIFICADOR = '0af7651916cd43dd8448eb211c80319c';
const PASSO = 'Passo 4 — Vagas';

const DO_SERVIDOR: ReferenciaAoSuporte = {
  origem: 'servidor',
  codigoDoErro: CODIGO,
  identificadorDoPedido: IDENTIFICADOR,
};

function rotulos(fixture: ComponentFixture<ReferenciaAoSuporteComponent>): string[] {
  const tela = fixture.nativeElement as HTMLElement;
  return [...tela.querySelectorAll('dt')].map((dt) => dt.textContent?.trim() ?? '');
}

async function copiar(fixture: ComponentFixture<ReferenciaAoSuporteComponent>): Promise<void> {
  (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('ReferenciaAoSuporteComponent', () => {
  afterEach(() => Reflect.deleteProperty(window.navigator, 'clipboard'));

  it('mostra o passo, o código do erro e o identificador do pedido, os dois últimos em código', () => {
    const fixture = montar(DO_SERVIDOR, PASSO);
    const tela = fixture.nativeElement as HTMLElement;

    expect(tela.textContent).toContain('Informe ao suporte:');
    expect(rotulos(fixture)).toEqual(['Passo', 'Código do erro', 'Identificador do pedido']);
    const valores = [...tela.querySelectorAll('code')];
    expect(valores.map((valor) => valor.textContent)).toEqual([CODIGO, IDENTIFICADOR]);
    expect(valores.every((valor) => valor.getAttribute('translate') === 'no')).toBe(true);
  });

  it('não mostra a linha do identificador que não tem valor', () => {
    const semIdentificador = { ...DO_SERVIDOR, identificadorDoPedido: null } as const;

    expect(rotulos(montar(semIdentificador))).toEqual(['Código do erro']);
  });

  it('não mostra a linha do código que não tem valor', () => {
    const semCodigo = { ...DO_SERVIDOR, codigoDoErro: null } as const;

    expect(rotulos(montar(semCodigo, PASSO))).toEqual(['Passo', 'Identificador do pedido']);
  });

  it('o erro da própria tela sai numa frase com o passo e o código', () => {
    const fixture = montar({ origem: 'tela', codigo: 'fuso_institucional_nao_reconhecido' }, PASSO);
    const tela = fixture.nativeElement as HTMLElement;

    expect(tela.textContent?.trim()).toBe(
      'Informe ao suporte: passo 4 — Vagas, código fuso_institucional_nao_reconhecido.',
    );
    expect(tela.querySelector('dl')).toBeNull();
  });

  it('o erro da própria tela sem passo diz só o código', () => {
    const fixture = montar({ origem: 'tela', codigo: 'regra_x versão 2' });

    expect((fixture.nativeElement as HTMLElement).textContent?.trim()).toBe(
      'Informe ao suporte: código regra_x versão 2.',
    );
  });

  it('copia o texto exato e anuncia a cópia', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const fixture = montar(DO_SERVIDOR, PASSO, { writeText });

    await copiar(fixture);

    expect(writeText).toHaveBeenCalledWith(
      `${PASSO}. Código do erro: ${CODIGO}. Identificador do pedido: ${IDENTIFICADOR}.`,
    );
    const status = (fixture.nativeElement as HTMLElement).querySelector('[role="status"]');
    expect(status?.textContent?.trim()).toBe('Copiado.');
  });

  it('copia a frase do erro da própria tela', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const fixture = montar({ origem: 'tela', codigo: 'regra_x' }, PASSO, { writeText });

    await copiar(fixture);

    expect(writeText).toHaveBeenCalledWith('Informe ao suporte: passo 4 — Vagas, código regra_x.');
  });

  it('se a cópia falha, diz o que fazer', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('negado'));
    const fixture = montar(DO_SERVIDOR, null, { writeText });

    await copiar(fixture);

    const status = (fixture.nativeElement as HTMLElement).querySelector('[role="status"]');
    expect(status?.textContent?.trim()).toBe('Não foi possível copiar. Selecione o texto e copie.');
  });

  it('descarta o resultado da cópia se a referência mudou enquanto ela esperava', async () => {
    let concluir: () => void = () => undefined;
    const writeText = vi.fn().mockReturnValue(
      new Promise<void>((resolver) => {
        concluir = resolver;
      }),
    );
    const fixture = montar(DO_SERVIDOR, PASSO, { writeText });
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();

    fixture.componentRef.setInput('referencia', { ...DO_SERVIDOR, codigoDoErro: 'uniplus.outro' });
    fixture.detectChanges();
    concluir();
    await fixture.whenStable();
    fixture.detectChanges();

    const status = (fixture.nativeElement as HTMLElement).querySelector('[role="status"]');
    expect(status?.textContent?.trim() ?? '').toBe('');
  });

  it('liga o botão ao texto por aria-describedby e leva a palavra visível no nome', () => {
    const fixture = montar(DO_SERVIDOR, PASSO, { writeText: vi.fn() });
    const tela = fixture.nativeElement as HTMLElement;
    const botao = tela.querySelector('button') as HTMLButtonElement;
    const texto = tela.querySelector(`#${botao.getAttribute('aria-describedby')}`);

    expect(botao.textContent?.trim()).toBe('Copiar');
    expect(botao.hasAttribute('aria-pressed')).toBe(false);
    expect(texto?.textContent).toContain(CODIGO);
  });

  it('sem área de transferência, não oferece copiar', () => {
    const fixture = montar(DO_SERVIDOR, PASSO);

    expect((fixture.nativeElement as HTMLElement).querySelector('button')).toBeNull();
  });
});
