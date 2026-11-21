import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SelectComponent, type UiSelectOption } from './select';

enum SituacaoDaVagaCodigo {
  aberta = 'aberta',
  preenchida = 'preenchida',
  cancelada = 'cancelada',
}

const OPCOES: readonly UiSelectOption<SituacaoDaVagaCodigo>[] = [
  {
    value: SituacaoDaVagaCodigo.aberta,
    label: 'Aberta',
    description: 'A vaga aceita novas convocações.',
  },
  {
    value: SituacaoDaVagaCodigo.preenchida,
    label: 'Preenchida',
    description: 'Todas as convocações foram matriculadas.',
  },
  { value: SituacaoDaVagaCodigo.cancelada, label: 'Cancelada' },
];

@Component({
  standalone: true,
  imports: [SelectComponent, ReactiveFormsModule],
  template: `
    <ui-select
      fieldLabel="Situação da vaga"
      [choices]="opcoes"
      [isRequired]="true"
      [formControl]="controle"
    />
  `,
})
class SelectObrigatorioHost {
  readonly opcoes = OPCOES;
  readonly controle = new FormControl('', { nonNullable: true, validators: [Validators.required] });
}

interface Entradas {
  readonly choices?: readonly UiSelectOption<SituacaoDaVagaCodigo>[];
  readonly placeholderText?: string;
  readonly hint?: string;
  readonly errorMessage?: string;
  readonly idDoCampo?: string | null;
  readonly descritoPor?: string | null;
  readonly carregandoOpcoes?: boolean;
}

