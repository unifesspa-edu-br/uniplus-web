import { HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { apiOk, errorResult, mockProblemDetails, okResult } from '@uniplus/shared-core/http';
import {
  ModalidadeDto,
  ModalidadesApi,
  TipoProcessoDto,
  TiposProcessoApi,
} from '@uniplus/shared-data/configuracao';
import { GeoApi } from '@uniplus/shared-data/geo';
import { UnidadeDto, UnidadesApi } from '@uniplus/shared-data/organizacao';
import {
  DocumentoEditalDto,
  ProcessoSeletivoDto,
  ProcessosSeletivosApi,
} from '@uniplus/shared-data/selecao';
import { BehaviorSubject, from, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EditorRouteReuseStrategy, ROTA_REUSE_KEY } from '../../editor-route-reuse.strategy';
import { ProcessoSeletivoPage } from './processo-seletivo.page';
import { CadastroInicialService } from './steps/shared/cadastro-inicial.service';
import { PROCESSO_SELETIVO_ROUTES } from './processo-seletivo.routes';

const PROCESSO_ID = '019f41cf-69fd-759a-ac6d-09acabc1b027';
const TIPO_ORIGEM_ID = '019f41cf-69fd-759a-ac6d-09acabc1b028';
const UNIDADE_ORIGEM_ID = '019f41cf-69fd-759a-ac6d-09acabc1b029';

const tiposProcessoApiStub = {
  listar: () => of(apiOk<readonly TipoProcessoDto[]>([], 200, new HttpHeaders())),
};
const unidadesApiStub = {
  listar: () => of(apiOk<readonly UnidadeDto[]>([], 200, new HttpHeaders())),
};
const geoApiStub = {
  listarCidades: () => of(apiOk<readonly never[]>([], 200, new HttpHeaders())),
};
const modalidadesApiStub = {
  listar: () => of(apiOk<readonly ModalidadeDto[]>([], 200, new HttpHeaders())),
};

/**
 * Detalhe canônico mínimo. As dimensões que o wizard ainda não edita entram
 * vazias de propósito — o teste do snapshot remoto confere que elas sobrevivem
 * à projeção, e é isso que o CA-05 protege.
 */
function detalhe(overrides: Partial<ProcessoSeletivoDto> = {}): ProcessoSeletivoDto {
  return {
    id: PROCESSO_ID,
    nome: 'Vestibular 2026.1',
    tipoProcesso: { origemId: TIPO_ORIGEM_ID, codigo: 'VESTIBULAR', nome: 'Vestibular' },
    status: 'Rascunho',
    // Como a API emite de fato: a criação recebe `inscricaoPropria`, mas o
    // detalhe devolve o nome do enum de domínio (uniplus-api#1294).
    origemCandidatos: 'InscricaoPropria',
    unidadeAdministradora: {
      origemId: UNIDADE_ORIGEM_ID,
      sigla: 'IGE',
      slug: 'ige',
      nome: 'Instituto de Geociências e Engenharias',
    },
    localidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
    etapas: [],
    ofertaAtendimento: null,
    distribuicaoVagas: [],
    bonusRegional: null,
    cascata: null,
    criteriosDesempate: [],
    classificacao: null,
    cronogramaFases: [],
    documentosExigidos: [],
    raizesExigencia: [],
    referenciaTemporalFatos: null,
    configuracaoTaxaInscricao: {
      cobra: true,
      valor: 230,
      fundamentos: ['CADASTRO_UNICO', 'DOACAO_MEDULA_OSSEA'],
      confirmacaoFundamentos: true,
    },
    ...overrides,
  } as ProcessoSeletivoDto;
}

function documento(overrides: Partial<DocumentoEditalDto> = {}): DocumentoEditalDto {
  return {
    id: '019f41cf-69fd-759a-ac6d-09acabc1b030',
    processoSeletivoId: PROCESSO_ID,
    status: 'Confirmado',
    criadoEm: '2026-08-20T12:00:00Z',
    expiraEm: '2026-08-20T12:15:00Z',
    tamanhoBytes: 2048,
    hashSha256: 'a'.repeat(64),
    confirmadoEm: '2026-08-20T12:05:00Z',
    ...overrides,
  };
}

interface CenarioOpts {
  readonly id?: string | null;
  readonly obter?: ReturnType<typeof vi.fn>;
  readonly listarDocumentos?: ReturnType<typeof vi.fn>;
  /** Simula catálogo de tipos indisponível. */
  readonly tiposFalham?: boolean;
  /** Simula catálogo de unidades indisponível. */
  readonly unidadesFalham?: boolean;
  /** Permite emitir mudanças de rota durante o teste. */
  readonly paramMap?: BehaviorSubject<{ get: (k: string) => string | null }>;
}

function montar(opts: CenarioOpts = {}) {
  const obter = opts.obter ?? vi.fn(() => of(okResult(detalhe())));
  const definirTaxaInscricao = vi.fn(() => of(okResult(undefined)));
  const listarDocumentos = opts.listarDocumentos ?? vi.fn(() => of(okResult([])));
  const id = opts.id === undefined ? PROCESSO_ID : opts.id;

  TestBed.configureTestingModule({
    imports: [ProcessoSeletivoPage],
    providers: [
      provideRouter([]),
      {
        provide: TiposProcessoApi,
        useValue: opts.tiposFalham
          ? { listar: () => of(errorResult(mockProblemDetails({ status: 503 }))) }
          : tiposProcessoApiStub,
      },
      {
        provide: UnidadesApi,
        useValue: opts.unidadesFalham
          ? { listar: () => of(errorResult(mockProblemDetails({ status: 503 }))) }
          : unidadesApiStub,
      },
      { provide: GeoApi, useValue: geoApiStub },
      { provide: ModalidadesApi, useValue: modalidadesApiStub },
      {
        provide: ProcessosSeletivosApi,
        useValue: {
          obter,
          listarDocumentosEdital: listarDocumentos,
          listarFundamentosIsencao: () => of(okResult<readonly FundamentoIsencaoDto[]>([])),
          definirTaxaInscricao,
        },
      },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { paramMap: { get: () => id } },
          paramMap: opts.paramMap ?? of({ get: () => id }),
        },
      },
    ],
  });

  // O roteador do TestBed não conhece as rotas reais; navegar de verdade
  // rejeitaria com NG04002. Os testes que verificam a troca de endereço leem
  // este espião.
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

  const fixture = TestBed.createComponent(ProcessoSeletivoPage);
  fixture.detectChanges();

  return {
    fixture,
    obter,
    listarDocumentos,
    definirTaxaInscricao,
    navigate,
    componente: fixture.componentInstance,
    // O store é provido pela própria página, não pelo injector do TestBed.
    store: fixture.componentInstance.store,
    host: fixture.nativeElement as HTMLElement,
  };
}

