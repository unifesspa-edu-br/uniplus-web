import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { TipoDocumentoDto } from '@uniplus/shared-data/configuracao';
import { beforeEach, describe, expect, it } from 'vitest';
import { TiposDocumentoListaComponent } from './tipos-documento-lista.component';
import { PERMISSAO_DE_MANTER, laudo, rg } from './tipos-documento.testing';
import type { LinhaDoTipoDocumento } from './tipos-documento.store';

const linhaDe = (tipo: TipoDocumentoDto): LinhaDoTipoDocumento => ({
  tipo,
  categoria: { estado: 'resolvido', rotulo: 'Identificação' },
  situacao: null,
});

describe('TiposDocumentoListaComponent', () => {
  let fixture: ComponentFixture<TiposDocumentoListaComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TiposDocumentoListaComponent],
      providers: [
        provideRouter([]),
        {
          provide: PermissoesService,
          useValue: { tem: (c: string) => c === PERMISSAO_DE_MANTER },
        },
      ],
    });
    fixture = TestBed.createComponent(TiposDocumentoListaComponent);
  });

  function montar(
    tipos: readonly TipoDocumentoDto[],
    entradas: Record<string, unknown> = {},
  ): void {
    const padrao: Record<string, unknown> = {
      linhas: tipos.map(linhaDe),
      carregando: false,
      gravando: false,
      removendo: false,
      erro: null,
      temFiltro: false,
      temAnterior: false,
      temProximo: false,
      podeSolicitar: true,
      leituras: [],
    };
    for (const [nome, valor] of Object.entries({ ...padrao, ...entradas })) {
      fixture.componentRef.setInput(nome, valor);
    }
    fixture.detectChanges();
  }
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const botoes = (): HTMLButtonElement[] => [...raiz().querySelectorAll('button')];
  /** O nome da linha abre o detalhe, que só lê: segue disponível durante a gravação. */
  const acoes = (): HTMLButtonElement[] =>
    botoes().filter((b) => !b.classList.contains('table-responsive__alvo'));
  const indisponivel = (b: HTMLButtonElement): boolean =>
    b.matches(':disabled') || b.getAttribute('aria-disabled') === 'true';
  const porNome = (nome: string): HTMLButtonElement => {
    const encontrado = botoes().find((item) => item.getAttribute('aria-label') === nome);
    if (!encontrado) throw new Error(`Botão ausente: ${nome}.`);
    return encontrado;
  };
  const editar = (): HTMLButtonElement => porNome('Editar tipo de documento RG');
  const remover = (): HTMLButtonElement => porNome('Remover tipo de documento RG');
  const novo = (): HTMLButtonElement =>
    raiz().querySelector('#cfg-tipos-documento-novo') as HTMLButtonElement;
  const atualizar = (nome: string, valor: unknown): void => {
    fixture.componentRef.setInput(nome, valor);
    fixture.detectChanges();
  };

  it('com a remoção em curso, todo botão fica indisponível e o título anuncia', () => {
    montar([rg], { removendo: true, gravando: true, temProximo: true });

    expect(acoes().length).toBeGreaterThanOrEqual(4);
    expect(acoes().filter((b) => !indisponivel(b))).toEqual([]);
    expect(raiz().textContent).toContain('Removendo');
  });

  it('no estado vazio, com gravação em curso, "Limpar filtros" e "Novo tipo" ficam indisponíveis', () => {
    montar([], { gravando: true, temFiltro: true });
    const limpar = botoes().find((b) => b.textContent?.includes('Limpar filtros'));
    expect(limpar?.matches(':disabled')).toBe(true);

    atualizar('temFiltro', false);
    expect(botoes().filter((b) => !indisponivel(b))).toEqual([]);
    expect(raiz().textContent).toContain('Nenhum tipo de documento cadastrado');
  });

  it('desabilita as ações no DOM e recusa acionamentos durante a carga', () => {
    montar([rg], { carregando: true });
    const emitidos: string[] = [];
    const c = fixture.componentInstance;
    c.editar.subscribe(() => emitidos.push('editar'));
    c.remover.subscribe(() => emitidos.push('remover'));
    c.cadastrar.subscribe(() => emitidos.push('cadastrar'));
    c.solicitar.subscribe(() => emitidos.push('solicitar'));

    for (const botao of [editar(), remover()]) {
      expect(botao.matches(':disabled')).toBe(true);
      botao.click();
    }
    expect(novo().getAttribute('aria-disabled')).toBe('true');
    novo().click();
    botoes()
      .find((b) => b.textContent?.includes('Enviar solicitação'))
      ?.click();
    expect(emitidos).toEqual([]);

    atualizar('carregando', false);
    editar().click();
    remover().click();
    novo().click();
    botoes()
      .find((b) => b.textContent?.includes('Enviar solicitação'))
      ?.click();
    expect(emitidos).toEqual(['editar', 'remover', 'cadastrar', 'solicitar']);
  });

  it('o novo cadastro continua focável enquanto indisponível, para o foco não se perder', () => {
    montar([rg], { gravando: true });
    document.body.appendChild(raiz());
    novo().focus();
    expect(document.activeElement).toBe(novo());
    raiz().remove();
  });

  it('marca o título da lista como destino de foco programático', () => {
    montar([rg]);
    expect(raiz().querySelector('#cfg-tipos-documento-list-title')?.getAttribute('tabindex')).toBe(
      '-1',
    );
  });

  it('só oferece "Enviar solicitação" com item solicitável', () => {
    montar([rg], { podeSolicitar: false });
    expect(botoes().some((b) => b.textContent?.includes('Enviar solicitação'))).toBe(false);
    atualizar('podeSolicitar', true);
    expect(botoes().some((b) => b.textContent?.includes('Enviar solicitação'))).toBe(true);
  });

  it('a situação ilegível diz que não foi possível ler, sem inventar aprovação', () => {
    montar([rg], { linhas: [{ ...linhaDe(rg), situacao: 'ilegivel' }] });
    expect(raiz().textContent).toContain('Não foi possível ler a situação');
    expect(raiz().textContent).not.toContain('Aprovada');
  });

  it('o estado vazio com filtro oferece limpar; sem filtro, cadastrar', () => {
    montar([], { temFiltro: true });
    expect(raiz().textContent).toContain('Nenhum tipo de documento encontrado');
    let limpou = 0;
    fixture.componentInstance.limparFiltros.subscribe(() => (limpou += 1));
    botoes()
      .find((b) => b.textContent?.includes('Limpar filtros'))
      ?.click();
    expect(limpou).toBe(1);

    atualizar('temFiltro', false);
    expect(raiz().textContent).toContain('Nenhum tipo de documento cadastrado');
  });

  it('o estado vazio some com a falha de leitura', () => {
    montar([], { erro: 'Falha.' });
    expect(raiz().textContent).not.toContain('Nenhum tipo de documento');
  });

  it('o pager aparece com página anterior ou próxima e emite a navegação', () => {
    montar([rg, laudo], { temProximo: true });
    let proximos = 0;
    fixture.componentInstance.proximo.subscribe(() => (proximos += 1));
    const proximo = botoes().find((b) => /Próxim/u.test(b.textContent ?? ''));
    proximo?.click();
    expect(proximos).toBe(1);
  });
});
