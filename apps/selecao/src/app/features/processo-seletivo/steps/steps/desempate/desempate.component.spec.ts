import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
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

/** O catálogo institucional, como a API o publica — só o que o predicado pode citar. */
const FATOS = [
  {
    id: 'f1',
    codigo: 'RENDA_PER_CAPITA',
    nome: 'Renda familiar per capita',
    descricao: null,
    dominio: 'NUMERICO',
    origem: 'DERIVADO',
    cardinalidade: 'ESCALAR',
    valoresDominio: null,
    pontoResolucao: 'INSCRICAO',
    binding: 'ATRIBUTO_CANDIDATO:RENDA_PER_CAPITA',
    valoresDominioDeclarados: null,
  },
  {
    id: 'f2',
    codigo: 'COR_RACA',
    nome: 'Cor ou raça',
    descricao: null,
    dominio: 'CATEGORICO',
    origem: 'DECLARADO',
    cardinalidade: 'ESCALAR',
    valoresDominio: ['BRANCA', 'PRETA', 'PARDA', 'INDIGENA', 'AMARELA'],
    pontoResolucao: 'INSCRICAO',
    binding: 'CAMPO_INSCRICAO:COR_RACA',
    valoresDominioDeclarados: null,
  },
];

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
        // O passo passou a ler o catálogo de fatos do candidato, que é do módulo Configuração.
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DesempateStepComponent);
    componente = fixture.componentInstance;
    store = TestBed.inject(ProcessoSeletivoStore);
    controller = TestBed.inject(HttpTestingController);

    fixture.detectChanges();
    for (const requisicao of controller.match(() => true)) {
      // O catálogo de fatos do candidato governa o que o predicado pode citar; respondê-lo
      // vazio faria todo critério por predicado ser recusado por "fato fora do catálogo".
      requisicao.flush(requisicao.request.url.includes('fatos-candidato') ? FATOS : []);
    }
    fixture.detectChanges();

    store.processoSeletivoId.set(PROCESSO_ID);
    store.patchObjectSection('cronograma', { etapas: [ETAPA_PERSISTIDA] });
  });

  afterEach(() => controller.verify());

  /**
   * O catálogo de fatos governa o que o predicado pode citar. Falhando a busca sem aviso nem
   * nova tentativa, todo critério já configurado por predicado aparecia como fato fora do
   * cadastro e a gravação do passo era recusada — sem explicação e sem caminho de volta que
   * não fosse recarregar a página.
   */
  it('anuncia a falha do catálogo de fatos e busca de novo quando pedido', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [DesempateStepComponent],
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

    const fixture = TestBed.createComponent(DesempateStepComponent);
    const local = fixture.componentInstance;
    const controllerLocal = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    for (const requisicao of controllerLocal.match(() => true)) {
      if (requisicao.request.url.includes('fatos-candidato')) {
        requisicao.flush(
          { type: 'about:blank', title: 'Falha ao consultar o cadastro', status: 500 },
          {
            status: 500,
            statusText: 'Internal Server Error',
            headers: { 'content-type': 'application/problem+json' },
          },
        );
        continue;
      }
      requisicao.flush([]);
    }
    fixture.detectChanges();

    expect(local.falhaDoCatalogoDeFatos()).not.toBeNull();
    expect(local.fatosEscolhiveis()).toHaveLength(0);

    // A nova tentativa existe, e é ela que devolve o vocabulário sem recarregar a página.
    local.carregarFatos();
    const retentativa = controllerLocal.expectOne((r) => r.url.includes('fatos-candidato'));
    retentativa.flush(FATOS);
    fixture.detectChanges();

    expect(local.falhaDoCatalogoDeFatos()).toBeNull();
    expect(local.fatosEscolhiveis().length).toBeGreaterThan(0);
    controllerLocal.verify();
  });

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
          operador: 'MENOR_IGUAL',
          valor: '1',
        }),
      ]);

      expect(componente.validate().valid).toBe(true);
    });

    /**
     * Antes a conferência olhava só se os três campos estavam preenchidos. `lte` parece um
     * operador e não é: o vocabulário do domínio tem `MENOR_IGUAL`, e o servidor recusava sem
     * dizer qual dos três campos estava errado.
     */
    it('recusa a comparação que não pertence ao vocabulário', () => {
      store.patchSection('desempate', [
        criterio({
          regraCodigo: 'DESEMPATE-PREDICADO-FATO',
          regraVersao: '1.0',
          fato: 'RENDA_PER_CAPITA',
          operador: 'lte',
          valor: '1',
        }),
      ]);

      const resultado = componente.validate();
      expect(resultado.valid).toBe(false);
      expect(resultado.messages?.[0]).toContain('não admite a comparação escolhida');
    });

    /** Valor fora do domínio declarado também é acusado antes da gravação. */
    it('recusa o valor que não pertence ao domínio do fato', () => {
      store.patchSection('desempate', [
        criterio({
          regraCodigo: 'DESEMPATE-PREDICADO-FATO',
          regraVersao: '1.0',
          fato: 'COR_RACA',
          operador: 'IGUAL',
          valor: '"AZUL"',
        }),
      ]);

      const resultado = componente.validate();
      expect(resultado.valid).toBe(false);
      expect(resultado.messages?.[0]).toContain('fora do domínio declarado');
    });

    /**
     * Voltar o seletor para "escolha o fato" tem de limpar o critério. Enquanto a escolha em
     * branco era ignorada, a tela mostrava o campo vazio e o rascunho continuava com o fato
     * anterior — gravava-se um desempate por cor/raça que o operador acreditava ter apagado.
     */
    it('voltar o seletor ao branco limpa o fato no rascunho, não só na tela', () => {
      store.patchSection('desempate', [
        criterio({
          regraCodigo: 'DESEMPATE-PREDICADO-FATO',
          regraVersao: '1.0',
          fato: 'COR_RACA',
          operador: 'IGUAL',
          valor: '"PRETA"',
        }),
      ]);

      componente.alterarFato(0, '');

      const criterioAtual = store.draft().desempate[0];
      expect(criterioAtual.fato).toBe('');
      expect(criterioAtual.operador).toBe('');
      expect(criterioAtual.valor).toBe('');
      expect(componente.validate().valid).toBe(false);
    });

    /**
     * O valor categórico chega do servidor como texto JSON — o mesmo formato do gatilho da
     * exigência documental. Antes de as duas leituras convergirem, o select ficava em branco
     * sobre um critério íntegro, e a gravação era recusada por "está sem valor".
     */
    it('lê de volta o valor categórico no formato em que o servidor o devolve', () => {
      store.patchSection('desempate', [
        criterio({
          regraCodigo: 'DESEMPATE-PREDICADO-FATO',
          regraVersao: '1.0',
          fato: 'COR_RACA',
          operador: 'IGUAL',
          valor: '"PRETA"',
        }),
      ]);

      expect(componente.valorDoCriterio(store.draft().desempate[0])).toBe('PRETA');
      expect(componente.validate().valid).toBe(true);
    });

    /** Fato que não está no catálogo é acusado pelo código, não silenciosamente aceito. */
    it('recusa o fato que não está no catálogo', () => {
      store.patchSection('desempate', [
        criterio({
          regraCodigo: 'DESEMPATE-PREDICADO-FATO',
          regraVersao: '1.0',
          fato: 'RELIGIAO',
          operador: 'IGUAL',
          valor: '"X"',
        }),
      ]);

      expect(componente.validate().valid).toBe(false);
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
