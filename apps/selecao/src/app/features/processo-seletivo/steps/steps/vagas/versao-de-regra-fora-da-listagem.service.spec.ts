import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CatalogosDeDistribuicao } from './catalogos-de-distribuicao.service';
import { VersaoDeRegraForaDaListagemService } from './versao-de-regra-fora-da-listagem.service';

const BASE = 'http://localhost:5000';
const URL_V0 = `${BASE}/api/selecao/regras-catalogo/REMANEJ-CASCATA-LEI-12711/versoes/v0`;
const SELECAO_A = { regraCodigo: 'REMANEJ-CASCATA-LEI-12711', regraVersao: 'v0' };

const REGRA_V0 = {
  codigo: 'REMANEJ-CASCATA-LEI-12711',
  versao: 'v0',
  tipo: 'criterio_remanejamento',
  esquemaArgs: { fallbackCodigo: 'AC', ordens: [] },
  invariantes: [],
  baseLegal: 'Portaria MEC nº 704/2025 (redação anterior)',
  hash: 'hash-cascata-v0',
  modalidadesAdmitidas: null,
};

describe('VersaoDeRegraForaDaListagemService', () => {
  let servico: VersaoDeRegraForaDaListagemService;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ProcessoSeletivoStore,
        CatalogosDeDistribuicao,
        VersaoDeRegraForaDaListagemService,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });

    servico = TestBed.inject(VersaoDeRegraForaDaListagemService);
    store = TestBed.inject(ProcessoSeletivoStore);
    controller = TestBed.inject(HttpTestingController);

    TestBed.inject(CatalogosDeDistribuicao).carregar();
    for (const requisicao of controller.match(() => true)) requisicao.flush([]);
    TestBed.tick();
  });

  afterEach(() => controller.verify());

  function abandonarBuscaDeA(): void {
    store.patchObjectSection('vagas', { cascata: SELECAO_A });
    TestBed.tick();
    const abandonada = controller.expectOne(URL_V0);

    store.patchObjectSection('vagas', { cascata: null });
    TestBed.tick();
    expect(abandonada.cancelled).toBe(true);

    store.patchObjectSection('vagas', { cascata: SELECAO_A });
    TestBed.tick();
  }

  it('refaz a busca da versão ao voltar à seleção abandonada e resolve a regra', () => {
    abandonarBuscaDeA();

    controller.expectOne(URL_V0).flush(REGRA_V0);

    expect(servico.regraEscolhida()?.versao).toBe('v0');
    expect(servico.regraNaoEncontrada()).toBe(false);
  });

  it('mantém a falha retentável e busca de novo ao tentar outra vez', () => {
    abandonarBuscaDeA();

    controller
      .expectOne(URL_V0)
      .flush(
        { type: 'about:blank', title: 'Erro interno.', status: 503, traceId: 't' },
        { status: 503, statusText: 'Service Unavailable' },
      );
    expect(servico.falhaAoConsultarRegra()).toBe(true);
    expect(servico.regraEscolhida()).toBeUndefined();

    servico.tentarNovamente();
    controller.expectOne(URL_V0).flush(REGRA_V0);

    expect(servico.falhaAoConsultarRegra()).toBe(false);
    expect(servico.regraEscolhida()?.versao).toBe('v0');
  });
});
