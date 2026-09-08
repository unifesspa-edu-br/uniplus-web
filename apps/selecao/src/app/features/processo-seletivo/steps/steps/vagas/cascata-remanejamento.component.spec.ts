import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { ProcessoSeletivoDto, SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DistribuicaoDeVagas } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CascataRemanejamentoComponent } from './cascata-remanejamento.component';
import { CatalogosDeDistribuicaoService } from './catalogos-de-distribuicao.service';

const BASE = 'http://localhost:5000';
const LB_PPI = '01960000-0000-7000-0000-0000000000b1';
const LB_Q = '01960000-0000-7000-0000-0000000000b2';
const AC = '01960000-0000-7000-0000-0000000000b3';

const MODALIDADES = [
  {
    id: LB_PPI,
    codigo: 'LB_PPI',
    descricao: null,
    naturezaLegal: 'COTA_RESERVADA',
    composicaoVagas: 'RETIRA_DE',
    composicaoOrigem: 'AC',
    regraRemanejamento: 'SEGUE_CASCATA',
    remanejamentoDestino: null,
    remanejamentoPar: null,
    remanejamentoFallback: null,
  },
  {
    id: LB_Q,
    codigo: 'LB_Q',
    descricao: null,
    naturezaLegal: 'COTA_RESERVADA',
    composicaoVagas: 'RETIRA_DE',
    composicaoOrigem: 'AC',
    regraRemanejamento: null,
    remanejamentoDestino: null,
    remanejamentoPar: null,
    remanejamentoFallback: null,
  },
  {
    id: AC,
    codigo: 'AC',
    descricao: null,
    naturezaLegal: 'GERAL',
    composicaoVagas: 'RETIRA_DE',
    composicaoOrigem: null,
    regraRemanejamento: null,
    remanejamentoDestino: null,
    remanejamentoPar: null,
    remanejamentoFallback: null,
  },
];

const REGRA_CASCATA = {
  codigo: 'REMANEJ-CASCATA-LEI-12711',
  versao: 'v1',
  tipo: 'criterio_remanejamento',
  esquemaArgs: {
    fallbackCodigo: 'AC',
    ordens: [{ origem: 'LB_PPI', destinos: ['LB_Q', 'AC'] }],
  },
  invariantes: ['origem sempre resolve pelo fallback'],
  baseLegal: 'Portaria MEC nº 704/2025',
  hash: 'hash-cascata-v1',
  modalidadesAdmitidas: null,
};

/** Uma versão anterior, que a listagem ativa não traz mais — só a busca direta a resolve. */
const REGRA_CASCATA_INATIVADA = {
  codigo: 'REMANEJ-CASCATA-LEI-12711',
  versao: 'v0',
  tipo: 'criterio_remanejamento',
  esquemaArgs: {
    fallbackCodigo: 'AC',
    ordens: [{ origem: 'LB_PPI', destinos: ['LB_Q', 'AC'] }],
  },
  invariantes: [],
  baseLegal: 'Portaria MEC nº 704/2025 (redação anterior)',
  hash: 'hash-cascata-v0',
  modalidadesAdmitidas: null,
};

function distribuicaoFederal(
  modalidades: readonly { id: string; codigo: string }[],
): DistribuicaoDeVagas {
  return {
    ofertaCursoId: 'oferta-1',
    voBase: '100',
    pr: '0,5',
    regraDistribuicaoCodigo: 'DISTRIB-VAGAS-LEI-12711',
    regraDistribuicaoVersao: 'v1',
    regraAjusteCodigo: 'AJUSTE-PADRAO',
    regraAjusteVersao: 'v1',
    referenciaReservaDemograficaId: 'ref-1',
    modalidades,
    quadro: [],
  };
}

