import { describe, expect, it } from 'vitest';

import { umaFaseDoCronograma } from '../../shared/fase-do-cronograma.testing';
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
const FALHA_DO_SERVIDOR = { status: 500, statusText: 'Internal Server Error' };

describe('CronogramaPassoComponent: as fases que o servidor tem depois de uma gravação que falha na última chamada', () => {
  let tela: ContextoDoCronograma;
  usarCronograma((contexto) => {
    tela = contexto;
  });

  function comOServidorTendo(...ids: readonly string[]): void {
    const fases = ids.map((id, indice) =>
      umaFaseDoCronograma({ faseCanonicaId: id, ordem: indice + 1 }),
    );
    tela.fasesNoServidor.registrarGravadas(fases);
  }

  /** A primeira chamada acusa o ciclo de ordem, a intermediária é confirmada e a última falha. */
  async function gravarComFalhaNaUltimaChamada(): Promise<void> {
    tela.store.processoSeletivoId.set(PROCESSO_ID);
    tela.comUmaEtapa();
    const gravacao = tela.componente.persistir();
    tela.controller.expectOne(ROTA_FASES).flush(CICLO_DE_ORDEM, {
      status: 422,
      statusText: 'Unprocessable Content',
      headers: PROBLEM_JSON,
    });
    await tela.proximoPasso();
    tela.controller.expectOne(ROTA_FASES).flush(null, SEM_CONTEUDO);
    await tela.proximoPasso();
    tela.controller.expectOne(ROTA_FASES).flush(null, FALHA_DO_SERVIDOR);
    await expect(gravacao).resolves.toMatchObject({ valid: false });
  }

  it('passa a ter a fase incluída que a chamada intermediária gravou', async () => {
    comOServidorTendo(ID_AVALIACAO);
    tela.comFases(ID_AVALIACAO, ID_INSCRICAO);

    await gravarComFalhaNaUltimaChamada();

    expect([...tela.fasesNoServidor.origens()]).toEqual([ID_AVALIACAO, ID_INSCRICAO]);
  });

  it('deixa de ter a fase removida que a chamada intermediária apagou', async () => {
    comOServidorTendo(ID_AVALIACAO, ID_INSCRICAO);
    tela.comFases(ID_AVALIACAO);

    await gravarComFalhaNaUltimaChamada();

    expect([...tela.fasesNoServidor.origens()]).toEqual([ID_AVALIACAO]);
  });

  it('mantém as fases que o servidor tinha quando a primeira chamada falha', async () => {
    comOServidorTendo(ID_AVALIACAO);
    tela.comFases(ID_AVALIACAO, ID_INSCRICAO);
    tela.store.processoSeletivoId.set(PROCESSO_ID);
    tela.comUmaEtapa();

    const gravacao = tela.componente.persistir();
    tela.controller.expectOne(ROTA_FASES).flush(null, FALHA_DO_SERVIDOR);

    await expect(gravacao).resolves.toMatchObject({ valid: false });
    expect([...tela.fasesNoServidor.origens()]).toEqual([ID_AVALIACAO]);
  });
});
