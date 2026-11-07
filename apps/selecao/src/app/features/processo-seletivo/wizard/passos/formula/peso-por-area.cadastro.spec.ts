import { config as configDoRxjs, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  AREAS_DO_CADASTRO,
  BASE,
  PESOS,
  RESOLUCAO,
  ROTA_AREAS,
  ROTA_PESOS,
  SELETOR_RESOLUCAO,
  TECNOLOGICA,
  botao,
  montarSecao,
  catalogos,
  concedidas,
  encerrarMontagem,
  escolherNoSeletor,
  falharPesos,
  linha,
  marcarEnemComMediaPonderada,
  responderPesos,
  seletor,
  texto,
} from './peso-por-area.testing';
describe('PesoPorAreaComponent — cadastro de Peso por Área', () => {
  afterEach(encerrarMontagem);

  describe('rótulo, link e lista do cadastro', () => {
    it('liga o seletor ao próprio rótulo e à dica', async () => {
      const m = await montarSecao();
      marcarEnemComMediaPonderada(m);
      responderPesos(m);

      expect(texto(m.el.querySelector('label[for="f-resolucao-peso-area"]'))).toBe(
        'Resolução de Peso por Área',
      );
      expect(seletor(m).getAttribute('aria-describedby')).toBe('f-resolucao-peso-area-dica');
    });

    it('aponta o cadastro de Peso por Área no mesmo host quando o ambiente não declara a origem', async () => {
      const m = await montarSecao();
      marcarEnemComMediaPonderada(m);
      responderPesos(m);

      const link = m.el.querySelector<HTMLAnchorElement>('#f-resolucao-peso-area-dica a');
      expect(link?.getAttribute('href')).toBe('/configuracao/pesos-por-area');
      expect(link?.getAttribute('target')).toBe('_blank');
      expect(link?.getAttribute('rel')).toBe('noopener');
      expect(texto(link)).toBe('Abrir o cadastro de Peso por Área (abre em nova aba)');
    });

    it('usa a origem do app da Configuração que o ambiente declara', async () => {
      const m = await montarSecao({
        config: {
          apiUrl: BASE,
          configuracaoWebUrl: 'http://localhost:4203',
          oidc: { issuerUrl: 'http://localhost:8080/realms/unifesspa', clientId: 'selecao-web' },
        },
      });
      marcarEnemComMediaPonderada(m);
      responderPesos(m);

      expect(m.el.querySelector('#f-resolucao-peso-area-dica a')?.getAttribute('href')).toBe(
        'http://localhost:4203/pesos-por-area',
      );
    });

    it('sem a permissão de manter peso por área, não oferece o link e diz quem cadastra as resoluções', async () => {
      concedidas.set([]);
      const m = await montarSecao();
      marcarEnemComMediaPonderada(m);
      responderPesos(m);

      expect(m.el.querySelector('#f-resolucao-peso-area-dica a')).toBeNull();
      expect(texto(m.el.querySelector('#f-resolucao-peso-area-dica'))).toContain(
        'As resoluções são cadastradas pela administração da plataforma.',
      );
    });

    it('com uma leitura em curso, "Atualizar lista" parece e age como indisponível', async () => {
      const m = await montarSecao();
      marcarEnemComMediaPonderada(m);
      responderPesos(m);
      botao(m, 'Atualizar lista')?.click();
      m.fixture.detectChanges();
      responderPesos(m);
      catalogos().recarregarPesosAreaEnem(m.store.classificacao.versaoLida());
      m.fixture.detectChanges();

      const atualizar = botao(m, 'Atualizar lista');
      expect(atualizar?.getAttribute('aria-disabled')).toBe('true');
      atualizar?.click();
      m.fixture.detectChanges();

      // O clique não pediu outra leitura nem apagou o anúncio da anterior.
      expect(m.controller.match((r) => r.url.endsWith(ROTA_PESOS))).toHaveLength(1);
      expect(texto(m.el.querySelector('#f-resolucao-peso-area-lista'))).toBe(
        'Lista de resoluções de Peso por Área atualizada.',
      );
      m.controller.match((r) => r.url.endsWith(ROTA_AREAS)).forEach((r) => r.flush([]));
    });

    it('"Atualizar lista" relê o cadastro e traz a resolução criada na outra aba', async () => {
      const m = await montarSecao();
      marcarEnemComMediaPonderada(m);
      responderPesos(m);

      botao(m, 'Atualizar lista')?.click();
      m.fixture.detectChanges();
      responderPesos(m, [...PESOS, linha('Resolução criada agora', TECNOLOGICA, [])]);

      const opcoes = Array.from(
        m.el.querySelectorAll(`${SELETOR_RESOLUCAO} option`) as NodeListOf<HTMLOptionElement>,
      ).map(texto);
      expect(opcoes).toContain('Resolução criada agora');
      expect(texto(m.el.querySelector('#f-resolucao-peso-area-lista'))).toBe(
        'Lista de resoluções de Peso por Área atualizada.',
      );
    });

    it('"Atualizar lista" tira a recusa guardada, que o servidor julga de novo na próxima gravação', async () => {
      const m = await montarSecao();
      marcarEnemComMediaPonderada(m);
      responderPesos(m);
      escolherNoSeletor(m, RESOLUCAO);
      m.store.classificacao.recusaDaResolucaoPesoAreaEnem.set('A resolução estava incompleta.');
      m.fixture.detectChanges();

      botao(m, 'Atualizar lista')?.click();
      m.fixture.detectChanges();
      responderPesos(m);

      expect(m.store.classificacao.recusaDaResolucaoPesoAreaEnem()).toBeNull();
      expect(seletor(m).getAttribute('aria-invalid')).toBeNull();
    });
  });

  describe('falha do cadastro de Peso por Área', () => {
    it('mantém o alerta durante a nova tentativa e o tira quando a lista chega', async () => {
      const m = await montarSecao();
      marcarEnemComMediaPonderada(m);
      falharPesos(m);

      const tentar = botao(m, 'Tentar novamente');
      expect(texto(m.el.querySelector('[role="alert"]'))).toContain(
        'Não foi possível carregar o cadastro de Peso por Área',
      );
      tentar?.focus();
      tentar?.click();
      m.fixture.detectChanges();

      expect(tentar?.isConnected).toBe(true);
      expect(tentar?.getAttribute('aria-disabled')).toBe('true');
      expect(tentar?.getAttribute('aria-busy')).toBe('true');

      responderPesos(m);
      await m.fixture.whenStable();

      expect(m.el.querySelector('[role="alert"]')).toBeNull();
    });

    it('a nova tentativa que termina com o passo já desmontado não tenta focar', async () => {
      const m = await montarSecao();
      marcarEnemComMediaPonderada(m);
      falharPesos(m);
      botao(m, 'Tentar novamente')?.click();
      m.fixture.detectChanges();
      const erroNaoTratado = vi.fn();
      const anterior = configDoRxjs.onUnhandledError;
      configDoRxjs.onUnhandledError = erroNaoTratado;

      try {
        m.fixture.destroy();
        m.controller.expectOne((r) => r.url.endsWith(ROTA_PESOS)).flush([...PESOS]);
        m.controller
          .match((r) => r.url.endsWith(ROTA_AREAS))
          .forEach((r) => r.flush([...AREAS_DO_CADASTRO]));
        await new Promise((resolve) => setTimeout(resolve));
      } finally {
        configDoRxjs.onUnhandledError = anterior;
      }

      expect(erroNaoTratado).not.toHaveBeenCalled();
    });

    it('trata o erro que escapa do envelope da API como falha, com nova tentativa', async () => {
      const m = await montarSecao({
        pesosApi: {
          listar: () => throwError(() => new Error('falha fora do envelope')),
          listarAreas: () => throwError(() => new Error('falha fora do envelope')),
        },
      });
      marcarEnemComMediaPonderada(m);

      expect(catalogos().pesosCarregando()).toBe(false);
      expect(botao(m, 'Tentar novamente')).toBeTruthy();
    });
  });
});
