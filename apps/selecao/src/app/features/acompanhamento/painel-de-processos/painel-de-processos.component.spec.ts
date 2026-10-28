import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  PainelDeProcessosComponent,
  TAMANHO_INICIAL_DO_PAINEL,
  type ProcessoDoPainel,
} from './painel-de-processos.component';

/** Dados fictícios: existem só neste teste, nunca em código de produção. */
const PROCESSOS_FICTICIOS: readonly ProcessoDoPainel[] = [
  { id: 'processo-ficticio-1', nome: 'Processo Seletivo Fictício A' },
  { id: 'processo-ficticio-2', nome: 'Processo Seletivo Fictício B' },
  { id: 'processo-ficticio-3', nome: 'Processo Seletivo Fictício C' },
];

const PROCESSO_FICTICIO_DE_NOME_LONGO: ProcessoDoPainel = {
  id: 'processo-ficticio-longo',
  nome:
    'Processo Seletivo Fictício para Ingresso nos Cursos de Graduação Presenciais ' +
    'em Regime Especial de Oferta Complementar — ' +
    'SeguenciaSemEspacosDeUmNomeExcessivamenteLongoParaForcarAQuebraDeLinhaNoCartao',
};

describe('PainelDeProcessosComponent', () => {
  let fixture: ComponentFixture<PainelDeProcessosComponent>;
  let componente: PainelDeProcessosComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [PainelDeProcessosComponent] });
    fixture = TestBed.createComponent(PainelDeProcessosComponent);
    componente = fixture.componentInstance;
  });

  function entrada(nome: string, valor: unknown): void {
    fixture.componentRef.setInput(nome, valor);
    fixture.detectChanges();
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function texto(): string {
    return host().textContent ?? '';
  }

  function botao(nome: string): HTMLButtonElement | undefined {
    return Array.from(host().querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes(nome),
    );
  }

  function emissoesDaNavegacao(): string[] {
    const emitidos: string[] = [];
    componente.paginaAnterior.subscribe(() => emitidos.push('anterior'));
    componente.proximaPagina.subscribe(() => emitidos.push('proxima'));
    return emitidos;
  }

  function regiaoDeStatus(): Element | null {
    return host().querySelector('.painel__espera[role="status"]');
  }

  function avisoDeEspera(): string {
    return regiaoDeStatus()?.textContent?.trim() ?? '';
  }

  function esperaSemReenviar(nome: string, contagem: () => number): void {
    const acao = botao(nome) as HTMLButtonElement;
    acao.focus();
    acao.click();
    entrada('carregando', true);

    acao.click();

    expect(contagem()).toBe(1);
    expect(acao.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(acao);
    expect(avisoDeEspera()).toContain('Carregando processos seletivos');
  }

  function cartoes(): HTMLElement[] {
    return Array.from(host().querySelectorAll<HTMLElement>('.painel__cartao'));
  }

  it('apresenta o título do painel', () => {
    fixture.detectChanges();

    expect(host().querySelector('h1')?.textContent).toContain('Painel de processos seletivos');
  });

  describe('resultado disponível', () => {
    beforeEach(() => entrada('processos', PROCESSOS_FICTICIOS));

    it('exibe um cartão por processo, na ordem recebida', () => {
      expect(cartoes().map((c) => c.querySelector('h2')?.textContent?.trim())).toEqual(
        PROCESSOS_FICTICIOS.map((p) => p.nome),
      );
    });

    it('nomeia cada ação pelo processo, contendo o rótulo visível', () => {
      const acoes = cartoes().map((c) => c.querySelector('button') as HTMLButtonElement);

      expect(acoes.map((a) => a.textContent?.trim())).toEqual(
        PROCESSOS_FICTICIOS.map(() => 'Abrir acompanhamento'),
      );
      expect(acoes.map((a) => a.getAttribute('aria-label'))).toEqual(
        PROCESSOS_FICTICIOS.map((p) => `Abrir acompanhamento de ${p.nome}`),
      );
    });

    it('comunica o identificador do processo escolhido', () => {
      const abertos: string[] = [];
      componente.abrir.subscribe((id) => abertos.push(id));

      (cartoes()[1].querySelector('button') as HTMLButtonElement).click();

      expect(abertos).toEqual(['processo-ficticio-2']);
    });

    it('não apresenta total global nem mensagem de lista vazia', () => {
      expect(texto()).not.toMatch(/total|\d+ processos/i);
      expect(texto()).not.toContain('Nenhum processo seletivo encontrado');
    });

    it('apresenta o rodapé compartilhado com tamanho inicial de 50', () => {
      const seletor = host().querySelector<HTMLSelectElement>('select[data-pager="page-size"]');

      expect(TAMANHO_INICIAL_DO_PAINEL).toBe(50);
      expect(seletor?.value).toBe('50');
      expect(Array.from(seletor?.options ?? []).map((o) => o.value)).toEqual([
        '10',
        '25',
        '50',
        '100',
      ]);
    });
  });

  describe('paginação', () => {
    beforeEach(() => {
      entrada('processos', PROCESSOS_FICTICIOS);
      entrada('temAnterior', true);
      entrada('temProxima', true);
    });

    it('comunica cada botão pela sua própria saída', () => {
      const emitidos = emissoesDaNavegacao();

      host().querySelector<HTMLButtonElement>('[data-pager="prev"]')?.click();
      expect(emitidos).toEqual(['anterior']);

      host().querySelector<HTMLButtonElement>('[data-pager="next"]')?.click();
      expect(emitidos).toEqual(['anterior', 'proxima']);
    });

    it('comunica a alteração do tamanho da página', () => {
      const tamanhos: number[] = [];
      componente.tamanhoDePaginaChange.subscribe((n) => tamanhos.push(n));
      const seletor = host().querySelector('select[data-pager="page-size"]') as HTMLSelectElement;

      seletor.value = '25';
      seletor.dispatchEvent(new Event('change'));

      expect(tamanhos).toEqual([25]);
    });

    it('sem página anterior, só Próximo comunica', () => {
      const emitidos = emissoesDaNavegacao();
      entrada('temAnterior', false);

      host().querySelector<HTMLButtonElement>('[data-pager="prev"]')?.click();
      host().querySelector<HTMLButtonElement>('[data-pager="next"]')?.click();

      expect(emitidos).toEqual(['proxima']);
    });

    it('sem próxima página, só Anterior comunica', () => {
      const emitidos = emissoesDaNavegacao();
      entrada('temProxima', false);

      host().querySelector<HTMLButtonElement>('[data-pager="prev"]')?.click();
      host().querySelector<HTMLButtonElement>('[data-pager="next"]')?.click();

      expect(emitidos).toEqual(['anterior']);
    });

    it('impede repetir as ações de consulta durante o carregamento', () => {
      const emitidos = emissoesDaNavegacao();
      componente.tamanhoDePaginaChange.subscribe(() => emitidos.push('tamanho'));
      entrada('carregando', true);

      host().querySelector<HTMLButtonElement>('[data-pager="prev"]')?.click();
      host().querySelector<HTMLButtonElement>('[data-pager="next"]')?.click();
      const seletor = host().querySelector('select[data-pager="page-size"]') as HTMLSelectElement;
      seletor.value = '10';
      seletor.dispatchEvent(new Event('change'));

      expect(emitidos).toEqual([]);
    });
  });

  describe('carregamento inicial', () => {
    beforeEach(() => entrada('carregando', true));

    it('sinaliza a espera sem apresentar lista vazia', () => {
      expect(avisoDeEspera()).toContain('Carregando processos seletivos');
      expect(texto()).not.toContain('Nenhum processo seletivo encontrado');
      expect(host().querySelector('.pager')).toBeNull();
    });
  });

  describe('atualização de página em andamento', () => {
    it('mantém os cartões e sinaliza a espera', () => {
      entrada('processos', PROCESSOS_FICTICIOS);
      const regiao = regiaoDeStatus();
      expect(regiao).not.toBeNull();
      expect(avisoDeEspera()).toBe('');

      entrada('carregando', true);

      expect(cartoes()).toHaveLength(3);
      expect(regiaoDeStatus()).toBe(regiao);
      expect(avisoDeEspera()).toContain('Carregando processos seletivos');
      expect(regiao?.closest('[aria-busy="true"]')).toBeNull();
      expect(host().querySelector('.painel__cartoes')?.getAttribute('aria-busy')).toBe('true');
    });
  });

  describe('resultado vazio', () => {
    it('apresenta a mensagem de lista vazia', () => {
      fixture.detectChanges();

      expect(texto()).toContain('Nenhum processo seletivo encontrado');
      expect(cartoes()).toHaveLength(0);
    });

    it('substitui os cartões anteriores quando a nova lista chega vazia', () => {
      entrada('processos', PROCESSOS_FICTICIOS);
      expect(cartoes()).toHaveLength(3);

      entrada('processos', []);

      expect(cartoes()).toHaveLength(0);
      expect(texto()).toContain('Nenhum processo seletivo encontrado');
    });
  });

  describe('falha inicial', () => {
    beforeEach(() => entrada('falha', 'inicial'));

    it('informa a falha e oferece nova tentativa, sem lista vazia', () => {
      expect(texto()).toContain('Não foi possível carregar os processos seletivos');
      expect(botao('Tentar novamente')).toBeDefined();
      expect(texto()).not.toContain('Nenhum processo seletivo encontrado');
    });

    it('comunica a nova tentativa uma só vez e mantém o foco durante a espera', () => {
      let tentativas = 0;
      componente.tentarNovamente.subscribe(() => tentativas++);

      esperaSemReenviar('Tentar novamente', () => tentativas);
    });
  });

  describe('falha de navegação', () => {
    beforeEach(() => {
      entrada('processos', PROCESSOS_FICTICIOS);
      entrada('temProxima', true);
      entrada('falha', 'navegacao');
    });

    it('mantém os cartões da última página válida, com aviso e nova tentativa', () => {
      expect(cartoes()).toHaveLength(3);
      expect(host().querySelector('[role="alert"]')).not.toBeNull();
      expect(botao('Tentar novamente')).toBeDefined();
      expect(host().querySelector('.pager')).not.toBeNull();
    });

    it('comunica a nova tentativa uma só vez e mantém foco e cartões durante a espera', () => {
      let tentativas = 0;
      componente.tentarNovamente.subscribe(() => tentativas++);

      esperaSemReenviar('Tentar novamente', () => tentativas);

      expect(cartoes()).toHaveLength(3);
    });
  });

  describe('cursor expirado', () => {
    beforeEach(() => {
      entrada('processos', PROCESSOS_FICTICIOS);
      entrada('restricao', 'cursor-expirado');
    });

    it('pede a atualização, sem cartões nem paginação', () => {
      expect(texto()).toContain('A lista precisa ser atualizada');
      expect(cartoes()).toHaveLength(0);
      expect(host().querySelector('.pager')).toBeNull();
    });

    it('comunica o reinício uma só vez e mantém o foco durante a espera', () => {
      let reinicios = 0;
      componente.atualizarLista.subscribe(() => reinicios++);

      esperaSemReenviar('Atualizar lista', () => reinicios);
    });
  });

  describe('acesso negado', () => {
    it.each(['inicial', 'navegacao', null])(
      'prevalece sobre a falha %s, sem dados, paginação nem nova tentativa',
      (falha) => {
        entrada('processos', PROCESSOS_FICTICIOS);
        entrada('falha', falha);
        entrada('restricao', 'acesso-negado');
        entrada('carregando', true);

        expect(texto()).toContain('Acesso negado');
        expect(texto()).not.toContain(PROCESSOS_FICTICIOS[0].nome);
        expect(cartoes()).toHaveLength(0);
        expect(host().querySelector('.pager')).toBeNull();
        expect(host().querySelector('button[data-acao]')).toBeNull();
        expect(regiaoDeStatus()).toBeNull();
      },
    );
  });

  describe('nomes longos', () => {
    it('mantém o nome e a ação no mesmo cartão', () => {
      entrada('processos', [PROCESSO_FICTICIO_DE_NOME_LONGO, ...PROCESSOS_FICTICIOS]);

      const [primeiro] = cartoes();
      expect(primeiro.querySelector('h2')?.textContent).toContain(
        PROCESSO_FICTICIO_DE_NOME_LONGO.nome,
      );
      expect(primeiro.querySelector('button')?.getAttribute('aria-label')).toBe(
        `Abrir acompanhamento de ${PROCESSO_FICTICIO_DE_NOME_LONGO.nome}`,
      );
    });
  });
});
