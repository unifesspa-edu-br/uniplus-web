import { describe, expect, it } from 'vitest';

import { ID_AVALIACAO, ROTA_FASES } from './cronograma.testing';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';

describe('CronogramaPassoComponent: o que a gravação das fases envia', () => {
  let store: ContextoDoCronograma['store'];
  let expansao: ContextoDoCronograma['expansao'];
  let nativo: ContextoDoCronograma['nativo'];
  let controller: ContextoDoCronograma['controller'];
  let componente: ContextoDoCronograma['componente'];
  let detectar: ContextoDoCronograma['detectar'];
  let comFases: ContextoDoCronograma['comFases'];
  let comUmaEtapa: ContextoDoCronograma['comUmaEtapa'];

  usarCronograma((tela) => {
    ({ store, expansao, nativo, controller, componente, detectar, comFases, comUmaEtapa } = tela);
  });

  it('envia os tipos de decisão que a fase declara', () => {
    comFases(ID_AVALIACAO);
    comUmaEtapa();
    expansao.abrirFases([0]);
    detectar();
    store.processoSeletivoId.set('01960000-0000-7000-0000-0000000007aa');
    const caixa = nativo.querySelector<HTMLInputElement>(
      '#fase-AVALIACAO-tipos-de-decisao-GABARITO_DA_PROVA',
    ) as HTMLInputElement;
    caixa.checked = true;
    caixa.dispatchEvent(new Event('change'));
    detectar();

    void componente.persistir();
    const [enviada] = controller.expectOne(ROTA_FASES).request.body as {
      tiposDeDecisao: string[];
    }[];

    expect(enviada.tiposDeDecisao).toEqual(['GABARITO_DA_PROVA']);
  });
});
