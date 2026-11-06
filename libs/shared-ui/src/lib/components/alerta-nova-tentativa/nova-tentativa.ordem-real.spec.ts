import '@analogjs/vitest-angular/setup-zone';
import {
  ChangeDetectionStrategy,
  Component,
  NgZone,
  computed,
  input,
  output,
  provideZoneChangeDetection,
  signal,
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AnuncioDaConclusao } from './anuncio-da-conclusao';
import { acompanharNovaTentativa } from './nova-tentativa';
import { SituacaoDaNovaTentativaComponent } from './situacao-da-nova-tentativa';

interface Busca {
  readonly carregando: boolean;
  readonly erro: boolean;
}

/** Como `dia-nao-util-campos`: `pendente` e `falhou` derivam de um `input()` que o pai alimenta. */
@Component({
  selector: 'ui-teste-filho',
  standalone: true,
  imports: [SituacaoDaNovaTentativaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 id="titulo-do-filho" tabindex="-1">Busca</h1>
    @if (busca().erro || tentativa.fase() === 'tentando') {
      <button type="button" (click)="tentarNovamente()">Tentar novamente</button>
      <ui-situacao-da-nova-tentativa [fase]="tentativa.fase()" />
    }
  `,
})
class FilhoComponent {
  readonly busca = input.required<Busca>();
  readonly alteracao = output();
  readonly tentativa = acompanharNovaTentativa({
    pendente: computed(() => this.busca().carregando),
    falhou: computed(() => this.busca().erro),
    destino: () => document.getElementById('titulo-do-filho'),
  });

  protected tentarNovamente(): void {
    this.tentativa.executar(() => this.alteracao.emit());
  }
}

/** O pai real: grava o estado na hora; o filho só o recebe na atualização da tela. */
@Component({
  selector: 'ui-teste-pai',
  standalone: true,
  imports: [FilhoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ui-teste-filho [busca]="busca()" (alteracao)="aoAlterar()" />`,
})
class PaiComponent {
  readonly busca = signal<Busca>({ carregando: false, erro: true });
  /** Uma leitura que falha na hora não chega a mudar o estado do pai. */
  falhaNaHora = false;

  protected aoAlterar(): void {
    if (!this.falhaNaHora) this.busca.set({ carregando: true, erro: false });
  }
}

const macrotarefa = (): Promise<void> => new Promise((resolver) => setTimeout(resolver));

describe('nova tentativa na ordem real de temporizador e atualização da tela', () => {
  const anunciar = vi.fn();
  let fixture: ComponentFixture<PaiComponent>;
  let pai: PaiComponent;
  let raiz: HTMLElement;
  const botao = (): HTMLButtonElement | null => raiz.querySelector('button');
  const situacao = (): string =>
    raiz.querySelector('ui-situacao-da-nova-tentativa')?.textContent ?? '';
  const filho = (): FilhoComponent =>
    fixture.debugElement.query((no) => no.componentInstance instanceof FilhoComponent)
      .componentInstance;

  beforeEach(async () => {
    anunciar.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideZoneChangeDetection({ eventCoalescing: true }),
        { provide: AnuncioDaConclusao, useValue: { anunciar } },
      ],
    });
    fixture = TestBed.createComponent(PaiComponent);
    pai = fixture.componentInstance;
    raiz = fixture.nativeElement;
    document.body.append(raiz);
    fixture.autoDetectChanges();
    await fixture.whenStable();
  });

  afterEach(() => raiz.remove());

  it('o temporizador do disparo não conclui antes da atualização que traz o estado do pai', async () => {
    botao()?.focus();
    botao()?.click();
    await macrotarefa();
    await fixture.whenStable();

    expect(pai.busca().carregando).toBe(true);
    expect(situacao()).toBe('Tentando novamente…');
    expect(document.activeElement).toBe(botao());
  });

  it('a busca que dá certo depois leva o foco ao destino, sem anúncio', async () => {
    botao()?.focus();
    botao()?.click();
    await macrotarefa();
    await fixture.whenStable();

    pai.busca.set({ carregando: false, erro: false });
    await fixture.whenStable();
    await macrotarefa();

    expect(botao()).toBeNull();
    expect(document.activeElement).toBe(raiz.querySelector('#titulo-do-filho'));
    expect(anunciar).not.toHaveBeenCalled();
  });

  it('a busca que dá certo com o foco fora do botão é anunciada', async () => {
    botao()?.click();
    await macrotarefa();
    await fixture.whenStable();

    pai.busca.set({ carregando: false, erro: false });
    await fixture.whenStable();

    expect(anunciar).toHaveBeenCalledWith('Dados carregados.');
  });

  it('a busca que falha de novo passa de "tentando" a "repetida"', async () => {
    botao()?.click();
    await macrotarefa();
    await fixture.whenStable();
    expect(situacao()).toBe('Tentando novamente…');

    pai.busca.set({ carregando: false, erro: true });
    await fixture.whenStable();

    expect(situacao()).toBe('A nova tentativa também falhou.');
  });

  it('na falha que não chega a mudar o estado, "tentando" passa por uma atualização antes de "repetida"', async () => {
    pai.falhaNaHora = true;
    const vistos: string[] = [];
    const observador = new MutationObserver(() => vistos.push(situacao()));
    observador.observe(raiz, { childList: true, characterData: true, subtree: true });

    botao()?.click();
    await macrotarefa();
    await fixture.whenStable();
    await macrotarefa();
    await fixture.whenStable();
    observador.disconnect();

    expect(vistos).toContain('Tentando novamente…');
    expect(vistos.at(-1)).toBe('A nova tentativa também falhou.');
    expect(vistos.indexOf('Tentando novamente…')).toBeLessThan(
      vistos.lastIndexOf('A nova tentativa também falhou.'),
    );
  });

  it('o desfecho chega mesmo que o pedido não mude nada além da fase e venha de fora da zona', async () => {
    pai.falhaNaHora = true;

    TestBed.inject(NgZone).runOutsideAngular(() => filho().tentativa.executar(() => undefined));
    await macrotarefa();
    await fixture.whenStable();
    await macrotarefa();
    await fixture.whenStable();

    expect(filho().tentativa.fase()).toBe('repetida');
  });
});
