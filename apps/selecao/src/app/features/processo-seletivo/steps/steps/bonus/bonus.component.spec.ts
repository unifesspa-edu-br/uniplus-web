import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import { CatalogosDeClassificacaoService } from '../classificacao/catalogos-de-classificacao.service';
import { BonusStepComponent } from './bonus.component';

const BASE = 'http://localhost:5000';
const PROCESSO_ID = '01960000-0000-7000-0000-0000000007aa';
const ROTA_BONUS = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/bonus-regional`;

describe('BonusStepComponent', () => {
  let componente: BonusStepComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BonusStepComponent],
      providers: [
        ProcessoSeletivoStore,
        CadastroInicialService,
        CatalogosDeClassificacaoService,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(BonusStepComponent);
    componente = fixture.componentInstance;
    store = TestBed.inject(ProcessoSeletivoStore);
    controller = TestBed.inject(HttpTestingController);

    fixture.detectChanges();
    for (const requisicao of controller.match(() => true)) requisicao.flush([]);
    fixture.detectChanges();

    store.processoSeletivoId.set(PROCESSO_ID);
  });

  afterEach(() => controller.verify());

  it('é válido inativo, sem nenhum campo preenchido (RN05, toggle por presença)', () => {
    expect(componente.validate().valid).toBe(true);
  });

  it('recusa ativo sem regra escolhida', () => {
    componente.alternarAtivo(true);
    expect(componente.validate().valid).toBe(false);
  });

  it('recusa fator zero ou negativo', () => {
    componente.alternarAtivo(true);
    componente.escolherRegra('BONUS-MULTIPLICATIVO|1.0');
    componente.alterarFator('0');

    expect(componente.validate().valid).toBe(false);
  });

  it('aceita ativo com regra e fator válidos, sem teto', () => {
    componente.alternarAtivo(true);
    componente.escolherRegra('BONUS-MULTIPLICATIVO|1.0');
    componente.alterarFator('1.2');

    expect(componente.validate().valid).toBe(true);
  });

  it('recusa teto informado igual ou menor que zero', () => {
    componente.alternarAtivo(true);
    componente.escolherRegra('BONUS-MULTIPLICATIVO|1.0');
    componente.alterarFator('1.2');
    componente.alterarTeto('0');

    expect(componente.validate().valid).toBe(false);
  });

  describe('persistir()', () => {
    it('grava os cinco campos null quando inativo', async () => {
      const gravacao = componente.persistir();

      const requisicao = controller.expectOne(ROTA_BONUS);
      expect(requisicao.request.method).toBe('PUT');
      expect(requisicao.request.headers.get('Idempotency-Key')).toBeTruthy();
      expect(requisicao.request.body).toEqual({
        regraCodigo: null,
        regraVersao: null,
        fator: null,
        teto: null,
        municipioConvenio: null,
        baseLegal: null,
      });

      requisicao.flush(null, { status: 204, statusText: 'No Content' });
      await expect(gravacao).resolves.toEqual({ valid: true });
    });

    it('grava os campos preenchidos quando ativo', async () => {
      componente.alternarAtivo(true);
      componente.escolherRegra('BONUS-MULTIPLICATIVO|1.0');
      componente.alterarFator('1.2');
      componente.alterarMunicipioConvenio('Marabá');
      componente.alterarBaseLegal('Convênio 01/2026');

      const gravacao = componente.persistir();

      const requisicao = controller.expectOne(ROTA_BONUS);
      expect(requisicao.request.body).toEqual({
        regraCodigo: 'BONUS-MULTIPLICATIVO',
        regraVersao: '1.0',
        fator: 1.2,
        teto: null,
        municipioConvenio: 'Marabá',
        baseLegal: 'Convênio 01/2026',
      });

      requisicao.flush(null, { status: 204, statusText: 'No Content' });
      await gravacao;
    });

    it('não chama a API quando a validação recusa', async () => {
      componente.alternarAtivo(true);
      const resultado = await componente.persistir();

      expect(resultado.valid).toBe(false);
      controller.verify();
    });

    it('preserva o rascunho quando a API recusa', async () => {
      componente.alternarAtivo(true);
      componente.escolherRegra('BONUS-MULTIPLICATIVO|1.0');
      componente.alterarFator('1.2');

      const gravacao = componente.persistir();

      controller.expectOne(ROTA_BONUS).flush(
        {
          type: 'about:blank',
          title: 'O fator do bônus deve ser maior que zero.',
          status: 422,
          code: 'ConfiguracaoBonusRegional.FatorInvalido',
          traceId: 'trace-1',
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );

      const resultado = await gravacao;
      expect(resultado.valid).toBe(false);
      expect(store.draft().bonus.ativo).toBe(true);
      expect(store.salvando()).toBe(false);
    });
  });

  describe('confirmacaoDeGravacao()', () => {
    it('confirma a ausência de bônus quando inativo', () => {
      const confirmacao = componente.confirmacaoDeGravacao();
      expect(confirmacao?.itens).toEqual([{ rotulo: 'Bônus regional', valor: 'Não configurado' }]);
    });

    it('devolve null quando ativo mas inválido', () => {
      componente.alternarAtivo(true);
      expect(componente.confirmacaoDeGravacao()).toBeNull();
    });

    it('resume os campos quando ativo e válido', () => {
      componente.alternarAtivo(true);
      componente.escolherRegra('BONUS-MULTIPLICATIVO|1.0');
      componente.alterarFator('1.2');

      const confirmacao = componente.confirmacaoDeGravacao();
      expect(confirmacao?.itens.map((item) => item.rotulo)).toContain('Fator');
    });
  });
});
