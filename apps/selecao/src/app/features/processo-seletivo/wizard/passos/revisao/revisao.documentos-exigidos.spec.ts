import { ComponentFixture } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { FaseDoCronograma } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import {
  baseLegalNova,
  comExigencia,
  exigenciaNova,
  folhaDe,
} from '../../shared/exigencias/exigencias-documentais';
import { RevisaoPassoComponent } from './revisao.component';
import {
  criarProcesso,
  flushProntidaoVerde,
  montarOCenario,
  CenarioDaRevisao,
} from './revisao.testing';

describe('RevisaoPassoComponent', () => {
  let cenario: CenarioDaRevisao;
  let fixture: ComponentFixture<RevisaoPassoComponent>;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;

  beforeEach(async () => {
    cenario = await montarOCenario();
    ({ fixture, store, controller } = cenario);
  });

  afterEach(() => controller.verify());

  describe('documentos exigidos', () => {
    const FASE = (codigo: string) => ({ codigo }) as FaseDoCronograma;
    const documento = (obrigatorio: boolean, comNorma: boolean) => ({
      ...exigenciaNova('01960000-0000-7000-0000-0000000000d1', 'INSCRICAO'),
      obrigatorio,
      basesLegais: [{ ...baseLegalNova(), referencia: comNorma ? 'Lei 12.711/2012' : '' }],
    });

    async function abrirRevisao(): Promise<string> {
      await criarProcesso(cenario);
      await flushProntidaoVerde(cenario);
      fixture.detectChanges();
      return (fixture.nativeElement as HTMLElement).textContent ?? '';
    }

    it('resume os documentos por fase e diz que a base legal está resolvida', async () => {
      store.patchSection('cronograma', { ...store.draft().cronograma, fases: [FASE('INSCRICAO')] });
      store.patchSection(
        'documentos',
        comExigencia({ raizes: [], emTodasAsFases: [] }, documento(true, true)),
      );

      const texto = await abrirRevisao();

      expect(texto).toContain('Fase INSCRICAO: 1 obrigatório, 0 facultativos.');
      expect(texto).toContain('Base legal resolvida');
    });

    it('materializa na fase acrescentada depois o documento exigido em todas as fases', async () => {
      store.patchSection('cronograma', {
        ...store.draft().cronograma,
        fases: [FASE('INSCRICAO'), FASE('NOVA')],
      });
      store.patchSection('documentos', {
        ...comExigencia({ raizes: [], emTodasAsFases: [] }, documento(true, true)),
        emTodasAsFases: ['01960000-0000-7000-0000-0000000000d1'],
      });

      expect(await abrirRevisao()).toContain('Fase NOVA: 1 obrigatório');
    });

    it('não diz que a fase dispensa base legal quando o grupo decisivo tem norma resolvida', async () => {
      store.patchSection('cronograma', { ...store.draft().cronograma, fases: [FASE('INSCRICAO')] });
      const facultativo = (tipo: string) =>
        folhaDe({ ...documento(false, true), tipoDocumentoId: tipo });
      store.patchSection('documentos', {
        emTodasAsFases: [],
        raizes: [
          {
            ...folhaDe(documento(false, true)),
            tipo: 'OU',
            documento: null,
            consequencia: 'INDEFERIMENTO',
            basesLegais: [baseLegalNova()].map((base) => ({ ...base, referencia: 'Edital' })),
            filhos: [facultativo('a'), facultativo('b')],
          },
        ],
      });

      const texto = await abrirRevisao();

      expect(texto).toContain('Base legal resolvida');
      expect(texto).not.toContain('Sem exigência de base legal');
    });

    it('acusa a fase cujo grupo de alternativas decide o resultado sem norma resolvida', async () => {
      store.patchSection('cronograma', { ...store.draft().cronograma, fases: [FASE('INSCRICAO')] });
      const facultativo = (tipo: string) =>
        folhaDe({ ...documento(false, true), tipoDocumentoId: tipo });
      store.patchSection('documentos', {
        emTodasAsFases: [],
        raizes: [
          {
            ...folhaDe(documento(false, true)),
            tipo: 'OU',
            documento: null,
            consequencia: 'INDEFERIMENTO',
            basesLegais: [],
            filhos: [facultativo('a'), facultativo('b')],
          },
        ],
      });

      expect(await abrirRevisao()).toContain('Base legal pendente em 1 exigência');
    });

    it('acusa a fase cuja exigência a publicação recusaria por falta de norma', async () => {
      store.patchSection('cronograma', { ...store.draft().cronograma, fases: [FASE('INSCRICAO')] });
      store.patchSection(
        'documentos',
        comExigencia({ raizes: [], emTodasAsFases: [] }, documento(true, false)),
      );

      expect(await abrirRevisao()).toContain('Base legal pendente em 1 exigência');
    });
  });
});