describe('CascataRemanejamentoComponent', () => {
  let componente: CascataRemanejamentoComponent;
  let fixture: ComponentFixture<CascataRemanejamentoComponent>;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let elemento: HTMLElement;
  let detectar: () => void;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CascataRemanejamentoComponent],
      providers: [
        ProcessoSeletivoStore,
        CatalogosDeDistribuicaoService,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CascataRemanejamentoComponent);
    componente = fixture.componentInstance;
    store = TestBed.inject(ProcessoSeletivoStore);
    controller = TestBed.inject(HttpTestingController);
    elemento = fixture.nativeElement as HTMLElement;
    detectar = () => fixture.detectChanges();

    componente.catalogos.carregar();
    detectar();
    responderCatalogos();
    detectar();
  });

  afterEach(() => controller.verify());

  function responderCatalogos(): void {
    for (const requisicao of controller.match(() => true)) {
      const url = requisicao.request.urlWithParams;
      if (url.includes('modalidades')) requisicao.flush(MODALIDADES);
      else if (url.includes('tipo=criterio_remanejamento')) requisicao.flush([REGRA_CASCATA]);
      else requisicao.flush([]);
    }
  }

  it('não exibe seletor nem alerta quando nenhuma oferta segue a cascata', () => {
    store.patchObjectSection('vagas', {
      ofertas: [distribuicaoFederal([{ id: LB_Q, codigo: 'LB_Q' }])],
    });
    detectar();

    expect(elemento.querySelector('#c-regra-cascata')).toBeNull();
    expect(elemento.textContent).not.toContain('fora do ramo federal');
  });

  it('alerta quando a oferta segue a cascata mas está fora do ramo federal', () => {
    store.patchObjectSection('vagas', {
      ofertas: [
        {
          ...distribuicaoFederal([{ id: LB_PPI, codigo: 'LB_PPI' }]),
          regraDistribuicaoCodigo: 'DISTRIB-VAGAS-INSTITUCIONAL',
        },
      ],
    });
    detectar();

    expect(elemento.querySelector('#c-regra-cascata')).toBeNull();
    expect(elemento.textContent).toContain('fora do ramo federal');
  });

  it('exibe o seletor sem regra pré-selecionada quando a seção se aplica', () => {
    store.patchObjectSection('vagas', {
      ofertas: [distribuicaoFederal([{ id: LB_PPI, codigo: 'LB_PPI' }])],
    });
    detectar();

    const select = elemento.querySelector<HTMLSelectElement>('#c-regra-cascata');
    expect(select).not.toBeNull();
    expect(select?.querySelector('option[value="|"]')?.textContent).toContain(
      'Selecione a regra',
    );
    expect(componente.valorDoSelect()).toBe('|');
    expect(componente.cascata()).toBeNull();
  });

  it('deriva a matriz da regra escolhida e apresenta origem, destinos e fallback', () => {
    store.patchObjectSection('vagas', {
      ofertas: [distribuicaoFederal([{ id: LB_PPI, codigo: 'LB_PPI' }])],
    });
    detectar();

    componente.escolherRegra('REMANEJ-CASCATA-LEI-12711|v1');
    detectar();

    expect(store.draft().vagas.cascata).toEqual({
      regraCodigo: 'REMANEJ-CASCATA-LEI-12711',
      regraVersao: 'v1',
    });
    expect(componente.matriz()).toEqual({
      fallbackCodigo: 'AC',
      ordens: [{ origem: 'LB_PPI', destinos: ['LB_Q', 'AC'] }],
    });
    expect(elemento.textContent).toContain('LB_PPI');
    expect(elemento.textContent).toContain('LB_Q → AC');
  });

  it('aponta o encaixe pendente e trava a confirmação quando a oferta não cobre a matriz', () => {
    // Só a origem está selecionada — nem o fallback nem o outro destino.
    store.patchObjectSection('vagas', {
      ofertas: [distribuicaoFederal([{ id: LB_PPI, codigo: 'LB_PPI' }])],
    });
    detectar();

    componente.escolherRegra('REMANEJ-CASCATA-LEI-12711|v1');
    detectar();

    expect(componente.problemas().length).toBeGreaterThan(0);
    const checkbox = elemento.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(checkbox?.disabled).toBe(true);
    expect(componente.pronta()).toBe(false);
  });

  it('libera e marca pronta quando a oferta cobre fallback e destino', () => {
    store.patchObjectSection('vagas', {
      ofertas: [
        distribuicaoFederal([
          { id: LB_PPI, codigo: 'LB_PPI' },
          { id: LB_Q, codigo: 'LB_Q' },
          { id: AC, codigo: 'AC' },
        ]),
      ],
    });
    detectar();

    componente.escolherRegra('REMANEJ-CASCATA-LEI-12711|v1');
    detectar();
    expect(componente.problemas()).toEqual([]);

    const checkbox = elemento.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(checkbox?.disabled).toBe(false);

    componente.confirmado.set(true);
    detectar();

    expect(componente.pronta()).toBe(true);
  });

  it('descarta a confirmação ao trocar de regra', () => {
    store.patchObjectSection('vagas', {
      ofertas: [
        distribuicaoFederal([
          { id: LB_PPI, codigo: 'LB_PPI' },
          { id: LB_Q, codigo: 'LB_Q' },
          { id: AC, codigo: 'AC' },
        ]),
      ],
    });
    detectar();
    componente.escolherRegra('REMANEJ-CASCATA-LEI-12711|v1');
    componente.confirmado.set(true);
    detectar();
    expect(componente.confirmado()).toBe(true);

    componente.escolherRegra('|');
    detectar();

    expect(componente.confirmado()).toBe(false);
    expect(store.draft().vagas.cascata).toBeNull();
  });

  it('reconhece que o servidor tem uma cascata a partir da hidratação, não do seletor', () => {
    store.remoteSnapshot.set({
      cascata: {
        id: 'cascata-1',
        regra: { codigo: 'REMANEJ-CASCATA-LEI-12711', versao: 'v1', hash: 'h' },
        fallbackCodigo: 'AC',
        destinos: [],
      },
    } as unknown as ProcessoSeletivoDto);
    detectar();

    expect(componente.existeNoServidor()).toBe(true);
  });

  it('não confunde cascata inexistente no servidor com rascunho vazio', () => {
    store.remoteSnapshot.set({ cascata: null } as unknown as ProcessoSeletivoDto);
    detectar();

    expect(componente.existeNoServidor()).toBe(false);
  });

  /**
   * As rotas do editor reusam a mesma instância de componente ao trocar de
   * processo — sem isto, a confirmação e o rastro de "existe no servidor" do
   * processo anterior vazariam para o processo que acabou de hidratar.
   */
  it('reseta confirmado e existeNoServidor a cada nova hidratação (troca de processo)', () => {
    store.remoteSnapshot.set({
      cascata: {
        id: 'cascata-a',
        regra: { codigo: 'REMANEJ-CASCATA-LEI-12711', versao: 'v1', hash: 'h' },
        fallbackCodigo: 'AC',
        destinos: [],
      },
    } as unknown as ProcessoSeletivoDto);
    detectar();
    componente.confirmado.set(true);
    expect(componente.confirmado()).toBe(true);
    expect(componente.existeNoServidor()).toBe(true);

    // Processo B, sem cascata gravada.
    store.remoteSnapshot.set({ cascata: null } as unknown as ProcessoSeletivoDto);
    detectar();

    expect(componente.confirmado()).toBe(false);
    expect(componente.existeNoServidor()).toBe(false);
  });

  it('desabilita o controle reativo do seletor quando o passo não aceita edição', () => {
    store.patchObjectSection('vagas', {
      ofertas: [distribuicaoFederal([{ id: LB_PPI, codigo: 'LB_PPI' }])],
    });
    detectar();
    expect(componente.regraControl.disabled).toBe(false);

    store.salvando.set(true);
    detectar();

    expect(componente.regraControl.disabled).toBe(true);
    const select = elemento.querySelector<HTMLSelectElement>('#c-regra-cascata');
    expect(select?.disabled).toBe(true);
  });

  it('sincroniza o controle reativo com o rascunho sem reemitir o evento', () => {
    store.patchObjectSection('vagas', {
      ofertas: [distribuicaoFederal([{ id: LB_PPI, codigo: 'LB_PPI' }])],
    });
    detectar();

    store.patchObjectSection('vagas', {
      cascata: { regraCodigo: 'REMANEJ-CASCATA-LEI-12711', regraVersao: 'v1' },
    });
    detectar();

    expect(componente.regraControl.value).toBe('REMANEJ-CASCATA-LEI-12711|v1');
  });

  /**
   * Reproduz o achado de revisão: a seleção hidratada (ou de uma gravação
   * anterior) pode referenciar uma versão que a listagem ativa não traz mais
   * — `regraEscolhida()` não pode ficar `undefined` só porque a listagem
   * não tem a versão, senão a tabela e o checkbox somem e `validate()` cai
   * no "confirme a cascata" sem controle nenhum na tela (CA-03: item já
   * referenciado permanece legível como snapshot).
   */
  it('busca a versão específica quando a seleção hidratada não está na listagem, e resolve a matriz normalmente', () => {
    store.patchObjectSection('vagas', {
      ofertas: [distribuicaoFederal([{ id: LB_PPI, codigo: 'LB_PPI' }])],
      cascata: { regraCodigo: 'REMANEJ-CASCATA-LEI-12711', regraVersao: 'v0' },
    });
    detectar();

    const requisicao = controller.expectOne(
      `${BASE}/api/selecao/regras-catalogo/REMANEJ-CASCATA-LEI-12711/versoes/v0`,
    );
    expect(requisicao.request.method).toBe('GET');
    requisicao.flush(REGRA_CASCATA_INATIVADA);
    detectar();

    expect(componente.esquemaNaoReconhecido()).toBe(false);
    expect(componente.regraNaoEncontrada()).toBe(false);
    expect(componente.matriz()).toEqual({
      fallbackCodigo: 'AC',
      ordens: [{ origem: 'LB_PPI', destinos: ['LB_Q', 'AC'] }],
    });
    expect(elemento.textContent).toContain('Fallback');

    // A regra resolvida por busca direta precisa aparecer como opção do
    // seletor — sem isto o controle segura um valor sem <option>
    // correspondente e o <select> aparece em branco, mesmo com a matriz
    // conferível e gravável (D1).
    const select = elemento.querySelector<HTMLSelectElement>('#c-regra-cascata');
    const opcaoSelecionada = select?.querySelector(
      'option[value="REMANEJ-CASCATA-LEI-12711|v0"]',
    );
    expect(opcaoSelecionada).not.toBeNull();
    expect(opcaoSelecionada?.textContent).toContain('v0');
    expect(select?.value).toBe('REMANEJ-CASCATA-LEI-12711|v0');
  });

  it('marca a regra como não encontrada quando a busca direta da versão também falha, sem confundir com esquemaArgs malformado', () => {
    store.patchObjectSection('vagas', {
      ofertas: [distribuicaoFederal([{ id: LB_PPI, codigo: 'LB_PPI' }])],
      cascata: { regraCodigo: 'REMANEJ-CASCATA-REMOVIDA', regraVersao: 'v9' },
    });
    detectar();

    const requisicao = controller.expectOne(
      `${BASE}/api/selecao/regras-catalogo/REMANEJ-CASCATA-REMOVIDA/versoes/v9`,
    );
    requisicao.flush(
      { type: 'about:blank', title: 'Regra não encontrada.', status: 404, traceId: 't' },
      { status: 404, statusText: 'Not Found' },
    );
    detectar();

    expect(componente.regraNaoEncontrada()).toBe(true);
    expect(componente.esquemaNaoReconhecido()).toBe(false);
    expect(componente.matriz()).toBeNull();
    expect(elemento.textContent).toContain('não foi encontrada no catálogo');
  });

  /**
   * Reproduz o achado de revisão: um 5xx (ou falha de rede/autorização) na
   * busca da versão fora da listagem não prova que a regra não existe —
   * classificar como `nao_encontrada` transformaria uma indisponibilidade
   * transitória num veredito permanente, e a busca nunca mais tentaria de
   * novo (D2). `falhaAoConsultarRegra()` é o estado certo, com saída via
   * `tentarNovamenteRegra()`.
   */
  it('marca falha ao consultar (não "não encontrada") quando a busca direta responde 5xx, e permite tentar de novo', () => {
    store.patchObjectSection('vagas', {
      ofertas: [distribuicaoFederal([{ id: LB_PPI, codigo: 'LB_PPI' }])],
      cascata: { regraCodigo: 'REMANEJ-CASCATA-LEI-12711', regraVersao: 'v0' },
    });
    detectar();

    controller
      .expectOne(`${BASE}/api/selecao/regras-catalogo/REMANEJ-CASCATA-LEI-12711/versoes/v0`)
      .flush(
        { type: 'about:blank', title: 'Erro interno.', status: 503, traceId: 't' },
        { status: 503, statusText: 'Service Unavailable' },
      );
    detectar();

    expect(componente.falhaAoConsultarRegra()).toBe(true);
    expect(componente.regraNaoEncontrada()).toBe(false);
    expect(componente.esquemaNaoReconhecido()).toBe(false);
    expect(componente.matriz()).toBeNull();
    expect(elemento.textContent).toContain('a consulta falhou, não a regra');

    componente.tentarNovamenteRegra();
    detectar();

    const retentativa = controller.expectOne(
      `${BASE}/api/selecao/regras-catalogo/REMANEJ-CASCATA-LEI-12711/versoes/v0`,
    );
    retentativa.flush(REGRA_CASCATA_INATIVADA);
    detectar();

    expect(componente.falhaAoConsultarRegra()).toBe(false);
    expect(componente.matriz()).toEqual({
      fallbackCodigo: 'AC',
      ordens: [{ origem: 'LB_PPI', destinos: ['LB_Q', 'AC'] }],
    });
  });
});
