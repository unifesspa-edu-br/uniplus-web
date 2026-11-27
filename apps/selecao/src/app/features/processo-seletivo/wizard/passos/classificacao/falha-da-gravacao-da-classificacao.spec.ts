import { describe, expect, it } from 'vitest';

import {
  PROCESSO_ID,
  ROTA_CLASSIFICACAO,
  ROTA_DETALHE,
  aguardarReleitura,
  componente,
  controller,
  montarEliminacao,
  prepararClassificacaoLocal,
  store,
} from '../eliminacao/eliminacao.testing';
import {
  falharPorRede,
  prepararClassificacaoLocalComResolucao,
} from './recusa-da-gravacao.testing';

describe('falha na gravação da classificação', () => {
  montarEliminacao();

  it('falha inconclusiva, mesmo sem resolução, deixa a classificação gravada desconhecida até a releitura', async () => {
    prepararClassificacaoLocal();

    const gravacao = componente.persistir();
    falharPorRede(ROTA_CLASSIFICACAO);
    await aguardarReleitura();

    // O servidor pode ter gravado a classificação sem quadro, ou não ter gravado nada.
    expect(store.classificacao.gravada()).toEqual({ estado: 'desconhecida' });
    controller.expectOne(ROTA_DETALHE).flush({ id: PROCESSO_ID, classificacao: null });
    await gravacao;
    expect(store.classificacao.gravada()).toEqual({ estado: 'nunca-gravada' });
  });

  it('falha inconclusiva: o servidor pode ter gravado, e o quadro fica desconhecido se a releitura também falha', async () => {
    prepararClassificacaoLocalComResolucao();

    const gravacao = componente.persistir();
    falharPorRede(ROTA_CLASSIFICACAO);
    await aguardarReleitura();
    falharPorRede(ROTA_DETALHE);

    expect((await gravacao).valid).toBe(false);
    expect(store.classificacao.motivoDaReleitura()).toBe('desconhecida');
  });

  it('preserva o rascunho quando a API recusa', async () => {
    prepararClassificacaoLocal();
    const gravacao = componente.persistir();

    controller.expectOne(ROTA_CLASSIFICACAO).flush(
      {
        type: 'about:blank',
        title: 'Regra não encontrada.',
        status: 422,
        code: 'ConfiguracaoClassificacao.RegraNaoEncontrada',
        traceId: 'trace-1',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    const resultado = await gravacao;
    expect(resultado.valid).toBe(false);
    expect(store.draft().classificacao.regraCalculoCodigo).toBe('FORMULA_MEDIA_PONDERADA');
    expect(store.salvando()).toBe(false);
  });
});
