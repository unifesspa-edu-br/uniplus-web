import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { InstituicaoPainelComponent } from './instituicao-painel.component';
import { unifesspa } from './instituicao.testing';

describe('InstituicaoPainelComponent', () => {
  let fixture: ComponentFixture<InstituicaoPainelComponent>;
  let acionados: string[];

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [InstituicaoPainelComponent] });
    fixture = TestBed.createComponent(InstituicaoPainelComponent);
    acionados = [];
    fixture.componentInstance.cadastrar.subscribe(() => acionados.push('cadastrar'));
    fixture.componentInstance.editar.subscribe(() => acionados.push('editar'));
  });

  function montar(entradas: Record<string, unknown>): void {
    const padrao: Record<string, unknown> = {
      instituicao: unifesspa,
      naoCadastrada: false,
      carregando: false,
      gravando: false,
      unidadeRaiz: 'REITORIA — Reitoria',
    };
    for (const [nome, valor] of Object.entries({ ...padrao, ...entradas })) {
      fixture.componentRef.setInput(nome, valor);
    }
    fixture.detectChanges();
  }
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const botoes = (): HTMLButtonElement[] => [...raiz().querySelectorAll('button')];

  it('antes da primeira leitura, mostra só a espera, sem botões', () => {
    montar({ instituicao: null });

    expect(raiz().textContent).toContain('Carregando instituição');
    expect(botoes()).toHaveLength(0);
  });

  it('com a instituição, oferece a edição e não o cadastro', () => {
    montar({});

    expect(botoes().map((b) => b.textContent?.trim())).toEqual(['Editar']);
    botoes()[0].click();
    expect(acionados).toEqual(['editar']);
  });

  it('sem instituição cadastrada, oferece o cadastro no cabeçalho e no estado vazio', () => {
    montar({ instituicao: null, naoCadastrada: true });

    expect(botoes().map((b) => b.textContent?.trim())).toEqual([
      'Cadastrar instituição',
      'Cadastrar instituição',
    ]);
    botoes().forEach((b) => b.click());
    expect(acionados).toEqual(['cadastrar', 'cadastrar']);
  });

  describe.each([
    ['carregando', { carregando: true }],
    ['gravando', { gravando: true }],
  ])('com a tela %s', (_rotulo, entradas) => {
    it('a ficha deixa o Editar com aria-disabled e o clique não emite', () => {
      montar(entradas);

      expect(botoes()).toHaveLength(1);
      expect(botoes()[0].getAttribute('aria-disabled')).toBe('true');
      botoes()[0].click();
      expect(acionados).toEqual([]);
    });

    it('o estado vazio deixa os dois botões de cadastro com aria-disabled e o clique não emite', () => {
      montar({ ...entradas, instituicao: null, naoCadastrada: true });

      expect(botoes()).toHaveLength(2);
      expect(botoes().map((b) => b.getAttribute('aria-disabled'))).toEqual(['true', 'true']);
      botoes().forEach((b) => b.click());
      expect(acionados).toEqual([]);
    });
  });

  it('o botão do cabeçalho tem o id que a devolução de foco procura nos dois modos', () => {
    montar({});
    expect(raiz().querySelector('#cfg-instituicao-acao')?.textContent).toContain('Editar');
    montar({ instituicao: null, naoCadastrada: true });
    expect(raiz().querySelector('#cfg-instituicao-acao')?.textContent).toContain('Cadastrar');
  });

  it('a leitura em segundo plano mostra o andamento sem esconder a ficha', () => {
    montar({ carregando: true });

    expect(raiz().querySelector('.panel-head .list-state__loading')).not.toBeNull();
    expect(raiz().querySelector('.cfg-instituicao__ficha')).not.toBeNull();
  });
});