describe('SelectComponent', () => {
  let fixture: ComponentFixture<SelectComponent<SituacaoDaVagaCodigo>>;

  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const campo = (): HTMLSelectElement => {
    const encontrado = raiz().querySelector('select');
    if (encontrado === null) throw new Error('campo ausente');
    return encontrado;
  };
  const apoios = (): HTMLElement[] => [...raiz().querySelectorAll<HTMLElement>('p.field__hint')];
  const textosReferidos = (): string[] =>
    (campo().getAttribute('aria-describedby') ?? '')
      .split(' ')
      .filter((id) => id !== '')
      .map((id) => document.getElementById(id)?.textContent?.trim() ?? `sem elemento: ${id}`);

  function mostrar(entradas: Entradas = {}): void {
    fixture.componentRef.setInput('fieldLabel', 'Situação da vaga');
    fixture.componentRef.setInput('choices', entradas.choices ?? OPCOES);
    fixture.componentRef.setInput('placeholderText', entradas.placeholderText ?? '');
    fixture.componentRef.setInput('hint', entradas.hint ?? '');
    fixture.componentRef.setInput('errorMessage', entradas.errorMessage ?? '');
    fixture.componentRef.setInput('idDoCampo', entradas.idDoCampo ?? null);
    fixture.componentRef.setInput('descritoPor', entradas.descritoPor ?? null);
    fixture.componentRef.setInput('carregandoOpcoes', entradas.carregandoOpcoes ?? false);
    fixture.detectChanges();
  }

  function escolher(valor: string): void {
    campo().value = valor;
    campo().dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
    fixture = TestBed.createComponent(SelectComponent<SituacaoDaVagaCodigo>);
  });

  describe('descrição da opção escolhida', () => {
    it('aparece como texto de apoio e muda quando a escolha muda', () => {
      mostrar();
      fixture.componentInstance.writeValue(SituacaoDaVagaCodigo.aberta);
      fixture.detectChanges();
      expect(apoios().map((apoio) => apoio.textContent?.trim())).toEqual([OPCOES[0]?.description]);

      escolher(SituacaoDaVagaCodigo.preenchida);

      expect(apoios().map((apoio) => apoio.textContent?.trim())).toEqual([OPCOES[1]?.description]);
    });

    it('some quando a escolha passa para uma opção sem descrição', () => {
      mostrar();
      fixture.componentInstance.writeValue(SituacaoDaVagaCodigo.aberta);
      fixture.detectChanges();

      escolher(SituacaoDaVagaCodigo.cancelada);

      expect(apoios()).toEqual([]);
    });

    it('não há parágrafo de apoio sem opção escolhida', () => {
      mostrar({ placeholderText: 'Todas' });

      expect(apoios()).toEqual([]);
    });

    it('o valor que não é de nenhuma opção não mostra apoio', () => {
      mostrar();
      fixture.componentInstance.writeValue('arquivada');
      fixture.detectChanges();

      expect(apoios()).toEqual([]);
    });

    it('a descrição é texto de apoio: não se anuncia como aviso', () => {
      mostrar();
      fixture.componentInstance.writeValue(SituacaoDaVagaCodigo.aberta);
      fixture.detectChanges();

      expect(apoios()[0]?.hasAttribute('aria-live')).toBe(false);
    });
  });

  describe('aria-describedby', () => {
    beforeEach(() => {
      fixture.componentInstance.writeValue(SituacaoDaVagaCodigo.aberta);
    });

    it('não existe sem dica, sem descrição e sem erro', () => {
      mostrar({ choices: [] });

      expect(campo().hasAttribute('aria-describedby')).toBe(false);
    });

    it.each([
      { nome: 'só a dica', entradas: { choices: [], hint: 'Dica' }, esperado: ['Dica'] },
      { nome: 'só a descrição', entradas: {}, esperado: [OPCOES[0]?.description] },
      { nome: 'só o erro', entradas: { choices: [], errorMessage: 'Erro' }, esperado: ['Erro'] },
      {
        nome: 'dica e descrição, nessa ordem',
        entradas: { hint: 'Dica' },
        esperado: ['Dica', OPCOES[0]?.description],
      },
      {
        nome: 'descrição e erro, nessa ordem',
        entradas: { errorMessage: 'Erro' },
        esperado: [OPCOES[0]?.description, 'Erro'],
      },
      {
        nome: 'dica, descrição e erro, nessa ordem',
        entradas: { hint: 'Dica', errorMessage: 'Erro' },
        esperado: ['Dica', OPCOES[0]?.description, 'Erro'],
      },
    ])('aponta para $nome', ({ entradas, esperado }) => {
      mostrar(entradas);

      expect(textosReferidos()).toEqual(esperado);
    });
  });

  describe('seleção', () => {
    it('continua marcada quando as opções chegam depois do valor', () => {
      mostrar({ choices: [] });
      fixture.componentInstance.writeValue(SituacaoDaVagaCodigo.preenchida);
      fixture.detectChanges();

      fixture.componentRef.setInput('choices', OPCOES);
      fixture.detectChanges();

      expect(campo().selectedOptions[0]?.value).toBe(SituacaoDaVagaCodigo.preenchida);
      expect(apoios().map((apoio) => apoio.textContent?.trim())).toEqual([OPCOES[1]?.description]);
    });

    it('com a opção inicial, ela vem primeiro e vale vazio', () => {
      mostrar({ placeholderText: 'Todas' });

      expect(campo().options[0]?.textContent?.trim()).toBe('Todas');
      expect(campo().options[0]?.value).toBe('');
      expect(campo().options.length).toBe(OPCOES.length + 1);
    });

    it('valor nulo escrito pelo formulário deixa o campo vazio', () => {
      mostrar({ placeholderText: 'Todas' });
      fixture.componentInstance.writeValue(null);
      fixture.detectChanges();

      expect(campo().value).toBe('');
    });
  });

  describe('valor que não corresponde a nenhuma opção', () => {
    const opcaoVazia = (): HTMLOptionElement | null =>
      campo().querySelector<HTMLOptionElement>('option[value=""][hidden]');

    it('sem opção inicial e sem valor, a escolhida é a opção vazia e oculta, sem apoio', () => {
      mostrar();

      const [vazia, ...demais] = [...campo().options];
      expect(campo().selectedIndex).toBe(0);
      expect(campo().value).toBe('');
      expect([vazia?.disabled, vazia?.hidden, vazia?.textContent?.trim()]).toEqual([
        true,
        true,
        '',
      ]);
      expect(demais.some((opcao) => opcao.selected)).toBe(false);
      expect(apoios()).toEqual([]);
    });

    it('sem opção inicial, o valor escrito antes das opções fica escolhido quando elas chegam', () => {
      mostrar({ choices: [] });
      fixture.componentInstance.writeValue(SituacaoDaVagaCodigo.preenchida);
      fixture.detectChanges();
      expect(opcaoVazia()).not.toBeNull();

      fixture.componentRef.setInput('choices', OPCOES);
      fixture.detectChanges();

      expect(campo().selectedOptions[0]?.value).toBe(SituacaoDaVagaCodigo.preenchida);
      expect(opcaoVazia()).toBeNull();
      expect(apoios().map((apoio) => apoio.textContent?.trim())).toEqual([OPCOES[1]?.description]);
    });

    it('sem opção inicial, escolher uma opção entrega o valor ao controle e tira a opção vazia', () => {
      const aoMudar = vi.fn();
      fixture.componentInstance.registerOnChange(aoMudar);
      mostrar();
      expect(opcaoVazia()).not.toBeNull();

      escolher(SituacaoDaVagaCodigo.aberta);

      expect(aoMudar).toHaveBeenCalledWith(SituacaoDaVagaCodigo.aberta);
      expect(opcaoVazia()).toBeNull();
      expect(campo().selectedOptions[0]?.value).toBe(SituacaoDaVagaCodigo.aberta);
    });

    it('valores sucessivos fora das opções deixam o campo sem opção visível marcada nem apoio', () => {
      mostrar();

      for (const valor of ['arquivada', 'em_revisao']) {
        fixture.componentInstance.writeValue(valor);
        fixture.detectChanges();

        const visiveis = [...campo().options].filter((opcao) => !opcao.hidden);
        expect(visiveis.some((opcao) => opcao.selected)).toBe(false);
        expect(campo().value).not.toBe(SituacaoDaVagaCodigo.aberta);
        expect(opcaoVazia()).not.toBeNull();
        expect(apoios()).toEqual([]);
      }
    });

    it('com opção inicial e valor vazio, ela é a escolhida e não há opção vazia', () => {
      mostrar({ placeholderText: 'Todas' });

      expect(campo().selectedOptions[0]?.textContent?.trim()).toBe('Todas');
      expect(opcaoVazia()).toBeNull();
      expect(campo().options.length).toBe(OPCOES.length + 1);
    });

    it('com opção inicial e valor fora das opções, a escolhida é a opção vazia, não ela', () => {
      mostrar({ placeholderText: 'Todas' });

      fixture.componentInstance.writeValue('arquivada');
      fixture.detectChanges();

      expect(campo().selectedIndex).toBe(0);
      expect(opcaoVazia()).not.toBeNull();
      expect(campo().options[1]?.textContent?.trim()).toBe('Todas');
      expect(campo().options[1]?.selected).toBe(false);
    });
  });

  describe('uso dentro de uma tela', () => {
    it('usa o id informado no campo e no rótulo, e deriva dele os ids de apoio', () => {
      mostrar({ idDoCampo: 'cfg-tipo', hint: 'Dica' });

      expect(campo().id).toBe('cfg-tipo');
      expect(raiz().querySelector('label')?.getAttribute('for')).toBe('cfg-tipo');
      expect(apoios()[0]?.id).toBe('cfg-tipo-hint');
    });

    it('sem id informado, gera um id próprio', () => {
      mostrar();

      expect(campo().id).toMatch(/^ui-select-\d+$/);
    });

    it('o aviso externo é descrito antes de dica, descrição e erro', () => {
      document.body.insertAdjacentHTML('beforeend', '<p id="aviso-externo">Aviso</p>');
      fixture.componentInstance.writeValue(SituacaoDaVagaCodigo.aberta);
      mostrar({ descritoPor: 'aviso-externo', hint: 'Dica', errorMessage: 'Erro' });

      expect(textosReferidos()).toEqual(['Aviso', 'Dica', OPCOES[0]?.description, 'Erro']);
      document.getElementById('aviso-externo')?.remove();
    });

    it('enquanto as opções carregam, o campo fica ocupado e continua habilitado', () => {
      mostrar({ carregandoOpcoes: true });
      expect(campo().getAttribute('aria-busy')).toBe('true');
      expect(campo().disabled).toBe(false);

      mostrar({ carregandoOpcoes: false });
      expect(campo().hasAttribute('aria-busy')).toBe(false);
    });

    it('avisa a escolha da pessoa, mas não o valor escrito pelo formulário', () => {
      const aoEscolher = vi.fn();
      fixture.componentInstance.escolhido.subscribe(aoEscolher);
      mostrar();

      fixture.componentInstance.writeValue(SituacaoDaVagaCodigo.cancelada);
      expect(aoEscolher).not.toHaveBeenCalled();

      escolher(SituacaoDaVagaCodigo.preenchida);
      expect(aoEscolher).toHaveBeenCalledTimes(1);
    });
  });

  describe('integração com o formulário', () => {
    it('repassa a escolha ao formulário e avisa o toque ao sair do campo', () => {
      const aoMudar = vi.fn();
      const aoTocar = vi.fn();
      fixture.componentInstance.registerOnChange(aoMudar);
      fixture.componentInstance.registerOnTouched(aoTocar);
      mostrar();

      escolher(SituacaoDaVagaCodigo.preenchida);
      campo().dispatchEvent(new Event('blur'));

      expect(aoMudar).toHaveBeenCalledWith(SituacaoDaVagaCodigo.preenchida);
      expect(aoTocar).toHaveBeenCalledTimes(1);
    });

    it('fica indisponível quando o formulário o desabilita', () => {
      mostrar();

      fixture.componentInstance.setDisabledState(true);
      fixture.detectChanges();

      expect(campo().disabled).toBe(true);
    });
  });
});

describe('SelectComponent obrigatório e ligado a um FormControl', () => {
  it('sem valor, o controle fica inválido até haver uma escolha', () => {
    const anfitriao = TestBed.createComponent(SelectObrigatorioHost);
    anfitriao.detectChanges();
    const controle = anfitriao.componentInstance.controle;
    const select = (anfitriao.nativeElement as HTMLElement).querySelector('select');
    if (select === null) throw new Error('campo ausente');
    expect(controle.invalid).toBe(true);

    select.value = SituacaoDaVagaCodigo.aberta;
    select.dispatchEvent(new Event('change'));

    expect(controle.value).toBe(SituacaoDaVagaCodigo.aberta);
    expect(controle.valid).toBe(true);
  });
});
