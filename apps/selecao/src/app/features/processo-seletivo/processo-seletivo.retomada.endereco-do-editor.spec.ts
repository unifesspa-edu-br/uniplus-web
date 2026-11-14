import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { EditorRouteReuseStrategy, ROTA_REUSE_KEY } from '../../editor-route-reuse.strategy';
import { PROCESSO_SELETIVO_ROUTES } from './processo-seletivo.routes';
import {
  PROCESSO_ID,
  MONTAGEM_LENTA,
  montar,
  propagar,
} from './processo-seletivo.retomada.testing';

describe('ProcessoSeletivoPage — endereço do editor', MONTAGEM_LENTA, () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('não lê detalhe algum em /novo', async () => {
    const cenario = montar({ id: null });
    await propagar();

    expect(cenario.obter).not.toHaveBeenCalled();
    expect(cenario.store.falhaDeLeitura()).toBeNull();
    expect(cenario.store.processoSeletivoId()).toBeNull();
  });

  /**
   * Sem isto, recarregar `/novo` depois de criado perderia o vínculo e
   * o passo 2 dispararia um segundo POST para o mesmo rascunho.
   */
  it('troca o endereço pelo id assim que a criação responde', async () => {
    const cenario = montar({ id: null });
    await propagar();

    cenario.store.processoSeletivoId.set(PROCESSO_ID);
    cenario.fixture.detectChanges();
    await propagar();

    expect(cenario.navigate).toHaveBeenCalledWith(['/processo-seletivo', PROCESSO_ID], {
      replaceUrl: true,
    });
  });

  /**
   * A transição entre `novo` e `:id` não pode recriar a página: a criação
   * acontece no meio do anexo do edital, e uma instância nova voltaria ao passo
   * 1, perderia os campos que só existem no rascunho local e abandonaria o
   * upload em curso. Quem garante isso é a `reuseKey` das duas rotas.
   */
  it('declara as duas rotas do editor como a mesma tela', () => {
    const novo = PROCESSO_SELETIVO_ROUTES.find((r) => r.path === 'novo');
    const porId = PROCESSO_SELETIVO_ROUTES.find((r) => r.path === ':id');
    const estrategia = new EditorRouteReuseStrategy();

    const dataNovo = novo?.data ?? {};
    const dataId = porId?.data ?? {};

    expect(dataNovo[ROTA_REUSE_KEY]).toBeDefined();
    expect(dataNovo[ROTA_REUSE_KEY]).toBe(dataId[ROTA_REUSE_KEY]);

    // `routeConfig` distinto é o que o comportamento padrão usa para recusar o
    // reuso; a chave é o que sobrepõe essa recusa.
    const como = (data: Record<string, unknown>, config: object) =>
      ({ data, routeConfig: config }) as never;
    const configNovo = {};
    const configId = {};

    expect(estrategia.shouldReuseRoute(como(dataNovo, configNovo), como(dataId, configId))).toBe(
      true,
    );
    expect(estrategia.shouldReuseRoute(como({}, configNovo), como({}, configId))).toBe(false);
    expect(
      estrategia.shouldReuseRoute(
        como({ [ROTA_REUSE_KEY]: 'a' }, configNovo),
        como({ [ROTA_REUSE_KEY]: 'b' }, configId),
      ),
    ).toBe(false);
  });

  it('preserva o passo e o rascunho local ao assumir o id', async () => {
    const cenario = montar({ id: null });
    await propagar();

    cenario.store.goTo(1);
    cenario.store.patchObjectSection('identificacao', { nome: 'Em edição' });

    cenario.store.processoSeletivoId.set(PROCESSO_ID);
    cenario.fixture.detectChanges();
    await propagar();

    expect(cenario.store.passoAtual()).toBe(1);
    expect(cenario.store.draft().identificacao.nome).toBe('Em edição');
  });

  it('não renavega quando o id já veio da própria rota', async () => {
    const cenario = montar();
    await propagar();

    cenario.store.processoSeletivoId.set(PROCESSO_ID);
    cenario.fixture.detectChanges();
    await propagar();

    expect(cenario.navigate).not.toHaveBeenCalled();
  });
});
