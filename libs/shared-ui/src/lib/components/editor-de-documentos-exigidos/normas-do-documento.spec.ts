import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { type BaseLegal, baseLegalNova } from '@uniplus/shared-utils';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  type DisposicaoDasNormas,
  NormasDoDocumentoComponent,
  type TextosDasNormas,
} from './normas-do-documento';

@Component({
  standalone: true,
  imports: [NormasDoDocumentoComponent],
  template: `
    <ui-normas-do-documento
      idBase="teste"
      [bases]="bases()"
      [minimo]="minimo()"
      [textos]="textos()"
      [disabled]="disabled()"
      [disposicao]="disposicao()"
      (basesChange)="bases.set($event)"
    >
      <p class="aviso-de-teste">Aviso sobre as normas</p>
    </ui-normas-do-documento>
  `,
})
class HospedeiroDeTeste {
  readonly bases = signal<readonly BaseLegal[]>([baseLegalNova()]);
  readonly minimo = signal(0);
  readonly textos = signal<Partial<TextosDasNormas>>({});
  readonly disabled = signal(false);
  readonly disposicao = signal<DisposicaoDasNormas>('agrupada');
}

describe('NormasDoDocumentoComponent', () => {
  let fixture: ComponentFixture<HospedeiroDeTeste>;
  let hospedeiro: HospedeiroDeTeste;
  let raiz: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HospedeiroDeTeste] }).compileComponents();
    fixture = TestBed.createComponent(HospedeiroDeTeste);
    hospedeiro = fixture.componentInstance;
    raiz = fixture.nativeElement as HTMLElement;
    document.body.appendChild(raiz);
    fixture.detectChanges();
  });

  const campo = <T extends HTMLElement>(id: string) => raiz.querySelector<T>(`#${id}`);
  const botoes = (texto: string) =>
    Array.from(raiz.querySelectorAll('button')).filter(
      (botao) => botao.textContent?.trim() === texto,
    );

  function digitar(id: string, valor: string): void {
    const alvo = campo<HTMLInputElement>(id) as HTMLInputElement;
    alvo.value = valor;
    alvo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('mostra cada norma com os campos endereçados por posição', () => {
    expect(campo<HTMLInputElement>('teste-base-0-ref')?.value).toBe('');
    expect(campo<HTMLSelectElement>('teste-base-0-abr')?.value).toBe('INTERNA_EDITAL');
    expect(campo<HTMLSelectElement>('teste-base-0-sts')?.value).toBe('RESOLVIDO');
    expect(campo<HTMLInputElement>('teste-base-0-obs')?.value).toBe('');
    expect(raiz.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe('Norma 1');
    expect(raiz.querySelector('legend')?.textContent?.trim()).toBe(
      'Normas que sustentam a exigência',
    );
  });

  it('devolve a lista inteira a cada tecla, com a observação apagada como null', () => {
    digitar('teste-base-0-ref', 'Lei 12.711/2012');
    digitar('teste-base-0-obs', 'cotas');
    expect(hospedeiro.bases()).toEqual([
      { ...baseLegalNova(), referencia: 'Lei 12.711/2012', observacao: 'cotas' },
    ]);

    digitar('teste-base-0-obs', '');
    expect(hospedeiro.bases()[0].observacao).toBeNull();
  });

  it('troca alcance e situação pela escolha', () => {
    const alcance = campo<HTMLSelectElement>('teste-base-0-abr') as HTMLSelectElement;
    alcance.value = 'FEDERAL';
    alcance.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    const situacao = campo<HTMLSelectElement>('teste-base-0-sts') as HTMLSelectElement;
    situacao.value = 'PENDENTE';
    situacao.dispatchEvent(new Event('change'));

    expect(hospedeiro.bases()[0]).toMatchObject({ abrangencia: 'FEDERAL', status: 'PENDENTE' });
  });

  /**
   * Duas mudanças antes de a lista voltar pelo input: a segunda parte da primeira, não da lista
   * que o hospedeiro ainda não repassou. Sem isso, trocar a situação logo depois de acrescentar
   * apagava a norma acrescentada.
   */
  it('não perde a mudança anterior quando a seguinte chega antes de a lista voltar', () => {
    botoes('Acrescentar norma')[0].click();
    const situacao = campo<HTMLSelectElement>('teste-base-0-sts') as HTMLSelectElement;
    situacao.value = 'PENDENTE';
    situacao.dispatchEvent(new Event('change'));
    digitar('teste-base-0-ref', 'Lei 12.711/2012');

    expect(hospedeiro.bases()).toEqual([
      { ...baseLegalNova(), referencia: 'Lei 12.711/2012', status: 'PENDENTE' },
      baseLegalNova(),
    ]);
  });

  it('acrescenta uma norma em branco e leva o foco à referência dela', async () => {
    botoes('Acrescentar norma')[0].click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(hospedeiro.bases()).toEqual([baseLegalNova(), baseLegalNova()]);
    expect(document.activeElement?.id).toBe('teste-base-1-ref');
  });

  it('remove a norma da posição, com nome acessível que diz qual', async () => {
    hospedeiro.bases.set([
      { ...baseLegalNova(), referencia: 'A' },
      { ...baseLegalNova(), referencia: 'B' },
    ]);
    fixture.detectChanges();

    const remover = campo<HTMLButtonElement>('teste-base-0-remover') as HTMLButtonElement;
    expect(remover.getAttribute('aria-label')).toBe('Remover a norma 1');
    remover.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(hospedeiro.bases().map((base) => base.referencia)).toEqual(['B']);
    expect(document.activeElement?.id).toBe('teste-base-0-remover');
  });

  it('não oferece remover abaixo do mínimo', () => {
    hospedeiro.minimo.set(1);
    fixture.detectChanges();
    expect(botoes('Remover norma')).toHaveLength(0);

    hospedeiro.bases.set([baseLegalNova(), baseLegalNova()]);
    fixture.detectChanges();
    expect(botoes('Remover norma')).toHaveLength(2);
  });

  it('fala os textos da tela que o usa, com o complemento só para leitor de tela', () => {
    hospedeiro.textos.set({
      referencia: 'Norma que exige o documento',
      observacao: 'Observação',
      observacaoOculta: ' sobre a norma',
      observacaoSufixo: ' (opcional)',
      acrescentar: 'Acrescentar outra norma',
    });
    fixture.detectChanges();

    const rotulo = raiz.querySelector('label[for="teste-base-0-obs"]') as HTMLLabelElement;
    expect(rotulo.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Observação sobre a norma (opcional)',
    );
    expect(rotulo.querySelector('.sr-only')?.textContent).toBe(' sobre a norma');
    expect(raiz.querySelector('label[for="teste-base-0-ref"]')?.textContent?.trim()).toBe(
      'Norma que exige o documento',
    );
    expect(botoes('Acrescentar outra norma')).toHaveLength(1);
  });

  it('desabilita campos e botões quando a edição está suspensa', () => {
    hospedeiro.bases.set([baseLegalNova(), baseLegalNova()]);
    hospedeiro.disabled.set(true);
    fixture.detectChanges();

    const controles = Array.from(raiz.querySelectorAll('input, select, button'));
    expect(controles.length).toBeGreaterThan(0);
    expect(controles.every((controle) => (controle as HTMLInputElement).disabled)).toBe(true);
  });

  it('põe o conteúdo projetado depois das normas e antes de acrescentar', () => {
    const ordem = Array.from(
      raiz.querySelectorAll('#teste-base-0-obs, .aviso-de-teste, #teste-base-nova'),
    );
    expect(ordem.map((elemento) => elemento.id || elemento.className)).toEqual([
      'teste-base-0-obs',
      'aviso-de-teste',
      'teste-base-nova',
    ]);
  });

  describe('na grade de quem hospeda', () => {
    beforeEach(() => {
      hospedeiro.disposicao.set('na-grade');
      hospedeiro.textos.set({ remover: 'Remover esta norma', removerAcessivel: '' });
      fixture.detectChanges();
    });

    it('não desenha quadro próprio: cada campo é item da grade do hospedeiro', () => {
      const elemento = raiz.querySelector('ui-normas-do-documento') as HTMLElement;
      expect(elemento.classList).toContain('normas-do-documento--na-grade');
      expect(raiz.querySelector('fieldset')).toBeNull();
      expect(raiz.querySelector('[role="group"]')).toBeNull();
      expect(
        Array.from(elemento.children)
          .filter((filho) => filho.classList.contains('form-field'))
          .map((campo) => campo.querySelector('input, select')?.id),
      ).toEqual(['teste-base-0-ref', 'teste-base-0-abr', 'teste-base-0-sts', 'teste-base-0-obs']);
      expect(raiz.querySelector('label[for="teste-base-0-ref"]')?.className).toBe(
        'label is-required',
      );
    });

    it('o remover fala pelo texto visível quando não há nome acessível próprio', () => {
      hospedeiro.bases.set([baseLegalNova(), baseLegalNova()]);
      fixture.detectChanges();

      const remover = botoes('Remover esta norma');
      expect(remover).toHaveLength(2);
      expect(remover.every((botao) => !botao.hasAttribute('aria-label'))).toBe(true);
    });

    it('mantém o conteúdo projetado entre as normas e acrescentar', () => {
      const ordem = Array.from(
        raiz.querySelectorAll('#teste-base-0-obs, .aviso-de-teste, #teste-base-nova'),
      );
      expect(ordem.map((elemento) => elemento.id || elemento.className)).toEqual([
        'teste-base-0-obs',
        'aviso-de-teste',
        'teste-base-nova',
      ]);
    });
  });
});
