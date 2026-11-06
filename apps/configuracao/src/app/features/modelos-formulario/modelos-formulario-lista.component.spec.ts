import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { ModeloFormularioView } from '@uniplus/shared-data/configuracao';
import { beforeEach, describe, expect, it } from 'vitest';
import { ModelosFormularioListaComponent } from './modelos-formulario-lista.component';

const conteudo = {
  titulo: 'Inscrição',
  etapas: [],
  itens: [],
  termos: [],
  pressupostos: [],
  grupos: [],
  documentosExigidos: [],
};
const ativo: ModeloFormularioView = {
  id: 'm1',
  codigo: 'INSCRICAO',
  nome: 'Inscrição',
  descricao: null,
  finalidade: 'INSCRICAO',
  tipoProcessoCodigo: null,
  ativo: true,
  conteudo,
};
const inativo: ModeloFormularioView = {
  ...ativo,
  id: 'm2',
  codigo: 'ANTIGO',
  ativo: false,
  tipoProcessoCodigo: 'VESTIBULAR',
};

describe('ModelosFormularioListaComponent', () => {
  let fixture: ComponentFixture<ModelosFormularioListaComponent>;
  let pode = true;

  beforeEach(() => {
    pode = true;
    TestBed.configureTestingModule({
      imports: [ModelosFormularioListaComponent],
      providers: [provideRouter([]), { provide: PermissoesService, useValue: { tem: () => pode } }],
    });
    fixture = TestBed.createComponent(ModelosFormularioListaComponent);
  });

  function montar(
    modelos: readonly ModeloFormularioView[],
    entradas: Record<string, unknown> = {},
  ): void {
    const padrao: Record<string, unknown> = {
      tiposDeProcesso: [{ codigo: 'VESTIBULAR', nome: 'Vestibular' }],
      modelosBuscados: modelos,
      loading: false,
      errorMessage: null,
      prevCursor: 'a',
      nextCursor: 'b',
      gravando: false,
      emAndamento: null,
    };
    for (const [nome, valor] of Object.entries({ ...padrao, ...entradas })) {
      fixture.componentRef.setInput(nome, valor);
    }
    fixture.detectChanges();
  }
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const botoes = (): HTMLButtonElement[] => [...raiz().querySelectorAll('button')];
  const acionaveis = (): HTMLElement[] =>
    [...raiz().querySelectorAll<HTMLElement>('button, a[aria-label]')].filter(
      (el) =>
        !el.matches(':disabled') &&
        el.getAttribute('aria-disabled') !== 'true' &&
        !el.closest('fieldset:disabled'),
    );

  it('durante a gravação, todo acionador fica indisponível, inclusive busca, filtros e paginação', () => {
    montar([ativo, inativo], { gravando: true });

    expect(acionaveis()).toEqual([]);
    expect(raiz().querySelector('fieldset')?.matches(':disabled')).toBe(true);
    expect(raiz().querySelector('input[type="search"]')?.matches(':disabled')).toBe(true);
    expect(
      raiz().querySelector('ui-pager [data-pager="next"]')?.getAttribute('aria-disabled'),
    ).toBe('true');
  });

  it('durante a carga, os acionadores da lista ficam indisponíveis mas os filtros seguem editáveis', () => {
    montar([ativo], { loading: true });

    expect(raiz().querySelector('fieldset')?.matches(':disabled')).toBe(false);
    expect(raiz().querySelector('select')?.matches(':disabled')).toBe(false);
    expect(
      raiz()
        .querySelector<HTMLButtonElement>('.table-responsive__actions button')
        ?.matches(':disabled'),
    ).toBe(true);
    expect(raiz().textContent).toContain('Carregando');
  });

  it('o botão de criar usa aria-disabled e o clique não cria enquanto a lista está ocupada', () => {
    const criacoes: number[] = [];
    fixture.componentInstance.criar.subscribe(() => criacoes.push(1));
    montar([ativo], { gravando: true });
    const novo = raiz().querySelector<HTMLButtonElement>('.panel-head .btn--primary');

    const clique = new MouseEvent('click', { bubbles: true, cancelable: true });
    novo?.dispatchEvent(clique);

    expect(novo?.getAttribute('aria-disabled')).toBe('true');
    expect(novo?.disabled).toBe(false);
    expect(clique.defaultPrevented).toBe(true);
    expect(criacoes).toEqual([]);
  });

  it('com a lista livre, o botão de criar emite e não anuncia indisponibilidade', () => {
    const criacoes: number[] = [];
    fixture.componentInstance.criar.subscribe(() => criacoes.push(1));
    montar([ativo]);
    const novo = raiz().querySelector<HTMLButtonElement>('.panel-head .btn--primary');

    novo?.click();

    expect(novo?.hasAttribute('aria-disabled')).toBe(false);
    expect(criacoes).toEqual([1]);
  });

  it('sem permissão de manter, não oferece criar, editar, ativar nem desativar', () => {
    pode = false;
    montar([ativo, inativo]);

    expect(raiz().querySelector('.panel-head .btn--primary')).toBeNull();
    expect(raiz().querySelector('[aria-label^="Editar o modelo"]')).toBeNull();
    expect(botoes().filter((b) => b.closest('td'))).toEqual([]);
    expect(raiz().querySelector('[aria-label^="Simular o modelo"]')).not.toBeNull();
  });

  it('desativa o modelo ativo e ativa o desativado, cada um por seu botão', () => {
    const desativados: string[] = [];
    const ativados: string[] = [];
    fixture.componentInstance.desativar.subscribe((m) => desativados.push(m.id));
    fixture.componentInstance.ativar.subscribe((m) => ativados.push(m.id));
    montar([ativo, inativo]);

    raiz().querySelector<HTMLButtonElement>('[aria-label="Desativar o modelo INSCRICAO"]')?.click();
    raiz().querySelector<HTMLButtonElement>('[aria-label="Ativar o modelo ANTIGO"]')?.click();

    expect(desativados).toEqual(['m1']);
    expect(ativados).toEqual(['m2']);
  });

  it('mostra o andamento só na linha afetada, escondido da tecnologia assistiva', () => {
    montar([ativo, inativo], { emAndamento: 'm2' });

    const linhas = raiz().querySelectorAll('tbody tr');
    expect(linhas[0].textContent).toContain('Ativo');
    expect(linhas[1].textContent).toContain('Ativando...');
    expect(linhas[1].querySelector('[aria-hidden="true"]')?.textContent).toContain('Ativando...');
  });

  it('mostra "Desativando..." na linha do modelo ativo em andamento', () => {
    montar([ativo], { emAndamento: 'm1' });

    expect(raiz().querySelector('tbody')?.textContent).toContain('Desativando...');
  });

  it('mostra o tipo de processo pelo código, com o nome na dica, ou "Qualquer tipo"', () => {
    montar([ativo, inativo]);

    const celulas = raiz().querySelectorAll('td[data-label="Tipo de processo"]');
    expect(celulas[0].textContent).toContain('Qualquer tipo');
    expect(celulas[1].querySelector('code')?.getAttribute('title')).toBe('Vestibular');
  });

  it('mantém o código do tipo na dica quando o tipo não está no catálogo carregado', () => {
    montar([inativo], { tiposDeProcesso: [] });

    expect(
      raiz().querySelector('td[data-label="Tipo de processo"] code')?.getAttribute('title'),
    ).toBe('VESTIBULAR');
  });

  it('mostra o rótulo da finalidade e mantém o valor quando ela é desconhecida', () => {
    montar([ativo, { ...ativo, id: 'm3', codigo: 'OUTRO', finalidade: 'DESCONHECIDA' }]);

    const celulas = raiz().querySelectorAll('td[data-label="Finalidade"]');
    expect(celulas[0].textContent?.trim()).not.toBe('INSCRICAO');
    expect(celulas[1].textContent?.trim()).toBe('DESCONHECIDA');
  });

  it('o estado vazio só aparece sem carga nem erro', () => {
    montar([]);
    expect(raiz().textContent).toContain('Nenhum modelo encontrado');

    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    expect(raiz().textContent).not.toContain('Nenhum modelo encontrado');

    fixture.componentRef.setInput('loading', false);
    fixture.componentRef.setInput('errorMessage', 'Falhou');
    fixture.detectChanges();
    expect(raiz().textContent).not.toContain('Nenhum modelo encontrado');
  });

  it('sem cursores, não mostra a paginação', () => {
    montar([ativo], { prevCursor: null, nextCursor: null });

    expect(raiz().querySelector('ui-pager')).toBeNull();
  });

  it('a paginação emite anterior e próximo', () => {
    const passos: string[] = [];
    fixture.componentInstance.anterior.subscribe(() => passos.push('anterior'));
    fixture.componentInstance.proximo.subscribe(() => passos.push('proximo'));
    montar([ativo]);

    raiz().querySelector<HTMLButtonElement>('ui-pager [data-pager="prev"]')?.click();
    raiz().querySelector<HTMLButtonElement>('ui-pager [data-pager="next"]')?.click();

    expect(passos).toEqual(['anterior', 'proximo']);
  });

  it('o filtro de tipo de processo atualiza o modelo de dados', () => {
    montar([ativo]);
    const select = raiz().querySelector<HTMLSelectElement>(
      '.filter-bar select',
    ) as HTMLSelectElement;

    select.value = 'VESTIBULAR';
    select.dispatchEvent(new Event('change'));

    expect(fixture.componentInstance.filtroTipo()).toBe('VESTIBULAR');
  });

  it('resume os filtros ativos com os rótulos, e com o valor quando não há rótulo', () => {
    montar([ativo]);
    fixture.componentInstance.filtroFinalidade.set('INSCRICAO');
    fixture.componentInstance.filtroSituacao.set('false');
    fixture.componentInstance.filtroTipo.set('VESTIBULAR');
    fixture.detectChanges();

    const resumo = raiz().querySelector('ui-filter-bar')?.textContent ?? '';
    expect(resumo).toContain('Desativados');
    expect(resumo).toContain('Vestibular');

    fixture.componentInstance.filtroFinalidade.set('OUTRA');
    fixture.componentInstance.filtroSituacao.set('talvez');
    fixture.detectChanges();

    const sem = raiz().querySelector('ui-filter-bar')?.textContent ?? '';
    expect(sem).toContain('OUTRA');
    expect(sem).toContain('talvez');

    fixture.componentInstance.filtroFinalidade.set('');
    fixture.componentInstance.filtroSituacao.set('');
    fixture.componentInstance.filtroTipo.set('SEM_CADASTRO');
    fixture.detectChanges();

    expect(raiz().querySelector('ui-filter-bar')?.textContent).toContain(
      'Tipo de processo: SEM_CADASTRO',
    );
  });

  it('o título da lista pode receber o foco programático', () => {
    montar([ativo]);

    expect(raiz().querySelector('#cfg-modelos-list-title')?.getAttribute('tabindex')).toBe('-1');
  });
});
