import { TestBed } from '@angular/core/testing';
import { expect } from 'vitest';

import { PainelDeProcessosComponent, type ProcessoDoPainel } from './painel-de-processos.component';

/** Dados fictícios: existem só nos testes, nunca em código de produção. */
export const PROCESSOS_FICTICIOS: readonly ProcessoDoPainel[] = [
  { id: 'processo-ficticio-1', nome: 'Processo Seletivo Fictício A' },
  { id: 'processo-ficticio-2', nome: 'Processo Seletivo Fictício B' },
  { id: 'processo-ficticio-3', nome: 'Processo Seletivo Fictício C' },
];

export const PROCESSO_FICTICIO_DE_NOME_LONGO: ProcessoDoPainel = {
  id: 'processo-ficticio-longo',
  nome:
    'Processo Seletivo Fictício para Ingresso nos Cursos de Graduação Presenciais ' +
    'em Regime Especial de Oferta Complementar — ' +
    'SeguenciaSemEspacosDeUmNomeExcessivamenteLongoParaForcarAQuebraDeLinhaNoCartao',
};

/** O painel montado para um teste, com o que os testes precisam para ler e acionar a tela. */
export class PainelEmTeste {
  readonly fixture = TestBed.createComponent(PainelDeProcessosComponent);
  readonly componente = this.fixture.componentInstance;

  entrada(nome: string, valor: unknown): void {
    this.fixture.componentRef.setInput(nome, valor);
    this.fixture.detectChanges();
  }

  host(): HTMLElement {
    return this.fixture.nativeElement as HTMLElement;
  }

  texto(): string {
    return this.host().textContent ?? '';
  }

  botao(nome: string): HTMLButtonElement | undefined {
    return Array.from(this.host().querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes(nome),
    );
  }

  emissoesDaNavegacao(): string[] {
    const emitidos: string[] = [];
    this.componente.paginaAnterior.subscribe(() => emitidos.push('anterior'));
    this.componente.proximaPagina.subscribe(() => emitidos.push('proxima'));
    return emitidos;
  }

  regiaoDeStatus(): Element | null {
    return this.host().querySelector('.painel__espera[role="status"]');
  }

  avisoDeEspera(): string {
    return this.regiaoDeStatus()?.textContent?.trim() ?? '';
  }

  esperaSemReenviar(nome: string, contagem: () => number): void {
    const acao = this.botao(nome) as HTMLButtonElement;
    acao.focus();
    acao.click();
    this.entrada('carregando', true);

    acao.click();

    expect(contagem()).toBe(1);
    expect(acao.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(acao);
    expect(this.avisoDeEspera()).toContain('Carregando processos seletivos');
  }

  cartoes(): HTMLElement[] {
    return Array.from(this.host().querySelectorAll<HTMLElement>('.painel__cartao'));
  }
}

export function montarPainel(): PainelEmTeste {
  TestBed.configureTestingModule({ imports: [PainelDeProcessosComponent] });
  return new PainelEmTeste();
}
