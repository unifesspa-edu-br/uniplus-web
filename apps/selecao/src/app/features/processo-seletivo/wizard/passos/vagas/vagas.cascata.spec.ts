import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { ORGANIZACAO_BASE_PATH } from '@uniplus/shared-data/organizacao';
import { PUBLICACOES_BASE_PATH } from '@uniplus/shared-data/publicacoes';
import {
  ProcessoSeletivoDto,
  SELECAO_BASE_PATH,
  StatusProcesso,
} from '@uniplus/shared-data/selecao';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicial } from '../../shared/cadastro-inicial.service';
import { GravacaoDoProcesso } from '../../shared/gravacao/gravacao-do-processo';
import { GravacaoDosCamposPressupostos } from '../../shared/campos-pressupostos.service';
import { CatalogosDoCronograma } from '../cronograma/catalogos-do-cronograma.service';
import { VagasPassoComponent } from './vagas.component';
import {
  ACEITA_AS_OPCOES,
  AC_CASCATA,
  BASE,
  LISTA_DE_CURSOS,
  LB_PPI,
  LB_Q,
  MODALIDADES_CASCATA,
  OFERTAS_CASCATA,
  OFERTA_CASCATA,
  PROCESSO_ID,
  REGRA_CASCATA,
  REGRA_CASCATA_SEM_MATRIZ,
  ServicosDasVagas,
  comReleitura,
  declararUmaOpcaoJaGravada,
  distribuicaoComCascata,
  servicosDe,
  tick,
} from './vagas.testing';

let servicos: ServicosDasVagas;

