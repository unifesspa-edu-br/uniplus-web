import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { ORGANIZACAO_BASE_PATH } from '@uniplus/shared-data/organizacao';
import { GEO_BASE_PATH } from '@uniplus/shared-data/geo';
import { PUBLICACOES_BASE_PATH } from '@uniplus/shared-data/publicacoes';
import {
  SELECAO_BASE_PATH,
  type FormularioDto,
  type ProcessoSeletivoDto,
} from '@uniplus/shared-data/selecao';
import { conteudoInicial } from '@uniplus/shared-ui/components';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type {
  AtributosCongeladosDaFase,
  ExigenciaDeDocumento,
  FaseDoCronograma,
} from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicial } from '../../shared/cadastro-inicial.service';
import { GravacaoDoProcesso } from '../../shared/gravacao/gravacao-do-processo';
import { comExigencia, exigenciaNova } from '../../shared/exigencias/exigencias-documentais';
import { CatalogosDoCronograma } from '../cronograma/catalogos-do-cronograma.service';
import { PASSO_CRONOGRAMA } from '../../shared/documentos-exigidos';
import { PASSO_DESEMPATE } from '../desempate/desempate-por-idade';
import { FormularioStepComponent } from './formulario.component';
import { GravacaoDosFormularios } from './servicos/gravacao-dos-formularios.service';
import { CamposPressupostosDoFormulario } from './servicos/campos-pressupostos-do-formulario.service';
import { FasesDosFormularios } from './servicos/fases-dos-formularios.service';
import { RemocaoDoFormulario } from './servicos/remocao-do-formulario.service';
import { AplicacaoDeModelo } from './servicos/aplicacao-de-modelo.service';
import { conteudoDoFormulario } from './formulario-do-processo';

