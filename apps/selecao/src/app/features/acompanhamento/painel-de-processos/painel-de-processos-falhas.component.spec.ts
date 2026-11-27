import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  PROCESSOS_FICTICIOS,
  montarPainel,
  type PainelEmTeste,
} from './painel-de-processos.testing';

describe('PainelDeProcessosComponent: falhas e restrições', () => {
  let painel: PainelEmTeste;

  beforeEach(() => {
    painel = montarPainel();
  });

  describe('falha inicial', () => {
    beforeEach(() => painel.entrada('falha', 'inicial'));

    it('informa a falha e oferece nova tentativa, sem lista vazia', () => {
      expect(painel.texto()).toContain('Não foi possível carregar os processos seletivos');
      expect(painel.botao('Tentar novamente')).toBeDefined();
      expect(painel.texto()).not.toContain('Nenhum processo seletivo encontrado');
    });

    it('comunica a nova tentativa uma só vez e mantém o foco durante a espera', () => {
      let tentativas = 0;
      painel.componente.tentarNovamente.subscribe(() => tentativas++);

      painel.esperaSemReenviar('Tentar novamente', () => tentativas);
    });
  });

  describe('falha de navegação', () => {
    beforeEach(() => {
      painel.entrada('processos', PROCESSOS_FICTICIOS);
      painel.entrada('temProxima', true);
      painel.entrada('falha', 'navegacao');
    });

    it('mantém os cartões da última página válida, com aviso e nova tentativa', () => {
      expect(painel.cartoes()).toHaveLength(3);
      expect(painel.host().querySelector('[role="alert"]')).not.toBeNull();
      expect(painel.botao('Tentar novamente')).toBeDefined();
      expect(painel.host().querySelector('.pager')).not.toBeNull();
    });

    it('comunica a nova tentativa uma só vez e mantém foco e cartões durante a espera', () => {
      let tentativas = 0;
      painel.componente.tentarNovamente.subscribe(() => tentativas++);

      painel.esperaSemReenviar('Tentar novamente', () => tentativas);

      expect(painel.cartoes()).toHaveLength(3);
    });
  });

  describe.each([
    { falha: 'inicial', titulo: 'Não foi possível carregar os processos seletivos' },
    { falha: 'navegacao', titulo: 'Não foi possível carregar a outra página' },
  ] as const)('nova tentativa após a falha $falha', ({ falha, titulo }) => {
    const macrotarefa = (): Promise<void> => new Promise((resolver) => setTimeout(resolver));
    const situacao = (): string =>
      painel.host().querySelector('ui-situacao-da-nova-tentativa')?.textContent?.trim() ?? '';

    async function estabilizar(): Promise<void> {
      await macrotarefa();
      await painel.fixture.whenStable();
      painel.fixture.detectChanges();
    }

    /** Como quem consulta: ao recomeçar, apaga a falha e marca o carregamento. */
    async function tentarNovamenteApagandoAFalha(): Promise<HTMLButtonElement> {
      painel.componente.tentarNovamente.subscribe(() => {
        painel.fixture.componentRef.setInput('falha', null);
        painel.fixture.componentRef.setInput('carregando', true);
      });
      const acao = painel.botao('Tentar novamente') as HTMLButtonElement;
      acao.focus();
      acao.click();
      await estabilizar();
      return acao;
    }

    beforeEach(() => {
      document.body.append(painel.host());
      painel.entrada('processos', falha === 'navegacao' ? PROCESSOS_FICTICIOS : []);
      painel.entrada('falha', falha);
    });

    afterEach(() => painel.host().remove());

    it('mantém o aviso, o botão focado e o anúncio enquanto a falha está apagada', async () => {
      const acao = await tentarNovamenteApagandoAFalha();

      expect(painel.texto()).toContain(titulo);
      expect(painel.botao('Tentar novamente')).toBe(acao);
      expect(document.activeElement).toBe(acao);
      expect(situacao()).toBe('Tentando novamente…');
      expect(painel.avisoDeEspera()).toContain('Carregando processos seletivos');
    });

    it('ao dar certo, tira o aviso e leva o foco ao título', async () => {
      await tentarNovamenteApagandoAFalha();

      painel.entrada('processos', PROCESSOS_FICTICIOS);
      painel.entrada('carregando', false);
      await estabilizar();

      expect(painel.texto()).not.toContain(titulo);
      expect(painel.botao('Tentar novamente')).toBeUndefined();
      expect(document.activeElement).toBe(painel.host().querySelector('h1'));
    });

    it('ao falhar de novo, mantém o aviso e o botão focado, com a nova falha anunciada', async () => {
      const acao = await tentarNovamenteApagandoAFalha();

      // Quem consulta grava o desfecho de uma vez: carregamento encerrado e falha de volta.
      painel.fixture.componentRef.setInput('carregando', false);
      painel.fixture.componentRef.setInput('falha', falha);
      await estabilizar();

      expect(painel.texto()).toContain(titulo);
      expect(painel.botao('Tentar novamente')).toBe(acao);
      expect(document.activeElement).toBe(acao);
      expect(situacao()).toBe('A nova tentativa também falhou.');
    });
  });

  describe('cursor expirado', () => {
    beforeEach(() => {
      painel.entrada('processos', PROCESSOS_FICTICIOS);
      painel.entrada('restricao', 'cursor-expirado');
    });

    it('pede a atualização, sem cartões nem paginação', () => {
      expect(painel.texto()).toContain('A lista precisa ser atualizada');
      expect(painel.cartoes()).toHaveLength(0);
      expect(painel.host().querySelector('.pager')).toBeNull();
    });

    it('comunica o reinício uma só vez e mantém o foco durante a espera', () => {
      let reinicios = 0;
      painel.componente.atualizarLista.subscribe(() => reinicios++);

      painel.esperaSemReenviar('Atualizar lista', () => reinicios);
    });
  });

  describe('acesso negado', () => {
    it.each(['inicial', 'navegacao', null])(
      'prevalece sobre a falha %s, sem dados, paginação nem nova tentativa',
      (falha) => {
        painel.entrada('processos', PROCESSOS_FICTICIOS);
        painel.entrada('falha', falha);
        painel.entrada('restricao', 'acesso-negado');
        painel.entrada('carregando', true);

        expect(painel.texto()).toContain('Acesso negado');
        expect(painel.texto()).not.toContain(PROCESSOS_FICTICIOS[0].nome);
        expect(painel.cartoes()).toHaveLength(0);
        expect(painel.host().querySelector('.pager')).toBeNull();
        expect(painel.botao('Tentar novamente')).toBeUndefined();
        expect(painel.botao('Atualizar lista')).toBeUndefined();
        expect(painel.regiaoDeStatus()).toBeNull();
      },
    );
  });
});