const propagar = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('ProcessoSeletivoPage — retomada por endereço', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('lê o detalhe do processo indicado pela rota', async () => {
    const cenario = montar();
    await propagar();

    expect(cenario.obter).toHaveBeenCalledWith(PROCESSO_ID);
    expect(cenario.store.processoSeletivoId()).toBe(PROCESSO_ID);
  });

  /**
   * CA-05: as dimensões sem tela própria não podem sumir só porque o wizard
   * ainda não sabe editá-las — o snapshot guarda o agregado inteiro.
   */
  it('preserva o detalhe canônico inteiro como snapshot remoto', async () => {
    const dto = detalhe({
      etapas: [{ ordem: 1 }] as unknown as ProcessoSeletivoDto['etapas'],
    });
    const cenario = montar({ obter: vi.fn(() => of(okResult(dto))) });
    await propagar();

    expect(cenario.store.remoteSnapshot()).toEqual(dto);
    expect(cenario.store.remoteSnapshot()?.etapas).toHaveLength(1);
  });

  it('projeta no rascunho apenas o que já tem tela', async () => {
    const cenario = montar();
    await propagar();

    const draft = cenario.store.draft();
    expect(draft.tipoProcesso.selected).toBe(TIPO_ORIGEM_ID);
    expect(draft.identificacao.nome).toBe('Vestibular 2026.1');
    expect(draft.identificacao.unidadeAdministradoraId).toBe(UNIDADE_ORIGEM_ID);
    expect(draft.identificacao.localidade).toEqual({
      codigoIbge: '1504208',
      nome: 'Marabá',
      uf: 'PA',
    });
  });

  /**
   * O vocabulário da leitura não é o da escrita: aceitar o valor cru deixaria
   * no rascunho algo que nenhuma `<option>` casa, e o campo apareceria em
   * branco num processo que declarou a origem.
   */
  it('traduz a origem dos candidatos do vocabulário da leitura', async () => {
    const cenario = montar();
    await propagar();

    expect(cenario.store.draft().identificacao.origemCandidatos).toBe('inscricaoPropria');
  });

  it('deixa a origem em branco quando o valor não é do vocabulário conhecido', async () => {
    const cenario = montar({
      obter: vi.fn(() => of(okResult(detalhe({ origemCandidatos: 'Nenhuma' })))),
    });
    await propagar();

    expect(cenario.store.draft().identificacao.origemCandidatos).toBe('');
  });

  /** Retomar equivale a ter criado: o contrato não expõe atualização desses campos. */
  it('congela o cadastro inicial depois de hidratar', async () => {
    const cenario = montar();
    await propagar();

    expect(cenario.store.cadastroInicialCongelado()).toBe(true);
  });

  it('restaura o vínculo quando há um único documento confirmado', async () => {
    const cenario = montar({
      listarDocumentos: vi.fn(() => of(okResult([documento()]))),
    });
    await propagar();

    const uploads = cenario.store.draft().identificacao.uploads;
    expect(uploads).toHaveLength(1);
    expect(uploads[0].documentoEditalId).toBe('019f41cf-69fd-759a-ac6d-09acabc1b030');
    expect(cenario.store.documentosParaEscolha()).toHaveLength(0);
  });

  /**
   * CA-06: adotar o mais recente trocaria o edital do certame sem o operador
   * perceber. Nenhum é vinculado até haver decisão.
   */
  it('não elege o oficial quando há mais de um documento confirmado', async () => {
    const cenario = montar({
      listarDocumentos: vi.fn(() =>
        of(
          okResult([
            documento(),
            documento({
              id: '019f41cf-69fd-759a-ac6d-09acabc1b031',
              confirmadoEm: '2026-08-21T09:00:00Z',
            }),
          ]),
        ),
      ),
    });
    await propagar();

    expect(cenario.store.documentosParaEscolha()).toHaveLength(2);
    expect(cenario.store.draft().identificacao.uploads).toHaveLength(0);
  });

  /**
   * O catálogo devolve só tipos ativos. Um processo criado antes de o tipo ser
   * desativado continuaria apontando para ele, e o passo 1 abriria sem seleção
   * — com o cadastro congelado, sem meio de identificar o que está lá.
   */
  it('mostra o tipo do processo mesmo fora do catálogo ativo', async () => {
    const cenario = montar();
    await propagar();
    cenario.fixture.detectChanges();

    expect(cenario.host.textContent).toContain('Vestibular');
    expect(cenario.host.textContent).toContain('Tipo não disponível no catálogo atual');
  });

  /**
   * Falha ao carregar o catálogo não pode esconder o tipo do processo: ele vem
   * do snapshot, não do catálogo, e o cadastro congelado tira do operador
   * qualquer outra forma de descobri-lo.
   */
  it('mostra o tipo do processo mesmo quando o catálogo falha', async () => {
    TestBed.resetTestingModule();
    const cenario = montar({ tiposFalham: true });
    await propagar();
    cenario.fixture.detectChanges();

    expect(cenario.host.querySelector('[role=alert]')).not.toBeNull();
    expect(cenario.host.textContent).toContain('Vestibular');
  });

  /**
   * Mesmo caso do tipo, na unidade: o catálogo pode não trazê-la — por
   * remoção ou por falha na leitura — e o campo congelado abriria sem valor,
   * sem o operador saber quem administra o certame.
   */
  it('mostra a unidade administradora mesmo fora do catálogo carregado', async () => {
    const cenario = montar();
    await propagar();
    cenario.fixture.detectChanges();

    const opcao = [...cenario.host.querySelectorAll('#f-unidade option')].find(
      (o) => o.getAttribute('value') === UNIDADE_ORIGEM_ID,
    );

    expect(opcao?.textContent).toContain('IGE');
    expect(opcao?.textContent).toContain('Instituto de Geociências e Engenharias');
  });

  /**
   * Fecha a matriz: os dois campos que dependem de catálogo — tipo e unidade —
   * precisam mostrar o snapshot tanto quando o catálogo não traz o id quanto
   * quando o catálogo não responde. Foi por tratar esses estados isoladamente
   * que a lacuna do tipo sob erro passou despercebida.
   */
  it('mostra a unidade administradora mesmo quando o catálogo falha', async () => {
    TestBed.resetTestingModule();
    const cenario = montar({ unidadesFalham: true });
    await propagar();
    cenario.fixture.detectChanges();

    const opcao = [...cenario.host.querySelectorAll('#f-unidade option')].find(
      (o) => o.getAttribute('value') === UNIDADE_ORIGEM_ID,
    );

    expect(opcao?.textContent).toContain('IGE');
    expect(cenario.host.querySelector('.field__erro')).not.toBeNull();
  });

  /**
   * Enviar outro edital durante a escolha criaria um terceiro documento
   * imutável, agravando a ambiguidade que a escolha existe para resolver.
   */
  it('bloqueia o envio de novo edital enquanto a escolha está pendente', async () => {
    const cenario = montar({
      listarDocumentos: vi.fn(() =>
        of(okResult([documento(), documento({ id: '019f41cf-69fd-759a-ac6d-09acabc1b031' })])),
      ),
    });
    await propagar();
    cenario.fixture.detectChanges();

    const zona = cenario.host.querySelector('.upload-zone');
    expect(zona?.getAttribute('aria-disabled')).toBe('true');

    // O input é visualmente oculto mas focável: bloquear só a zona deixaria a
    // navegação por teclado burlar a escolha.
    const input = cenario.host.querySelector<HTMLInputElement>('input[type=file]');
    expect(input?.disabled).toBe(true);
  });

  /**
   * Dois confirmados no mesmo minuto renderizavam botões idênticos — pedir
   * escolha entre opções indistinguíveis é pior do que escolher sozinho, e o
   * contrato não devolve nome de arquivo nem oferece rota de download. Restam
   * os metadados: instante com segundos, tamanho e início do hash.
   */
  it('distingue documentos confirmados no mesmo minuto', async () => {
    const cenario = montar({
      listarDocumentos: vi.fn(() =>
        of(
          okResult([
            documento({
              confirmadoEm: '2026-08-20T12:05:10Z',
              tamanhoBytes: 2048,
              hashSha256: 'a'.repeat(64),
            }),
            documento({
              id: '019f41cf-69fd-759a-ac6d-09acabc1b031',
              confirmadoEm: '2026-08-20T12:05:40Z',
              tamanhoBytes: 4096,
              hashSha256: 'b'.repeat(64),
            }),
          ]),
        ),
      ),
    });
    await propagar();
    cenario.fixture.detectChanges();

    // Cada documento oferece duas ações — usar e abrir para conferir —, então o
    // que identifica a opção é o rótulo da escolha, não a contagem de botões.
    const rotulos = [...cenario.host.querySelectorAll('.ps-doc-escolha button')]
      .map((b) => b.getAttribute('aria-label'))
      .filter((rotulo): rotulo is string => rotulo?.startsWith('Usar o documento') ?? false);

    expect(rotulos).toHaveLength(2);
    expect(rotulos[0]).not.toBe(rotulos[1]);
    expect(rotulos[0]).toContain('aaaaaaaaaaaa');
    expect(rotulos[1]).toContain('bbbbbbbbbbbb');
    expect(rotulos[0]).toContain('2,0 KB');
    expect(rotulos[1]).toContain('4,0 KB');
    // Segundos separam o que o minuto não separa.
    expect(rotulos[0]).toContain(':10');
    expect(rotulos[1]).toContain(':40');
  });

  it('ignora documentos pendentes ao restaurar o vínculo', async () => {
    const cenario = montar({
      listarDocumentos: vi.fn(() =>
        of(okResult([documento({ status: 'Pendente', confirmadoEm: null })])),
      ),
    });
    await propagar();

    expect(cenario.store.draft().identificacao.uploads).toHaveLength(0);
    expect(cenario.store.documentosParaEscolha()).toHaveLength(0);
  });

  /** O processo foi lido; só o anexo não pôde ser verificado. */
  it('mantém o editor utilizável quando a leitura dos documentos falha', async () => {
    const cenario = montar({
      listarDocumentos: vi.fn(() => of(errorResult(mockProblemDetails({ status: 503 })))),
    });
    await propagar();

    expect(cenario.store.falhaDeLeitura()).toBeNull();
    expect(cenario.store.processoSeletivoId()).toBe(PROCESSO_ID);
  });

  /**
   * Um aviso guardado em signal e nunca renderizado não protege ninguém: o
   * operador veria o controle de upload vazio e concluiria que não há edital
   * anexado, criando um segundo documento imutável.
   */
  it('mostra na tela o aviso de que o anexo não pôde ser verificado', async () => {
    const cenario = montar({
      listarDocumentos: vi.fn(() => of(errorResult(mockProblemDetails({ status: 503 })))),
    });
    await propagar();
    cenario.fixture.detectChanges();

    expect(cenario.store.avisoDocumentos()).not.toBeNull();
    expect(cenario.host.textContent).toContain('já tem edital anexado');
  });

  /**
   * A API aceita um segundo documento sem recusar — `IniciarPendente` não
   * confere se já há confirmado. Com a verificação falha, anexar é apostar que
   * não existe edital; o bloqueio dura só enquanto o estado é desconhecido.
   */
  it('trava o anexo enquanto o estado dos documentos é desconhecido', async () => {
    const cenario = montar({
      listarDocumentos: vi.fn(() => of(errorResult(mockProblemDetails({ status: 503 })))),
    });
    await propagar();
    cenario.fixture.detectChanges();

    const input = cenario.host.querySelector<HTMLInputElement>('input[type=file]');
    expect(input?.disabled).toBe(true);
    expect(cenario.host.querySelector('.upload-zone')?.getAttribute('aria-disabled')).toBe('true');
  });

  /** Travar sem saída deixaria o operador preso: o aviso oferece refazer. */
  it('destrava o anexo quando a reverificação encontra o processo sem edital', async () => {
    const listar = vi
      .fn()
      .mockReturnValueOnce(of(errorResult(mockProblemDetails({ status: 503 }))))
      .mockReturnValueOnce(of(okResult([])));
    const cenario = montar({ listarDocumentos: listar });
    await propagar();
    cenario.fixture.detectChanges();

    const botao = [...cenario.host.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Verificar novamente'),
    ) as HTMLButtonElement;
    expect(botao).toBeDefined();

    botao.click();
    await propagar();
    cenario.fixture.detectChanges();

    expect(listar).toHaveBeenCalledTimes(2);
    expect(cenario.store.avisoDocumentos()).toBeNull();
    expect(cenario.host.querySelector<HTMLInputElement>('input[type=file]')?.disabled).toBe(false);
  });

  it('não avisa quando a leitura dos documentos funciona', async () => {
    const cenario = montar();
    await propagar();
    cenario.fixture.detectChanges();

    expect(cenario.store.avisoDocumentos()).toBeNull();
    expect(cenario.host.textContent).not.toContain('já tem edital anexado');
  });

  /**
   * O painel de etapas só entra no DOM depois da leitura; sem observar o fim
   * da hidratação, o foco ficaria no estado de carregamento e quem navega por
   * teclado ou leitor de tela perderia a referência.
   */
  it('devolve o foco ao título do passo depois de hidratar', async () => {
    const cenario = montar();
    await propagar();
    cenario.fixture.detectChanges();
    await new Promise((r) => queueMicrotask(() => r(null)));

    const titulo = cenario.host.querySelector('.step-head h1');
    expect(titulo).not.toBeNull();
    expect(document.activeElement).toBe(titulo);
  });
});

