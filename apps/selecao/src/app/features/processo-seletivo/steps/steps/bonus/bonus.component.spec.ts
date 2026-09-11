import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import { CatalogosDeClassificacaoService } from '../classificacao/catalogos-de-classificacao.service';
import { BonusStepComponent } from './bonus.component';

const BASE = 'http://localhost:5000';
const PROCESSO_ID = '01960000-0000-7000-0000-0000000007aa';
const ROTA_BONUS = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/bonus-regional`;
const BASE_LEGAL_ID = 'ba5e0000-0000-7000-8000-000000000001';

describe('BonusStepComponent', () => {
  let componente: BonusStepComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let fixture: ComponentFixture<BonusStepComponent>;

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
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BonusStepComponent);
    componente = fixture.componentInstance;
    store = TestBed.inject(ProcessoSeletivoStore);
    controller = TestBed.inject(HttpTestingController);

    fixture.detectChanges();
    for (const requisicao of controller.match(() => true)) requisicao.flush([]);
    fixture.detectChanges();

    store.processoSeletivoId.set(PROCESSO_ID);
  });

  afterEach(() => controller.verify());

  it('é válido inativo, sem nenhum campo preenchido (toggle por presença)', () => {
    expect(componente.validate().valid).toBe(true);
  });

  it('recusa ativo sem regra escolhida', () => {
    componente.alternarAtivo(true);
    expect(componente.validate().valid).toBe(false);
  });

  it('recusa fator zero ou negativo', () => {
    componente.alternarAtivo(true);
    componente.escolherRegra('BONUS-MULTIPLICATIVO|1.0');
    componente.escolherBaseLegal(BASE_LEGAL_ID);
    componente.alterarFator('0');

    expect(componente.validate().valid).toBe(false);
  });

  it('recusa ativo sem base legal escolhida', () => {
    componente.alternarAtivo(true);
    componente.escolherRegra('BONUS-MULTIPLICATIVO|1.0');
    componente.alterarFator('1.2');

    expect(componente.validate().valid).toBe(false);
  });

  it('aceita ativo com regra, fator e base legal válidos, sem teto', () => {
    componente.alternarAtivo(true);
    componente.escolherRegra('BONUS-MULTIPLICATIVO|1.0');
    componente.alterarFator('1.2');
    componente.escolherBaseLegal(BASE_LEGAL_ID);

    expect(componente.validate().valid).toBe(true);
  });

  it('recusa teto informado igual ou menor que zero', () => {
    componente.alternarAtivo(true);
    componente.escolherRegra('BONUS-MULTIPLICATIVO|1.0');
    componente.alterarFator('1.2');
    componente.escolherBaseLegal(BASE_LEGAL_ID);
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
        baseLegalBonusRegionalId: null,
      });

      requisicao.flush(null, { status: 204, statusText: 'No Content' });
      await expect(gravacao).resolves.toEqual({ valid: true });
    });

    it('grava os campos preenchidos quando ativo', async () => {
      componente.alternarAtivo(true);
      componente.escolherRegra('BONUS-MULTIPLICATIVO|1.0');
      componente.alterarFator('1.2');
      componente.escolherBaseLegal(BASE_LEGAL_ID);

      const gravacao = componente.persistir();

      const requisicao = controller.expectOne(ROTA_BONUS);
      expect(requisicao.request.body).toEqual({
        regraCodigo: 'BONUS-MULTIPLICATIVO',
        regraVersao: '1.0',
        fator: 1.2,
        teto: null,
        baseLegalBonusRegionalId: BASE_LEGAL_ID,
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
      componente.escolherBaseLegal(BASE_LEGAL_ID);

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
      componente.escolherBaseLegal(BASE_LEGAL_ID);

      const confirmacao = componente.confirmacaoDeGravacao();
      expect(confirmacao?.itens.map((item) => item.rotulo)).toEqual([
        'Regra',
        'Fator',
        'Teto',
        'Base legal',
      ]);
    });

    it('mostra a identificação da base legal do catálogo', () => {
      // A carga inicial do beforeEach já foi flushada com [] — refaz a busca para
      // interceptar esta com dados reais, sem alterar o setup compartilhado.
      componente['carregarBasesLegais']();
      const requisicaoBaseLegal = controller.expectOne(
        (r) => r.url === `${BASE}/api/configuracao/base-legal-bonus-regional`,
      );
      requisicaoBaseLegal.flush([
        {
          id: BASE_LEGAL_ID,
          tipoInstrumento: 'PORTARIA',
          identificacao: 'Portaria Unifesspa nº 2514/2023',
          descricao: 'Institui inclusão regional.',
          municipios: [],
          criadoEm: '2026-01-01T00:00:00Z',
        },
      ]);

      componente.alternarAtivo(true);
      componente.escolherRegra('BONUS-MULTIPLICATIVO|1.0');
      componente.alterarFator('1.2');
      componente.escolherBaseLegal(BASE_LEGAL_ID);

      const confirmacao = componente.confirmacaoDeGravacao();
      expect(confirmacao?.itens).toContainEqual({
        rotulo: 'Base legal',
        valor: 'Portaria Unifesspa nº 2514/2023',
      });
    });
  });

  describe('municipiosDaBaseLegalSelecionada()', () => {
    it('não lista município nenhum quando não há base legal escolhida', () => {
      expect(componente.municipiosDaBaseLegalSelecionada()).toEqual([]);
    });

    it('lista os municípios da base legal escolhida, ordenados por nome', () => {
      componente['carregarBasesLegais']();
      controller
        .expectOne((r) => r.url === `${BASE}/api/configuracao/base-legal-bonus-regional`)
        .flush([
          {
            id: BASE_LEGAL_ID,
            tipoInstrumento: 'PORTARIA',
            identificacao: 'Portaria Unifesspa nº 2514/2023',
            descricao: 'Institui inclusão regional.',
            municipios: [
              { codigoIbge: '1500107', nome: 'Xinguara', uf: 'PA' },
              { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
              { codigoIbge: '1500859', nome: 'Abel Figueiredo', uf: 'PA' },
            ],
            criadoEm: '2026-01-01T00:00:00Z',
          },
        ]);

      componente.escolherBaseLegal(BASE_LEGAL_ID);

      expect(componente.municipiosDaBaseLegalSelecionada().map((m) => m.nome)).toEqual([
        'Abel Figueiredo',
        'Marabá',
        'Xinguara',
      ]);
    });

    it('não expõe tabindex/role/aria-labelledby quando a tabela não transborda a caixa', () => {
      componente['carregarBasesLegais']();
      controller
        .expectOne((r) => r.url === `${BASE}/api/configuracao/base-legal-bonus-regional`)
        .flush([
          {
            id: BASE_LEGAL_ID,
            tipoInstrumento: 'PORTARIA',
            identificacao: 'Portaria Unifesspa nº 2514/2023',
            descricao: 'Institui inclusão regional.',
            municipios: [{ codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' }],
            criadoEm: '2026-01-01T00:00:00Z',
          },
        ]);

      componente.alternarAtivo(true);
      componente.escolherBaseLegal(BASE_LEGAL_ID);
      fixture.detectChanges();

      // jsdom não faz layout de verdade — scrollHeight/clientHeight ficam
      // ambos em 0, o mesmo estado de "cabe sem rolar" que uma base legal com
      // poucos municípios produz numa tela real.
      const regiao = fixture.nativeElement.querySelector<HTMLDivElement>(
        '.bonus-municipios__scroll',
      );
      expect(regiao?.hasAttribute('tabindex')).toBe(false);
      expect(regiao?.hasAttribute('role')).toBe(false);
      expect(regiao?.hasAttribute('aria-labelledby')).toBe(false);
    });

    it('a região com rolagem é alcançável por teclado e tem nome acessível quando a tabela transborda a caixa', () => {
      componente['carregarBasesLegais']();
      controller
        .expectOne((r) => r.url === `${BASE}/api/configuracao/base-legal-bonus-regional`)
        .flush([
          {
            id: BASE_LEGAL_ID,
            tipoInstrumento: 'PORTARIA',
            identificacao: 'Portaria Unifesspa nº 2514/2023',
            descricao: 'Institui inclusão regional.',
            municipios: [{ codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' }],
            criadoEm: '2026-01-01T00:00:00Z',
          },
        ]);

      componente.alternarAtivo(true);
      componente.escolherBaseLegal(BASE_LEGAL_ID);
      fixture.detectChanges();

      const regiao = fixture.nativeElement.querySelector<HTMLDivElement>(
        '.bonus-municipios__scroll',
      );
      vi.spyOn(regiao as HTMLDivElement, 'scrollHeight', 'get').mockReturnValue(500);
      vi.spyOn(regiao as HTMLDivElement, 'clientHeight', 'get').mockReturnValue(256);
      componente['medirRolagemDosMunicipios']();
      fixture.detectChanges();

      expect(regiao?.getAttribute('tabindex')).toBe('0');
      expect(regiao?.getAttribute('role')).toBe('region');

      const legendaId = regiao?.getAttribute('aria-labelledby');
      const legenda = fixture.nativeElement.querySelector<HTMLElement>(`#${legendaId}`);
      expect(legenda?.textContent).toContain('1 município(s) beneficiado(s)');
    });
  });
});
