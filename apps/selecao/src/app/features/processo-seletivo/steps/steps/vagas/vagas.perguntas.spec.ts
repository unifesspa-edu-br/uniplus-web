import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, type FatoCandidatoView } from '@uniplus/shared-data/configuracao';
import { ORGANIZACAO_BASE_PATH } from '@uniplus/shared-data/organizacao';
import { PUBLICACOES_BASE_PATH } from '@uniplus/shared-data/publicacoes';
import { OrigemCandidatos, SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicial } from '../../shared/cadastro-inicial.service';
import { GravacaoDoProcesso } from '../../shared/gravacao/gravacao-do-processo';
import { GravacaoDosCamposPressupostos } from '../../shared/campos-pressupostos.service';
import { CatalogosDoCronograma } from '../cronograma/catalogos-do-cronograma.service';
import { VagasStepComponent } from './vagas.component';
import {
  ACEITA_AS_OPCOES,
  BASE,
  LISTA_DE_CURSOS,
  MODALIDADE,
  MODALIDADES,
  OFERTA,
  OFERTAS,
  PROCESSO_ID,
  ROTA_DISTRIBUICAO,
  ROTA_SIMULACAO,
  SEGUNDA_MODALIDADE,
  ServicosDasVagas,
  declararUmaOpcaoJaGravada,
  distribuicao,
  servicosDe,
} from './vagas.testing';

let servicos: ServicosDasVagas;

