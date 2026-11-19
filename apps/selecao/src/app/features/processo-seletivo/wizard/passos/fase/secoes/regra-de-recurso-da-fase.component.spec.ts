import type { HttpTestingController } from '@angular/common/http/testing';
import {
  StatusProcesso,
  UnidadePrazo,
  type ProcessoSeletivoDto,
} from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { FaseDoCronograma } from '../../../processo-seletivo.models';
import type { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { fase, montarFase } from '../fase.testing';

const REGRA = {
  regraCodigo: 'RECURSO-PRAZO-ANCORADO-EM-ATO',
  regraVersao: 'v1',
  prazoValor: '2',
  prazoUnidade: 'diasUteis',
  atoAncoraCodigo: 'RESULTADO_PRELIMINAR',
  suspensividadePrimeiraInstanciaValor: '1',
  suspensividadePrimeiraInstanciaUnidade: 'horas',
  admiteInstanciaSuperior: true,
  suspensividadeSegundaInstanciaValor: '',
  suspensividadeSegundaInstanciaUnidade: '',
};

describe('RegraDeRecursoDaFaseComponent', () => {
  let controller: HttpTestingController;
  let nativo: HTMLElement;
  let store: ProcessoSeletivoStore;
  let detectar: () => void;
  let comCronograma: (...fases: readonly FaseDoCronograma[]) => void;

  beforeEach(async () => {
    ({ controller, nativo, comCronograma, store, detectar } = await montarFase());
    comCronograma(
      fase({
        produtos: [{ atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' }],
        regraRecurso: REGRA as FaseDoCronograma['regraRecurso'],
      }),
    );
  });

  afterEach(() => controller.verify());

  const campo = (sufixo: string) =>
    nativo.querySelector<HTMLElement>(`#fase-AVALIACAO-${sufixo}`) as HTMLElement;

  it('desenha os três pares de prazo e unidade ligados ao rótulo e à ajuda de cada um', () => {
    for (const [par, ajuda] of [
      ['prazo', 'prazo-ajuda'],
      ['susp1', 'susp-ajuda'],
      ['susp2', 'susp-ajuda'],
    ]) {
      for (const parte of ['valor', 'unidade']) {
        const controle = campo(`${par}-${parte}`);
        expect(controle, `${par}-${parte}`).not.toBeNull();
        expect(nativo.querySelector(`label[for="fase-AVALIACAO-${par}-${parte}"]`)).not.toBeNull();
        expect(controle.getAttribute('aria-describedby')).toBe(`fase-AVALIACAO-${ajuda}`);
        expect(controle.getAttribute('formcontrolname')).not.toBeNull();
      }
    }
    expect(campo('prazo-valor').parentElement?.parentElement?.classList).toContain('form-grid');
    expect(campo('susp1-unidade').querySelector('option')?.textContent).toBe('Sem suspensividade');
    expect(campo('prazo-unidade').querySelector('option')?.textContent).toBe('Selecione…');
  });

  const unidadesDe = (sufixo: string): string[] =>
    Array.from(campo(sufixo).querySelectorAll('option')).map((opcao) => opcao.value);

  it('o prazo de interposição oferece dias úteis e horas, sem dias corridos', () => {
    expect(unidadesDe('prazo-unidade')).toEqual(['', UnidadePrazo.diasUteis, UnidadePrazo.horas]);
  });

  it.each(['susp1-unidade', 'susp2-unidade'])(
    'a suspensividade %s oferece dias úteis, dias corridos e horas, sem o valor-zero do enum',
    (sufixo) => {
      expect(unidadesDe(sufixo)).toEqual([
        '',
        UnidadePrazo.diasUteis,
        UnidadePrazo.dias,
        UnidadePrazo.horas,
      ]);
    },
  );

  it('em consulta, lê a suspensividade em dias corridos com a unidade no plural', () => {
    comCronograma(
      fase({
        produtos: [{ atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' }],
        regraRecurso: {
          ...REGRA,
          suspensividadePrimeiraInstanciaValor: '3',
          suspensividadePrimeiraInstanciaUnidade: 'dias',
          suspensividadeSegundaInstanciaValor: '1',
          suspensividadeSegundaInstanciaUnidade: 'dias',
        } as FaseDoCronograma['regraRecurso'],
      }),
    );
    store.remoteSnapshot.set({
      status: StatusProcesso.publicado,
    } as unknown as ProcessoSeletivoDto);
    detectar();

    const leitura = (nativo.textContent ?? '').replace(/\s+/g, ' ');
    expect(leitura).toContain('3 dias corridos');
    expect(leitura).toContain('1 dia corrido');
  });
});
