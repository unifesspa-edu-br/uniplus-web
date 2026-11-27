import { beforeEach, describe, expect, it } from 'vitest';
import type { UiComboboxGroup } from './combobox';
import { montarCombobox, type CenarioDoCombobox } from './combobox.setup';

describe('ComboboxComponent com opção indisponível', () => {
  let cenario: CenarioDoCombobox;
  let fixture: CenarioDoCombobox['fixture'];
  let nativo: HTMLElement;
  const campo = () => cenario.campo();

  beforeEach(async () => {
    cenario = await montarCombobox();
    ({ fixture, nativo } = cenario);
  });

  const COM_INDISPONIVEL: readonly UiComboboxGroup[] = [
    {
      label: 'Identificação',
      options: [
        { value: 'rg', label: 'RG' },
        { value: 'cnh', label: 'CNH — aguarda a aprovação da proteção de dados', disabled: true },
        { value: 'cpf', label: 'CPF' },
      ],
    },
  ];

  beforeEach(() => {
    fixture.componentInstance.grupos.set(COM_INDISPONIVEL);
    fixture.detectChanges();
    campo().dispatchEvent(new Event('focus'));
    fixture.detectChanges();
  });

  function opcao(rotulo: string): HTMLElement {
    return Array.from(nativo.querySelectorAll<HTMLElement>('[role="option"]')).find((o) =>
      o.textContent?.includes(rotulo),
    ) as HTMLElement;
  }

  it('aparece com o motivo e anunciada como desabilitada', () => {
    expect(opcao('CNH').textContent).toContain('aguarda a aprovação da proteção de dados');
    expect(opcao('CNH').getAttribute('aria-disabled')).toBe('true');
    expect(opcao('RG').getAttribute('aria-disabled')).toBeNull();
  });

  it('a contagem anunciada só conta o que se pode escolher', () => {
    expect(nativo.querySelector('[role="status"]')?.textContent?.trim()).toBe(
      '2 opções disponíveis.',
    );
  });

  it('o clique nela não escolhe', () => {
    opcao('CNH').dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    fixture.detectChanges();

    expect(fixture.componentInstance.escolhido()).toBe('');
  });

  it('Enter não escolhe a opção que ficou indisponível depois de apontada', () => {
    campo().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    campo().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    fixture.componentInstance.grupos.set([
      {
        label: 'Identificação',
        options: [
          { value: 'rg', label: 'RG' },
          { value: 'cpf', label: 'CPF — aguarda', disabled: true },
        ],
      },
    ]);
    fixture.detectChanges();

    campo().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();

    expect(fixture.componentInstance.escolhido()).toBe('');
  });

  it('as setas pulam a opção indisponível', () => {
    campo().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    campo().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    campo().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();

    expect(fixture.componentInstance.escolhido()).toBe('cpf');
  });
});
