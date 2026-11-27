import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ComboboxComponent } from './combobox';
import { GRUPOS, montarCombobox, type CenarioDoCombobox } from './combobox.setup';

describe('ComboboxComponent', () => {
  let cenario: CenarioDoCombobox;
  let fixture: CenarioDoCombobox['fixture'];
  let nativo: HTMLElement;
  const campo = () => cenario.campo();
  const digitar = (termo: string) => cenario.digitar(termo);
  const teclar = (key: string) => cenario.teclar(key);
  const opcoes = () => cenario.opcoes();

  beforeEach(async () => {
    cenario = await montarCombobox();
    ({ fixture, nativo } = cenario);
  });

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

    expect(opcoes(), 'o grupo inteiro entra quando o termo casa com ele').toHaveLength(2);
    expect(nativo.textContent).toContain('Contracheque');
  });

  it('anuncia quantas opções o termo alcança', () => {
    digitar('rg');

    const contagem = nativo.querySelector('[role="status"]');
    expect(contagem?.textContent).toContain('1 opção casa com “rg”');
  });

  it('a contagem fora da vista continua anunciada ao leitor de tela', () => {
    const solto = TestBed.createComponent(ComboboxComponent);
    solto.componentRef.setInput('rotulo', 'Documentos');
    solto.componentRef.setInput('grupos', GRUPOS);
    solto.componentRef.setInput('contagemVisivel', false);
    solto.detectChanges();

    const contagem = (solto.nativeElement as HTMLElement).querySelector('[role="status"]');
    expect(contagem?.classList).toContain('sr-only');
    expect(contagem?.textContent).toContain('4 opções disponíveis.');
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
    expect(rotuloApontado(), 'a quarta descida chega à última opção do segundo grupo').toBe('CPF');

    teclar('ArrowDown');
    expect(rotuloApontado(), 'depois da última, volta à primeira').toBe('Contracheque');
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
    expect(campo().value, 'o campo passa a mostrar o que foi escolhido').toBe('Declaração de IRPF');
  });

  it('Escape fecha sem escolher e devolve o campo ao que mostrava', () => {
    fixture.componentInstance.escolhido.set('rg');
    fixture.detectChanges();
    digitar('cpf');

    teclar('Escape');

    expect(fixture.componentInstance.escolhido(), 'a escolha anterior permanece').toBe('rg');
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

  it('bloqueado por um fieldset desabilitado, não escolhe pelo mouse nem pelo teclado', () => {
    const fieldset = document.createElement('fieldset');
    nativo.parentElement?.appendChild(fieldset);
    fieldset.appendChild(nativo);
    campo().dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    teclar('ArrowDown');
    expect(opcoes().length).toBeGreaterThan(0);

    fieldset.disabled = true;
    opcoes()[1].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    teclar('Enter');
    fixture.detectChanges();

    expect(fixture.componentInstance.escolhido()).toBe('');
    expect(campo().getAttribute('aria-expanded')).toBe('false');
  });

  it('Enter sem opção apontada fecha a lista e devolve o texto do valor escolhido', () => {
    fixture.componentInstance.escolhido.set('rg');
    fixture.detectChanges();
    campo().dispatchEvent(new Event('focus'));
    digitar('CP');

    const evento = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    campo().dispatchEvent(evento);
    fixture.detectChanges();

    expect(campo().getAttribute('aria-expanded')).toBe('false');
    expect(campo().value).toBe('RG');
    expect(evento.defaultPrevented).toBe(false);
  });

  it('Enter durante a composição de IME mantém a lista aberta e a busca', () => {
    fixture.componentInstance.escolhido.set('rg');
    fixture.detectChanges();
    digitar('CP');

    const evento = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
      isComposing: true,
    });
    campo().dispatchEvent(evento);
    fixture.detectChanges();

    expect(campo().getAttribute('aria-expanded')).toBe('true');
    expect(campo().value).toBe('CP');
    expect(evento.defaultPrevented).toBe(false);
  });

  it('Enter com keyCode 229 mantém a lista aberta e a busca mesmo sem isComposing', () => {
    fixture.componentInstance.escolhido.set('rg');
    fixture.detectChanges();
    digitar('CP');

    const evento = new KeyboardEvent('keydown', {
      key: 'Enter',
      keyCode: 229,
      isComposing: false,
      bubbles: true,
      cancelable: true,
    });
    campo().dispatchEvent(evento);
    fixture.detectChanges();

    expect(campo().getAttribute('aria-expanded')).toBe('true');
    expect(campo().value).toBe('CP');
    expect(evento.defaultPrevented).toBe(false);
  });

  it('a lista aberta fecha quando um fieldset desabilita o campo', () => {
    const fieldset = document.createElement('fieldset');
    nativo.parentElement?.appendChild(fieldset);
    fieldset.appendChild(nativo);
    campo().dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    expect(campo().getAttribute('aria-expanded')).toBe('true');

    fieldset.disabled = true;
    fixture.componentRef.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    fixture.detectChanges();

    expect(campo().getAttribute('aria-expanded')).toBe('false');
    expect(nativo.querySelector('[role="listbox"]')).toBeNull();
  });

  it('desabilitado não abre', () => {
    campo().dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    expect(campo().getAttribute('aria-expanded')).toBe('true');

    teclar('Escape');
    expect(campo().getAttribute('aria-expanded')).toBe('false');
  });

  /**
   * Quem já escolheu e reabre a lista costuma querer trocar a escolha, e digita por cima. Se o
   * campo abrisse com o rótulo anterior, a consulta seria inserida nele — o filtro passaria a
   * procurar por "RGcpf" e não acharia nada até o rótulo velho ser apagado à mão.
   */
  it('abre com o campo vazio quando já há escolha, e devolve o rótulo ao fechar', () => {
    fixture.componentInstance.escolhido.set('rg');
    fixture.detectChanges();
    expect(campo().value).toBe('RG');

    campo().dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    expect(campo().value).toBe('');

    teclar('Escape');
    expect(campo().value, 'fechada, a lista devolve ao campo o que está escolhido').toBe('RG');
  });

  /** A seta é a outra porta de reabertura, e precisa deixar o campo tão vazio quanto o foco. */
  it('reabrir pela seta também esvazia o campo', () => {
    fixture.componentInstance.escolhido.set('rg');
    fixture.detectChanges();

    campo().dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    teclar('Escape');
    expect(campo().value, 'pré-condição: fechada, a lista devolveu o rótulo').toBe('RG');

    teclar('ArrowDown');
    expect(campo().value).toBe('');
  });

  function rotuloApontado(): string {
    const id = campo().getAttribute('aria-activedescendant');
    return nativo.querySelector(`#${id}`)?.textContent?.trim() ?? '';
  }
});