describe('ProcessoSeletivoPage — falhas de leitura', () => {
  beforeEach(() => TestBed.resetTestingModule());

  /**
   * CA-08: um id inexistente não pode virar cadastro novo — o operador
   * preencheria tudo de novo e criaria uma duplicata no passo 2.
   */
  it('404 informa o não encontrado sem inicializar rascunho', async () => {
    const cenario = montar({
      obter: vi.fn(() =>
        of(errorResult(mockProblemDetails({ status: 404, title: 'Processo não encontrado' }))),
      ),
    });
    await propagar();
    cenario.fixture.detectChanges();

    expect(cenario.store.falhaDeLeitura()?.motivo).toBe('naoEncontrado');
    expect(cenario.store.processoSeletivoId()).toBeNull();
    expect(cenario.store.remoteSnapshot()).toBeNull();
    expect(cenario.host.textContent).toContain('não encontrado');
  });

  it('403 distingue a falta de permissão', async () => {
    const cenario = montar({
      obter: vi.fn(() => of(errorResult(mockProblemDetails({ status: 403 })))),
    });
    await propagar();

    expect(cenario.store.falhaDeLeitura()?.motivo).toBe('semPermissao');
  });

  /** Falha temporária é a única que oferece repetir a leitura. */
  it('5xx oferece nova tentativa', async () => {
    const cenario = montar({
      obter: vi.fn(() => of(errorResult(mockProblemDetails({ status: 503 })))),
    });
    await propagar();
    cenario.fixture.detectChanges();

    expect(cenario.store.falhaDeLeitura()?.motivo).toBe('falhaTemporaria');
    const botao = [...cenario.host.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Tentar novamente'),
    );
    expect(botao).toBeDefined();
  });

  it('não oferece nova tentativa quando o processo não existe', async () => {
    const cenario = montar({
      obter: vi.fn(() => of(errorResult(mockProblemDetails({ status: 404 })))),
    });
    await propagar();
    cenario.fixture.detectChanges();

    const botao = [...cenario.host.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Tentar novamente'),
    );
    expect(botao).toBeUndefined();
  });

  it('sempre oferece o caminho de volta à listagem', async () => {
    const cenario = montar({
      obter: vi.fn(() => of(errorResult(mockProblemDetails({ status: 404 })))),
    });
    await propagar();
    cenario.fixture.detectChanges();

    const voltar = [...cenario.host.querySelectorAll('a')].find((a) =>
      a.textContent?.includes('Voltar à listagem'),
    );
    expect(voltar?.getAttribute('href')).toBe('/processo-seletivo');
  });

  /** Endereço malformado é recusado antes de gastar uma ida ao servidor. */
  it('id fora do formato UUID não chega à API', async () => {
    const cenario = montar({ id: 'nao-e-uuid' });
    await propagar();

    expect(cenario.obter).not.toHaveBeenCalled();
    expect(cenario.store.falhaDeLeitura()?.motivo).toBe('idInvalido');
  });

  it('repete a leitura pelo botão de nova tentativa', async () => {
    const obter = vi
      .fn()
      .mockReturnValueOnce(of(errorResult(mockProblemDetails({ status: 503 }))))
      .mockReturnValueOnce(of(okResult(detalhe())));
    const cenario = montar({ obter });
    await propagar();
    cenario.fixture.detectChanges();

    const botao = [...cenario.host.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Tentar novamente'),
    ) as HTMLButtonElement;
    botao.click();
    await propagar();

    expect(obter).toHaveBeenCalledTimes(2);
    expect(cenario.store.falhaDeLeitura()).toBeNull();
    expect(cenario.store.processoSeletivoId()).toBe(PROCESSO_ID);
  });
});

