import { afterEach, describe, expect, it } from 'vitest';

import { PARAMETROS_SEM_INSTANCIA_SUPERIOR } from '../../shared/configuracao-do-recurso/parametros-do-recurso.testing';
import { recurso } from './configuracao-da-fase.testing';
import { fase, montarFase } from './fase.testing';

const RECURSO_SEM_ANCORA = recurso({ ...PARAMETROS_SEM_INSTANCIA_SUPERIOR, atoAncoraCodigo: '' });

describe('âncora única do prazo de recurso', () => {
  let encerrar: () => void = () => undefined;

  afterEach(() => encerrar());

  for (const estado of ['pendentes', 'com-erro'] as const) {
    it(`preenche a âncora única com o catálogo ${estado === 'pendentes' ? 'ainda carregando' : 'em erro'}`, async () => {
      const { componente, comCronograma, controller, atenderCatalogos } = await montarFase(estado);
      encerrar = () => {
        atenderCatalogos();
        controller.verify();
      };

      comCronograma(
        fase({
          produtos: [{ atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' }],
          regraRecurso: RECURSO_SEM_ANCORA,
        }),
      );

      expect(componente.formulario()?.controls.recurso.controls.atoAncoraCodigo.value).toBe(
        'RESULTADO_PRELIMINAR',
      );
    });
  }
});
