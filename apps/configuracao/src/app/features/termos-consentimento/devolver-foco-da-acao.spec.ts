import { ApplicationRef, Component, computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { devolverFocoDaAcao } from './devolver-foco-da-acao';
import { AcaoTermo } from './termo-consentimento-form';

const processando = signal(false);
const acao = signal<AcaoTermo | null>(null);
const promoverDisponivel = signal(true);

@Component({
  selector: 'cfg-teste-foco-da-acao',
  template: `
    <h1 id="titulo" tabindex="-1">Termo</h1>
    <button id="revisar" data-acao="revisar">Revisar</button>
    <button id="promover" data-acao="promover" [disabled]="!promoverDisponivel()">Promover</button>
    <input id="outro" />
  `,
})
class HospedeiroComponent {
  protected readonly promoverDisponivel = promoverDisponivel;
  constructor() {
    devolverFocoDaAcao({ processando, acao: computed(() => acao()), idDoTitulo: 'titulo' });
  }
}

describe('devolverFocoDaAcao', () => {
  let appRef: ApplicationRef;
  let raiz: HTMLElement;

  function montar(): void {
    processando.set(false);
    acao.set(null);
    promoverDisponivel.set(true);
    const fixture = TestBed.createComponent(HospedeiroComponent);
    raiz = fixture.nativeElement;
    document.body.append(raiz);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
    appRef.tick();
  }
  const botao = (id: string): HTMLElement =>
    raiz.querySelector<HTMLElement>(`#${id}`) as HTMLElement;

  /** Uma ação da escrita até a releitura; `aoTerminar` roda antes de a releitura encerrar, quando a tela muda. */
  function executar(daAcao: AcaoTermo | null, aoTerminar: () => void = () => undefined): void {
    processando.set(true);
    acao.set(daAcao);
    appRef.tick();
    acao.set(null);
    appRef.tick();
    aoTerminar();
    processando.set(false);
    appRef.tick();
  }

  afterEach(() => raiz.remove());

  it('devolve o foco ao botão da ação quando ele o perdeu e ainda aceita foco', () => {
    montar();
    executar('revisar');
    expect(document.activeElement).toBe(botao('revisar'));
  });

  it('leva o foco ao título quando o botão da ação ficou indisponível', () => {
    montar();
    botao('promover').focus();
    executar('promover', () => promoverDisponivel.set(false));
    expect(document.activeElement).toBe(botao('titulo'));
  });

  it('leva o foco ao título quando a ação não tem botão', () => {
    montar();
    executar(null);
    expect(document.activeElement).toBe(botao('titulo'));
  });

  it('não toma o foco que a pessoa levou a outro campo', () => {
    montar();
    botao('outro').focus();
    executar('revisar');
    expect(document.activeElement).toBe(botao('outro'));
  });

  it('não faz nada se nenhuma ação foi iniciada', () => {
    montar();
    botao('outro').focus();
    processando.set(false);
    appRef.tick();
    expect(document.activeElement).toBe(botao('outro'));
  });
});
