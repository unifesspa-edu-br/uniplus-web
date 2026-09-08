import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CriterioDesempateConfigurado, EtapaPontuada } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import { CatalogosDeClassificacaoService } from '../classificacao/catalogos-de-classificacao.service';
import { DesempateStepComponent } from './desempate.component';

const BASE = 'http://localhost:5000';
const PROCESSO_ID = '01960000-0000-7000-0000-0000000007aa';
const ROTA_DESEMPATE = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/criterios-desempate`;

const ETAPA_PERSISTIDA: EtapaPontuada = {
  id: 'etapa-1',
  nome: 'Prova objetiva',
  carater: 'classificatoria',
  tipoEtapaOrigemId: 'tipo-1',
  peso: '1',
  notaMinima: '',
  ordem: 1,
};

function criterio(patch: Partial<CriterioDesempateConfigurado>): CriterioDesempateConfigurado {
  return {
    regraCodigo: '',
    regraVersao: '',
    etapaRef: '',
    idadeMinima: '',
    fato: '',
    operador: '',
    valor: '',
    ...patch,
  };
}

describe('DesempateStepComponent', () => {
  let componente: DesempateStepComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DesempateStepComponent],
      providers: [
        ProcessoSeletivoStore,
        CadastroInicialService,
        CatalogosDeClassificacaoService,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DesempateStepComponent);
    componente = fixture.componentInstance;
    store = TestBed.inject(ProcessoSeletivoStore);
    controller = TestBed.inject(HttpTestingController);

    fixture.detectChanges();
    for (const requisicao of controller.match(() => true)) requisicao.flush([]);
    fixture.detectChanges();

    store.processoSeletivoId.set(PROCESSO_ID);
    store.patchObjectSection('cronograma', { etapas: [ETAPA_PERSISTIDA] });
  });

  afterEach(() => controller.verify());

  it('é válido sem nenhum critério (desempate é opcional)', () => {
    expect(componente.validate().valid).toBe(true);
  });

  it('reordena com mover()', () => {
    store.patchSection('desempate', [
      criterio({ regraCodigo: 'DESEMPATE-MAIOR-IDADE', regraVersao: '1.0' }),
      criterio({ regraCodigo: 'DESEMPATE-IDOSO', regraVersao: '1.0', idadeMinima: '60' }),
    ]);

    componente.mover(1, -1);

    expect(store.draft().desempate.map((item) => item.regraCodigo)).toEqual([
      'DESEMPATE-IDOSO',
      'DESEMPATE-MAIOR-IDADE',
    ]);
  });

  it('remove um critério pelo índice', () => {
    store.patchSection('desempate', [
      criterio({ regraCodigo: 'DESEMPATE-MAIOR-IDADE', regraVersao: '1.0' }),
    ]);

    componente.remover(0);

    expect(store.draft().desempate).toEqual([]);
  });

  describe('DESEMPATE-MAIOR-NOTA-ETAPA — exige etapaRef existente', () => {
    it('recusa sem etapaRef', () => {
      store.patchSection('desempate', [
        criterio({ regraCodigo: 'DESEMPATE-MAIOR-NOTA-ETAPA', regraVersao: '1.0' }),
      ]);

      expect(componente.validate().valid).toBe(false);
    });

    it('recusa quando a etapa referenciada não existe mais', () => {
      store.patchSection('desempate', [
        criterio({
          regraCodigo: 'DESEMPATE-MAIOR-NOTA-ETAPA',
          regraVersao: '1.0',
          etapaRef: 'etapa-removida',
        }),
      ]);

      expect(componente.validate().valid).toBe(false);
    });

    it('aceita com etapaRef existente', () => {
      store.patchSection('desempate', [
        criterio({
          regraCodigo: 'DESEMPATE-MAIOR-NOTA-ETAPA',
          regraVersao: '1.0',
          etapaRef: 'etapa-1',
        }),
      ]);

      expect(componente.validate().valid).toBe(true);
    });
  });

  describe('DESEMPATE-IDOSO — exige idadeMinima maior que zero', () => {
    it('recusa idade mínima ausente', () => {
      store.patchSection('desempate', [
        criterio({ regraCodigo: 'DESEMPATE-IDOSO', regraVersao: '1.0' }),
      ]);

      expect(componente.validate().valid).toBe(false);
    });

    it('aceita com idade mínima informada', () => {
      store.patchSection('desempate', [
        criterio({ regraCodigo: 'DESEMPATE-IDOSO', regraVersao: '1.0', idadeMinima: '60' }),
      ]);

      expect(componente.validate().valid).toBe(true);
    });
  });

  describe('DESEMPATE-PREDICADO-FATO — exige fato, operador e valor', () => {
    it('recusa incompleto', () => {
      store.patchSection('desempate', [
        criterio({ regraCodigo: 'DESEMPATE-PREDICADO-FATO', regraVersao: '1.0', fato: 'RENDA' }),
      ]);

      expect(componente.validate().valid).toBe(false);
    });

    it('aceita completo', () => {
      store.patchSection('desempate', [
        criterio({
          regraCodigo: 'DESEMPATE-PREDICADO-FATO',
          regraVersao: '1.0',
          fato: 'RENDA_PER_CAPITA',
          operador: 'lte',
          valor: '1.5',
        }),
      ]);

      expect(componente.validate().valid).toBe(true);
    });
  });

  describe('DESEMPATE-MAIOR-IDADE — sem argumento', () => {
    it('aceita sem nenhum campo adicional', () => {
      store.patchSection('desempate', [
        criterio({ regraCodigo: 'DESEMPATE-MAIOR-IDADE', regraVersao: '1.0' }),
      ]);

      expect(componente.validate().valid).toBe(true);
    });
  });

  describe('persistir()', () => {
    it('grava a coleção vazia quando não há critério (CA-05)', async () => {
      const gravacao = componente.persistir();

      const requisicao = controller.expectOne(ROTA_DESEMPATE);
      expect(requisicao.request.method).toBe('PUT');
      expect(requisicao.request.headers.get('Idempotency-Key')).toBeTruthy();
      expect(requisicao.request.body).toEqual([]);

      requisicao.flush(null, { status: 204, statusText: 'No Content' });
      await expect(gravacao).resolves.toEqual({ valid: true });
    });

    it('grava a coleção inteira, com ordem pela posição em tela', async () => {
      store.patchSection('desempate', [
        criterio({
          regraCodigo: 'DESEMPATE-MAIOR-NOTA-ETAPA',
          regraVersao: '1.0',
          etapaRef: 'etapa-1',
        }),
        criterio({ regraCodigo: 'DESEMPATE-IDOSO', regraVersao: '1.0', idadeMinima: '60' }),
      ]);

      const gravacao = componente.persistir();

      const requisicao = controller.expectOne(ROTA_DESEMPATE);
      expect(requisicao.request.body).toEqual([
        {
          ordem: 1,
          regraCodigo: 'DESEMPATE-MAIOR-NOTA-ETAPA',
          regraVersao: '1.0',
          etapaRef: 'etapa-1',
          idadeMinima: null,
          fato: null,
          operador: null,
          valor: null,
        },
        {
          ordem: 2,
          regraCodigo: 'DESEMPATE-IDOSO',
          regraVersao: '1.0',
          etapaRef: null,
          idadeMinima: 60,
          fato: null,
          operador: null,
          valor: null,
        },
      ]);

      requisicao.flush(null, { status: 204, statusText: 'No Content' });
      await gravacao;
    });

    it('não chama a API quando a validação recusa', async () => {
      store.patchSection('desempate', [
        criterio({ regraCodigo: 'DESEMPATE-IDOSO', regraVersao: '1.0' }),
      ]);

      const resultado = await componente.persistir();

      expect(resultado.valid).toBe(false);
      controller.verify();
    });
  });
});
