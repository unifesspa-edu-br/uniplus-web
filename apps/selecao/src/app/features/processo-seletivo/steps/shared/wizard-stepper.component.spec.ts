import { TestBed } from '@angular/core/testing';
import { WizardStepperComponent } from './wizard-stepper.component';
import { ProcessoSeletivoStore } from '../processo-seletivo.store';

describe('WizardStepperComponent — semântica', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WizardStepperComponent],
      providers: [ProcessoSeletivoStore],
    }).compileComponents();
  });

  function montar() {
    const fixture = TestBed.createComponent(WizardStepperComponent);
    fixture.detectChanges();
    return { fixture, host: fixture.nativeElement as HTMLElement };
  }

  /**
   * `role="button"` no `<li>` apaga a semântica de item de lista: o leitor de
   * tela deixa de anunciar "item X de Y" dentro do `<ol>`. O alvo clicável
   * precisa ser um `<button>` dentro do item.
   */
  it('não sobrescreve o papel do item de lista', () => {
    const { host } = montar();
    const itens = [...host.querySelectorAll('li.steps__item')];

    expect(itens.length).toBeGreaterThan(0);
    expect(itens.every((item) => item.getAttribute('role') === null)).toBe(true);
    expect(itens.every((item) => item.getAttribute('tabindex') === null)).toBe(true);
  });

  it('usa botão nativo como alvo de cada passo', () => {
    const { host } = montar();
    const itens = [...host.querySelectorAll('li.steps__item')];

    expect(itens.every((item) => item.querySelector('button[type="button"]') !== null)).toBe(true);
  });

  it('marca o passo atual com aria-current', () => {
    const { fixture, host } = montar();
    const store = TestBed.inject(ProcessoSeletivoStore);

    store.goTo(2);
    fixture.detectChanges();

    const atuais = host.querySelectorAll('li[aria-current="step"]');
    expect(atuais.length).toBe(1);
    expect(atuais[0].textContent).toContain(store.labels[2]);
  });

  it('navega ao acionar o botão do passo', () => {
    const { fixture, host } = montar();
    const store = TestBed.inject(ProcessoSeletivoStore);

    const botoes = host.querySelectorAll<HTMLButtonElement>('li.steps__item button');
    botoes[3].click();
    fixture.detectChanges();

    expect(store.currentStep()).toBe(3);
  });
});