const BASE = 'http://localhost:5000';
const PROCESSO_ID = '01960000-0000-7000-0000-0000000007aa';
const ROTA_PROCESSO = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}`;
const ROTA_INSCRICAO = `${BASE}/api/selecao/admin/processos-seletivos/${PROCESSO_ID}/formularios/INSCRICAO`;
const PROBLEM_JSON = { 'content-type': 'application/problem+json' };

const CONGELADOS_DA_INSCRICAO: AtributosCongeladosDaFase = {
  origemData: 'NO_EDITAL',
  agrupaEtapas: false,
  coletaInscricao: true,
  permiteComplementacao: false,
  coletaSolicitacaoIsencao: false,
  bancas: [],
};

const FASE_INSCRICAO: FaseDoCronograma = {
  faseCanonicaId: 'fc-inscricao',
  codigo: 'INSCRICAO',
  ordem: 0,
  inicio: null,
  fim: null,
  unidadeResponsavelId: null,
  produtos: [],
  faseConcluinteCodigo: null,
  emiteParecerIndividual: false,
  bancasRequeridas: [],
  regraRecurso: null,
  congelados: CONGELADOS_DA_INSCRICAO,
};

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
  titulo: codigo === 'S1' ? 'Condições especiais' : codigo,
  descricao: null,
  aviso: null,
  exibicao: null,
});

/** A inscrição como o servidor a devolve: com a seção dos dados básicos que a API acrescenta. */
const GRAVADO = {
  finalidade: 'INSCRICAO',
  faseId: 'F-INSCRICAO',
  titulo: 'Inscrição — Medicina 2027',
  modeloOrigemId: null,
  modeloOrigemCodigo: null,
  etapas: [
    etapa('DADOS_BASICOS', 0),
    etapa('S1', 1),
    etapa('REVISAO_E_ACEITE', 2, 'REVISAO_E_ACEITE'),
  ],
  fatosColetados: [
    campo('NOME', 0, 'DADOS_BASICOS'),
    {
      ...campo('PCD', 1, 'S1'),
      obrigatoriedade: {
        tipo: 'QUANDO',
        predicado: [[{ fato: 'NOME', operador: 'IGUAL', valor: 'x' }]],
      },
    },
  ],
  termos: [],
  grupos: [
    {
      codigo: 'FAMILIA',
      ordem: 3,
      rotulo: 'FAMILIA',
      etapaCodigo: 'S1',
      minimo: 0,
      maximo: null,
      exibicao: null,
      obrigatoriedade: { tipo: 'SEMPRE', predicado: null },
      incluiCandidato: false,
      subitens: [],
    },
  ],
} as unknown as FormularioDto;

const PROCESSO = {
  formularios: [GRAVADO],
  cronogramaFases: [{ id: 'F-INSCRICAO', codigo: 'INSCRICAO', coletaInscricao: true }],
};

const PCD_NO_CATALOGO = {
  id: 'f-pcd',
  codigo: 'PCD',
  nome: 'Pessoa com deficiência',
  descricao: null,
  dominio: 'BOOLEANO',
  origem: 'DECLARADO',
  cardinalidade: 'ESCALAR',
  valoresDominio: null,
  pontoResolucao: 'INSCRICAO',
  binding: 'CAMPO_INSCRICAO:PCD',
  valoresDominioDeclarados: null,
  fonteValores: null,
  ativo: true,
  escopo: 'CANDIDATO',
};

describe('FormularioStepComponent', () => {
  let fixture: ComponentFixture<FormularioStepComponent>;
  const servicoDeModelos = (): AplicacaoDeModelo =>
    fixture.debugElement.injector.get(AplicacaoDeModelo);
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let host: HTMLElement;

  /** Deixa a cadeia de `await` da gravação avançar antes da próxima expectativa. */
  const proximoPasso = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormularioStepComponent],
      providers: [
        provideRouter([]),
        ProcessoSeletivoStore,
        CadastroInicial,
        GravacaoDoProcesso,
        CatalogosDoCronograma,
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        { provide: ORGANIZACAO_BASE_PATH, useValue: BASE },
        { provide: PUBLICACOES_BASE_PATH, useValue: BASE },
        { provide: GEO_BASE_PATH, useValue: BASE },
      ],
    }).compileComponents();

    store = TestBed.inject(ProcessoSeletivoStore);
    controller = TestBed.inject(HttpTestingController);
    store.processoSeletivoId.set(PROCESSO_ID);
    store.patchSection('cronograma', { ...store.draft().cronograma, fases: [FASE_INSCRICAO] });
    store.patchObjectSection('formulario', {
      conteudo: conteudoDoFormulario(GRAVADO),
      referenciaTemporal: { tipo: 'DATA_ESPECIFICA', data: '2027-01-15', faseCodigo: '' },
    });

    fixture = TestBed.createComponent(FormularioStepComponent);
    host = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    for (const requisicao of controller.match(() => true)) {
      requisicao.flush(requisicao.request.url.includes('fatos-candidato') ? [PCD_NO_CATALOGO] : []);
    }
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  function valor(rotulo: string): readonly (string | undefined)[] {
    return Array.from(host.querySelectorAll('dl'))
      .filter((dl) => dl.querySelector('dt')?.textContent?.trim() === rotulo)
      .map((dl) => dl.querySelector('dd')?.textContent?.trim());
  }

  function declararDesempate(regraCodigo: string): void {
    store.patchSection('desempate', [
      {
        regraCodigo,
        regraVersao: 'v1',
        etapaRef: '',
        idadeMinima: '',
        fato: '',
        operador: '',
        valor: '',
        areas: [],
      },
    ]);
  }

  /** O processo como a hidratação o deixa: o gravado é o que a simulação abre. */
  function comProcessoLido(): void {
    store.remoteSnapshot.set({ ...PROCESSO, id: PROCESSO_ID, status: 'rascunho' } as never);
    fixture.detectChanges();
  }

  describe('etapa dos documentos do formulário', () => {
    const TIPO_LAUDO = '01960000-0000-7000-0000-0000000000d1';
    const COM_ETAPA_DE_DOCUMENTOS = {
      ...GRAVADO,
      etapas: [
        etapa('DADOS_BASICOS', 0),
        etapa('DOCUMENTOS', 1, 'COMPROVACAO_DOCUMENTAL'),
        etapa('REVISAO_E_ACEITE', 2, 'REVISAO_E_ACEITE'),
      ],
      fatosColetados: [campo('NOME', 0, 'DADOS_BASICOS')],
      grupos: [],
    } as unknown as FormularioDto;

    /** O processo publicado: os passos mostram o que está gravado como texto. */
    function emConsulta(): void {
      TestBed.inject(CatalogosDoCronograma).fatos.set([PCD_NO_CATALOGO] as never);
      store.patchObjectSection('formulario', {
        conteudo: conteudoDoFormulario(COM_ETAPA_DE_DOCUMENTOS),
      });
      store.remoteSnapshot.set({ ...PROCESSO, id: PROCESSO_ID, status: 'publicado' } as never);
      fixture.detectChanges();
    }

    it('lista os documentos da fase do formulário, com a condição de cada um, em vez de "Nenhum campo"', () => {
      const laudo = {
        ...exigenciaNova(TIPO_LAUDO, 'INSCRICAO'),
        tipoDocumentoNome: 'Laudo médico',
        aplicabilidade: 'CONDICIONAL',
        condicoes: [{ clausula: 0, fato: 'PCD', operador: 'IGUAL', valor: 'true' }],
        formatosPermitidos: ['PDF'],
        tamanhoMaximoBytes: 5 * 1024 * 1024,
      } as ExigenciaDeDocumento;
      const certidaoDeOutraFase = {
        ...exigenciaNova(TIPO_LAUDO, 'MATRICULA'),
        tipoDocumentoNome: 'Outra fase',
      };
      store.patchSection(
        'documentos',
        comExigencia(comExigencia({ raizes: [], emTodasAsFases: [] }, laudo), certidaoDeOutraFase),
      );

      emConsulta();

      const texto = host.textContent ?? '';
      expect(texto).toContain('Laudo médico');
      expect(texto).toContain('Obrigatório');
      expect(texto).toContain('Pessoa com deficiência');
      expect(texto).toContain('PDF, até 5,0 MB');
      expect(texto).not.toContain('Outra fase');
      expect(host.querySelector('sel-documentos-do-formulario')?.textContent).toContain(
        'Laudo médico',
      );
    });

    it('não diz que a fase não exige nada quando o documento ainda não tem formulário escolhido', () => {
      const dividida = {
        ...FASE_INSCRICAO,
        congelados: { ...CONGELADOS_DA_INSCRICAO, coletaSolicitacaoIsencao: true },
      };
      store.patchSection('cronograma', { ...store.draft().cronograma, fases: [dividida] });
      store.patchSection(
        'documentos',
        comExigencia({ raizes: [], emTodasAsFases: [] }, exigenciaNova(TIPO_LAUDO, 'INSCRICAO')),
      );

      emConsulta();

      const texto = host.textContent ?? '';
      expect(texto).toContain('1 documento desta fase depende da escolha do formulário');
      expect(texto).not.toContain('Nenhum documento exigido nesta fase');
    });

    it('lista o documento exigido em todas as fases, também na fase acrescentada depois', () => {
      const antes = {
        ...FASE_INSCRICAO,
        codigo: 'ANTES',
        congelados: { ...CONGELADOS_DA_INSCRICAO, coletaInscricao: false },
      };
      store.patchSection('cronograma', {
        ...store.draft().cronograma,
        fases: [antes, FASE_INSCRICAO],
      });
      store.patchSection('documentos', {
        ...comExigencia(
          { raizes: [], emTodasAsFases: [] },
          { ...exigenciaNova(TIPO_LAUDO, 'ANTES'), tipoDocumentoNome: 'Laudo médico' },
        ),
        emTodasAsFases: [TIPO_LAUDO],
      });

      emConsulta();

      expect(host.querySelector('sel-documentos-do-formulario')?.textContent).toContain(
        'Laudo médico',
      );
    });

    it('sem documento na fase, diz que nenhum é exigido e leva ao Cronograma', () => {
      store.patchObjectSection('formulario', {
        conteudo: conteudoDoFormulario(COM_ETAPA_DE_DOCUMENTOS),
      });
      fixture.detectChanges();

      expect(host.textContent).toContain('Nenhum documento exigido nesta fase');
      host.querySelector<HTMLButtonElement>('sel-documentos-do-formulario button')?.click();
      expect(store.currentStep()).toBe(PASSO_CRONOGRAMA);
    });
  });

  it('a simulação usa o processo gravado e avisa a alteração ainda não gravada', () => {
    comProcessoLido();
    fixture.detectChanges();
    expect(host.textContent).not.toContain('Há alteração nos formulários ainda não gravada');

    store.patchObjectSection('formulario', {
      conteudo: { ...conteudoDoFormulario(GRAVADO), titulo: 'Outro título' },
    });
    fixture.detectChanges();

    expect(host.textContent).toContain('Há alteração nos formulários ainda não gravada');
  });

  it('cada formulário gravado tem o link que abre a simulação dele em nova aba', () => {
    comProcessoLido();

    const link = host.querySelector('.form-simulacao__links a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toMatch(/\/processo-seletivo\/.+\/simulacao\/INSCRICAO$/);
    expect(link.target).toBe('_blank');
  });

  it('com uma só fase que coleta inscrição, a escolhe sozinho', () => {
    expect(store.draft().formulario.faseCodigo).toBe('');
    expect(fixture.debugElement.injector.get(FasesDosFormularios).faseDaInscricao()).toBe(
      'INSCRICAO',
    );
    expect(fixture.componentInstance.validar()).toEqual({ valid: true });
  });

  it('antes de o formulário existir no servidor, o combo não oferece o conjunto básico, que a API põe na seção reservada', () => {
    expect(
      fixture.componentInstance.abas()[0].fatosIndisponiveis,
      'com a seção dos dados básicos, ela é a referência',
    ).not.toContain('SEXO');

    store.patchObjectSection('formulario', { conteudo: conteudoInicial() });

    expect(fixture.componentInstance.abas()[0].fatosIndisponiveis).toContain('SEXO');
  });

  it('o formulário de isenção que já existe barra o passo quando o processo deixa de cobrar taxa', () => {
    store.patchObjectSection('formulario', {
      outrasFinalidades: [
        { finalidade: 'ISENCAO_TAXA', faseCodigo: 'INSCRICAO', conteudo: conteudoInicial() },
      ],
    });
    store.patchObjectSection('pagamento', { cobra: false });

    const validacao = fixture.componentInstance.validar();

    expect(validacao.valid).toBe(false);
    expect(validacao.messages?.join(' ')).toContain(
      'O processo não cobra taxa de inscrição, e o formulário de isenção',
    );
  });

  it('o campo que uma exigência documental cita não sai, e o editor diz por quê', () => {
    const exigencia = {
      ...exigenciaNova('01960000-0000-7000-0000-0000000000d1', 'INSCRICAO'),
      aplicabilidade: 'CONDICIONAL',
      condicoes: [{ clausula: 0, fato: 'PCD', operador: 'IGUAL', valor: 'true' }],
    } as ExigenciaDeDocumento;
    store.patchSection('documentos', comExigencia({ raizes: [], emTodasAsFases: [] }, exigencia));
    fixture.detectChanges();

    expect(
      fixture.debugElement.injector
        .get(CamposPressupostosDoFormulario)
        .remocoesTravadas()
        .get('PCD'),
    ).toMatch(/^Não pode sair: o documento/);
    expect(host.textContent).toContain('Não pode sair: o documento');
  });

  it('o campo que a regra de uma modalidade ofertada cita não sai depois de gravar o quadro', () => {
    store.registrarRegrasDasModalidades({
      distribuicaoVagas: [
        {
          modalidades: [
            {
              codigo: 'AC_PCD',
              descricao: 'Pessoa com deficiência',
              regraDeAplicabilidade: [[{ fato: 'PCD', operador: 'IGUAL', valor: true }]],
            },
          ],
        },
      ],
    } as unknown as ProcessoSeletivoDto);
    fixture.detectChanges();

    expect(
      fixture.debugElement.injector
        .get(CamposPressupostosDoFormulario)
        .remocoesTravadas()
        .get('PCD'),
    ).toBe(
      'Não pode sair: a regra de quem concorre em AC_PCD depende deste dado. Desfaça a dependência antes de remover o campo.',
    );
  });

  it('grava só o que mudou, seguindo o plano, e envia os itens sem os dados básicos', async () => {
    const conteudo = store.draft().formulario.conteudo;
    store.patchObjectSection('formulario', {
      conteudo: {
        ...conteudo,
        itens:
          conteudo.itens?.map((i) =>
            i.fatoCodigo === 'PCD' ? { ...i, rotulo: 'Você tem deficiência?' } : i,
          ) ?? [],
      },
    });

    const gravacao = fixture.componentInstance.persistir();
    controller.expectOne(ROTA_PROCESSO).flush(PROCESSO);
    await proximoPasso();

    const itens = controller.expectOne(
      (r) => r.method === 'PUT' && r.url === `${ROTA_INSCRICAO}/itens`,
    );
    expect(
      itens.request.body.itens.map((i: { fatoCodigo: string; rotulo: string }) => [
        i.fatoCodigo,
        i.rotulo,
      ]),
    ).toEqual([['PCD', 'Você tem deficiência?']]);
    expect(itens.request.headers.has('Idempotency-Key')).toBe(true);
    itens.flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();

    controller
      .expectOne(`${ROTA_PROCESSO}/referencia-temporal-fatos`)
      .flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    controller.expectOne(ROTA_PROCESSO).flush(PROCESSO);

    expect(await gravacao).toEqual({ valid: true });
    // A releitura projeta o que o servidor tem, inclusive a fase pelo código.
    expect(store.draft().formulario.faseCodigo).toBe('INSCRICAO');
  });

  it('recusa o limite que não é número e diz em que formulário está', () => {
    const conteudo = store.draft().formulario.conteudo;
    store.patchObjectSection('formulario', {
      conteudo: {
        ...conteudo,
        itens:
          conteudo.itens?.map((i) =>
            i.fatoCodigo === 'PCD'
              ? { ...i, restricoes: [{ tipo: 'TAMANHO_TEXTO', minimo: 'dez', maximo: null }] }
              : i,
          ) ?? [],
      },
    });

    expect(fixture.componentInstance.validar()).toEqual({
      valid: false,
      messages: [
        'O formulário de inscrição tem campos que não são números: veja os campos marcados na aba dele.',
      ],
    });
  });

  it('a recusa de um item vai para ele, pelo índice da lista enviada sem os dados básicos', async () => {
    const conteudo = store.draft().formulario.conteudo;
    store.patchObjectSection('formulario', {
      conteudo: {
        ...conteudo,
        itens:
          conteudo.itens?.map((i) => (i.fatoCodigo === 'PCD' ? { ...i, rotulo: 'Outro' } : i)) ??
          [],
      },
    });

    const gravacao = fixture.componentInstance.persistir();
    controller.expectOne(ROTA_PROCESSO).flush(PROCESSO);
    await proximoPasso();
    controller.expectOne(`${ROTA_INSCRICAO}/itens`).flush(
      {
        type: 'about:blank',
        title: 'Recusado.',
        status: 422,
        code: 'uniplus.selecao.formulario.item_invalido',
        traceId: '00000000000000000000000000000003',
        errors: [{ field: 'itens[0].rotulo', code: 'x', message: 'Rótulo recusado.' }],
      },
      { status: 422, statusText: 'Unprocessable Entity', headers: PROBLEM_JSON },
    );
    await proximoPasso();
    // Depois da recusa, relê para comparar a próxima tentativa com o que ficou gravado.
    controller.expectOne(ROTA_PROCESSO).flush(PROCESSO);

    const resultado = await gravacao;
    expect(resultado.valid).toBe(false);
    expect(
      fixture.debugElement.injector
        .get(GravacaoDosFormularios)
        .recusas()
        .get('INSCRICAO')
        ?.porItem.get('PCD'),
    ).toEqual(['Rótulo recusado.']);
  });

  it('avisa do desempate por idoso sem apuração da idade e leva ao passo Desempate', () => {
    declararDesempate('DESEMPATE-IDOSO');
    store.patchObjectSection('formulario', {
      referenciaTemporal: { tipo: '', data: '', faseCodigo: '' },
    });
    fixture.detectChanges();

    expect(host.querySelector('#form-idoso-sem-apuracao')).not.toBeNull();
    // A data de nascimento é dos dados básicos, que a inscrição sempre coleta.
    expect(host.querySelector('#form-desempate-sem-nascimento')).toBeNull();
    (host.querySelector('#form-ir-desempate-apuracao') as HTMLButtonElement).click();
    expect(store.currentStep()).toBe(PASSO_DESEMPATE);
  });

  describe('com um formulário por finalidade', () => {
    const ROTA_HABILITACAO = `${BASE}/api/selecao/admin/processos-seletivos/${PROCESSO_ID}/formularios/HABILITACAO`;
    const FASE_HABILITACAO: FaseDoCronograma = {
      ...FASE_INSCRICAO,
      faseCanonicaId: 'fc-habilitacao',
      codigo: 'HABILITACAO',
      ordem: 1,
      congelados: {
        origemData: 'NO_EDITAL',
        agrupaEtapas: false,
        coletaInscricao: false,
        permiteComplementacao: false,
        coletaSolicitacaoIsencao: false,
        bancas: [],
      },
    };
    const HABILITACAO_GRAVADA = {
      ...GRAVADO,
      finalidade: 'HABILITACAO',
      faseId: 'F-HABILITACAO',
      etapas: [etapa('REVISAO_E_ACEITE', 0, 'REVISAO_E_ACEITE')],
      fatosColetados: [],
    } as unknown as FormularioDto;

    const abas = (): HTMLButtonElement[] =>
      Array.from(host.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const teclar = (aba: HTMLButtonElement, key: string): void => {
      aba.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      fixture.detectChanges();
    };

    beforeEach(() => {
      store.patchSection('cronograma', {
        ...store.draft().cronograma,
        fases: [FASE_INSCRICAO, FASE_HABILITACAO],
      });
      store.patchObjectSection('formulario', {
        outrasFinalidades: [
          {
            finalidade: 'HABILITACAO',
            faseCodigo: '',
            conteudo: conteudoDoFormulario(HABILITACAO_GRAVADA),
          },
        ],
      });
      fixture.detectChanges();
    });

    it('só a aba ativa entra no Tab, e setas, Home e End trocam de aba levando o foco', () => {
      const [inscricao, habilitacao] = abas();
      expect([inscricao.tabIndex, habilitacao.tabIndex]).toEqual([0, -1]);
      expect(
        host
          .querySelector(`#${inscricao.getAttribute('aria-controls')}`)
          ?.getAttribute('aria-labelledby'),
      ).toBe(inscricao.id);

      teclar(inscricao, 'ArrowRight');
      expect(abas().map((aba) => aba.getAttribute('aria-selected'))).toEqual(['false', 'true']);
      expect([inscricao.tabIndex, habilitacao.tabIndex]).toEqual([-1, 0]);
      expect(document.activeElement).toBe(habilitacao);
      expect((host.querySelector('#form-painel-habilitacao') as HTMLElement).hidden).toBe(false);

      teclar(habilitacao, 'Home');
      expect(document.activeElement).toBe(inscricao);
      teclar(inscricao, 'End');
      expect(document.activeElement).toBe(habilitacao);
    });

    it('a inscrição não oferece remoção; as outras finalidades, sim', () => {
      expect(host.querySelector('#form-inscricao-remover')).toBeNull();
      expect(host.querySelector('#form-habilitacao-remover')).not.toBeNull();
    });

    it('os fatos da inscrição são citáveis na habilitação, e o fato que ela cita não sai da inscrição', () => {
      const habilitacao = fixture.componentInstance
        .abas()
        .find((aba) => aba.finalidade === 'HABILITACAO');
      expect(habilitacao?.fatosDaInscricao).toContain('PCD');

      const conteudo = conteudoDoFormulario(HABILITACAO_GRAVADA);
      store.patchObjectSection('formulario', {
        outrasFinalidades: [
          {
            finalidade: 'HABILITACAO',
            faseCodigo: '',
            conteudo: {
              ...conteudo,
              termos: [
                {
                  codigo: 'T',
                  ordem: 0,
                  termoId: 't',
                  versaoId: 'v',
                  exibicao: [[{ fato: 'PCD', operador: 'IGUAL', valor: 'true' }]],
                  obrigatoriedade: 'SEMPRE',
                  predicadoObrigatoriedade: null,
                },
              ],
            },
          },
        ],
      });

      expect(
        fixture.debugElement.injector
          .get(CamposPressupostosDoFormulario)
          .remocoesTravadas()
          .get('PCD'),
      ).toMatch(/o formulário de habilitação depende deste dado/);
    });

    it('a recusa da remoção aparece em texto na aba, que continua, e a remoção trava o passo enquanto está no ar', async () => {
      fixture.debugElement.injector.get(RemocaoDoFormulario).pedir('HABILITACAO');
      const remocao = fixture.componentInstance.confirmarRemocao();
      controller
        .expectOne(ROTA_PROCESSO)
        .flush({ ...PROCESSO, formularios: [GRAVADO, HABILITACAO_GRAVADA] });
      await proximoPasso();
      expect(
        store.operacaoEmAndamento(),
        'um PUT da aba depois do DELETE recriaria o formulário',
      ).toBe(true);
      controller
        .expectOne((r) => r.method === 'DELETE' && r.url === ROTA_HABILITACAO)
        .flush(
          {
            type: 'about:blank',
            title: 'A remoção foi recusada.',
            status: 422,
            code: 'uniplus.selecao.formulario.remocao_so_em_rascunho',
            traceId: '00000000000000000000000000000004',
          },
          { status: 422, statusText: 'Unprocessable Entity', headers: PROBLEM_JSON },
        );
      await remocao;
      fixture.detectChanges();

      expect(host.querySelector('#form-habilitacao-recusa-remocao')?.textContent).toContain(
        'A remoção foi recusada.',
      );
      expect(abas()[1].textContent).toContain('(recusado)');
      expect(store.draft().formulario.outrasFinalidades.map((outra) => outra.finalidade)).toEqual([
        'HABILITACAO',
      ]);
      expect(store.operacaoEmAndamento()).toBe(false);
    });

    it('removido o penúltimo formulário, sem abas, o foco vai ao título do painel que sobra', async () => {
      fixture.debugElement.injector.get(RemocaoDoFormulario).pedir('HABILITACAO');
      const remocao = fixture.componentInstance.confirmarRemocao();
      controller
        .expectOne(ROTA_PROCESSO)
        .flush({ ...PROCESSO, id: PROCESSO_ID, formularios: [GRAVADO, HABILITACAO_GRAVADA] });
      await proximoPasso();
      controller
        .expectOne((r) => r.method === 'DELETE' && r.url === ROTA_HABILITACAO)
        .flush(null, { status: 204, statusText: 'No Content' });
      await remocao;
      fixture.detectChanges();
      await fixture.whenStable();

      expect(abas()).toEqual([]);
      expect(document.activeElement?.id).toBe('form-inscricao-fase-titulo');
      expect(host.textContent, 'o servidor já está como o rascunho').not.toContain(
        'Há alteração nos formulários ainda não gravada',
      );
    });

    it('acrescentar uma finalidade abre a aba dela, leva o foco até ela e anuncia', async () => {
      store.patchObjectSection('formulario', { outrasFinalidades: [] });
      fixture.detectChanges();

      fixture.componentInstance.finalidadeAAcrescentar.set('HABILITACAO');
      fixture.componentInstance.acrescentarFinalidade();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(fixture.componentInstance.abaAtiva()).toBe('HABILITACAO');
      expect(document.activeElement?.id).toBe('form-aba-habilitacao');
      expect(host.querySelector('#form-anuncio')?.textContent).toContain(
        'Formulário de habilitação acrescentado',
      );
    });
  });

  describe('partindo de um modelo', () => {
    const ROTA_MODELOS = `${BASE}/api/configuracao/admin/modelos-formulario`;
    const ROTA_APLICACAO = `${BASE}/api/selecao/admin/processos-seletivos/${PROCESSO_ID}/formularios/aplicacoes-de-modelo`;
    const ROTA_HABILITACAO = `${BASE}/api/selecao/admin/processos-seletivos/${PROCESSO_ID}/formularios/HABILITACAO`;
    const modelo = (id: string, nome: string, finalidade: string) => ({
      id,
      codigo: id.toUpperCase(),
      nome,
      descricao: null,
      finalidade,
      tipoProcessoCodigo: 'MEDICINA',
      ativo: true,
      conteudo: {},
    });
    const MODELOS = [
      modelo('insc', 'Inscrição de Medicina', 'INSCRICAO'),
      modelo('hab', 'Habilitação padrão', 'HABILITACAO'),
    ];
    const relato = (finalidade: string) => ({
      finalidade,
      fatosTrazidosParaAInscricao: [],
      fatosMantidosNaInscricao: [],
      descartados: [],
      derivacoesCopiadas: [],
      derivacoesMantidas: [],
    });
    /** A inscrição que a cópia deixa no servidor: sem PCD, que o modelo não traz. */
    const INSCRICAO_COPIADA = {
      ...GRAVADO,
      modeloOrigemId: 'insc',
      modeloOrigemCodigo: 'INSC',
      fatosColetados: [campo('NOME', 0, 'DADOS_BASICOS')],
    } as unknown as FormularioDto;
    const PROCESSO_COM_DERIVACOES = { ...PROCESSO, regrasDerivacao: [] };

    beforeEach(() => {
      store.patchObjectSection('tipoProcesso', { codigo: 'MEDICINA' });
      fixture.detectChanges();
      controller.expectOne((r) => r.url === ROTA_MODELOS).flush(MODELOS);
      fixture.detectChanges();
    });

    function escolherEAplicar(finalidade: string, modeloId: string): Promise<void> {
      servicoDeModelos().escolher(finalidade, modeloId);
      servicoDeModelos().pedir(finalidade);
      return fixture.componentInstance.confirmarAplicacao();
    }

    it('lista os modelos ativos do tipo do processo, e cada aba só os da finalidade dela', () => {
      // O beforeEach já respondeu; a requisição é refeita para conferir os filtros que ela leva.
      servicoDeModelos().carregarModelos();
      const listagem = controller.expectOne((r) => r.url === ROTA_MODELOS);
      expect(listagem.request.params.get('tipoProcesso')).toBe('MEDICINA');
      expect(listagem.request.params.get('ativo')).toBe('true');
      listagem.flush(MODELOS);
      fixture.detectChanges();

      const opcoes = Array.from(
        host.querySelectorAll<HTMLOptionElement>('#form-inscricao-modelo option'),
      ).map((opcao) => opcao.value);
      expect(opcoes).toEqual(['', 'insc']);
      expect(host.querySelector('#form-inscricao-modelo')?.getAttribute('aria-describedby')).toBe(
        'form-inscricao-modelo-ajuda',
      );
    });

    it('antes de o processo existir, aplicar fica indisponível e a ajuda diz por quê', () => {
      servicoDeModelos().escolher('INSCRICAO', 'insc');
      store.processoSeletivoId.set(null);
      fixture.detectChanges();

      expect(
        (host.querySelector('#form-inscricao-aplicar-modelo') as HTMLButtonElement).disabled,
      ).toBe(true);
      expect(host.querySelector('#form-inscricao-modelo-ajuda')?.textContent).toContain(
        'depois que o processo for criado',
      );
    });

    it('pede confirmação antes de substituir, dizendo que as edições não gravadas saem', () => {
      servicoDeModelos().escolher('INSCRICAO', 'insc');
      fixture.detectChanges();
      (host.querySelector('#form-inscricao-aplicar-modelo') as HTMLButtonElement).click();
      fixture.detectChanges();

      // Nenhuma requisição saiu: o afterEach confere.
      expect(servicoDeModelos().pendente()?.modelo.id).toBe('insc');
      expect(servicoDeModelos().aviso()).toContain(
        'inclusive as edições desta aba ainda não gravadas',
      );
      servicoDeModelos().cancelar();
      expect(servicoDeModelos().pendente()).toBeNull();
    });

    it('relê o processo e devolve ao formulário o que as exigências pressupõem, trava o passo enquanto aplica e mostra o resumo e a origem', async () => {
      const exigencia = {
        ...exigenciaNova('01960000-0000-7000-0000-0000000000d1', 'INSCRICAO'),
        aplicabilidade: 'CONDICIONAL',
        condicoes: [{ clausula: 0, fato: 'PCD', operador: 'IGUAL', valor: 'true' }],
      } as ExigenciaDeDocumento;
      store.patchSection('documentos', comExigencia({ raizes: [], emTodasAsFases: [] }, exigencia));

      const aplicacao = escolherEAplicar('INSCRICAO', 'insc');
      expect(
        store.operacaoEmAndamento(),
        'um PUT da aba durante a aplicação gravaria por cima da cópia',
      ).toBe(true);
      controller.expectOne(ROTA_PROCESSO).flush(PROCESSO_COM_DERIVACOES);
      await proximoPasso();
      const post = controller.expectOne((r) => r.method === 'POST' && r.url === ROTA_APLICACAO);
      expect(post.request.body).toEqual({ modeloId: 'insc' });
      expect(post.request.headers.get('Accept')).toBe(
        'application/vnd.uniplus.aplicacao-de-modelo-formulario.v1+json',
      );
      expect(post.request.headers.has('Idempotency-Key')).toBe(true);
      post.flush(relato('INSCRICAO'));
      await proximoPasso();
      controller
        .expectOne(ROTA_PROCESSO)
        .flush({ ...PROCESSO_COM_DERIVACOES, formularios: [INSCRICAO_COPIADA] });
      await aplicacao;
      fixture.detectChanges();

      expect(store.operacaoEmAndamento()).toBe(false);
      expect(store.draft().formulario.conteudo.itens?.map((i) => i.fatoCodigo)).toEqual([
        'NOME',
        'PCD',
      ]);
      expect(host.querySelector('#form-inscricao-resumo-modelo')?.textContent).toContain(
        'Acrescentados porque o processo os pressupõe',
      );
      expect(host.querySelector('#form-inscricao-resumo-modelo')?.textContent).toContain(
        'Pessoa com deficiência',
      );
      expect(host.querySelector('#form-inscricao-origem')?.textContent).toContain('INSC');
    });

    it('a finalidade que nasce da cópia recebe em seguida o cabeçalho com a fase da aba', async () => {
      const FASE_HABILITACAO: FaseDoCronograma = {
        ...FASE_INSCRICAO,
        faseCanonicaId: 'fc-habilitacao',
        codigo: 'HABILITACAO',
        ordem: 1,
        congelados: { ...CONGELADOS_DA_INSCRICAO, coletaInscricao: false },
      };
      store.patchSection('cronograma', {
        ...store.draft().cronograma,
        fases: [FASE_INSCRICAO, FASE_HABILITACAO],
      });
      store.patchObjectSection('formulario', {
        outrasFinalidades: [
          { finalidade: 'HABILITACAO', faseCodigo: '', conteudo: conteudoInicial() },
        ],
      });
      const fases = [
        ...PROCESSO.cronogramaFases,
        { id: 'F-HABILITACAO', codigo: 'HABILITACAO', coletaInscricao: false },
      ];
      const copiada = {
        ...GRAVADO,
        finalidade: 'HABILITACAO',
        faseId: null,
        modeloOrigemId: 'hab',
        modeloOrigemCodigo: 'HAB',
        etapas: [etapa('REVISAO_E_ACEITE', 0, 'REVISAO_E_ACEITE')],
        fatosColetados: [],
      };

      const aplicacao = escolherEAplicar('HABILITACAO', 'hab');
      controller
        .expectOne(ROTA_PROCESSO)
        .flush({ ...PROCESSO_COM_DERIVACOES, cronogramaFases: fases });
      await proximoPasso();
      controller.expectOne(ROTA_APLICACAO).flush(relato('HABILITACAO'));
      await proximoPasso();
      controller.expectOne(ROTA_PROCESSO).flush({
        ...PROCESSO_COM_DERIVACOES,
        cronogramaFases: fases,
        formularios: [GRAVADO, copiada],
      });
      await proximoPasso();
      const cabecalho = controller.expectOne(
        (r) => r.method === 'PUT' && r.url === ROTA_HABILITACAO,
      );
      expect(cabecalho.request.body.faseId).toBe('F-HABILITACAO');
      cabecalho.flush(null, { status: 204, statusText: 'No Content' });
      await aplicacao;

      const habilitacao = store
        .draft()
        .formulario.outrasFinalidades.find((outra) => outra.finalidade === 'HABILITACAO');
      expect(habilitacao?.faseCodigo).toBe('HABILITACAO');
      expect(habilitacao?.modeloOrigemCodigo).toBe('HAB');
    });

    it('a recusa da aplicação aparece em texto na aba, que continua como estava', async () => {
      const antes = store.draft().formulario.conteudo;

      const aplicacao = escolherEAplicar('INSCRICAO', 'insc');
      controller.expectOne(ROTA_PROCESSO).flush(PROCESSO_COM_DERIVACOES);
      await proximoPasso();
      controller.expectOne(ROTA_APLICACAO).flush(
        {
          type: 'about:blank',
          title: 'O modelo não serve a este processo.',
          status: 422,
          code: 'uniplus.selecao.validacao',
          traceId: '00000000000000000000000000000005',
          errors: [
            {
              field: 'modelo.pressupostos[0]',
              code: 'AplicacaoDeModelo.PressupostoAusente',
              message: "O modelo cita 'RENDA', que a inscrição do processo não coleta.",
            },
          ],
        },
        { status: 422, statusText: 'Unprocessable Entity', headers: PROBLEM_JSON },
      );
      await aplicacao;
      fixture.detectChanges();

      expect(host.querySelector('#form-inscricao-recusa-modelo')?.textContent).toContain(
        "O modelo cita 'RENDA', que a inscrição do processo não coleta.",
      );
      expect(store.draft().formulario.conteudo).toBe(antes);
      expect(
        store.aplicacoesDeModeloEmAberto().size,
        'a recusa é definitiva: nada foi copiado',
      ).toBe(0);
    });

    it('sem saber se a cópia aconteceu, o passo não grava o rascunho antigo por cima dela', async () => {
      const aplicacao = escolherEAplicar('INSCRICAO', 'insc');
      controller.expectOne(ROTA_PROCESSO).flush(PROCESSO_COM_DERIVACOES);
      await proximoPasso();
      controller.expectOne(ROTA_APLICACAO).flush(
        {
          type: 'about:blank',
          title: 'Serviço indisponível.',
          status: 503,
          traceId: '00000000000000000000000000000006',
        },
        { status: 503, statusText: 'Service Unavailable', headers: PROBLEM_JSON },
      );
      await aplicacao;

      const validacao = fixture.componentInstance.validar();
      expect(validacao.valid).toBe(false);
      expect(validacao.messages?.join(' ')).toContain(
        'Não foi possível confirmar se o modelo “Inscrição de Medicina” foi aplicado ao formulário de inscrição',
      );
      fixture.detectChanges();
      const naAba = host.querySelector('#form-inscricao-recusa-modelo')?.textContent ?? '';
      expect(naAba, 'a aba não desmente a trava').toContain(
        'Não foi possível confirmar se o modelo “Inscrição de Medicina” foi aplicado',
      );
      expect(naAba).not.toContain('não foi aplicado');
    });

    it('sem saber se a cópia aconteceu, só o mesmo modelo pode ser aplicado de novo', async () => {
      servicoDeModelos().modelos.set(
        new Map([
          [
            'INSCRICAO',
            [
              { id: 'insc', nome: 'Inscrição de Medicina' },
              { id: 'outro', nome: 'Outra inscrição' },
            ],
          ],
          ['HABILITACAO', [{ id: 'hab', nome: 'Habilitação padrão' }]],
        ]) as never,
      );
      const aplicacao = escolherEAplicar('INSCRICAO', 'insc');
      controller.expectOne(ROTA_PROCESSO).flush(PROCESSO_COM_DERIVACOES);
      await proximoPasso();
      controller.expectOne(ROTA_APLICACAO).flush(
        {
          type: 'about:blank',
          title: 'Serviço indisponível.',
          status: 503,
          traceId: '00000000000000000000000000000007',
        },
        { status: 503, statusText: 'Service Unavailable', headers: PROBLEM_JSON },
      );
      await aplicacao;

      servicoDeModelos().escolher('INSCRICAO', 'outro');
      servicoDeModelos().pedir('INSCRICAO');
      expect(
        servicoDeModelos().pendente(),
        'outro modelo trocaria a chave, e a primeira cópia ainda pode chegar',
      ).toBeNull();
      servicoDeModelos().escolher('HABILITACAO', 'hab');
      servicoDeModelos().pedir('HABILITACAO');
      expect(
        servicoDeModelos().pendente(),
        'nem em outra aba: as cópias mexem no que é do processo inteiro',
      ).toBeNull();

      servicoDeModelos().escolher('INSCRICAO', 'insc');
      servicoDeModelos().pedir('INSCRICAO');
      expect(servicoDeModelos().pendente()?.modelo.id).toBe('insc');

      // A nova tentativa recusada de vez não desfaz a cópia que a primeira pode ter feito.
      const nova = fixture.componentInstance.confirmarAplicacao();
      controller.expectOne(ROTA_PROCESSO).flush(PROCESSO_COM_DERIVACOES);
      await proximoPasso();
      controller.expectOne(ROTA_APLICACAO).flush(
        {
          type: 'about:blank',
          title: 'O modelo não serve a este processo.',
          status: 422,
          code: 'uniplus.selecao.validacao',
          traceId: '00000000000000000000000000000009',
        },
        { status: 422, statusText: 'Unprocessable Entity', headers: PROBLEM_JSON },
      );
      await nova;
      fixture.detectChanges();
      const naAba = host.querySelector('#form-inscricao-recusa-modelo')?.textContent ?? '';
      expect(naAba, 'o operador sabe o que corrigir').toContain(
        'A nova tentativa foi recusada: O modelo não serve a este processo.',
      );
      expect(naAba).toContain(
        'Não foi possível confirmar se o modelo “Inscrição de Medicina” foi aplicado',
      );
      // A cópia em aberto se resolve: a outra aba deixa de ser recusada por causa dela.
      servicoDeModelos().escolher('INSCRICAO', 'insc');
      servicoDeModelos().pedir('INSCRICAO');
      const resolvida = fixture.componentInstance.confirmarAplicacao();
      controller.expectOne(ROTA_PROCESSO).flush(PROCESSO_COM_DERIVACOES);
      await proximoPasso();
      controller.expectOne(ROTA_APLICACAO).flush(relato('INSCRICAO'));
      await proximoPasso();
      controller
        .expectOne(ROTA_PROCESSO)
        .flush({ ...PROCESSO_COM_DERIVACOES, formularios: [INSCRICAO_COPIADA] });
      await resolvida;
      expect(
        servicoDeModelos().recusas().has('HABILITACAO'),
        'a recusa da habilitação era só o bloqueio',
      ).toBe(false);
    });

    it('com a cópia confirmada e a releitura falhando, a aba diz que o modelo foi aplicado e pede recarregar', async () => {
      const aplicacao = escolherEAplicar('INSCRICAO', 'insc');
      controller.expectOne(ROTA_PROCESSO).flush(PROCESSO_COM_DERIVACOES);
      await proximoPasso();
      controller.expectOne(ROTA_APLICACAO).flush(relato('INSCRICAO'));
      await proximoPasso();
      controller.expectOne(ROTA_PROCESSO).flush(
        {
          type: 'about:blank',
          title: 'Serviço indisponível.',
          status: 503,
          traceId: '00000000000000000000000000000008',
        },
        { status: 503, statusText: 'Service Unavailable', headers: PROBLEM_JSON },
      );
      await aplicacao;
      fixture.detectChanges();

      const naAba = host.querySelector('#form-inscricao-recusa-modelo')?.textContent ?? '';
      expect(naAba).toContain(
        'foi aplicado ao formulário de inscrição, mas não foi possível reler o processo. Recarregue o processo',
      );
      expect(naAba).not.toContain('Não foi possível confirmar');
      expect(fixture.componentInstance.validar().valid).toBe(false);
    });

    it('a troca de processo descarta a aplicação que aguardava confirmação', () => {
      servicoDeModelos().escolher('INSCRICAO', 'insc');
      servicoDeModelos().pedir('INSCRICAO');

      store.reset();
      fixture.detectChanges();

      expect(servicoDeModelos().pendente()).toBeNull();
    });

    it('a lista de um tipo já trocado não chega por cima da do tipo atual', () => {
      servicoDeModelos().carregarModelos();
      const doTipoAnterior = controller.expectOne((r) => r.url === ROTA_MODELOS);

      store.patchObjectSection('tipoProcesso', { codigo: 'PSIQ' });
      fixture.detectChanges();
      controller
        .expectOne((r) => r.url === ROTA_MODELOS && r.params.get('tipoProcesso') === 'PSIQ')
        .flush([modelo('psiq', 'Inscrição do PSIQ', 'INSCRICAO')]);
      doTipoAnterior.flush(MODELOS);

      expect(
        servicoDeModelos()
          .modelos()
          .get('INSCRICAO')
          ?.map((m) => m.id),
      ).toEqual(['psiq']);
    });
  });

  describe('em consulta', () => {
    beforeEach(() => {
      store.remoteSnapshot.set({ status: 'publicado' } as never);
      fixture.detectChanges();
    });

    it('não oferece partir de um modelo, e lê de que modelo o formulário partiu', () => {
      // Pelo sinal, porque a consulta não aceita edição: com o tipo conhecido, a listagem não sai.
      store.draft.update((draft) => ({
        ...draft,
        tipoProcesso: { ...draft.tipoProcesso, codigo: 'MEDICINA' },
      }));
      store.projetarSecao('formulario', { modeloOrigemCodigo: 'INSC' });
      fixture.detectChanges();

      expect(host.querySelector('#form-inscricao-modelo-titulo')).toBeNull();
      expect(valor('Modelo de origem')).toEqual(['INSC']);
    });

    it('lê o formulário como texto, sem controle nem ação de edição', () => {
      // Com a inscrição só, não há aba: nada entre o que navegar.
      expect(
        host.querySelector('input, select, textarea, button, ui-editor-de-formulario'),
      ).toBeNull();
      expect(valor('Título do formulário')).toEqual(['Inscrição — Medicina 2027']);
      expect(valor('Fase da inscrição')).toEqual(['INSCRICAO']);
      expect(host.textContent).toContain('Condições especiais');
      expect(host.querySelector('.doc-list ui-valor-em-consulta')).toBeNull();
      const linhas = Array.from(host.querySelectorAll('.doc-item__head')).map((l) =>
        l.textContent?.replace(/\s+/g, ' ').trim(),
      );
      expect(linhas).toEqual([
        'NOME · obrigatório',
        'PCD · obrigatório conforme respostas anteriores',
        'FAMILIA · repetível, obrigatório',
      ]);
    });

    it('lê a apuração da idade pelo rótulo da âncora e a data no formato brasileiro', () => {
      expect(valor('Apurar a idade em')).toEqual(['Uma data fixa']);
      expect(valor('Data de apuração')).toEqual(['15/01/2027']);
    });

    it('não mostra os avisos de idade: o processo publicado não admite a correção', () => {
      store.remoteSnapshot.set({ status: 'rascunho' } as never);
      declararDesempate('DESEMPATE-IDOSO');
      store.patchObjectSection('formulario', {
        referenciaTemporal: { tipo: '', data: '', faseCodigo: '' },
      });
      fixture.detectChanges();
      expect(host.querySelector('#form-idoso-sem-apuracao')).not.toBeNull();

      store.remoteSnapshot.set({ status: 'publicado' } as never);
      fixture.detectChanges();

      expect(host.querySelector('#form-idoso-sem-apuracao')).toBeNull();
    });
  });
});
