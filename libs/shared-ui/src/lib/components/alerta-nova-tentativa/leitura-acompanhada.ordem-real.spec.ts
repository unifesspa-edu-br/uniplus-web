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
import { FalhaDeLeituraComponent } from './falha-de-leitura';
import { acompanharLeitura } from './leitura-acompanhada';

interface Busca {
  readonly carregando: boolean;
  readonly erro: boolean;
  /** Terminou numa recusa que a tela mostra por conta própria. */
  readonly recusada?: boolean;
}

const MENSAGEM = 'O servidor recusou a busca.';

/** `pendente` e a falha derivam de um `input()` que o pai alimenta, como `dia-nao-util-campos`. */
@Component({
  selector: 'ui-teste-filho',
  standalone: true,
  imports: [FalhaDeLeituraComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 id="titulo-do-filho" tabindex="-1">Busca</h2>
    <ui-falha-de-leitura titulo="Não foi possível buscar" [leitura]="leitura" />
  `,
})
class FilhoComponent {
  readonly busca = input.required<Busca>();
  readonly alteracao = output();
  readonly leitura = acompanharLeitura({
    falha: computed(() => (this.busca().erro ? MENSAGEM : null)),
    pendente: computed(() => this.busca().carregando),
    recarregar: () => this.alteracao.emit(),
    destino: () => document.getElementById('titulo-do-filho'),
    recusada: computed(() => this.busca().recusada === true),
  });
}

/** O pai real grava o estado na hora; o filho só o recebe na atualização da tela. */
@Component({
  selector: 'ui-teste-pai',
  standalone: true,
  imports: [FilhoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ui-teste-filho [busca]="busca()" (alteracao)="aoAlterar()" />`,
})
class PaiComponent {
  readonly busca = signal<Busca>({ carregando: false, erro: true });
  /** `true`: a fonte apaga a falha ao recomeçar; `false`: a mantém até o desfecho. */
  apagaAoRecomecar = false;
  /** Uma leitura que falha na hora não chega a mudar o estado do pai. */
  falhaNaHora = false;

  protected aoAlterar(): void {
    if (this.falhaNaHora) return;
    this.busca.set({ carregando: true, erro: !this.apagaAoRecomecar });
  }
}

const macrotarefa = (): Promise<void> => new Promise((resolver) => setTimeout(resolver));

describe.each([
  { fonte: 'que mantém a falha ao recomeçar', apaga: false },
  { fonte: 'que apaga a falha ao recomeçar', apaga: true },
])('leitura acompanhada na ordem real de temporizador e atualização, fonte $fonte', ({ apaga }) => {
  const anunciar = vi.fn();
  let fixture: ComponentFixture<PaiComponent>;
  let pai: PaiComponent;
  let raiz: HTMLElement;
  const botao = (): HTMLButtonElement | null => raiz.querySelector('button');
  const situacao = (): string =>
    raiz.querySelector('ui-situacao-da-nova-tentativa')?.textContent ?? '';
  const mensagem = (): string => raiz.querySelector('.alert__msg')?.textContent?.trim() ?? '';
  const filho = (): FilhoComponent =>
    fixture.debugElement.query((no) => no.componentInstance instanceof FilhoComponent)
      .componentInstance;
  const estabilizar = async (): Promise<void> => {
    await macrotarefa();
    await fixture.whenStable();
  };

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
    pai.apagaAoRecomecar = apaga;
    raiz = fixture.nativeElement;
    document.body.append(raiz);
    fixture.autoDetectChanges();
    await fixture.whenStable();
  });

  afterEach(() => raiz.remove());

  it('o temporizador do disparo não conclui antes da atualização que traz o estado do pai', async () => {
    botao()?.focus();
    botao()?.click();
    await estabilizar();

    expect(pai.busca().carregando).toBe(true);
    expect(situacao()).toBe('Tentando novamente…');
    expect(mensagem()).toBe(MENSAGEM);
    expect(document.activeElement).toBe(botao());
  });

  it('a busca que dá certo depois leva o foco ao destino, sem anúncio', async () => {
    botao()?.focus();
    botao()?.click();
    await estabilizar();

    pai.busca.set({ carregando: false, erro: false });
    await fixture.whenStable();
    await macrotarefa();

    expect(botao()).toBeNull();
    expect(document.activeElement).toBe(raiz.querySelector('#titulo-do-filho'));
    expect(anunciar).not.toHaveBeenCalled();
  });

  it('a busca que dá certo com o foco fora do botão é anunciada', async () => {
    botao()?.click();
    await estabilizar();

    pai.busca.set({ carregando: false, erro: false });
    await fixture.whenStable();

    expect(botao()).toBeNull();
    expect(anunciar).toHaveBeenCalledWith('Dados carregados.');
  });

  it('a tentativa que termina em recusa, com o foco fora do botão, não anuncia a conclusão', async () => {
    botao()?.click();
    await estabilizar();

    pai.busca.set({ carregando: false, erro: false, recusada: true });
    await fixture.whenStable();
    await macrotarefa();

    expect(botao()).toBeNull();
    expect(anunciar).not.toHaveBeenCalled();
  });

  it('a tentativa que termina em recusa, com o foco no botão, leva o foco ao destino', async () => {
    botao()?.focus();
    botao()?.click();
    await estabilizar();

    pai.busca.set({ carregando: false, erro: false, recusada: true });
    await fixture.whenStable();
    await macrotarefa();

    expect(document.activeElement).toBe(raiz.querySelector('#titulo-do-filho'));
    expect(anunciar).not.toHaveBeenCalled();
  });

  it('a busca que falha de novo passa de "tentando" a "repetida" e mantém o alerta', async () => {
    botao()?.click();
    await estabilizar();
    expect(situacao()).toBe('Tentando novamente…');

    pai.busca.set({ carregando: false, erro: true });
    await fixture.whenStable();

    expect(situacao()).toBe('A nova tentativa também falhou.');
    expect(mensagem()).toBe(MENSAGEM);
    expect(anunciar).not.toHaveBeenCalled();
  });

  it('falha, tentativa, nova falha, nova tentativa e sucesso: foco no destino e nenhum anúncio', async () => {
    botao()?.focus();
    botao()?.click();
    await estabilizar();
    pai.busca.set({ carregando: false, erro: true });
    await fixture.whenStable();
    expect(situacao()).toBe('A nova tentativa também falhou.');
    expect(document.activeElement).toBe(botao());

    botao()?.click();
    await estabilizar();
    expect(situacao()).toBe('Tentando novamente…');
    pai.busca.set({ carregando: false, erro: false });
    await fixture.whenStable();
    await macrotarefa();

    expect(raiz.querySelector('ui-alerta-nova-tentativa')).toBeNull();
    expect(document.activeElement).toBe(raiz.querySelector('#titulo-do-filho'));
    expect(anunciar).not.toHaveBeenCalled();
  });

  it('na falha que não chega a mudar o estado, "tentando" passa por uma atualização antes de "repetida"', async () => {
    pai.falhaNaHora = true;
    const vistos: string[] = [];
    const observador = new MutationObserver(() => vistos.push(situacao()));
    observador.observe(raiz, { childList: true, characterData: true, subtree: true });

    botao()?.click();
    await estabilizar();
    await estabilizar();
    observador.disconnect();

    expect(vistos).toContain('Tentando novamente…');
    expect(vistos.at(-1)).toBe('A nova tentativa também falhou.');
    expect(vistos.indexOf('Tentando novamente…')).toBeLessThan(
      vistos.lastIndexOf('A nova tentativa também falhou.'),
    );
  });

  it('o desfecho chega mesmo que o pedido não mude nada além da fase e venha de fora da zona', async () => {
    pai.falhaNaHora = true;

    TestBed.inject(NgZone).runOutsideAngular(() => filho().leitura.tentar());
    await estabilizar();
    await estabilizar();

    expect(filho().leitura.fase()).toBe('repetida');
    expect(situacao()).toBe('A nova tentativa também falhou.');
  });
});