describe('ProcessoSeletivoPage — cadastro novo', () => {
  beforeEach(() => TestBed.resetTestingModule());

  /**
   * A `reuseKey` é simétrica, então voltar de um processo carregado para
   * `/novo` também reusa a página. Sem limpar, o operador veria o cadastro
   * anterior sob o endereço de cadastro novo — e o que preenchesse dali iria
   * para o processo errado.
   */
  it('limpa o editor ao entrar em /novo vindo de um processo carregado', async () => {
    const paramMap = new BehaviorSubject<{ get: (k: string) => string | null }>({
      get: () => PROCESSO_ID,
    });
    const cenario = montar({ id: PROCESSO_ID, paramMap });
    await propagar();

    expect(cenario.store.processoSeletivoId()).toBe(PROCESSO_ID);

    paramMap.next({ get: () => null });
    await propagar();

    expect(cenario.store.processoSeletivoId()).toBeNull();
    expect(cenario.store.remoteSnapshot()).toBeNull();
    expect(cenario.store.currentStep()).toBe(0);
    expect(cenario.store.draft().identificacao.nome).toBe('');
  });

  /**
   * Trocar de processo com a página reusada não pode misturar os dois: o
   * detalhe não devolve anexo nem os metadados locais do edital, então
   * hidratar B por cima do rascunho de A deixaria o anexo de A atribuído a B —
   * inclusive para efeito de validação.
   */
  it('não carrega o rascunho do processo anterior ao abrir outro', async () => {
    const OUTRO_ID = '019f41cf-69fd-759a-ac6d-09acabc1b099';
    const paramMap = new BehaviorSubject<{ get: (k: string) => string | null }>({
      get: () => PROCESSO_ID,
    });
    const obter = vi.fn((id: string) =>
      of(okResult(detalhe({ id, nome: id === PROCESSO_ID ? 'Processo A' : 'Processo B' }))),
    );
    const listar = vi
      .fn()
      .mockReturnValueOnce(of(okResult([documento()])))
      .mockReturnValue(of(okResult([])));

    const cenario = montar({ id: PROCESSO_ID, paramMap, obter, listarDocumentos: listar });
    await propagar();

    expect(cenario.store.draft().identificacao.uploads).toHaveLength(1);

    paramMap.next({ get: () => OUTRO_ID });
    await propagar();
    await propagar();

    expect(cenario.store.processoSeletivoId()).toBe(OUTRO_ID);
    expect(cenario.store.draft().identificacao.nome).toBe('Processo B');
    expect(cenario.store.draft().identificacao.uploads).toHaveLength(0);
  });

  /**
   * Duas leituras em voo podem responder fora de ordem. A antiga chegando por
   * último mostraria A sob o endereço de B — e o anexo enviado ali iria para o
   * processo errado.
   */
  it('descarta a resposta da leitura superada', async () => {
    const OUTRO_ID = '019f41cf-69fd-759a-ac6d-09acabc1b099';
    const paramMap = new BehaviorSubject<{ get: (k: string) => string | null }>({
      get: () => PROCESSO_ID,
    });

    let resolverA: ((v: unknown) => void) | null = null;
    const obter = vi.fn((id: string) =>
      id === PROCESSO_ID
        ? from(
            new Promise((r) => {
              resolverA = r;
            }),
          )
        : of(okResult(detalhe({ id, nome: 'Processo B' }))),
    );

    const cenario = montar({ id: PROCESSO_ID, paramMap, obter });
    await propagar();

    // B entra e responde enquanto A ainda está pendente.
    paramMap.next({ get: () => OUTRO_ID });
    await propagar();
    await propagar();
    expect(cenario.store.processoSeletivoId()).toBe(OUTRO_ID);

    // A responde depois: não pode sobrescrever B.
    resolverA?.(okResult(detalhe({ id: PROCESSO_ID, nome: 'Processo A' })));
    await propagar();
    await propagar();

    expect(cenario.store.processoSeletivoId()).toBe(OUTRO_ID);
    expect(cenario.store.draft().identificacao.nome).toBe('Processo B');
  });

  /**
   * A leitura ainda em voo não deixa rastro em `processoSeletivoId` nem em
   * `falhaDeLeitura`: sem contar `hidratando`, a resposta hidrataria o processo
   * sob `/novo` e o efeito do id levaria de volta a ele.
   */
  it('descarta a leitura pendente ao entrar em /novo', async () => {
    const paramMap = new BehaviorSubject<{ get: (k: string) => string | null }>({
      get: () => PROCESSO_ID,
    });
    let resolver: ((v: unknown) => void) | null = null;
    const obter = vi.fn(() =>
      from(
        new Promise((r) => {
          resolver = r;
        }),
      ),
    );

    const cenario = montar({ id: PROCESSO_ID, paramMap, obter });
    await propagar();
    expect(cenario.store.hidratando()).toBe(true);

    paramMap.next({ get: () => null });
    await propagar();

    resolver?.(okResult(detalhe()));
    await propagar();
    await propagar();

    expect(cenario.store.processoSeletivoId()).toBeNull();
    expect(cenario.store.remoteSnapshot()).toBeNull();
    expect(cenario.navigate).not.toHaveBeenCalled();
  });

  /**
   * A geração do store invalida o que o passo deixou em voo para o processo
   * anterior — sem ela, um envio que responde depois vincularia o edital de um
   * processo ao outro.
   */
  it('muda de geração ao trocar de processo e ao limpar', async () => {
    const OUTRO_ID = '019f41cf-69fd-759a-ac6d-09acabc1b099';
    const paramMap = new BehaviorSubject<{ get: (k: string) => string | null }>({
      get: () => PROCESSO_ID,
    });
    const obter = vi.fn((id: string) => of(okResult(detalhe({ id }))));

    const cenario = montar({ id: PROCESSO_ID, paramMap, obter });
    await propagar();
    const inicial = cenario.store.geracao();

    paramMap.next({ get: () => OUTRO_ID });
    await propagar();
    await propagar();
    const aposTroca = cenario.store.geracao();

    paramMap.next({ get: () => null });
    await propagar();

    expect(aposTroca).not.toBe(inicial);
    expect(cenario.store.geracao()).not.toBe(aposTroca);
  });

  /**
   * Matriz de transições do editor reusado. Cada linha é um estado de partida
   * que já produziu defeito quando tratado isoladamente.
   */
  it('não leva o rascunho de /novo para um processo aberto por endereço', async () => {
    const paramMap = new BehaviorSubject<{ get: (k: string) => string | null }>({
      get: () => null,
    });
    const cenario = montar({ id: null, paramMap });
    await propagar();

    cenario.store.goTo(1);
    cenario.store.patchObjectSection('identificacao', { nome: 'Rascunho não salvo' });

    paramMap.next({ get: () => PROCESSO_ID });
    await propagar();
    await propagar();

    expect(cenario.store.processoSeletivoId()).toBe(PROCESSO_ID);
    expect(cenario.store.draft().identificacao.nome).toBe('Vestibular 2026.1');
  });

  it('limpa a falha ao voltar para o processo que continua carregado', async () => {
    const paramMap = new BehaviorSubject<{ get: (k: string) => string | null }>({
      get: () => PROCESSO_ID,
    });
    const cenario = montar({ id: PROCESSO_ID, paramMap });
    await propagar();
    expect(cenario.store.processoSeletivoId()).toBe(PROCESSO_ID);

    paramMap.next({ get: () => 'nao-e-uuid' });
    await propagar();
    expect(cenario.store.falhaDeLeitura()?.motivo).toBe('idInvalido');

    paramMap.next({ get: () => PROCESSO_ID });
    await propagar();

    expect(cenario.store.falhaDeLeitura()).toBeNull();
    expect(cenario.store.processoSeletivoId()).toBe(PROCESSO_ID);
  });

  /**
   * O serviço de cadastro sobrevive à troca de endereço junto com a página, e
   * retém o comando e a `Idempotency-Key` de uma criação inconclusiva. Sem
   * esquecê-los ao limpar, o próximo envio repetiria o cadastro anterior e
   * receberia de volta o id daquele processo.
   */
  it('esquece o cadastro em andamento ao limpar o editor', async () => {
    const paramMap = new BehaviorSubject<{ get: (k: string) => string | null }>({
      get: () => PROCESSO_ID,
    });
    const cenario = montar({ id: PROCESSO_ID, paramMap });
    await propagar();

    const cadastro = cenario.fixture.debugElement.injector.get(CadastroInicialService);
    const descartar = vi.spyOn(cadastro, 'descartarCadastroEmAndamento');

    paramMap.next({ get: () => null });
    await propagar();

    expect(descartar).toHaveBeenCalled();
  });

  /**
   * O detalhe já hidratou, os documentos ainda não; um endereço recusado no
   * meio superava a leitura e deixava `hidratando` ligado, e a volta ao
   * processo encontrava o editor preso no indicador de progresso.
   */
  it('não deixa o editor preso no carregamento após um endereço recusado', async () => {
    const paramMap = new BehaviorSubject<{ get: (k: string) => string | null }>({
      get: () => PROCESSO_ID,
    });
    const listar = vi.fn(() => from(new Promise(() => undefined)));
    const cenario = montar({ id: PROCESSO_ID, paramMap, listarDocumentos: listar });
    await propagar();
    await propagar();
    expect(cenario.store.hidratando()).toBe(true);

    // O desvio encerra o carregamento de A: a resposta pendente foi superada e
    // não há mais nada para esperar. Voltar ao processo relê — isso é assunto
    // do caso `relê os documentos ao voltar de um desvio que interrompeu a
    // leitura`, e é o que impede o editor de ficar sem saber do edital.
    paramMap.next({ get: () => 'nao-e-uuid' });
    await propagar();

    expect(cenario.store.hidratando()).toBe(false);
    expect(cenario.store.falhaDeLeitura()?.motivo).toBe('idInvalido');
  });

  /**
   * Limpar `hidratando` sem reler deixava o editor sem saber se o processo tem
   * edital: aviso nulo, anexo destravado, e a porta aberta para um segundo
   * documento imutável. Voltar de um desvio que interrompeu a leitura relê.
   */
  it('relê os documentos ao voltar de um desvio que interrompeu a leitura', async () => {
    const paramMap = new BehaviorSubject<{ get: (k: string) => string | null }>({
      get: () => PROCESSO_ID,
    });
    const listar = vi
      .fn()
      .mockReturnValueOnce(from(new Promise(() => undefined)))
      .mockReturnValue(of(okResult([documento()])));

    const cenario = montar({ id: PROCESSO_ID, paramMap, listarDocumentos: listar });
    await propagar();
    await propagar();
    expect(cenario.store.hidratando()).toBe(true);

    paramMap.next({ get: () => 'nao-e-uuid' });
    await propagar();

    paramMap.next({ get: () => PROCESSO_ID });
    await propagar();
    await propagar();
    await propagar();

    expect(listar).toHaveBeenCalledTimes(2);
    expect(cenario.store.draft().identificacao.uploads).toHaveLength(1);
    expect(cenario.store.hidratando()).toBe(false);
  });

  /**
   * Fecha #606. Confere o elemento, não o rascunho: com `[value]` num
   * `<select>` os dois divergem — o dado chega ao estado e não chega à tela.
   * `formControlName` resolve isso, e é por isso que o teste olha o DOM.
   */
  it('exibe na tela os valores hidratados dos campos de seleção', async () => {
    const cenario = montar();
    await propagar();
    cenario.fixture.detectChanges();
    await propagar();
    cenario.fixture.detectChanges();

    const host = cenario.host;

    expect(host.querySelector<HTMLInputElement>('#f-nome')?.value).toBe('Vestibular 2026.1');
    expect(host.querySelector<HTMLSelectElement>('#f-unidade')?.value).toBe(UNIDADE_ORIGEM_ID);
    expect(host.querySelector<HTMLSelectElement>('#f-origem')?.value).toBe('inscricaoPropria');
  });

  /**
   * O município congelado era um parágrafo solto ao lado de um botão inerte,
   * enquanto os vizinhos eram campos: quem lê a tela via um dado à deriva no
   * meio do formulário. Congelado, ele é um campo desabilitado como os outros,
   * e a ação de trocar — que não faz nada nesse estado — sai da tela.
   */
  it('mostra o município congelado como campo, sem ação de troca', async () => {
    const cenario = montar();
    await propagar();
    cenario.fixture.detectChanges();
    await propagar();
    cenario.fixture.detectChanges();

    const municipio = cenario.host.querySelector<HTMLInputElement>('#f-localidade');
    expect(municipio?.value).toBe('Marabá — PA');
    expect(municipio?.disabled).toBe(true);
    expect(municipio?.classList.contains('input')).toBe(true);
    expect(cenario.host.textContent).not.toContain('Trocar município');
  });

  /** Campo congelado precisa mostrar o valor, não só recusar edição. */
  it('mantém o valor visível nos campos congelados após a retomada', async () => {
    const cenario = montar();
    await propagar();
    cenario.fixture.detectChanges();
    await propagar();
    cenario.fixture.detectChanges();

    const unidade = cenario.host.querySelector<HTMLSelectElement>('#f-unidade');

    expect(unidade?.disabled).toBe(true);
    expect(unidade?.value).toBe(UNIDADE_ORIGEM_ID);
    expect(unidade?.selectedOptions[0]?.textContent).toContain('IGE');
  });

  it('não lê detalhe algum em /novo', async () => {
    const cenario = montar({ id: null });
    await propagar();

    expect(cenario.obter).not.toHaveBeenCalled();
    expect(cenario.store.falhaDeLeitura()).toBeNull();
    expect(cenario.store.processoSeletivoId()).toBeNull();
  });

  /**
   * CA-04: sem isto, recarregar `/novo` depois de criado perderia o vínculo e
   * o passo 2 dispararia um segundo POST para o mesmo rascunho.
   */
  it('troca o endereço pelo id assim que a criação responde', async () => {
    const cenario = montar({ id: null });
    await propagar();

    cenario.store.processoSeletivoId.set(PROCESSO_ID);
    cenario.fixture.detectChanges();
    await propagar();

    expect(cenario.navigate).toHaveBeenCalledWith(['/processo-seletivo', PROCESSO_ID], {
      replaceUrl: true,
    });
  });

  /**
   * A transição entre `novo` e `:id` não pode recriar a página: a criação
   * acontece no meio do anexo do edital, e uma instância nova voltaria ao passo
   * 1, perderia os campos que só existem no rascunho local e abandonaria o
   * upload em curso. Quem garante isso é a `reuseKey` das duas rotas.
   */
  it('declara as duas rotas do editor como a mesma tela', () => {
    const novo = PROCESSO_SELETIVO_ROUTES.find((r) => r.path === 'novo');
    const porId = PROCESSO_SELETIVO_ROUTES.find((r) => r.path === ':id');
    const estrategia = new EditorRouteReuseStrategy();

    const dataNovo = novo?.data ?? {};
    const dataId = porId?.data ?? {};

    expect(dataNovo[ROTA_REUSE_KEY]).toBeDefined();
    expect(dataNovo[ROTA_REUSE_KEY]).toBe(dataId[ROTA_REUSE_KEY]);

    // `routeConfig` distinto é o que o comportamento padrão usa para recusar o
    // reuso; a chave é o que sobrepõe essa recusa.
    const como = (data: Record<string, unknown>, config: object) =>
      ({ data, routeConfig: config }) as never;
    const configNovo = {};
    const configId = {};

    expect(estrategia.shouldReuseRoute(como(dataNovo, configNovo), como(dataId, configId))).toBe(
      true,
    );
    expect(estrategia.shouldReuseRoute(como({}, configNovo), como({}, configId))).toBe(false);
    expect(
      estrategia.shouldReuseRoute(
        como({ [ROTA_REUSE_KEY]: 'a' }, configNovo),
        como({ [ROTA_REUSE_KEY]: 'b' }, configId),
      ),
    ).toBe(false);
  });

  it('preserva o passo e o rascunho local ao assumir o id', async () => {
    const cenario = montar({ id: null });
    await propagar();

    cenario.store.goTo(1);
    cenario.store.patchObjectSection('identificacao', { nome: 'Em edição' });

    cenario.store.processoSeletivoId.set(PROCESSO_ID);
    cenario.fixture.detectChanges();
    await propagar();

    expect(cenario.store.currentStep()).toBe(1);
    expect(cenario.store.draft().identificacao.nome).toBe('Em edição');
  });

  it('não renavega quando o id já veio da própria rota', async () => {
    const cenario = montar();
    await propagar();

    cenario.store.processoSeletivoId.set(PROCESSO_ID);
    cenario.fixture.detectChanges();
    await propagar();

    expect(cenario.navigate).not.toHaveBeenCalled();
  });

  /**
   * A configuração de taxa já gravada volta ao editor. Sem isto, retomar um
   * processo mostrava a declaração em branco — e regravar por cima apagaria o
   * que estava lá.
   */
  it('hidrata a configuração de taxa já gravada', async () => {
    const cenario = montar();
    await propagar();

    const pagamento = cenario.store.draft().pagamento;
    expect(pagamento.cobra).toBe(true);
    expect(pagamento.valor).toBe('230');
    expect(pagamento.fundamentos).toEqual(['CADASTRO_UNICO', 'DOACAO_MEDULA_OSSEA']);
    expect(pagamento.confirmacaoFundamentos).toBe(true);
  });

  /**
   * Ausência de configuração é "ainda não declarado", que não é o mesmo que
   * declarar que não cobra — o passo precisa continuar exigindo a declaração.
   */
  it('deixa a cobrança por declarar quando o processo nunca a declarou', async () => {
    const cenario = montar({
      obter: vi.fn(() => of(okResult(detalhe({ configuracaoTaxaInscricao: null })))),
    });
    await propagar();

    expect(cenario.store.draft().pagamento.cobra).toBeNull();
  });

  /**
   * O agregado recusa mutação fora de rascunho, e a listagem oferece "Abrir"
   * para qualquer processo. Sem esta condição o editor monta os mesmos
   * controles e promete uma gravação que o servidor negaria depois de o
   * operador preencher a tela.
   */
  describe('processo fora de rascunho', () => {
    const PASSO_PAGAMENTO = 2;

    const publicado = () =>
      montar({ obter: vi.fn(() => of(okResult(detalhe({ status: 'Publicado' })))) });

    it('não promete gravação no rótulo do avanço', async () => {
      const cenario = publicado();
      await propagar();

      cenario.store.goTo(PASSO_PAGAMENTO);
      cenario.fixture.detectChanges();

      expect(cenario.componente.rotuloDeAvanco()).toBe('Próximo');
    });

    it('avança sem emitir comando de escrita', async () => {
      const cenario = publicado();
      await propagar();

      cenario.store.goTo(PASSO_PAGAMENTO);
      cenario.fixture.detectChanges();
      await cenario.componente.nextOrPublish();

      expect(cenario.definirTaxaInscricao).not.toHaveBeenCalled();
      expect(cenario.store.currentStep()).toBe(PASSO_PAGAMENTO + 1);
    });

    it('retira o botão de avanço do último passo, onde ele só publicaria', async () => {
      const cenario = publicado();
      await propagar();

      cenario.store.goTo(cenario.store.totalSteps - 1);
      cenario.fixture.detectChanges();

      expect(cenario.componente.ofereceAvanco()).toBe(false);
    });

    it('recusa alterar o rascunho pelos passos que não gravam', async () => {
      const cenario = publicado();
      await propagar();

      const antes = cenario.store.draft().modalidades;
      cenario.store.patchSection('modalidades', { ...antes, selecionadas: ['AC'] } as never);

      expect(cenario.store.draft().modalidades).toEqual(antes);
    });

    it('explica a consulta conforme o status, sem prometer retificação a quem não a tem', async () => {
      const cancelado = montar({
        obter: vi.fn(() => of(okResult(detalhe({ status: 'Cancelado' })))),
      });
      await propagar();
      expect(cancelado.store.motivoDeSomenteLeitura()).toContain('cancelado');
      expect(cancelado.store.motivoDeSomenteLeitura()).not.toContain('retificação');

      TestBed.resetTestingModule();
      const publicadoCenario = publicado();
      await propagar();
      expect(publicadoCenario.store.motivoDeSomenteLeitura()).toContain('retificação');
    });

    it('relê o edital confirmado, que é o que a consulta existe para mostrar', async () => {
      const cenario = montar({
        obter: vi.fn(() => of(okResult(detalhe({ status: 'Publicado' })))),
        listarDocumentos: vi.fn(() => of(okResult([documento()]))),
      });
      await propagar();

      expect(cenario.store.draft().identificacao.uploads.length).toBe(1);
    });

    it('não nomeia a situação de um status que este cliente não conhece', async () => {
      const cenario = montar({
        obter: vi.fn(() => of(okResult(detalhe({ status: 'Arquivado' })))),
      });
      await propagar();

      const motivo = cenario.store.motivoDeSomenteLeitura();
      expect(motivo).toContain('não está em rascunho');
      expect(motivo).not.toContain('cancelado');
      expect(motivo).not.toContain('encerrado');
    });

    it('mantém a edição liberada enquanto o detalhe não chegou', () => {
      const cenario = montar();

      expect(cenario.store.edicaoPermitida()).toBe(true);
    });
  });
});
