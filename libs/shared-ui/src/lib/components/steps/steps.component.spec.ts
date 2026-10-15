import { TestBed } from '@angular/core/testing';

import { type StepItem, StepsComponent } from './steps.component';

const ITENS: StepItem[] = [
  { rotulo: 'Tipo', status: 'done' },
  { rotulo: 'Identificação', status: 'active' },
  { rotulo: 'Fórmula', status: 'pending' },
  { rotulo: 'Revisão', status: 'unvisited' },
];

describe('StepsComponent', () => {
  function montar(itens: readonly StepItem[] = ITENS, entradas: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(StepsComponent);
    fixture.componentRef.setInput('items', itens);
    for (const [nome, valor] of Object.entries(entradas)) {
      fixture.componentRef.setInput(nome, valor);
    }
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const itensDaLista = Array.from(host.querySelectorAll<HTMLLIElement>('li.ui-steps__item'));
    return { fixture, host, itensDaLista };
  }

  it('renderiza um item por passo, com número e rótulo, na ordem recebida', () => {
    const { itensDaLista } = montar();

    expect(itensDaLista.map((li) => li.querySelector('.ui-steps__texto')?.textContent)).toEqual([
      '1',
      '2',
      '3',
      '4',
    ]);
    expect(itensDaLista.map((li) => li.querySelector('.ui-steps__rotulo')?.textContent)).toEqual([
      'Tipo',
      'Identificação',
      'Fórmula',
      'Revisão',
    ]);
  });

  it('marca cada estado de apresentação só no item correspondente', () => {
    const { itensDaLista } = montar();

    expect(itensDaLista.map((li) => li.classList.contains('is-done'))).toEqual([
      true,
      false,
      false,
      false,
    ]);
    expect(itensDaLista.map((li) => li.classList.contains('is-active'))).toEqual([
      false,
      true,
      false,
      false,
    ]);
    expect(itensDaLista.map((li) => li.classList.contains('is-pending'))).toEqual([
      false,
      false,
      true,
      false,
    ]);
  });

  it('expõe aria-current="step" só no passo ativo', () => {
    const { host } = montar();

    const atuais = host.querySelectorAll('button[aria-current="step"]');
    expect(atuais.length).toBe(1);
    expect(atuais[0].textContent).toContain('Identificação');
  });

  it('nomeia o passo concluído como concluído, sem depender de cor ou ícone', () => {
    const { itensDaLista } = montar();

    expect(itensDaLista[0].querySelector('button')?.textContent).toContain('(concluída)');
    expect(itensDaLista[1].querySelector('button')?.textContent).not.toContain('(concluída)');
  });

  it('o passo atual já concluído mantém aria-current e também se anuncia concluído', () => {
    const { itensDaLista } = montar([{ rotulo: 'Dados', status: 'active', concluido: true }]);

    expect(itensDaLista[0].querySelector('button')?.getAttribute('aria-current')).toBe('step');
    expect(itensDaLista[0].querySelector('button')?.textContent).toContain('(concluída)');
  });

  it('o passo com resposta recusada se anuncia recusado, no lugar de concluído', () => {
    const { itensDaLista } = montar([
      { rotulo: 'Dados', status: 'done', concluido: true, comErro: true },
    ]);

    const texto = itensDaLista[0].querySelector('button')?.textContent;
    expect(itensDaLista[0].classList).toContain('is-error');
    expect(texto).toContain('(com resposta recusada)');
    expect(texto).not.toContain('(concluída)');
  });

  it('usa botão nativo como alvo e não sobrescreve o papel do item de lista', () => {
    const { itensDaLista } = montar();

    expect(itensDaLista.every((li) => li.querySelector('button[type="button"]') !== null)).toBe(
      true,
    );
    expect(itensDaLista.every((li) => li.getAttribute('role') === null)).toBe(true);
  });

  it('emite o índice do passo acionado, sem decidir se a navegação vale', () => {
    const { fixture, itensDaLista } = montar();
    const emitidos: number[] = [];
    fixture.componentInstance.selecionado.subscribe((i) => emitidos.push(i));

    itensDaLista[3].querySelector('button')?.click();
    itensDaLista[0].querySelector('button')?.click();

    expect(emitidos).toEqual([3, 0]);
    expect(itensDaLista[1].querySelector('button')?.getAttribute('aria-current')).toBe('step');
  });

  it('com rótulo de navegação, envolve a lista num nav com esse nome; sem, não cria landmark', () => {
    const com = montar(ITENS, { rotuloDaNavegacao: 'Etapas do cadastro' });
    expect(com.host.querySelector('nav')?.getAttribute('aria-label')).toBe('Etapas do cadastro');

    TestBed.resetTestingModule();
    const sem = montar();
    expect(sem.host.querySelector('nav')).toBeNull();
  });

  it('aplica a variante pedida ao contêiner', () => {
    const { host } = montar(ITENS, { variante: 'chips' });

    expect(host.querySelector('.ui-steps--chips')).not.toBeNull();
    expect(host.querySelector('.ui-steps--lateral')).toBeNull();
  });

  it('o passo atual já concluído aparece como ativo nas colunas e soma os dois estados nos chips', () => {
    const item: StepItem = { rotulo: 'Dados', status: 'active', concluido: true };

    const coluna = montar([item]).itensDaLista[0];
    expect(coluna.classList).toContain('is-active');
    expect(coluna.classList).not.toContain('is-done');
    expect(coluna.textContent).toContain('(concluída)');

    TestBed.resetTestingModule();
    const chips = montar([item], { variante: 'chips' }).itensDaLista[0];
    expect(chips.classList).toContain('is-active');
    expect(chips.classList).toContain('is-done');
  });

  it('reaproveita o DOM do passo pela chave quando a lista perde um passo antes dele', () => {
    const { fixture, host } = montar([
      { chave: 'a', rotulo: 'A', status: 'pending' },
      { chave: 'b', rotulo: 'B', status: 'pending' },
    ]);
    const botaoDeB = host.querySelectorAll('button')[1];

    fixture.componentRef.setInput('items', [{ chave: 'b', rotulo: 'B', status: 'pending' }]);
    fixture.detectChanges();

    expect(host.querySelectorAll('button')[0]).toBe(botaoDeB);
  });

  it('nomeia o passo pendente, e o não visitado fica sem texto de estado', () => {
    const { itensDaLista } = montar();

    expect(itensDaLista[2].querySelector('button')?.textContent).toContain('(pendente)');
    expect(itensDaLista[3].querySelector('button')?.textContent).not.toContain('(');
  });
});
