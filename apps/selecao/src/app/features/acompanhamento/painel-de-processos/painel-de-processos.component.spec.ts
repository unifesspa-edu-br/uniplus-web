import { beforeEach, describe, expect, it } from 'vitest';

import { TAMANHO_INICIAL_DO_PAINEL } from './painel-de-processos.component';
import {
  PROCESSOS_FICTICIOS,
  PROCESSO_FICTICIO_DE_NOME_LONGO,
  montarPainel,
  type PainelEmTeste,
} from './painel-de-processos.testing';

describe('PainelDeProcessosComponent', () => {
  let painel: PainelEmTeste;

  beforeEach(() => {
    painel = montarPainel();
  });

  it('apresenta o título do painel', () => {
    painel.fixture.detectChanges();

    expect(painel.host().querySelector('h1')?.textContent).toContain(
      'Painel de processos seletivos',
    );
  });

  describe('resultado disponível', () => {
    beforeEach(() => painel.entrada('processos', PROCESSOS_FICTICIOS));

    it('exibe um cartão por processo, na ordem recebida', () => {
      expect(painel.cartoes().map((c) => c.querySelector('h2')?.textContent?.trim())).toEqual(
        PROCESSOS_FICTICIOS.map((p) => p.nome),
      );
    });

    it('nomeia cada ação pelo processo, contendo o rótulo visível', () => {
      const acoes = painel.cartoes().map((c) => c.querySelector('button') as HTMLButtonElement);

      expect(acoes.map((a) => a.textContent?.trim())).toEqual(
        PROCESSOS_FICTICIOS.map(() => 'Abrir acompanhamento'),
      );
      expect(acoes.map((a) => a.getAttribute('aria-label'))).toEqual(
        PROCESSOS_FICTICIOS.map((p) => `Abrir acompanhamento de ${p.nome}`),
      );
    });

    it('comunica o identificador do processo escolhido', () => {
      const abertos: string[] = [];
      painel.componente.abrir.subscribe((id) => abertos.push(id));

      (painel.cartoes()[1].querySelector('button') as HTMLButtonElement).click();

      expect(abertos).toEqual(['processo-ficticio-2']);
    });

    it('não abre um cartão da página sendo substituída durante a recarga (ADR-0026)', () => {
      const abertos: string[] = [];
      painel.componente.abrir.subscribe((id) => abertos.push(id));
      const acao = painel.cartoes()[1].querySelector('button') as HTMLButtonElement;

      painel.entrada('carregando', true);
      acao.click();

      expect(abertos).toEqual([]);
      expect(acao.getAttribute('aria-disabled')).toBe('true');
    });

    it('não apresenta total global nem mensagem de lista vazia', () => {
      expect(painel.texto()).not.toMatch(/total|\d+ processos/i);
      expect(painel.texto()).not.toContain('Nenhum processo seletivo encontrado');
    });

    it('apresenta o rodapé compartilhado com tamanho inicial de 50', () => {
      const seletor = painel
        .host()
        .querySelector<HTMLSelectElement>('select[data-pager="page-size"]');

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
      painel.entrada('processos', PROCESSOS_FICTICIOS);
      painel.entrada('temAnterior', true);
      painel.entrada('temProxima', true);
    });

    it('comunica cada botão pela sua própria saída', () => {
      const emitidos = painel.emissoesDaNavegacao();

      painel.host().querySelector<HTMLButtonElement>('[data-pager="prev"]')?.click();
      expect(emitidos).toEqual(['anterior']);

      painel.host().querySelector<HTMLButtonElement>('[data-pager="next"]')?.click();
      expect(emitidos).toEqual(['anterior', 'proxima']);
    });

    it('comunica a alteração do tamanho da página', () => {
      const tamanhos: number[] = [];
      painel.componente.tamanhoDePaginaChange.subscribe((n) => tamanhos.push(n));
      const seletor = painel
        .host()
        .querySelector('select[data-pager="page-size"]') as HTMLSelectElement;

      seletor.value = '25';
      seletor.dispatchEvent(new Event('change'));

      expect(tamanhos).toEqual([25]);
    });

    it('sem página anterior, só Próximo comunica', () => {
      const emitidos = painel.emissoesDaNavegacao();
      painel.entrada('temAnterior', false);

      painel.host().querySelector<HTMLButtonElement>('[data-pager="prev"]')?.click();
      painel.host().querySelector<HTMLButtonElement>('[data-pager="next"]')?.click();

      expect(emitidos).toEqual(['proxima']);
    });

    it('sem próxima página, só Anterior comunica', () => {
      const emitidos = painel.emissoesDaNavegacao();
      painel.entrada('temProxima', false);

      painel.host().querySelector<HTMLButtonElement>('[data-pager="prev"]')?.click();
      painel.host().querySelector<HTMLButtonElement>('[data-pager="next"]')?.click();

      expect(emitidos).toEqual(['anterior']);
    });

    it('impede repetir as ações de consulta durante o carregamento', () => {
      const emitidos = painel.emissoesDaNavegacao();
      painel.componente.tamanhoDePaginaChange.subscribe(() => emitidos.push('tamanho'));
      painel.entrada('carregando', true);

      painel.host().querySelector<HTMLButtonElement>('[data-pager="prev"]')?.click();
      painel.host().querySelector<HTMLButtonElement>('[data-pager="next"]')?.click();
      const seletor = painel
        .host()
        .querySelector('select[data-pager="page-size"]') as HTMLSelectElement;
      seletor.value = '10';
      seletor.dispatchEvent(new Event('change'));

      expect(emitidos).toEqual([]);
    });
  });

  describe('carregamento inicial', () => {
    beforeEach(() => painel.entrada('carregando', true));

    it('sinaliza a espera sem apresentar lista vazia', () => {
      expect(painel.avisoDeEspera()).toContain('Carregando processos seletivos');
      expect(painel.texto()).not.toContain('Nenhum processo seletivo encontrado');
      expect(painel.host().querySelector('.pager')).toBeNull();
    });
  });

  describe('atualização de página em andamento', () => {
    it('mantém os cartões e sinaliza a espera', () => {
      painel.entrada('processos', PROCESSOS_FICTICIOS);
      const regiao = painel.regiaoDeStatus();
      expect(regiao).not.toBeNull();
      expect(painel.avisoDeEspera()).toBe('');

      painel.entrada('carregando', true);

      expect(painel.cartoes()).toHaveLength(3);
      expect(painel.regiaoDeStatus()).toBe(regiao);
      expect(painel.avisoDeEspera()).toContain('Carregando processos seletivos');
      expect(regiao?.closest('[aria-busy="true"]')).toBeNull();
      expect(painel.host().querySelector('.painel__cartoes')?.getAttribute('aria-busy')).toBe(
        'true',
      );
    });
  });

  describe('resultado vazio', () => {
    it('apresenta a mensagem de lista vazia', () => {
      painel.fixture.detectChanges();

      expect(painel.texto()).toContain('Nenhum processo seletivo encontrado');
      expect(painel.cartoes()).toHaveLength(0);
    });

    it('substitui os cartões anteriores quando a nova lista chega vazia', () => {
      painel.entrada('processos', PROCESSOS_FICTICIOS);
      expect(painel.cartoes()).toHaveLength(3);

      painel.entrada('processos', []);

      expect(painel.cartoes()).toHaveLength(0);
      expect(painel.texto()).toContain('Nenhum processo seletivo encontrado');
    });
  });

  describe('nomes longos', () => {
    it('mantém o nome e a ação no mesmo cartão', () => {
      painel.entrada('processos', [PROCESSO_FICTICIO_DE_NOME_LONGO, ...PROCESSOS_FICTICIOS]);

      const [primeiro] = painel.cartoes();
      expect(primeiro.querySelector('h2')?.textContent).toContain(
        PROCESSO_FICTICIO_DE_NOME_LONGO.nome,
      );
      expect(primeiro.querySelector('button')?.getAttribute('aria-label')).toBe(
        `Abrir acompanhamento de ${PROCESSO_FICTICIO_DE_NOME_LONGO.nome}`,
      );
    });
  });
});
