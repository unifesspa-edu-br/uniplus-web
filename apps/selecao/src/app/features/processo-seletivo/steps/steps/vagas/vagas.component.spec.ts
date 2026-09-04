import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DistribuicaoDeVagas } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import { VagasStepComponent } from './vagas.component';

const BASE = 'http://localhost:5000';
const PROCESSO_ID = '01960000-0000-7000-0000-0000000007aa';
const ROTA_DISTRIBUICAO = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/distribuicao-vagas`;
const ROTA_SIMULACAO = `${ROTA_DISTRIBUICAO}/simulacao`;
const OFERTA = '01960000-0000-7000-0000-0000000000f1';
const OUTRA_OFERTA = '01960000-0000-7000-0000-0000000000f2';
const MODALIDADE = '01960000-0000-7000-0000-0000000000a1';

const OUTRA_MODALIDADE = '01960000-0000-7000-0000-0000000000a2';

/** Suplementares: não dependem de origem nem de remanejamento para valer. */
const MODALIDADES = [
  {
    id: MODALIDADE,
    codigo: 'AC_I',
    descricao: 'Indígena',
    naturezaLegal: 'SUPLEMENTAR',
    composicaoVagas: 'SUPLEMENTAR_AO_TOTAL',
    composicaoOrigemCodigo: null,
    regraRemanejamento: null,
    remanejamentoDestino: null,
    remanejamentoPar: null,
    remanejamentoFallback: null,
  },
  {
    id: OUTRA_MODALIDADE,
    codigo: 'AC_Q',
    descricao: 'Quilombola',
    naturezaLegal: 'SUPLEMENTAR',
    composicaoVagas: 'SUPLEMENTAR_AO_TOTAL',
    composicaoOrigemCodigo: null,
    regraRemanejamento: null,
    remanejamentoDestino: null,
    remanejamentoPar: null,
    remanejamentoFallback: null,
  },
];

const CURSOS = [
  { id: 'curso-1', nome: 'Medicina' },
  { id: 'curso-2', nome: 'Letras' },
];

const OFERTAS = [
  {
    id: OFERTA,
    cursoId: 'curso-1',
    unidadeOfertante: { sigla: 'IGE' },
    programaDeOferta: 'REGULAR',
    formatoPedagogico: 'PRESENCIAL',
    turnos: ['MATUTINO'],
    vagasAnuaisAutorizadas: 40,
  },
  {
    id: OUTRA_OFERTA,
    cursoId: 'curso-2',
    unidadeOfertante: { sigla: 'IGE' },
    programaDeOferta: 'REGULAR',
    formatoPedagogico: 'PRESENCIAL',
    turnos: ['NOTURNO'],
    vagasAnuaisAutorizadas: 40,
  },
];

function distribuicao(ofertaCursoId: string): DistribuicaoDeVagas {
  return {
    ofertaCursoId,
    voBase: '40',
    pr: '0,5',
    regraDistribuicaoCodigo: 'DISTRIB-VAGAS-INSTITUCIONAL',
    regraDistribuicaoVersao: 'v1',
    regraAjusteCodigo: null,
    regraAjusteVersao: null,
    referenciaReservaDemograficaId: null,
    modalidades: [{ id: MODALIDADE, codigo: 'AC_I' }],
    quadro: [{ modalidadeId: MODALIDADE, quantidade: '2' }],
  };
}

describe('VagasStepComponent — remoção de oferta do quadro', () => {
  let componente: VagasStepComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let detectar: () => void;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VagasStepComponent],
      providers: [
        ProcessoSeletivoStore,
        CadastroInicialService,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(VagasStepComponent);
    componente = fixture.componentInstance;
    store = TestBed.inject(ProcessoSeletivoStore);
    controller = TestBed.inject(HttpTestingController);
    detectar = () => fixture.detectChanges();

    detectar();
    responderCatalogos();
    detectar();

    store.patchObjectSection('vagas', {
      ofertas: [distribuicao(OFERTA), distribuicao(OUTRA_OFERTA)],
    });
    detectar();
  });

  afterEach(() => controller.verify());

  /** Sem cabeçalho `Link`, a coleta de páginas encerra na primeira. */
  function responderCatalogos(): void {
    for (const requisicao of controller.match(() => true)) {
      const url = requisicao.request.url;
      if (url.includes('ofertas-curso')) requisicao.flush(OFERTAS);
      else if (url.includes('cursos')) requisicao.flush(CURSOS);
      else if (url.includes('modalidades')) requisicao.flush(MODALIDADES);
      else requisicao.flush([]);
    }
  }

  function ofertasNoQuadro(): readonly string[] {
    return store.draft().vagas.ofertas.map((item) => item.ofertaCursoId);
  }

  it('não remove ao pedir a remoção — só marca a oferta como pendente', () => {
    componente.pedirRemocao(OFERTA);

    expect(componente.remocaoPendente()).toBe(OFERTA);
    expect(ofertasNoQuadro()).toEqual([OFERTA, OUTRA_OFERTA]);
  });

  it('remove a oferta ao confirmar', () => {
    componente.pedirRemocao(OFERTA);
    componente.confirmarRemocao();

    expect(ofertasNoQuadro()).toEqual([OUTRA_OFERTA]);
    expect(componente.remocaoPendente()).toBeNull();
  });

  it('mantém a oferta ao cancelar', () => {
    componente.pedirRemocao(OFERTA);
    componente.cancelarRemocao();

    expect(ofertasNoQuadro()).toEqual([OFERTA, OUTRA_OFERTA]);
    expect(componente.remocaoPendente()).toBeNull();
  });

  /** Confirmar sem pedido pendente não pode remover a primeira da lista. */
  it('ignora a confirmação quando nada está pendente', () => {
    componente.confirmarRemocao();

    expect(ofertasNoQuadro()).toEqual([OFERTA, OUTRA_OFERTA]);
  });

  it('nomeia a oferta no aviso de confirmação', () => {
    componente.pedirRemocao(OFERTA);

    expect(componente.avisoDaRemocao()).toContain('Medicina');
    expect(componente.avisoDaRemocao()).toContain('quando o passo for gravado');
  });

  /**
   * Num processo retomado o padrão vem da primeira oferta, e `padraoPendente`
   * só é preenchido por quem edita esses campos. Sem preservá-lo, tirar a
   * última linha apagaria regra, percentual e modalidades já gravados.
   */
  it('preserva o padrão ao remover a última oferta do quadro', () => {
    comQuadroDeUmaOferta();

    componente.pedirRemocao(OFERTA);
    componente.confirmarRemocao();

    expect(store.draft().vagas.ofertas).toEqual([]);
    expect(componente.padrao()).toMatchObject({
      regraDistribuicaoCodigo: 'DISTRIB-VAGAS-INSTITUCIONAL',
      pr: '0,5',
      modalidades: [{ id: MODALIDADE, codigo: 'AC_I' }],
    });
  });

  function comQuadroDeUmaOferta(): void {
    store.patchObjectSection('vagas', { ofertas: [distribuicao(OFERTA)] });
  }

  /** Passo em leitura não abre confirmação: não há remoção a confirmar. */
  it('não abre a confirmação com a edição bloqueada', () => {
    store.salvando.set(true);
    componente.pedirRemocao(OFERTA);

    expect(componente.remocaoPendente()).toBeNull();
  });
});

describe('VagasStepComponent — gravação da distribuição', () => {
  let componente: VagasStepComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VagasStepComponent],
      providers: [
        ProcessoSeletivoStore,
        CadastroInicialService,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(VagasStepComponent);
    componente = fixture.componentInstance;
    store = TestBed.inject(ProcessoSeletivoStore);
    controller = TestBed.inject(HttpTestingController);

    fixture.detectChanges();
    for (const requisicao of controller.match(() => true)) {
      const url = requisicao.request.url;
      if (url.includes('ofertas-curso')) requisicao.flush(OFERTAS);
      else if (url.includes('cursos')) requisicao.flush(CURSOS);
      else if (url.includes('modalidades')) requisicao.flush(MODALIDADES);
      else requisicao.flush([]);
    }
    fixture.detectChanges();

    store.processoSeletivoId.set(PROCESSO_ID);
    store.patchObjectSection('vagas', {
      ofertas: [distribuicao(OFERTA), distribuicao(OUTRA_OFERTA)],
    });
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  /** A gravação exige a conferência: o passo simula antes de enviar o comando. */
  function simularEConferir(ofertas: readonly string[]): void {
    simular(ofertas);
    componente.conferenciaConfirmada.set(true);
  }

  function simular(ofertas: readonly string[]): void {
    componente.simular();
    controller.expectOne(ROTA_SIMULACAO).flush(
      ofertas.map((ofertaCursoOrigemId) => ({
        ofertaCursoOrigemId,
        quadro: [{ modalidadeOrigemId: MODALIDADE, modalidadeCodigo: 'AC_I', quantidade: 2 }],
        totalPublicado: 42,
      })),
    );
  }

  /** O comando substitui a configuração inteira: as duas ofertas vão juntas. */
  it('envia a coleção completa num único PUT', async () => {
    simularEConferir([OFERTA, OUTRA_OFERTA]);

    const gravacao = componente.persistir();

    const requisicao = controller.expectOne(ROTA_DISTRIBUICAO);
    expect(requisicao.request.method).toBe('PUT');
    expect(requisicao.request.body).toHaveLength(2);
    expect(requisicao.request.body[0]).toMatchObject({
      ofertaCursoId: OFERTA,
      voBase: 40,
      modalidadeIds: [MODALIDADE],
      quadro: [{ modalidadeId: MODALIDADE, quantidade: 2 }],
    });

    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    await expect(gravacao).resolves.toEqual({ valid: true });
  });

  /** ADR-0027: comando de escrita viaja com Idempotency-Key. */
  it('envia a gravação com Idempotency-Key', async () => {
    simularEConferir([OFERTA, OUTRA_OFERTA]);

    const gravacao = componente.persistir();

    const requisicao = controller.expectOne(ROTA_DISTRIBUICAO);
    expect(requisicao.request.headers.get('Idempotency-Key')).toBeTruthy();

    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    await gravacao;
  });

  /**
   * Cenário de aceite da #541: a recusa da API não pode apagar o formulário —
   * o operador precisa corrigir a partir do que já preencheu.
   */
  it('preserva o rascunho quando a API recusa a coleção', async () => {
    simularEConferir([OFERTA, OUTRA_OFERTA]);

    const gravacao = componente.persistir();

    controller.expectOne(ROTA_DISTRIBUICAO).flush(
      {
        type: 'about:blank',
        title: 'A quantidade de AC_I não pode ser fixada pelo edital.',
        status: 422,
        code: 'uniplus.selecao.configuracao_distribuicao_vagas.quantidade_calculada_nao_informavel',
        traceId: 'trace-1',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    const resultado = await gravacao;
    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.[0]).toBeTruthy();
    expect(store.draft().vagas.ofertas).toHaveLength(2);
    expect(store.salvando()).toBe(false);
  });

  /**
   * O que a regra calcula é a maior parte do que será publicado, e só existe
   * depois da simulação: gravar sem ela é declarar um quadro que ninguém viu.
   */
  it('recusa gravar antes de simular o quadro', async () => {
    const resultado = await componente.persistir();

    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.some((m) => m.includes('Simule o quadro'))).toBe(true);
    controller.expectNone(ROTA_DISTRIBUICAO);
  });

  /** Uma edição descarta o resultado: a conferência é sobre o que está em tela. */
  it('volta a exigir simulação depois de editar o quadro', () => {
    simularEConferir([OFERTA, OUTRA_OFERTA]);
    expect(componente.simulacaoCobreOQuadro()).toBe(true);

    componente.alterarVoBase(OFERTA, '35');

    expect(componente.simulacaoCobreOQuadro()).toBe(false);
  });

  /** Simular não é conferir: o operador declara que leu o resultado. */
  it('recusa gravar sem a declaração de conferência', async () => {
    simular([OFERTA, OUTRA_OFERTA]);

    const resultado = await componente.persistir();

    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.some((m) => m.includes('Confirme que conferiu'))).toBe(true);
    controller.expectNone(ROTA_DISTRIBUICAO);
  });

  /** Confirmar um quadro e gravar outro seria pior do que não confirmar nada. */
  it('descarta a declaração ao editar o quadro', () => {
    simularEConferir([OFERTA, OUTRA_OFERTA]);
    expect(componente.conferenciaConfirmada()).toBe(true);

    componente.alterarVoBase(OFERTA, '35');

    expect(componente.conferenciaConfirmada()).toBe(false);
  });

  /**
   * A resposta descreveria o quadro anterior, e a conferência — que só olha se
   * cada oferta tem resultado — a aceitaria como atual. Abandonar a requisição
   * resolve os dois lados: nada obsoleto é instalado, e o botão de simular fica
   * livre para o quadro novo em vez de esperar por um resultado que será
   * ignorado.
   */
  it('abandona a simulação em voo quando o quadro muda', async () => {
    componente.simular();
    const requisicao = controller.expectOne(ROTA_SIMULACAO);
    expect(componente.simulando()).toBe(true);

    componente.alterarVoBase(OFERTA, '35');

    expect(requisicao.cancelled).toBe(true);
    expect(componente.simulando()).toBe(false);
    expect(componente.simulacaoCobreOQuadro()).toBe(false);

    const resultado = await componente.persistir();
    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.some((m) => m.includes('Simule o quadro'))).toBe(true);
    controller.expectNone(ROTA_DISTRIBUICAO);
  });

  /** Simular de novo não deixa a requisição anterior competindo pelo resultado. */
  it('abandona a simulação anterior ao simular outra vez', () => {
    componente.simular();
    const primeira = controller.expectOne(ROTA_SIMULACAO);

    componente.simular();
    const segunda = controller.expectOne(ROTA_SIMULACAO);

    expect(primeira.cancelled).toBe(true);
    expect(segunda.cancelled).toBe(false);
    expect(componente.simulando()).toBe(true);
  });

  /** Sem edição no meio, a resposta é a do quadro em tela e vale. */
  it('instala a simulação quando o quadro não mudou', () => {
    simular([OFERTA, OUTRA_OFERTA]);

    expect(componente.simulacaoCobreOQuadro()).toBe(true);
  });

  /**
   * A rota é reusada entre processos e `store.reset()` não alcança signal de
   * componente. Como a cobertura é verificada por id de oferta, o resultado do
   * processo anterior valeria para o novo sempre que as ofertas coincidissem —
   * e são as mesmas quando os dois usam o catálogo de cursos da instituição.
   */
  it('descarta a simulação ao trocar de processo', () => {
    simularEConferir([OFERTA, OUTRA_OFERTA]);
    expect(componente.simulacaoCobreOQuadro()).toBe(true);

    trocarDeProcesso();

    expect(componente.simulacaoCobreOQuadro()).toBe(false);
    expect(componente.conferenciaConfirmada()).toBe(false);
  });

  /** O padrão guardado pertence ao processo em que foi guardado. */
  it('descarta o padrão preservado ao trocar de processo', () => {
    store.patchObjectSection('vagas', { ofertas: [distribuicao(OFERTA)] });
    componente.pedirRemocao(OFERTA);
    componente.confirmarRemocao();
    expect(componente.padrao().regraDistribuicaoCodigo).toBe('DISTRIB-VAGAS-INSTITUCIONAL');

    trocarDeProcesso();

    expect(componente.padrao().regraDistribuicaoCodigo).toBe('');
    expect(componente.padrao().modalidades).toEqual([]);
  });

  /**
   * O contrato guarda regra e percentual por oferta, então um processo criado
   * por outro caminho pode chegar heterogêneo. A tela mostra o padrão da
   * primeira e enviaria os valores de cada uma: gravar assim seria confirmar
   * um quadro e declarar outro.
   */
  it('recusa gravar com oferta fora do padrão em tela', async () => {
    store.patchObjectSection('vagas', {
      ofertas: [distribuicao(OFERTA), { ...distribuicao(OUTRA_OFERTA), pr: '0,75' }],
    });

    expect(componente.ofertasForaDoPadrao()).toHaveLength(1);

    const resultado = await componente.persistir();
    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.some((m) => m.includes('diferentes do padrão'))).toBe(true);
    controller.expectNone(ROTA_DISTRIBUICAO);
  });

  it('uniformiza o quadro ao aplicar o padrão a todas', () => {
    store.patchObjectSection('vagas', {
      ofertas: [distribuicao(OFERTA), { ...distribuicao(OUTRA_OFERTA), pr: '0,75' }],
    });

    componente.aplicarPadraoATodas();

    expect(componente.ofertasForaDoPadrao()).toEqual([]);
    expect(store.draft().vagas.ofertas.map((item) => item.pr)).toEqual(['0,5', '0,5']);
  });

  /** A troca de processo devolve o botão de simular ao processo novo. */
  it('desliga o indicador de simulação ao trocar de processo', () => {
    componente.simular();
    controller.expectOne(ROTA_SIMULACAO);
    expect(componente.simulando()).toBe(true);

    trocarDeProcesso();

    expect(componente.simulando()).toBe(false);
  });

  /** O que sobra do processo anterior não pertence ao que está aberto. */
  it('descarta o restante do estado local ao trocar de processo', () => {
    componente.alternarOfertaMarcada(OFERTA);
    componente.filtroDeOferta.set('medicina');
    componente.pedirRemocao(OUTRA_OFERTA);
    componente.erroDaSimulacao.set('falha anterior');

    trocarDeProcesso();

    expect(componente.ofertasMarcadas().size).toBe(0);
    expect(componente.filtroDeOferta()).toBe('');
    expect(componente.remocaoPendente()).toBeNull();
    expect(componente.erroDaSimulacao()).toBeNull();
  });

  /** O editor reusa o componente; quem troca de processo é a geração do store. */
  function trocarDeProcesso(): void {
    store.geracao.update((valor) => valor + 1);
    TestBed.tick();
  }

  /** Sem processo criado não há o que gravar, e o comando não sai. */
  it('recusa gravar antes de o processo existir', async () => {
    store.processoSeletivoId.set(null);

    const resultado = await componente.persistir();

    expect(resultado.valid).toBe(false);
    controller.expectNone(ROTA_DISTRIBUICAO);
  });

  /**
   * O comando não sai de um passo que a validação recusaria: os campos são
   * texto, e o que não é número viraria zero no envio.
   */
  it('não envia comando quando a validação do passo recusa', async () => {
    store.patchObjectSection('vagas', {
      ofertas: [{ ...distribuicao(OFERTA), voBase: '' }],
    });

    const resultado = await componente.persistir();

    expect(resultado.valid).toBe(false);
    controller.expectNone(ROTA_DISTRIBUICAO);
  });
});

describe('VagasStepComponent — totais do quadro', () => {
  let componente: VagasStepComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VagasStepComponent],
      providers: [
        ProcessoSeletivoStore,
        CadastroInicialService,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(VagasStepComponent);
    componente = fixture.componentInstance;
    store = TestBed.inject(ProcessoSeletivoStore);
    controller = TestBed.inject(HttpTestingController);

    fixture.detectChanges();
    for (const requisicao of controller.match(() => true)) {
      const url = requisicao.request.url;
      if (url.includes('ofertas-curso')) requisicao.flush(OFERTAS);
      else if (url.includes('cursos')) requisicao.flush(CURSOS);
      else if (url.includes('modalidades')) requisicao.flush(MODALIDADES);
      else requisicao.flush([]);
    }
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  function comQuadro(ofertas: readonly DistribuicaoDeVagas[]): void {
    store.patchObjectSection('vagas', { ofertas: [...ofertas] });
  }

  it('soma os totais informados pelas ofertas', () => {
    comQuadro([
      { ...distribuicao(OFERTA), voBase: '40' },
      { ...distribuicao(OUTRA_OFERTA), voBase: '30' },
    ]);

    expect(componente.totalGeralDeVagas()).toBe(70);
  });

  it('soma a coluna de uma modalidade declarada', () => {
    comQuadro([
      { ...distribuicao(OFERTA), quadro: [{ modalidadeId: MODALIDADE, quantidade: '5' }] },
      { ...distribuicao(OUTRA_OFERTA), quadro: [{ modalidadeId: MODALIDADE, quantidade: '7' }] },
    ]);

    expect(componente.totalDeclaradoDe(MODALIDADE)).toBe(12);
  });

  /**
   * Célula vazia ou malformada já é apontada pela validação; somá-la como
   * `NaN` apagaria o total inteiro, e o operador perderia a única leitura que
   * diz quantas vagas o processo publica.
   */
  it.each([[''], ['dez'], ['-5'], ['1e2']])('ignora o total malformado %j na soma', (voBase) => {
    comQuadro([
      { ...distribuicao(OFERTA), voBase: '40' },
      { ...distribuicao(OUTRA_OFERTA), voBase },
    ]);

    expect(componente.totalGeralDeVagas()).toBe(40);
  });

  it('devolve zero sem nenhuma oferta no quadro', () => {
    comQuadro([]);

    expect(componente.totalGeralDeVagas()).toBe(0);
    expect(componente.totalGeralPublicado()).toBe(0);
  });
});

const REGRA_INSTITUCIONAL = {
  codigo: 'DISTRIB-VAGAS-INSTITUCIONAL',
  versao: 'v1',
  tipo: 'regra_distribuicao_vagas',
  esquemaArgs: {},
  invariantes: [],
  baseLegal: 'Res. Unifesspa 532/2021',
  hash: 'hash-institucional',
  modalidadesAdmitidas: null,
};

/** O rol fechado coincide, de propósito, com o catálogo de duas modalidades já usado nos demais testes. */
const REGRA_PSIQ = {
  codigo: 'DISTRIB-VAGAS-PSIQ',
  versao: 'v1',
  tipo: 'regra_distribuicao_vagas',
  esquemaArgs: {},
  invariantes: [],
  baseLegal: 'Portaria Normativa MEC 18/2012',
  hash: 'hash-psiq',
  modalidadesAdmitidas: ['AC_I', 'AC_Q'],
};

describe('VagasStepComponent — regra determina o rol de modalidades', () => {
  let componente: VagasStepComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let detectar: () => void;
  let elementoRaiz: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VagasStepComponent],
      providers: [
        ProcessoSeletivoStore,
        CadastroInicialService,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(VagasStepComponent);
    componente = fixture.componentInstance;
    store = TestBed.inject(ProcessoSeletivoStore);
    controller = TestBed.inject(HttpTestingController);
    detectar = () => fixture.detectChanges();
    elementoRaiz = fixture.nativeElement;

    detectar();
    for (const requisicao of controller.match(() => true)) {
      const url = requisicao.request.url;
      if (url.includes('ofertas-curso')) requisicao.flush(OFERTAS);
      else if (url.includes('cursos')) requisicao.flush(CURSOS);
      else if (url.includes('modalidades')) requisicao.flush(MODALIDADES);
      else if (url.includes('regras-catalogo')) {
        const tipo = requisicao.request.params.get('tipo');
        requisicao.flush(tipo === 'regra_distribuicao_vagas' ? [REGRA_INSTITUCIONAL, REGRA_PSIQ] : []);
      } else requisicao.flush([]);
    }
    detectar();
  });

  afterEach(() => controller.verify());

  it('rol aberto (Institucional) oferece o catálogo inteiro para seleção livre', () => {
    expect(componente.rolDaRegraEscolhida()).toBeNull();
    expect(componente.modalidadesOferecidas().map((m) => m.codigo)).toEqual(['AC_I', 'AC_Q']);
  });

  it('trocar para regra sem dado a perder aplica direto, sem confirmação', () => {
    store.patchObjectSection('vagas', { ofertas: [] });
    detectar();

    componente.escolherRegraDistribuicao('DISTRIB-VAGAS-PSIQ|v1');

    expect(componente.trocaDeRegraPendente()).toBeNull();
    expect(componente.padrao().regraDistribuicaoCodigo).toBe('DISTRIB-VAGAS-PSIQ');
    expect(componente.padrao().modalidades.map((m) => m.codigo).sort()).toEqual(['AC_I', 'AC_Q']);
  });

  it('trocar de regra com dado preenchido pede confirmação antes de mudar', () => {
    store.patchObjectSection('vagas', { ofertas: [distribuicao(OFERTA)] });
    detectar();

    componente.escolherRegraDistribuicao('DISTRIB-VAGAS-PSIQ|v1');

    expect(componente.trocaDeRegraPendente()).toEqual({ codigo: 'DISTRIB-VAGAS-PSIQ', versao: 'v1' });
    expect(componente.padrao().regraDistribuicaoCodigo).toBe('DISTRIB-VAGAS-INSTITUCIONAL');
  });

  it('confirmar a troca aplica o rol fechado da nova regra por inteiro', () => {
    store.patchObjectSection('vagas', { ofertas: [distribuicao(OFERTA)] });
    detectar();

    componente.escolherRegraDistribuicao('DISTRIB-VAGAS-PSIQ|v1');
    componente.confirmarTrocaDeRegra();

    expect(componente.trocaDeRegraPendente()).toBeNull();
    expect(componente.padrao().regraDistribuicaoCodigo).toBe('DISTRIB-VAGAS-PSIQ');
    expect(componente.padrao().modalidades.map((m) => m.codigo).sort()).toEqual(['AC_I', 'AC_Q']);
    expect(componente.rolDaRegraEscolhida()).toEqual(['AC_I', 'AC_Q']);
  });

  it('cancelar a troca mantém a regra e as modalidades como estavam', () => {
    store.patchObjectSection('vagas', { ofertas: [distribuicao(OFERTA)] });
    detectar();

    componente.escolherRegraDistribuicao('DISTRIB-VAGAS-PSIQ|v1');
    componente.cancelarTrocaDeRegra();

    expect(componente.trocaDeRegraPendente()).toBeNull();
    expect(componente.padrao().regraDistribuicaoCodigo).toBe('DISTRIB-VAGAS-INSTITUCIONAL');
    expect(componente.padrao().modalidades).toEqual([{ id: MODALIDADE, codigo: 'AC_I' }]);
  });

  it('rol fechado não aceita alternar modalidade manualmente', () => {
    store.patchObjectSection('vagas', { ofertas: [distribuicao(OFERTA)] });
    detectar();
    componente.escolherRegraDistribuicao('DISTRIB-VAGAS-PSIQ|v1');
    componente.confirmarTrocaDeRegra();

    componente.alternarModalidade({ id: MODALIDADE, codigo: 'AC_I' } as never);

    expect(componente.padrao().modalidades.map((m) => m.codigo).sort()).toEqual(['AC_I', 'AC_Q']);
  });

  /** Processo hidratado por fora do fluxo normal, trazendo modalidade que a regra atual não admite. */
  it('nomeia a modalidade hidratada fora do rol fechado, em vez de escondê-la', () => {
    store.patchObjectSection('vagas', {
      ofertas: [
        {
          ...distribuicao(OFERTA),
          regraDistribuicaoCodigo: 'DISTRIB-VAGAS-PSIQ',
          regraDistribuicaoVersao: 'v1',
          modalidades: [
            { id: MODALIDADE, codigo: 'AC_I' },
            { id: OUTRA_MODALIDADE, codigo: 'AC_Q' },
            { id: '01960000-0000-7000-0000-0000000000a9', codigo: 'PCD_PURO' },
          ],
        },
      ],
    });
    detectar();

    const problemas = componente.problemasDe(store.draft().vagas.ofertas[0]);

    expect(
      problemas.some(
        (p) => p.mensagem.includes('PCD_PURO') && p.mensagem.includes('não pertence ao rol'),
      ),
    ).toBe(true);
  });

  it('rol fechado incompleto: selecaoBateComORol acusa, e reaplicarRolDaRegra completa', () => {
    store.patchObjectSection('vagas', {
      ofertas: [
        {
          ...distribuicao(OFERTA),
          regraDistribuicaoCodigo: 'DISTRIB-VAGAS-PSIQ',
          regraDistribuicaoVersao: 'v1',
          modalidades: [{ id: MODALIDADE, codigo: 'AC_I' }],
        },
      ],
    });
    detectar();

    expect(componente.selecaoBateComORol()).toBe(false);

    componente.reaplicarRolDaRegra();

    expect(componente.selecaoBateComORol()).toBe(true);
    expect(componente.padrao().modalidades.map((m) => m.codigo).sort()).toEqual(['AC_I', 'AC_Q']);
  });

  /**
   * Diferente do caso "só falta" acima: aqui a modalidade excedente tem
   * quantidade preenchida no quadro — reaplicar descartaria essa quantidade
   * em silêncio se não pedisse confirmação, a mesma perda que a troca de
   * regra evita.
   */
  it('reaplicar o rol com quantidade a perder no quadro pede confirmação antes de completar', () => {
    store.patchObjectSection('vagas', {
      ofertas: [
        {
          ...distribuicao(OFERTA),
          regraDistribuicaoCodigo: 'DISTRIB-VAGAS-PSIQ',
          regraDistribuicaoVersao: 'v1',
          modalidades: [
            { id: MODALIDADE, codigo: 'AC_I' },
            { id: OUTRA_MODALIDADE, codigo: 'AC_Q' },
            { id: '01960000-0000-7000-0000-0000000000a9', codigo: 'PCD_PURO' },
          ],
          quadro: [{ modalidadeId: '01960000-0000-7000-0000-0000000000a9', quantidade: '3' }],
        },
      ],
    });
    detectar();

    componente.reaplicarRolDaRegra();

    expect(componente.reaplicarRolPendente()).toBe(true);
    expect(componente.padrao().modalidades.map((m) => m.codigo).sort()).toEqual([
      'AC_I',
      'AC_Q',
      'PCD_PURO',
    ]);

    componente.confirmarReaplicarRol();

    expect(componente.reaplicarRolPendente()).toBe(false);
    expect(componente.padrao().modalidades.map((m) => m.codigo).sort()).toEqual(['AC_I', 'AC_Q']);
  });

  it('cancelar o reaplicar do rol mantém a seleção divergente como estava', () => {
    store.patchObjectSection('vagas', {
      ofertas: [
        {
          ...distribuicao(OFERTA),
          regraDistribuicaoCodigo: 'DISTRIB-VAGAS-PSIQ',
          regraDistribuicaoVersao: 'v1',
          modalidades: [
            { id: MODALIDADE, codigo: 'AC_I' },
            { id: '01960000-0000-7000-0000-0000000000a9', codigo: 'PCD_PURO' },
          ],
          quadro: [{ modalidadeId: '01960000-0000-7000-0000-0000000000a9', quantidade: '3' }],
        },
      ],
    });
    detectar();

    componente.reaplicarRolDaRegra();
    componente.cancelarReaplicarRol();

    expect(componente.reaplicarRolPendente()).toBe(false);
    expect(componente.padrao().modalidades.map((m) => m.codigo).sort()).toEqual([
      'AC_I',
      'PCD_PURO',
    ]);
  });

  it('rol fechado com a seleção certa: selecaoBateComORol aprova', () => {
    store.patchObjectSection('vagas', { ofertas: [distribuicao(OFERTA)] });
    detectar();

    componente.escolherRegraDistribuicao('DISTRIB-VAGAS-PSIQ|v1');
    componente.confirmarTrocaDeRegra();

    expect(componente.selecaoBateComORol()).toBe(true);
  });

  /**
   * NgModel só reescreve o <select> nativo quando o valor do binding muda
   * entre ciclos de detecção — chamar os métodos direto na instância (como os
   * demais testes deste describe) não exercita essa reescrita. Este teste
   * interage com o elemento real.
   */
  it('cancelar a troca devolve o <select> nativo à regra vigente, não à rejeitada', () => {
    store.patchObjectSection('vagas', { ofertas: [distribuicao(OFERTA)] });
    detectar();

    const campoRegra = elementoRaiz.querySelector<HTMLSelectElement>('#f-regra');
    if (campoRegra === null) throw new Error('Campo #f-regra não encontrado no template.');

    campoRegra.value = 'DISTRIB-VAGAS-PSIQ|v1';
    campoRegra.dispatchEvent(new Event('change'));
    detectar();

    expect(componente.trocaDeRegraPendente()).not.toBeNull();
    expect(campoRegra.value).toBe('DISTRIB-VAGAS-PSIQ|v1');

    componente.cancelarTrocaDeRegra();
    detectar();

    expect(campoRegra.value).toBe('DISTRIB-VAGAS-INSTITUCIONAL|v1');
  });
});

describe('VagasStepComponent — reaplicar o rol sob composição calculada', () => {
  let componente: VagasStepComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let detectar: () => void;

  const MODALIDADE_CALCULADA = '01960000-0000-7000-0000-0000000000c1';

  const MODALIDADES_FEDERAL = [
    {
      id: MODALIDADE,
      codigo: 'AC_I',
      descricao: 'Indígena',
      naturezaLegal: 'SUPLEMENTAR',
      composicaoVagas: 'SUPLEMENTAR_AO_TOTAL',
      composicaoOrigemCodigo: null,
      regraRemanejamento: null,
      remanejamentoDestino: null,
      remanejamentoPar: null,
      remanejamentoFallback: null,
    },
    {
      id: MODALIDADE_CALCULADA,
      codigo: 'X_CALC',
      descricao: 'Calculada pela regra',
      naturezaLegal: 'COTA_RESERVADA',
      composicaoVagas: 'DENTRO_DO_VR',
      composicaoOrigemCodigo: null,
      regraRemanejamento: null,
      remanejamentoDestino: null,
      remanejamentoPar: null,
      remanejamentoFallback: null,
    },
  ];

  const REGRA_FEDERAL = {
    codigo: 'DISTRIB-VAGAS-LEI-12711',
    versao: 'v1',
    tipo: 'regra_distribuicao_vagas',
    esquemaArgs: {},
    invariantes: [],
    baseLegal: 'Lei 12.711/2012',
    hash: 'hash-federal',
    modalidadesAdmitidas: ['AC_I', 'X_CALC'],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VagasStepComponent],
      providers: [
        ProcessoSeletivoStore,
        CadastroInicialService,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(VagasStepComponent);
    componente = fixture.componentInstance;
    store = TestBed.inject(ProcessoSeletivoStore);
    controller = TestBed.inject(HttpTestingController);
    detectar = () => fixture.detectChanges();

    detectar();
    for (const requisicao of controller.match(() => true)) {
      const url = requisicao.request.url;
      if (url.includes('ofertas-curso')) requisicao.flush(OFERTAS);
      else if (url.includes('cursos')) requisicao.flush(CURSOS);
      else if (url.includes('modalidades')) requisicao.flush(MODALIDADES_FEDERAL);
      else if (url.includes('regras-catalogo')) {
        const tipo = requisicao.request.params.get('tipo');
        requisicao.flush(tipo === 'regra_distribuicao_vagas' ? [REGRA_FEDERAL] : []);
      } else requisicao.flush([]);
    }
    detectar();
  });

  afterEach(() => controller.verify());

  /**
   * A modalidade continua no rol — o id permanece selecionado —, mas sua
   * composicaoVagas é calculada pela fórmula do art. 10 sob ramo federal:
   * quadroCoerente descarta a quantidade fixada por essa segunda condição,
   * não porque a modalidade saiu da seleção. Checar só "saiu do rol" não
   * pega esse caso — reaplicarRolDaRegra precisa comparar com o resultado
   * real de quadroCoerente, não reimplementar metade do filtro dele.
   */
  it('pede confirmação quando a quantidade que seria perdida é de composição calculada, não de modalidade fora do rol', () => {
    store.patchObjectSection('vagas', {
      ofertas: [
        {
          ofertaCursoId: OFERTA,
          voBase: '40',
          pr: '0,5',
          regraDistribuicaoCodigo: 'DISTRIB-VAGAS-LEI-12711',
          regraDistribuicaoVersao: 'v1',
          regraAjusteCodigo: null,
          regraAjusteVersao: null,
          referenciaReservaDemograficaId: null,
          modalidades: [
            { id: MODALIDADE, codigo: 'AC_I' },
            { id: MODALIDADE_CALCULADA, codigo: 'X_CALC' },
          ],
          quadro: [{ modalidadeId: MODALIDADE_CALCULADA, quantidade: '5' }],
        },
      ],
    });
    detectar();

    componente.reaplicarRolDaRegra();

    expect(componente.reaplicarRolPendente()).toBe(true);
  });

  /**
   * selecaoBateComORol não vê essa divergência: os ids batem com o rol, a
   * checagem é sobre o CONTEÚDO do quadro. Sem reaplicarRolTemEfeito, o
   * botão "Recompor pelo rol da regra atual" ficaria escondido e a única
   * saída seria remover e recriar a oferta — o achado original do Codex.
   */
  it('reaplicarRolTemEfeito acusa mesmo quando a seleção já bate com o rol', () => {
    store.patchObjectSection('vagas', {
      ofertas: [
        {
          ofertaCursoId: OFERTA,
          voBase: '40',
          pr: '0,5',
          regraDistribuicaoCodigo: 'DISTRIB-VAGAS-LEI-12711',
          regraDistribuicaoVersao: 'v1',
          regraAjusteCodigo: null,
          regraAjusteVersao: null,
          referenciaReservaDemograficaId: null,
          modalidades: [
            { id: MODALIDADE, codigo: 'AC_I' },
            { id: MODALIDADE_CALCULADA, codigo: 'X_CALC' },
          ],
          quadro: [{ modalidadeId: MODALIDADE_CALCULADA, quantidade: '5' }],
        },
      ],
    });
    detectar();

    expect(componente.selecaoBateComORol()).toBe(true);
    expect(componente.reaplicarRolTemEfeito()).toBe(true);
  });
});