describe('VagasStepComponent — perguntas das modalidades ofertadas', () => {
  const ROTA_PROCESSO = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}`;
  const ROTA_DERIVACAO = `${ROTA_PROCESSO}/regras-derivacao`;

  const QUEM_CONCORRE_PCD = [[{ fato: 'CONCORRER_PCD', operador: 'IGUAL', valor: true }]];

  let componente: VagasStepComponent;
  let fixture: ComponentFixture<VagasStepComponent>;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VagasStepComponent],
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

    fixture = TestBed.createComponent(VagasStepComponent);
    componente = fixture.componentInstance;
    servicos = servicosDe(fixture);
    store = TestBed.inject(ProcessoSeletivoStore);
    declararUmaOpcaoJaGravada(store);
    controller = TestBed.inject(HttpTestingController);

    fixture.detectChanges();
    for (const requisicao of controller.match(() => true)) {
      const url = requisicao.request.url;
      if (url.includes('ofertas-curso')) requisicao.flush(OFERTAS);
      else if (url.includes('cursos')) requisicao.flush(LISTA_DE_CURSOS);
      else if (url.includes('modalidades')) requisicao.flush(MODALIDADES);
      else requisicao.flush([]);
    }
    fixture.detectChanges();

    store.processoSeletivoId.set(PROCESSO_ID);
    store.patchObjectSection('identificacao', {
      origemCandidatos: OrigemCandidatos.inscricaoPropria,
    });
    store.patchObjectSection('vagas', {
      ofertas: [
        {
          ...distribuicao(OFERTA),
          modalidades: [
            { id: MODALIDADE, codigo: 'AC' },
            { id: SEGUNDA_MODALIDADE, codigo: 'AC_PCD' },
          ],
          quadro: [
            { modalidadeId: MODALIDADE, quantidade: '2' },
            { modalidadeId: SEGUNDA_MODALIDADE, quantidade: '1' },
          ],
        },
      ],
    });
    fixture.detectChanges();

    // O catálogo do cronograma já carregado: a seção das regras o pede ao aparecer.
    const catalogos = TestBed.inject(CatalogosDoCronograma);
    catalogos.carregar();
    for (const requisicao of controller.match(() => true)) requisicao.flush([]);
    catalogos.fatos.set([
      {
        codigo: 'CONCORRER_PCD',
        nome: 'Concorrer na reserva para pessoa com deficiência',
        dominio: 'BOOLEANO',
        origem: 'DECLARADO',
        cardinalidade: 'UNIVALORADO',
        binding: 'CAMPO_INSCRICAO:CONCORRER_PCD',
        escopo: 'CANDIDATO',
        fonteValores: null,
        ativo: true,
        valoresDominio: null,
      } as unknown as FatoCandidatoView,
    ]);
    catalogos.carregando.set(false);

    servicos.simulacao.simular();
    controller.expectOne(ROTA_SIMULACAO).flush([
      {
        ofertaCursoOrigemId: OFERTA,
        quadro: [
          { modalidadeOrigemId: MODALIDADE, modalidadeCodigo: 'AC', quantidade: 2 },
          { modalidadeOrigemId: SEGUNDA_MODALIDADE, modalidadeCodigo: 'AC_PCD', quantidade: 1 },
        ],
        totalPublicado: 43,
      },
    ]);
  });

  afterEach(() => controller.verify());

  const proximoPasso = () => new Promise((resolve) => setTimeout(resolve, 0));

  const FASE_DE_INSCRICAO = { id: 'F-INSCRICAO', codigo: 'INSCRICAO', coletaInscricao: true };
  const ROTA_INSCRICAO = `${BASE}/api/selecao/admin/processos-seletivos/${PROCESSO_ID}/formularios/INSCRICAO`;

  const campo = (fatoCodigo: string, ordem: number, etapaCodigo: string) => ({
    fatoCodigo,
    ordem,
    rotulo: fatoCodigo,
    tipoRenderizacao: 'BOOLEANO',
    obrigatoriedade: { tipo: 'SEMPRE', predicado: null },
    precondicao: null,
    opcoes: null,
    etapaCodigo,
    formato: null,
    ajuda: null,
    pedirConfirmacao: false,
    restricoes: [],
    impedimento: null,
  });
  const etapa = (codigo: string, ordem: number, bloco: string | null = null) => ({
    codigo,
    ordem,
    tipo: bloco === null ? 'SECAO' : 'BLOCO',
    bloco,
    titulo: codigo,
    descricao: null,
    aviso: null,
    exibicao: null,
  });

  /** O formulário de inscrição gravado, com a seção dos dados básicos que a api acrescenta. */
  function formularioDeInscricao(coletados: readonly string[]): unknown {
    return {
      finalidade: 'INSCRICAO',
      faseId: FASE_DE_INSCRICAO.id,
      titulo: null,
      modeloOrigemId: null,
      modeloOrigemCodigo: null,
      etapas: [etapa('DADOS_BASICOS', 0), etapa('REVISAO_E_ACEITE', 1, 'REVISAO_E_ACEITE')],
      fatosColetados: coletados.map((codigo, ordem) => campo(codigo, ordem, 'DADOS_BASICOS')),
      termos: [],
      grupos: [],
    };
  }

  /** O processo como o servidor o devolve depois de gravar o quadro, com as regras congeladas. */
  function processoGravado(
    inscricao: {
      readonly formularios: readonly unknown[];
      readonly cronogramaFases: readonly unknown[];
    } = {
      formularios: [formularioDeInscricao(['NOME', 'CONCORRER_PCD'])],
      cronogramaFases: [FASE_DE_INSCRICAO],
    },
  ): Record<string, unknown> {
    return {
      id: PROCESSO_ID,
      distribuicaoVagas: [
        {
          modalidades: [
            { codigo: 'AC', descricao: 'Ampla concorrência', regraDeAplicabilidade: [] },
            {
              codigo: 'AC_PCD',
              descricao: 'Pessoa com deficiência',
              regraDeAplicabilidade: QUEM_CONCORRE_PCD,
            },
          ],
        },
      ],
      regrasDerivacao: [],
      ...inscricao,
    };
  }

  /** Grava o quadro e responde o processo relido; o resto da gravação fica com o teste. */
  async function gravarQuadro(
    processo: Record<string, unknown> = processoGravado(),
  ): Promise<{ readonly gravacao: Promise<{ valid: boolean; messages?: readonly string[] }> }> {
    const gravacao = componente.persistir();
    controller.expectOne(ROTA_DISTRIBUICAO).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    controller.expectOne(ROTA_PROCESSO).flush(processo);
    await proximoPasso();
    return { gravacao };
  }

  it('põe no formulário de inscrição a pergunta que a regra congelada cita, sem gravar derivação', async () => {
    const { gravacao } = await gravarQuadro(
      processoGravado({
        formularios: [formularioDeInscricao(['NOME'])],
        cronogramaFases: [FASE_DE_INSCRICAO],
      }),
    );

    // A pergunta entra na seção dos outros dados, que o cabeçalho do formulário cria antes dos itens.
    const cabecalho = controller.expectOne((r) => r.method === 'PUT' && r.url === ROTA_INSCRICAO);
    expect(cabecalho.request.body.etapas.map((e: { codigo: string }) => e.codigo)).toContain(
      'OUTROS_DADOS_EXIGIDOS',
    );
    cabecalho.flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();

    const itens = controller.expectOne(
      (r) => r.method === 'PUT' && r.url === `${ROTA_INSCRICAO}/itens`,
    );
    // A seção dos dados básicos é da api e não vai no envio.
    expect(itens.request.body.itens.map((item: { fatoCodigo: string }) => item.fatoCodigo)).toEqual(
      ['CONCORRER_PCD'],
    );
    itens.flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    controller.match((r) => r.method === 'GET' && r.url === ROTA_PROCESSO);

    await expect(gravacao).resolves.toEqual({ valid: true });
    controller.expectNone((r) => r.url.startsWith(ROTA_DERIVACAO));
  });

  it('não grava nada além do quadro quando o formulário já coleta o que as regras citam', async () => {
    const { gravacao } = await gravarQuadro();

    await expect(gravacao).resolves.toEqual({ valid: true });
    controller.expectNone((r) => r.method === 'PUT');
  });

  it('sem fase de inscrição, aceita a gravação e deixa as perguntas para o cronograma', async () => {
    const { gravacao } = await gravarQuadro(
      processoGravado({ formularios: [], cronogramaFases: [] }),
    );

    await expect(gravacao).resolves.toEqual({ valid: true });
    controller.expectNone((r) => r.method === 'PUT');
  });

  it('recusa e pede o catálogo de fatos de novo quando ele falhou', async () => {
    const catalogos = TestBed.inject(CatalogosDoCronograma);
    catalogos.fatos.set([]);
    catalogos.erro.set('Não foi possível carregar os catálogos.');
    const carregar = vi.spyOn(catalogos, 'carregar');

    const { gravacao } = await gravarQuadro(
      processoGravado({
        formularios: [formularioDeInscricao(['NOME'])],
        cronogramaFases: [FASE_DE_INSCRICAO],
      }),
    );

    const resultado = await gravacao;
    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.[0]).toContain('Grave de novo em instantes');
    expect(carregar).toHaveBeenCalled();
    controller.expectNone((r) => r.method === 'PUT');
  });

  it('no processo que importa o resultado, relê só para mostrar as regras, sem pôr perguntas', async () => {
    store.patchObjectSection('identificacao', {
      origemCandidatos: OrigemCandidatos.importacaoExterna,
    });

    const { gravacao } = await gravarQuadro(
      processoGravado({
        formularios: [formularioDeInscricao(['NOME'])],
        cronogramaFases: [FASE_DE_INSCRICAO],
      }),
    );

    await expect(gravacao).resolves.toEqual({ valid: true });
    controller.expectNone((r) => r.method === 'PUT');
    expect(store.regrasDasModalidades().map((modalidade) => modalidade.codigo)).toEqual([
      'AC',
      'AC_PCD',
    ]);
  });

  it('mostra, depois de gravar o quadro, quem concorre em cada modalidade pela regra congelada', async () => {
    const { gravacao } = await gravarQuadro();
    await expect(gravacao).resolves.toEqual({ valid: true });
    fixture.detectChanges();

    const secao = fixture.nativeElement.querySelector('sel-regras-das-modalidades') as HTMLElement;
    expect(secao.textContent).toContain('Quem concorre em cada modalidade');
    const linhas = [...secao.querySelectorAll('dl > div')].map((linha) =>
      (linha.textContent ?? '').replace(/\s+/g, ' ').trim(),
    );
    expect(linhas).toEqual([
      'AC — Ampla concorrência Todos os candidatos',
      'AC_PCD — Pessoa com deficiência Concorrer na reserva para pessoa com deficiência é sim',
    ]);
  });
});
