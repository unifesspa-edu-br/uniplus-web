import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OfertaCursoDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LinhaDaOferta } from './linhas-da-oferta';
import { OfertasCursoListaComponent } from './ofertas-curso-lista.component';
import { oferta } from './ofertas-curso.testing';

const linha = {
  oferta,
  curso: { estado: 'resolvido', rotulo: 'Engenharia Civil' },
  grau: 'Bacharelado',
  local: { estado: 'resolvido', rotulo: 'Campus sede — Marabá' },
  identificador: 'Engenharia Civil · IGE',
} as unknown as LinhaDaOferta;

describe('OfertasCursoListaComponent', () => {
  let fixture: ComponentFixture<OfertasCursoListaComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [OfertasCursoListaComponent] });
    fixture = TestBed.createComponent(OfertasCursoListaComponent);
  });

  function montar(linhas: readonly LinhaDaOferta[], entradas: Record<string, unknown> = {}): void {
    const padrao: Record<string, unknown> = {
      linhas,
      total: null,
      carregando: false,
      gravando: false,
      removendo: false,
      mensagemDeErro: null,
      leituras: [],
      limite: 20,
      temAnterior: true,
      temProximo: true,
    };
    for (const [nome, valor] of Object.entries({ ...padrao, ...entradas })) {
      fixture.componentRef.setInput(nome, valor);
    }
    fixture.detectChanges();
  }
  const atualizar = (nome: string, valor: unknown): void => {
    fixture.componentRef.setInput(nome, valor);
    fixture.detectChanges();
  };
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const botoes = (): HTMLButtonElement[] => [...raiz().querySelectorAll('button')];
  const indisponivel = (botao: HTMLButtonElement): boolean =>
    botao.matches(':disabled') || botao.getAttribute('aria-disabled') === 'true';
  const porNome = (nome: string): HTMLButtonElement => {
    const encontrado = botoes().find((item) => item.getAttribute('aria-label') === nome);
    if (!encontrado) throw new Error(`Botão ausente: ${nome}.`);
    return encontrado;
  };
  const novo = (): HTMLButtonElement =>
    raiz().querySelector('#cfg-ofertas-novo') as HTMLButtonElement;
  const editar = (): HTMLButtonElement => porNome('Editar oferta de curso Engenharia Civil · IGE');
  const remover = (): HTMLButtonElement =>
    porNome('Remover oferta de curso Engenharia Civil · IGE');

  it('com a remoção em curso, todo botão fica indisponível e o título anuncia', () => {
    montar([linha], { removendo: true, gravando: true });

    expect(botoes().length).toBeGreaterThanOrEqual(3);
    expect(botoes().filter((b) => !indisponivel(b))).toEqual([]);
    expect(raiz().querySelector('.list-state__loading')?.textContent).toContain('Removendo');
  });

  it('no estado vazio, com a escrita em curso, os dois "Nova oferta" ficam indisponíveis', () => {
    montar([], { removendo: true, gravando: true });
    const cadastros = botoes().filter((b) => b.textContent?.includes('Nova oferta de curso'));
    expect(cadastros).toHaveLength(2);
    expect(cadastros.every((b) => b.getAttribute('aria-disabled') === 'true')).toBe(true);
  });

  it('sem escrita em curso os acionadores seguem disponíveis', () => {
    montar([linha]);
    expect(botoes().filter(indisponivel)).toEqual([]);
  });

  it('mostra o total só quando a API o informa', () => {
    montar([linha]);
    expect(raiz().textContent).not.toContain('Total de ofertas cadastradas');
    atualizar('total', 7);
    expect(raiz().textContent).toContain('Total de ofertas cadastradas: 7');
  });

  it('desabilita as ações no DOM e recusa acionamentos durante a carga', () => {
    montar([linha], { carregando: true });
    const editados: OfertaCursoDto[] = [];
    const removidos: OfertaCursoDto[] = [];
    let cadastros = 0;
    fixture.componentInstance.editar.subscribe((item) => editados.push(item));
    fixture.componentInstance.remover.subscribe((item) => removidos.push(item));
    fixture.componentInstance.cadastrar.subscribe(() => (cadastros += 1));

    for (const botao of [editar(), remover()]) {
      expect(botao.matches(':disabled')).toBe(true);
      botao.click();
    }
    expect(novo().getAttribute('aria-disabled')).toBe('true');
    novo().click();
    expect([editados, removidos, cadastros]).toEqual([[], [], 0]);

    atualizar('carregando', false);
    editar().click();
    remover().click();
    novo().click();
    expect([editados, removidos, cadastros]).toEqual([[oferta], [oferta], 1]);
  });

  it('a paginação segue as entradas e emite o que a pessoa aciona', () => {
    montar([linha], { temAnterior: false, temProximo: true });
    const eventos: string[] = [];
    fixture.componentInstance.anterior.subscribe(() => eventos.push('anterior'));
    fixture.componentInstance.proximo.subscribe(() => eventos.push('proximo'));
    const navegacao = raiz().querySelector('nav[aria-label="Paginação de ofertas de curso"]');
    expect(navegacao).not.toBeNull();
    const [anterior, proximo] = [...(navegacao as HTMLElement).querySelectorAll('button')];
    expect(indisponivel(anterior)).toBe(true);
    proximo.click();
    expect(eventos).toEqual(['proximo']);
  });

  it('o novo continua focável enquanto indisponível, para o foco não se perder', () => {
    montar([linha], { gravando: true });
    document.body.appendChild(raiz());
    novo().focus();
    expect(document.activeElement).toBe(novo());
    raiz().remove();
  });

  it('marca o título da lista como destino de foco programático', () => {
    montar([linha]);
    expect(raiz().querySelector('#cfg-ofertas-list-title')?.getAttribute('tabindex')).toBe('-1');
  });

  it('usa a classe de carregamento que o estilo da lista define, com o spinner pequeno', () => {
    montar([linha], { carregando: true });
    const carregamento = raiz().querySelector('.list-state__loading');
    expect(carregamento?.textContent).toContain('Carregando');
    expect(carregamento?.querySelector('.spinner--sm')).not.toBeNull();
  });

  describe('foco depois de uma escrita', () => {
    const acionar = (acionador: HTMLButtonElement): void => {
      acionador.focus();
      acionador.click();
      acionador.blur();
    };
    const concluirEscrita = async (): Promise<void> => {
      atualizar('gravando', true);
      atualizar('gravando', false);
      await fixture.whenStable();
    };
    beforeEach(() => document.body.appendChild(raiz()));
    afterEach(() => raiz().remove());

    it('devolve o foco ao botão de edição que iniciou a escrita', async () => {
      montar([linha]);
      acionar(editar());
      expect(document.activeElement).toBe(document.body);
      await concluirEscrita();
      expect(document.activeElement).toBe(editar());
    });

    it('devolve o foco ao botão de remover da linha', async () => {
      montar([linha]);
      acionar(remover());
      await concluirEscrita();
      expect(document.activeElement).toBe(remover());
    });

    it('devolve o foco ao botão de cadastro quando a escrita partiu dele', async () => {
      montar([linha]);
      acionar(novo());
      await concluirEscrita();
      expect(document.activeElement).toBe(novo());
    });

    it('leva o foco ao título quando a linha do acionador não existe mais', async () => {
      montar([linha]);
      acionar(remover());
      atualizar('gravando', true);
      atualizar('linhas', []);
      atualizar('gravando', false);
      await fixture.whenStable();
      expect(document.activeElement).toBe(raiz().querySelector('#cfg-ofertas-list-title'));
    });

    it('não toma o foco de quem já o levou a outro controle', async () => {
      montar([linha]);
      acionar(editar());
      const outro = document.createElement('button');
      document.body.appendChild(outro);
      outro.focus();
      await concluirEscrita();
      expect(document.activeElement).toBe(outro);
      outro.remove();
    });

    it('não move o foco numa carga sem escrita', async () => {
      montar([linha]);
      acionar(editar());
      atualizar('carregando', true);
      atualizar('carregando', false);
      await fixture.whenStable();
      expect(document.activeElement).toBe(document.body);
    });
  });
});
