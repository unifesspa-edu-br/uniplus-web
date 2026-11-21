import { afterEach, describe, expect, it } from 'vitest';

import {
  CLASSIFICACAO_COM_QUADRO,
  ROTA_PESOS,
  ROTA_AREAS,
  ERRO_500,
  criterio,
} from './desempate.areas-enem.dados.testing';
import {
  montar,
  responderPendentes,
  classificacaoGravada,
  criterioPorArea,
  seletor,
  opcoesDoSeletor,
  botao,
  acrescentarPelaTela,
  areasNaTela,
  textoDaTela,
  conferirERestaurar,
} from './desempate.areas-enem.montagem.testing';

describe('DesempatePassoComponent — ordem das áreas do ENEM: sem área a oferecer', () => {
  afterEach(conferirERestaurar);

  describe('quando não há área a oferecer', () => {
    it('sem classificação por ENEM com média ponderada, explica e recusa, mas mantém as áreas configuradas à vista e retiráveis', async () => {
      const m = await montar({ classificacao: null });
      m.store.patchSection('desempate', [criterio(['REDACAO'])]);
      m.fixture.detectChanges();
      responderPendentes(m.controller);
      m.fixture.detectChanges();

      expect(seletor(m, 0)).toBeNull();
      expect(textoDaTela(m)).toContain(
        'A nota de área do ENEM só desempata quando a classificação é baseada no ENEM pela média ponderada',
      );
      expect(areasNaTela(m, 0)).toEqual(['1ª Redação']);
      expect(m.componente.validar()).toEqual({
        valid: false,
        messages: [
          'Critério de desempate 1: a nota de área do ENEM só desempata quando a classificação é baseada no ENEM pela média ponderada, com a resolução de Peso por Área escolhida no passo Fórmula.',
        ],
      });

      botao(m, 'desemp-area-remover-0-0').click();
      m.fixture.detectChanges();
      expect(m.componente.criterios()[0].areas).toEqual([]);
    });

    it('sem a resolução escolhida, aponta o passo Fórmula em vez de dizer que as áreas acabaram', async () => {
      const m = await montar({
        classificacao: { ...CLASSIFICACAO_COM_QUADRO, resolucaoPesoAreaEnem: '' },
      });
      criterioPorArea(m);

      expect(seletor(m, 0)).toBeNull();
      expect(textoDaTela(m)).toContain('Escolha a resolução de Peso por Área no passo Fórmula');
      expect(textoDaTela(m)).not.toContain('Todas as áreas do quadro já estão na ordem');
      expect(m.componente.validar()).toEqual({
        valid: false,
        messages: [
          'Critério de desempate 1: escolha a resolução de Peso por Área no passo Fórmula: as áreas que o desempate pode citar vêm do quadro dela.',
        ],
      });
    });

    it('enquanto o cadastro é lido, diz que está carregando', async () => {
      const m = await montar({ semResponderPesos: true });
      criterioPorArea(m);

      expect(seletor(m, 0)).toBeNull();
      expect(textoDaTela(m)).toContain('Carregando as áreas do cadastro de Peso por Área');

      responderPendentes(m.controller);
      m.fixture.detectChanges();
      expect(opcoesDoSeletor(m, 0)).toEqual(['Redação', 'Matemática']);
    });

    it('com a leitura do cadastro falhando, mostra a falha e lê de novo pelo "Tentar novamente"', async () => {
      const m = await montar({ semResponderPesos: true });
      m.controller
        .expectOne((r) => r.url.endsWith(ROTA_PESOS))
        .flush(ERRO_500.corpo, ERRO_500.opcoes);
      criterioPorArea(m);

      expect(seletor(m, 0)).toBeNull();
      expect(m.el.querySelector('[role="alert"]')?.textContent).toContain(
        'Não foi possível carregar o cadastro de Peso por Área',
      );

      m.store.classificacao.recusaDaResolucaoPesoAreaEnem.set('Recusa do cadastro anterior.');
      const tentar = botao(m, 'desemp-areas-tentar');
      tentar.focus();
      tentar.click();
      responderPendentes(m.controller);
      m.fixture.detectChanges();
      await m.fixture.whenStable();

      expect(opcoesDoSeletor(m, 0)).toEqual(['Redação', 'Matemática']);
      expect(m.store.classificacao.recusaDaResolucaoPesoAreaEnem()).toBeNull();
    });

    it('"Tentar novamente" mantém o alerta, com o botão focado, enquanto a nova leitura corre e se ela falhar de novo', async () => {
      const m = await montar({ semResponderPesos: true });
      m.controller
        .expectOne((r) => r.url.endsWith(ROTA_PESOS))
        .flush(ERRO_500.corpo, ERRO_500.opcoes);
      criterioPorArea(m);

      const tentar = botao(m, 'desemp-areas-tentar');
      tentar.focus();
      tentar.click();
      m.fixture.detectChanges();

      expect(m.el.querySelector('#desemp-areas-tentar')).toBe(tentar);
      expect(document.activeElement).toBe(tentar);

      m.controller
        .expectOne((r) => r.url.endsWith(ROTA_PESOS))
        .flush(ERRO_500.corpo, ERRO_500.opcoes);
      m.fixture.detectChanges();

      expect(m.el.querySelector('#desemp-areas-tentar')).toBe(tentar);
      expect(document.activeElement).toBe(tentar);
      expect(m.el.querySelector('[role="alert"]')).not.toBeNull();
    });

    it('com dois critérios por área, avisa a falha uma vez só no passo', async () => {
      const m = await montar({ semResponderPesos: true });
      m.controller
        .expectOne((r) => r.url.endsWith(ROTA_PESOS))
        .flush(ERRO_500.corpo, ERRO_500.opcoes);
      criterioPorArea(m);
      criterioPorArea(m);

      expect(m.el.querySelectorAll('[role="alert"]')).toHaveLength(1);
      expect(m.el.querySelectorAll('#desemp-areas-tentar')).toHaveLength(1);
      // Cada critério aponta para o aviso, sem repeti-lo.
      expect(m.el.querySelector('#desemp-areas-dica-1')?.textContent).toContain(
        'Veja o aviso no início do passo',
      );
    });

    it('pede a lista canônica das áreas uma vez só, mesmo quando dois motivos a pedem', async () => {
      let pedidosDaLista = 0;
      await montar({
        classificacao: { ...CLASSIFICACAO_COM_QUADRO, resolucaoPesoAreaEnem: '' },
        antesDeMontar: (store) => store.patchSection('desempate', [criterio(['REDACAO'])]),
        antesDeResponder: (controller) => {
          pedidosDaLista = controller.match((r) => r.url.endsWith(ROTA_AREAS)).length;
        },
      });

      expect(pedidosDaLista).toBe(1);
    });

    it('só diz que todas as áreas estão na ordem quando elas estão', async () => {
      const m = await montar();
      criterioPorArea(m);
      acrescentarPelaTela(m, 0, 'REDACAO');
      acrescentarPelaTela(m, 0, 'MATEMATICA');

      expect(seletor(m, 0)?.disabled).toBe(true);
      expect(seletor(m, 0)?.options[0].textContent?.trim()).toBe(
        'Todas as áreas do quadro já estão na ordem',
      );
    });

    it('com as áreas que faltam num critério citadas por outros, diz isso, e não que todas estão nele', async () => {
      const m = await montar();
      criterioPorArea(m);
      acrescentarPelaTela(m, 0, 'REDACAO');
      criterioPorArea(m);
      acrescentarPelaTela(m, 1, 'MATEMATICA');

      expect(seletor(m, 0)?.options[0].textContent?.trim()).toBe(
        'As demais áreas do quadro já estão em outros critérios',
      );
      expect(seletor(m, 1)?.options[0].textContent?.trim()).toBe(
        'As demais áreas do quadro já estão em outros critérios',
      );
    });

    it('com a leitura do cadastro em falha, as áreas citadas ainda saem pelo nome', async () => {
      const m = await montar({
        semResponderPesos: true,
        antesDeMontar: (store) => store.patchSection('desempate', [criterio(['REDACAO'])]),
      });
      m.controller
        .expectOne((r) => r.url.endsWith(ROTA_PESOS))
        .flush(ERRO_500.corpo, ERRO_500.opcoes);
      m.fixture.detectChanges();

      expect(areasNaTela(m, 0)).toEqual(['1ª Redação']);
    });

    it('a lista canônica que falhou é pedida de novo na leitura seguinte da classificação', async () => {
      const m = await montar({
        classificacao: null,
        antesDeMontar: (store) => store.patchSection('desempate', [criterio(['REDACAO'])]),
        antesDeResponder: (controller) => {
          controller
            .expectOne((r) => r.url.endsWith(ROTA_AREAS))
            .flush(ERRO_500.corpo, ERRO_500.opcoes);
        },
      });
      expect(areasNaTela(m, 0)).toEqual(['1ª REDACAO']);

      classificacaoGravada(null, [])(m.store);
      m.fixture.detectChanges();
      responderPendentes(m.controller);
      m.fixture.detectChanges();

      expect(areasNaTela(m, 0)).toEqual(['1ª Redação']);
    });
  });
});
