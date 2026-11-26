import { expect, it } from 'vitest';

import {
  EDICOES_DA_REGRA_DO_SERVIDOR,
  REGRA_DE_HOMOLOGACAO_DO_SERVIDOR,
} from '../../shared/homologacao/regra-de-homologacao.testing';
import { regraDoDto } from '../../shared/homologacao/regra-de-homologacao-contrato';
import {
  CICLO_DE_ORDEM,
  ID_AVALIACAO,
  ID_INSCRICAO,
  PROBLEM_JSON,
  PROCESSO_ID,
  ROTA_FASES,
} from './cronograma.testing';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';

const SEM_CONTEUDO = { status: 204, statusText: 'No Content' };
const REGRA = regraDoDto(REGRA_DE_HOMOLOGACAO_DO_SERVIDOR);

describe('CronogramaPassoComponent: a regra de homologação na gravação', () => {
  let componente: ContextoDoCronograma['componente'];
  let cronograma: ContextoDoCronograma['cronograma'];
  let store: ContextoDoCronograma['store'];
  let controller: ContextoDoCronograma['controller'];
  let detectar: ContextoDoCronograma['detectar'];
  let proximoPasso: ContextoDoCronograma['proximoPasso'];
  let gravouEtapas: ContextoDoCronograma['gravouEtapas'];
  let gravouExigencias: ContextoDoCronograma['gravouExigencias'];
  let comFases: ContextoDoCronograma['comFases'];
  let comUmaEtapa: ContextoDoCronograma['comUmaEtapa'];

  usarCronograma((tela) => {
    ({
      componente,
      cronograma,
      store,
      controller,
      detectar,
      proximoPasso,
      gravouEtapas,
      gravouExigencias,
      comFases,
      comUmaEtapa,
    } = tela);
  });

  const regrasDoCorpo = (corpo: unknown): unknown[] =>
    (corpo as { regraDeHomologacao: unknown }[]).map((fase) => fase.regraDeHomologacao);

  /** As fases do rascunho, todas com a regra declarada, como o servidor as devolveu. */
  function comAsFasesComRegra(...ids: readonly string[]): void {
    comFases(...ids);
    const fases = store.draft().cronograma.fases.map((fase) => ({
      ...fase,
      regraDeHomologacao: REGRA,
    }));
    store.patchObjectSection('classificacao', { edicoesEnem: [...EDICOES_DA_REGRA_DO_SERVIDOR] });
    store.patchObjectSection('cronograma', { fases });
    detectar();
  }

  it('grava a mudança só da data da fase levando a regra como estava', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comAsFasesComRegra(ID_AVALIACAO);
    comUmaEtapa();
    cronograma.fases.at(0).controls.inicio.setValue('2026-03-05T09:30');

    const gravacao = componente.persistir();

    const pedido = controller.expectOne(ROTA_FASES);
    expect(regrasDoCorpo(pedido.request.body)).toStrictEqual([REGRA_DE_HOMOLOGACAO_DO_SERVIDOR]);
    pedido.flush(null, SEM_CONTEUDO);
    await proximoPasso();
    await gravouEtapas();
    await gravouExigencias();
    await expect(gravacao).resolves.toEqual({ valid: true });
  });

  it('leva a regra de cada fase, e só das que a declaram', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comAsFasesComRegra(ID_AVALIACAO, ID_INSCRICAO);
    const [primeira, segunda] = store.draft().cronograma.fases;
    store.patchObjectSection('cronograma', {
      fases: [primeira, { ...segunda, regraDeHomologacao: null }],
    });
    detectar();
    comUmaEtapa();

    const gravacao = componente.persistir();

    const pedido = controller.expectOne(ROTA_FASES);
    expect(regrasDoCorpo(pedido.request.body)).toStrictEqual([
      REGRA_DE_HOMOLOGACAO_DO_SERVIDOR,
      null,
    ]);
    pedido.flush(null, SEM_CONTEUDO);
    await proximoPasso();
    await gravouEtapas();
    await gravouExigencias();
    await expect(gravacao).resolves.toEqual({ valid: true });
  });

  it('leva a regra nas três chamadas que resolvem o ciclo de ordem', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comAsFasesComRegra(ID_AVALIACAO, ID_INSCRICAO);
    comUmaEtapa();
    const regras = [REGRA_DE_HOMOLOGACAO_DO_SERVIDOR, REGRA_DE_HOMOLOGACAO_DO_SERVIDOR];

    const gravacao = componente.persistir();

    const pretendida = controller.expectOne(ROTA_FASES);
    expect(regrasDoCorpo(pretendida.request.body)).toStrictEqual(regras);
    pretendida.flush(CICLO_DE_ORDEM, {
      status: 422,
      statusText: 'Unprocessable Content',
      headers: PROBLEM_JSON,
    });
    await proximoPasso();
    const intermediaria = controller.expectOne(ROTA_FASES);
    expect(regrasDoCorpo(intermediaria.request.body)).toStrictEqual(regras);
    intermediaria.flush(null, SEM_CONTEUDO);
    await proximoPasso();
    const final = controller.expectOne(ROTA_FASES);
    expect(regrasDoCorpo(final.request.body)).toStrictEqual(regras);
    final.flush(null, SEM_CONTEUDO);
    await proximoPasso();
    await gravouEtapas();
    await gravouExigencias();
    await expect(gravacao).resolves.toEqual({ valid: true });
  });
});
