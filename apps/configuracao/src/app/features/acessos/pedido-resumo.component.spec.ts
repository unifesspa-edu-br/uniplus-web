import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { beforeEach, describe, expect, it } from 'vitest';
import { PedidoResumoComponent } from './pedido-resumo.component';
import { pedido } from './testes';

describe('PedidoResumoComponent', () => {
  let fixture: ComponentFixture<PedidoResumoComponent>;
  let decisoes: string[];
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const botao = (texto: string): HTMLButtonElement => {
    const encontrado = [...raiz().querySelectorAll('button')].find((item) =>
      item.textContent?.includes(texto),
    );
    if (!encontrado) throw new Error(`botão ausente: ${texto}`);
    return encontrado;
  };

  function entradas(parcial: {
    decisaoIndisponivel: boolean;
    prazoInvalido?: boolean;
    aceitaECancela?: boolean;
  }): void {
    const prazo = new FormControl('', { nonNullable: true });
    fixture.componentRef.setInput('pedido', pedido());
    fixture.componentRef.setInput('nomeDoEscopo', () => 'Escopo informado');
    fixture.componentRef.setInput('prazo', prazo);
    fixture.componentRef.setInput('informaPrazo', true);
    fixture.componentRef.setInput('podeAceitar', parcial.aceitaECancela ?? false);
    fixture.componentRef.setInput('podeDecidir', true);
    fixture.componentRef.setInput('decisaoIndisponivel', parcial.decisaoIndisponivel);
    fixture.componentRef.setInput('podeCancelar', parcial.aceitaECancela ?? false);
    fixture.componentRef.setInput('podeAnexar', false);
    fixture.componentRef.setInput('aguardandoDocumento', false);
    fixture.detectChanges();
    if (parcial.prazoInvalido) {
      prazo.setErrors({ prazoNoPassado: true });
      prazo.markAsTouched();
      fixture.detectChanges();
    }
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
    fixture = TestBed.createComponent(PedidoResumoComponent);
    decisoes = [];
    fixture.componentInstance.confirmacao.subscribe(({ acao }) => decisoes.push(acao));
    fixture.componentInstance.recusar.subscribe(() => decisoes.push('recusar'));
  });

  it('com a decisão disponível, aprovar e recusar são pedidos', () => {
    entradas({ decisaoIndisponivel: false });

    botao('Aprovar').click();
    botao('Recusar').click();

    expect(decisoes).toEqual(['aprovar', 'recusar']);
    expect(botao('Aprovar').getAttribute('aria-disabled')).toBeNull();
  });

  it('com a decisão indisponível, aprovar e recusar ficam marcados e não pedem nada', () => {
    entradas({ decisaoIndisponivel: true });

    botao('Aprovar').click();
    botao('Recusar').click();

    expect(decisoes).toEqual([]);
    expect(botao('Aprovar').getAttribute('aria-disabled')).toBe('true');
    expect(botao('Recusar').getAttribute('aria-disabled')).toBe('true');
  });

  it('o prazo recusado aparece no campo, ligado à sua mensagem', () => {
    entradas({ decisaoIndisponivel: false, prazoInvalido: true });

    const campo = raiz().querySelector('input[type="date"]');
    expect(campo?.getAttribute('aria-invalid')).toBe('true');
    expect(campo?.getAttribute('aria-describedby')).toContain('cfg-pedido-prazo-erro');
    expect(raiz().querySelector('#cfg-pedido-prazo-erro')).not.toBeNull();
  });

  it('com a decisão disponível, aceitar e cancelar são pedidos', () => {
    entradas({ decisaoIndisponivel: false, aceitaECancela: true });

    botao('Aceitar o pedido').click();
    botao('Cancelar o pedido').click();

    expect(decisoes).toEqual(['aceitar', 'cancelar']);
    expect(botao('Aceitar o pedido').getAttribute('aria-disabled')).toBeNull();
    expect(botao('Cancelar o pedido').getAttribute('aria-disabled')).toBeNull();
  });

  it('com a decisão indisponível, aceitar e cancelar ficam marcados e não pedem nada', () => {
    entradas({ decisaoIndisponivel: true, aceitaECancela: true });

    botao('Aceitar o pedido').click();
    botao('Cancelar o pedido').click();

    expect(decisoes).toEqual([]);
    expect(botao('Aceitar o pedido').getAttribute('aria-disabled')).toBe('true');
    expect(botao('Cancelar o pedido').getAttribute('aria-disabled')).toBe('true');
  });

  it('mostra o escopo com o nome que a página informa', () => {
    entradas({ decisaoIndisponivel: false });

    expect(raiz().textContent).toContain('Escopo informado');
  });
});
