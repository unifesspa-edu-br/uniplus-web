import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ComboboxComponent, type UiComboboxGroup } from './combobox';

const GRUPOS: readonly UiComboboxGroup[] = [
  {
    label: 'Comprovação de renda',
    options: [
      { value: 'contracheque', label: 'Contracheque' },
      { value: 'irpf', label: 'Declaração de IRPF' },
    ],
  },
  {
    label: 'Identificação',
    options: [
      { value: 'rg', label: 'RG' },
      { value: 'cpf', label: 'CPF' },
    ],
  },
];

@Component({
  standalone: true,
  imports: [ComboboxComponent],
  template: `
    <ui-combobox
      rotulo="Documentos"
      [grupos]="grupos()"
      [value]="escolhido()"
      (valueChange)="escolhido.set($event)"
    />
  `,
})
class HospedeiroDeTeste {
  readonly grupos = signal(GRUPOS);
  readonly escolhido = signal('');
}

describe('ComboboxComponent', () => {
  let fixture: ComponentFixture<HospedeiroDeTeste>;
  let nativo: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HospedeiroDeTeste] }).compileComponents();
    fixture = TestBed.createComponent(HospedeiroDeTeste);
    fixture.detectChanges();
    nativo = fixture.nativeElement as HTMLElement;
  });

  function campo(): HTMLInputElement {
    return nativo.querySelector('input[role="combobox"]') as HTMLInputElement;
  }

  function digitar(termo: string): void {
    campo().value = termo;
    campo().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function teclar(key: string): void {
    campo().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    fixture.detectChanges();
  }

  function opcoes(): HTMLElement[] {
    return [...nativo.querySelectorAll<HTMLElement>('[role="option"]')];
  }

  it('chega fechado, e o campo anuncia que abre uma lista', () => {
    expect(campo().getAttribute('role')).toBe('combobox');
    expect(campo().getAttribute('aria-expanded')).toBe('false');
    expect(opcoes()).toHaveLength(0);
  });

  it('abre ao receber o foco, com a lista inteira agrupada', () => {
    campo().dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    expect(campo().getAttribute('aria-expanded')).toBe('true');
    expect(opcoes()).toHaveLength(4);
    expect(nativo.querySelectorAll('.combobox__grupo')).toHaveLength(2);
  });

  /** Buscar e escolher no mesmo campo é o ponto do componente. */
  it('filtra pelo que se digita, sem depender de acento nem de caixa', () => {
    digitar('DECLARAÇAO');

    expect(opcoes().map((o) => o.textContent?.trim())).toEqual(['Declaração de IRPF']);
  });

  it('a busca alcança também o nome do grupo', () => {
    digitar('renda');

    expect(opcoes()).toHaveLength(2, 'o grupo inteiro entra quando o termo casa com ele');
    expect(nativo.textContent).toContain('Contracheque');
  });

  it('anuncia quantas opções o termo alcança', () => {
    digitar('rg');

    const contagem = nativo.querySelector('[role="status"]');
    expect(contagem?.textContent).toContain('1 opção casa com “rg”');
  });

  it('diz quando não alcança nada, sem deixar a lista muda', () => {
    digitar('inexistente');

    expect(opcoes()).toHaveLength(0);
    expect(nativo.textContent).toContain('Nada encontrado para “inexistente”');
    expect(nativo.querySelector('.combobox__vazio')).not.toBeNull();
  });

  /**
   * O foco fica no campo — é o que deixa continuar digitando enquanto se navega —, então
   * quem diz ao leitor de tela onde o cursor está é `aria-activedescendant`.
   */
  it('a seta para baixo aponta a opção sem tirar o foco do campo', () => {
    campo().dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    teclar('ArrowDown');

    const apontada = campo().getAttribute('aria-activedescendant');
    expect(apontada).not.toBeNull();
    expect(nativo.querySelector(`#${apontada}`)?.textContent?.trim()).toBe('Contracheque');
    expect(document.activeElement).not.toBe(nativo.querySelector('[role="option"]'));
  });

  it('a seta atravessa os grupos e volta ao começo', () => {
    campo().dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    for (let passo = 0; passo < 4; passo += 1) teclar('ArrowDown');
    expect(rotuloApontado()).toBe('CPF', 'a quarta descida chega à última opção do segundo grupo');

    teclar('ArrowDown');
    expect(rotuloApontado()).toBe('Contracheque', 'depois da última, volta à primeira');
  });

  it('Home e End vão aos extremos da lista', () => {
    campo().dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    teclar('End');
    expect(rotuloApontado()).toBe('CPF');

    teclar('Home');
    expect(rotuloApontado()).toBe('Contracheque');
  });

  /** Digitar sugere, não escolhe: a primeira seta chega à primeira opção da lista. */
  it('a primeira seta depois de digitar aponta a primeira opção', () => {
    digitar('quilombola');
    expect(campo().getAttribute('aria-activedescendant')).toBeNull();

    digitar('declaração');
    teclar('ArrowDown');

    expect(rotuloApontado()).toBe('Declaração de IRPF');
  });

  it('Enter escolhe a opção apontada e fecha a lista', () => {
    digitar('irpf');
    teclar('ArrowDown');
    teclar('Enter');

    expect(fixture.componentInstance.escolhido()).toBe('irpf');
    expect(campo().getAttribute('aria-expanded')).toBe('false');
    expect(campo().value).toBe('Declaração de IRPF', 'o campo passa a mostrar o que foi escolhido');
  });

  it('Escape fecha sem escolher e devolve o campo ao que mostrava', () => {
    fixture.componentInstance.escolhido.set('rg');
    fixture.detectChanges();
    digitar('cpf');

    teclar('Escape');

    expect(fixture.componentInstance.escolhido()).toBe('rg', 'a escolha anterior permanece');
    expect(campo().value).toBe('RG');
    expect(campo().getAttribute('aria-expanded')).toBe('false');
  });

  it('marca a opção escolhida na lista', () => {
    fixture.componentInstance.escolhido.set('cpf');
    fixture.detectChanges();
    campo().dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    const marcada = opcoes().filter((o) => o.getAttribute('aria-selected') === 'true');
    expect(marcada.map((o) => o.textContent?.trim())).toEqual(['CPF']);
  });

  it('desabilitado não abre', () => {
    campo().dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    expect(campo().getAttribute('aria-expanded')).toBe('true');

    teclar('Escape');
    expect(campo().getAttribute('aria-expanded')).toBe('false');
  });

  describe('múltipla escolha', () => {
    @Component({
      standalone: true,
      imports: [ComboboxComponent],
      template: `
        <ui-combobox
          rotulo="Modalidades"
          multiplo
          [grupos]="grupos()"
          [values]="escolhidas()"
          (valuesChange)="escolhidas.set($event)"
        />
      `,
    })
    class HospedeiroMultiplo {
      readonly grupos = signal(GRUPOS);
      readonly escolhidas = signal<readonly string[]>([]);
    }

    let multi: ComponentFixture<HospedeiroMultiplo>;
    let nativoMulti: HTMLElement;

    beforeEach(async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({ imports: [HospedeiroMultiplo] }).compileComponents();
      multi = TestBed.createComponent(HospedeiroMultiplo);
      multi.detectChanges();
      nativoMulti = multi.nativeElement as HTMLElement;
    });

    function campoMulti(): HTMLInputElement {
      return nativoMulti.querySelector('input[role="combobox"]') as HTMLInputElement;
    }

    function marcar(rotulo: string): void {
      const alvo = [...nativoMulti.querySelectorAll<HTMLElement>('[role="option"]')].find(
        (o) => o.textContent?.trim() === rotulo,
      );
      alvo?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      multi.detectChanges();
    }

    function abrir(): void {
      campoMulti().dispatchEvent(new Event('focus'));
      multi.detectChanges();
    }

    it('anuncia que a lista aceita mais de uma escolha', () => {
      abrir();
      expect(nativoMulti.querySelector('[role="listbox"]')?.getAttribute('aria-multiselectable')).toBe(
        'true',
      );
    });

    /** Marcar três não pode custar reabrir a lista três vezes. */
    it('a lista continua aberta a cada escolha', () => {
      abrir();

      marcar('Contracheque');
      expect(campoMulti().getAttribute('aria-expanded')).toBe('true');

      marcar('RG');
      expect(multi.componentInstance.escolhidas()).toEqual(['contracheque', 'rg']);
    });

    it('clicar de novo desmarca', () => {
      abrir();
      marcar('CPF');
      expect(multi.componentInstance.escolhidas()).toEqual(['cpf']);

      marcar('CPF');
      expect(multi.componentInstance.escolhidas()).toEqual([]);
    });

    it('o campo fechado resume o que está marcado', () => {
      multi.componentInstance.escolhidas.set(['rg', 'contracheque']);
      multi.detectChanges();

      expect(campoMulti().value).toBe(
        'Contracheque, RG',
        'na ordem da lista, não na ordem em que foram marcadas',
      );
    });

    it('marca na lista tudo o que está escolhido', () => {
      multi.componentInstance.escolhidas.set(['cpf', 'irpf']);
      multi.detectChanges();
      abrir();

      const marcadas = [...nativoMulti.querySelectorAll<HTMLElement>('[role="option"]')]
        .filter((o) => o.getAttribute('aria-selected') === 'true')
        .map((o) => o.textContent?.trim());
      expect(marcadas).toEqual(['Declaração de IRPF', 'CPF']);
    });
  });

  function rotuloApontado(): string {
    const id = campo().getAttribute('aria-activedescendant');
    return nativo.querySelector(`#${id}`)?.textContent?.trim() ?? '';
  }
});
