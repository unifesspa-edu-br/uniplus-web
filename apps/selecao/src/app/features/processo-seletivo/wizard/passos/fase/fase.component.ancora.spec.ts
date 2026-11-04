import { UnidadePrazo } from '@uniplus/shared-data/selecao';
import { afterEach, describe, expect, it } from 'vitest';

import type { RecursoDaFase } from '../../processo-seletivo.models';
import { fase, montarFase } from './fase.testing';

const RECURSO_SEM_ANCORA: RecursoDaFase = {
  regraCodigo: 'RECURSO-PRAZO-ANCORADO-EM-ATO',
  regraVersao: 'v1',
  prazoValor: '2',
  prazoUnidade: UnidadePrazo.diasUteis,
  atoAncoraCodigo: '',
  suspensividadePrimeiraInstanciaValor: '',
  suspensividadePrimeiraInstanciaUnidade: '',
  admiteInstanciaSuperior: false,
  suspensividadeSegundaInstanciaValor: '',
  suspensividadeSegundaInstanciaUnidade: '',
};

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