describe('VagasPassoComponent — gravação da cascata de remanejamento', () => {
  let componente: VagasPassoComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let detectar: () => void;
  let elementoRaiz: HTMLElement;
  const ROTA_CASCATA_TESTE = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/cascata-remanejamento`;
  const ROTA_DISTRIBUICAO_TESTE = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/distribuicao-vagas`;
  const ROTA_PROCESSO_LIDO_TESTE = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}`;
  const ROTA_SIMULACAO_TESTE = `${ROTA_DISTRIBUICAO_TESTE}/simulacao`;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VagasPassoComponent],
      providers: [
        ProcessoSeletivoStore,
        CadastroInicial,
        GravacaoDoProcesso,
        CatalogosDoCronograma,
        GravacaoDosCamposPressupostos,
        { provide: PUBLICACOES_BASE_PATH, useValue: BASE },
        provideHttpClient(withInterceptors([apiResultInterceptor, ACEITA_AS_OPCOES])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        { provide: ORGANIZACAO_BASE_PATH, useValue: BASE },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(VagasPassoComponent);
    componente = fixture.componentInstance;
    servicos = servicosDe(fixture);
    store = TestBed.inject(ProcessoSeletivoStore);
    declararUmaOpcaoJaGravada(store);
    controller = TestBed.inject(HttpTestingController);
    detectar = () => fixture.detectChanges();
    elementoRaiz = fixture.nativeElement;

    detectar();
    for (const requisicao of controller.match(() => true)) {
      const url = requisicao.request.url;
      if (url.includes('ofertas-curso')) requisicao.flush(OFERTAS_CASCATA);
      else if (url.includes('cursos')) requisicao.flush(LISTA_DE_CURSOS);
      else if (url.includes('modalidades')) requisicao.flush(MODALIDADES_CASCATA);
      else if (url.includes('regras-catalogo')) {
        const tipo = requisicao.request.params.get('tipo');
        requisicao.flush(
          tipo === 'criterio_remanejamento' ? [REGRA_CASCATA, REGRA_CASCATA_SEM_MATRIZ] : [],
        );
      } else requisicao.flush([]);
    }
    detectar();

    store.processoSeletivoId.set(PROCESSO_ID);
  });

  afterEach(() => controller.verify());

  function simularEConferirDistribuicao(): void {
    servicos.simulacao.simular();
    controller.expectOne(ROTA_SIMULACAO_TESTE).flush([
      {
        ofertaCursoOrigemId: OFERTA_CASCATA,
        quadro: [
          { modalidadeOrigemId: LB_PPI, modalidadeCodigo: 'LB_PPI', quantidade: 10 },
          { modalidadeOrigemId: LB_Q, modalidadeCodigo: 'LB_Q', quantidade: 10 },
          { modalidadeOrigemId: AC_CASCATA, modalidadeCodigo: 'AC', quantidade: 80 },
        ],
        totalPublicado: 100,
      },
    ]);
  }

  /** Interage com o `<select>` real da seção da cascata, no molde do teste do seletor de regra da distribuição. */
  function escolherRegraCascataNaTela(valor: string): void {
    const campo = elementoRaiz.querySelector<HTMLSelectElement>('#c-regra-cascata');
    if (campo === null) throw new Error('Campo #c-regra-cascata não encontrado no template.');
    campo.value = valor;
    campo.dispatchEvent(new Event('change'));
    detectar();
  }

  it('grava a cascata depois da distribuição, com a matriz inteira da regra', async () => {
    store.patchObjectSection('vagas', { ofertas: [distribuicaoComCascata()] });
    detectar();
    simularEConferirDistribuicao();

    escolherRegraCascataNaTela('REMANEJ-CASCATA-LEI-12711|v1');
    detectar();

    const gravacao = componente.persistir();

    const distribuicaoReq = controller.expectOne(ROTA_DISTRIBUICAO_TESTE);
    distribuicaoReq.flush(null, { status: 204, statusText: 'No Content' });
    await tick();

    const cascataReq = controller.expectOne(ROTA_CASCATA_TESTE);
    expect(cascataReq.request.method).toBe('PUT');
    expect(cascataReq.request.body).toEqual({
      regraCodigo: 'REMANEJ-CASCATA-LEI-12711',
      regraVersao: 'v1',
      fallbackCodigo: 'AC',
      destinos: [
        { modalidadeOrigemCodigo: 'LB_PPI', ordem: 1, modalidadeDestinoCodigo: 'LB_Q' },
        { modalidadeOrigemCodigo: 'LB_PPI', ordem: 2, modalidadeDestinoCodigo: 'AC' },
      ],
    });
    expect(cascataReq.request.headers.get('Idempotency-Key')).toBeTruthy();

    cascataReq.flush(null, { status: 204, statusText: 'No Content' });
    await expect(comReleitura(controller, gravacao)).resolves.toEqual({ valid: true });
  });

  it('não envia cascata quando nenhuma oferta a exige', async () => {
    store.patchObjectSection('vagas', {
      ofertas: [
        {
          ...distribuicaoComCascata(),
          modalidades: [
            { id: LB_Q, codigo: 'LB_Q' },
            { id: AC_CASCATA, codigo: 'AC' },
          ],
          quadro: [
            { modalidadeId: LB_Q, quantidade: '20' },
            { modalidadeId: AC_CASCATA, quantidade: '80' },
          ],
        },
      ],
    });
    detectar();
    servicos.simulacao.simular();
    controller
      .expectOne(ROTA_SIMULACAO_TESTE)
      .flush([{ ofertaCursoOrigemId: OFERTA_CASCATA, quadro: [], totalPublicado: 100 }]);

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_DISTRIBUICAO_TESTE).flush(null, {
      status: 204,
      statusText: 'No Content',
    });
    await tick();

    controller.expectNone(ROTA_CASCATA_TESTE);
    await expect(comReleitura(controller, gravacao)).resolves.toEqual({ valid: true });
  });

  /**
   * A cascata exigida e sem regra escolhida continua bloqueando — isso é erro, não conferência.
   *
   * O que saiu daqui foi a marca do operador. Enquanto ela existia, o efeito que a zerava a
   * cada hidratação fazia a gravação da publicação falhar com "confirme a matriz" num passo que
   * o operador não tinha aberto — bastava um recarregamento antes de publicar.
   */
  it('recusa gravar com a cascata exigida e sem regra escolhida', async () => {
    store.patchObjectSection('vagas', { ofertas: [distribuicaoComCascata()] });
    detectar();
    simularEConferirDistribuicao();

    const resultado = await comReleitura(controller, componente.persistir());

    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.some((m) => m.includes('cascata'))).toBe(true);
    controller.expectNone(ROTA_DISTRIBUICAO_TESTE);
    controller.expectNone(ROTA_CASCATA_TESTE);
  });

  /**
   * O defeito que esta entrega conserta: depois de hidratar, a gravação da cascata falhava
   * porque o efeito de `remoteSnapshot` zerava a marca de conferência a cada leitura.
   */
  it('grava a cascata logo depois de hidratar, sem marca nenhuma a repor', async () => {
    store.patchObjectSection('vagas', { ofertas: [distribuicaoComCascata()] });
    detectar();
    simularEConferirDistribuicao();
    escolherRegraCascataNaTela('REMANEJ-CASCATA-LEI-12711|v1');
    detectar();

    // O que a retomada faz: reprojeta o snapshot remoto por cima do que está em tela.
    store.remoteSnapshot.set({ cascata: null } as unknown as ProcessoSeletivoDto);
    detectar();

    expect(componente.validar().valid).toBe(true);
  });

  /**
   * Reproduz o beco sem saída: a regra existe no catálogo, mas seu
   * `esquemaArgs` não declara a matriz no formato esperado — a tabela e o
   * checkbox de confirmação não aparecem no template. Sem o desvio em
   * `pendenciasDaCascata()`, `validar()` pedia para "confirmar a cascata",
   * mandando o operador marcar um controle que a tela nem renderiza.
   */
  it('recusa avançar com mensagem acionável quando a regra escolhida não tem matriz reconhecida', async () => {
    store.patchObjectSection('vagas', { ofertas: [distribuicaoComCascata()] });
    detectar();
    simularEConferirDistribuicao();

    escolherRegraCascataNaTela('REMANEJ-CASCATA-SEM-MATRIZ|v1');
    detectar();

    const resultado = await comReleitura(controller, componente.persistir());

    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.some((m) => m.includes('não declara uma matriz'))).toBe(true);
    expect(resultado.messages?.some((m) => /escolha outra regra ou versão/i.test(m))).toBe(true);
    expect(resultado.messages?.some((m) => m.includes('Confirme que conferiu'))).toBe(false);
    controller.expectNone(ROTA_DISTRIBUICAO_TESTE);
    controller.expectNone(ROTA_CASCATA_TESTE);
  });

  /**
   * Reproduz o mesmo beco sem saída do teste acima, por outra entrada: a
   * cascata hidratada referencia uma versão que a listagem ativa não traz
   * mais, e a busca direta da versão também não a encontra (regra
   * genuinamente removida, não apenas fora da página carregada).
   */
  it('recusa avançar com mensagem acionável quando a regra hidratada não é encontrada no catálogo', async () => {
    store.patchObjectSection('vagas', {
      ofertas: [distribuicaoComCascata()],
      cascata: { regraCodigo: 'REMANEJ-CASCATA-REMOVIDA', regraVersao: 'v9' },
    });
    detectar();
    simularEConferirDistribuicao();

    controller
      .expectOne(`${BASE}/api/selecao/regras-catalogo/REMANEJ-CASCATA-REMOVIDA/versoes/v9`)
      .flush(
        { type: 'about:blank', title: 'Regra não encontrada.', status: 404, traceId: 't' },
        { status: 404, statusText: 'Not Found' },
      );
    detectar();

    const resultado = await comReleitura(controller, componente.persistir());

    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.some((m) => m.includes('não foi encontrada no catálogo'))).toBe(
      true,
    );
    expect(resultado.messages?.some((m) => m.includes('Confirme que conferiu'))).toBe(false);
    controller.expectNone(ROTA_DISTRIBUICAO_TESTE);
    controller.expectNone(ROTA_CASCATA_TESTE);
  });

  /**
   * Uma falha transitória (5xx) ao consultar a versão fora da listagem não
   * pode virar "regra não encontrada" — a mensagem precisa dizer que foi a
   * consulta que falhou, distinta da recusa definitiva do teste acima.
   */
  it('recusa avançar com mensagem distinta quando a consulta da regra hidratada falha (não confunde com regra ausente)', async () => {
    store.patchObjectSection('vagas', {
      ofertas: [distribuicaoComCascata()],
      cascata: { regraCodigo: 'REMANEJ-CASCATA-LEI-12711', regraVersao: 'v0' },
    });
    detectar();
    simularEConferirDistribuicao();

    controller
      .expectOne(`${BASE}/api/selecao/regras-catalogo/REMANEJ-CASCATA-LEI-12711/versoes/v0`)
      .flush(
        { type: 'about:blank', title: 'Erro interno.', status: 503, traceId: 't' },
        { status: 503, statusText: 'Service Unavailable' },
      );
    detectar();

    const resultado = await comReleitura(controller, componente.persistir());

    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.some((m) => m.includes('a consulta falhou'))).toBe(true);
    expect(resultado.messages?.some((m) => m.includes('não foi encontrada no catálogo'))).toBe(
      false,
    );
    controller.expectNone(ROTA_DISTRIBUICAO_TESTE);
    controller.expectNone(ROTA_CASCATA_TESTE);
  });

  /**
   * `cascata_modalidade_fora_do_regime_federal` bloqueia a publicação mais
   * adiante (`ExisteCascataForaDoRegimeFederal` no domínio) mesmo quando a
   * seção da cascata nem aparece — por isso o passo Vagas não pode deixar o
   * operador avançar como se estivesse tudo bem, só porque não há cascata
   * para confirmar.
   */
  it('recusa gravar com modalidade SEGUE_CASCATA fora do ramo federal, mesmo sem seção de cascata', async () => {
    store.patchObjectSection('vagas', {
      ofertas: [
        {
          ...distribuicaoComCascata(),
          regraDistribuicaoCodigo: 'DISTRIB-VAGAS-INSTITUCIONAL',
        },
      ],
    });
    detectar();

    const resultado = await comReleitura(controller, componente.persistir());

    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.some((m) => m.includes('fora do ramo federal'))).toBe(true);
    controller.expectNone(ROTA_DISTRIBUICAO_TESTE);
    controller.expectNone(ROTA_CASCATA_TESTE);
  });

  it('quando a distribuição falha, a cascata não é enviada', async () => {
    store.patchObjectSection('vagas', { ofertas: [distribuicaoComCascata()] });
    detectar();
    simularEConferirDistribuicao();
    escolherRegraCascataNaTela('REMANEJ-CASCATA-LEI-12711|v1');
    detectar();

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_DISTRIBUICAO_TESTE).flush(
      {
        type: 'about:blank',
        title: 'Quantidade inválida.',
        status: 422,
        code: 'uniplus.selecao.configuracao_distribuicao_vagas.quantidade_invalida',
        traceId: 'trace-1',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    const resultado = await comReleitura(controller, gravacao);
    expect(resultado.valid).toBe(false);
    controller.expectNone(ROTA_CASCATA_TESTE);
  });

  it('quando a distribuição grava mas a cascata falha, a mensagem diz que só a distribuição gravou', async () => {
    store.patchObjectSection('vagas', { ofertas: [distribuicaoComCascata()] });
    detectar();
    simularEConferirDistribuicao();
    escolherRegraCascataNaTela('REMANEJ-CASCATA-LEI-12711|v1');
    detectar();

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_DISTRIBUICAO_TESTE).flush(null, {
      status: 204,
      statusText: 'No Content',
    });
    await tick();
    controller.expectOne(ROTA_CASCATA_TESTE).flush(
      {
        type: 'about:blank',
        title: 'A matriz diverge da regra.',
        status: 422,
        code: 'uniplus.selecao.configuracao_cascata_remanejamento.matriz_divergente_da_regra',
        traceId: 'trace-2',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    const resultado = await comReleitura(controller, gravacao);
    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.[0]).toContain('distribuição de vagas foi gravada');
  });

  /**
   * Um 5xx na gravação da cascata é resposta
   * inconclusiva (`ChaveDeSubstituicao` preserva a chave porque o servidor
   * pode ter aplicado o comando mesmo sem confirmar) — `existeNoServidor`
   * não pode ficar `false` nesse caso, senão uma mudança seguinte que torne
   * a cascata desnecessária pula a remoção e deixa uma cascata possivelmente
   * gravada órfã no servidor.
   */
  it('trata recusa 5xx da cascata como presença possível, e força a remoção quando ela deixa de se aplicar depois', async () => {
    store.patchObjectSection('vagas', { ofertas: [distribuicaoComCascata()] });
    detectar();
    simularEConferirDistribuicao();
    escolherRegraCascataNaTela('REMANEJ-CASCATA-LEI-12711|v1');
    detectar();

    const primeiraGravacao = componente.persistir();
    controller.expectOne(ROTA_DISTRIBUICAO_TESTE).flush(null, {
      status: 204,
      statusText: 'No Content',
    });
    await tick();
    controller.expectOne(ROTA_CASCATA_TESTE).flush(
      {
        type: 'about:blank',
        title: 'Erro interno do servidor.',
        status: 503,
        traceId: 'trace-3',
      },
      { status: 503, statusText: 'Service Unavailable' },
    );
    expect((await comReleitura(controller, primeiraGravacao)).valid).toBe(false);

    // A oferta deixa de exigir cascata — se o 5xx acima aplicou o comando no
    // servidor, pular a remoção deixaria a cascata órfã.
    store.patchObjectSection('vagas', {
      ofertas: [
        {
          ...distribuicaoComCascata(),
          modalidades: [
            { id: LB_Q, codigo: 'LB_Q' },
            { id: AC_CASCATA, codigo: 'AC' },
          ],
          quadro: [
            { modalidadeId: LB_Q, quantidade: '20' },
            { modalidadeId: AC_CASCATA, quantidade: '80' },
          ],
        },
      ],
    });
    detectar();
    servicos.simulacao.simular();
    controller
      .expectOne(ROTA_SIMULACAO_TESTE)
      .flush([{ ofertaCursoOrigemId: OFERTA_CASCATA, quadro: [], totalPublicado: 100 }]);

    const segundaGravacao = componente.persistir();
    // A cascata ficou sem resposta conclusiva: o passo relê o processo antes de gravar de novo.
    controller.expectOne(ROTA_PROCESSO_LIDO_TESTE).flush({ distribuicaoVagas: [] });
    await tick();
    controller.expectOne(ROTA_DISTRIBUICAO_TESTE).flush(null, {
      status: 204,
      statusText: 'No Content',
    });
    await tick();

    const remocao = controller.expectOne(ROTA_CASCATA_TESTE);
    expect(remocao.request.body).toEqual({
      regraCodigo: null,
      regraVersao: null,
      fallbackCodigo: null,
      destinos: null,
    });
    remocao.flush(null, { status: 204, statusText: 'No Content' });
    await expect(comReleitura(controller, segundaGravacao)).resolves.toEqual({ valid: true });
  });

  it('envia a remoção quando a cascata deixou de se aplicar mas havia escolha anterior', async () => {
    // Hidratação anterior trouxe uma cascata do servidor — é isto, não o
    // valor do seletor de regra, que decide se a remoção precisa ser
    // enviada quando a oferta em tela já não tem modalidade SEGUE_CASCATA.
    store.remoteSnapshot.set({
      status: StatusProcesso.rascunho,
      cascata: {
        id: 'cascata-1',
        regra: { codigo: 'REMANEJ-CASCATA-LEI-12711', versao: 'v1', hash: 'hash-1' },
        fallbackCodigo: 'AC',
        destinos: [],
      },
    } as unknown as ProcessoSeletivoDto);
    detectar();

    store.patchObjectSection('vagas', {
      ofertas: [
        {
          ...distribuicaoComCascata(),
          modalidades: [
            { id: LB_Q, codigo: 'LB_Q' },
            { id: AC_CASCATA, codigo: 'AC' },
          ],
          quadro: [
            { modalidadeId: LB_Q, quantidade: '20' },
            { modalidadeId: AC_CASCATA, quantidade: '80' },
          ],
        },
      ],
      cascata: null,
    });
    detectar();
    servicos.simulacao.simular();
    controller
      .expectOne(ROTA_SIMULACAO_TESTE)
      .flush([{ ofertaCursoOrigemId: OFERTA_CASCATA, quadro: [], totalPublicado: 100 }]);

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_DISTRIBUICAO_TESTE).flush(null, {
      status: 204,
      statusText: 'No Content',
    });
    await tick();

    const cascataReq = controller.expectOne(ROTA_CASCATA_TESTE);
    expect(cascataReq.request.body).toEqual({
      regraCodigo: null,
      regraVersao: null,
      fallbackCodigo: null,
      destinos: null,
    });
    cascataReq.flush(null, { status: 204, statusText: 'No Content' });

    await expect(comReleitura(controller, gravacao)).resolves.toEqual({ valid: true });
  });
});
