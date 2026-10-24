import { HttpHeaders, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, type Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserContextService } from '@uniplus/shared-auth/bootstrap';
import { RELOGIO } from '@uniplus/shared-core/relogio';
import { type ApiResult, apiFailure, apiOk } from '@uniplus/shared-core/http';
import {
  type AvaliacaoDaInscricaoDto,
  type AvaliacaoDaInscricaoRequest,
  type ComprovanteInscricaoDto,
  type FormularioRenderizavelDto,
  type InscricaoDto,
  type InscricaoRequest,
  SituacaoDoArquivoDoCandidato,
  SituacaoInscricao,
} from '@uniplus/shared-data/selecao';
import {
  type ArquivoEnviado,
  BUSCA_DE_CEP,
  BUSCA_DE_MUNICIPIOS,
} from '@uniplus/shared-ui/components';

import type { OfertaDaInscricao } from '../oferta-da-inscricao';
import { ESPERA_DA_CONSULTA_MS } from './avaliacao-da-inscricao.estado';
import { EnvioDeDocumentosDaInscricao } from './envio-de-documentos-da-inscricao';
import { FORMULARIO_DE_INSCRICAO_MOCK } from './inscricao-do-candidato.mock';
import { InscricaoDoCandidatoPage } from './inscricao-do-candidato.page';
import { InscricaoDoCandidatoService } from './inscricao-do-candidato.service';

/** Fernanda Drumond, persona fictícia do portal de documentação. */
const CPF_DA_CONTA = '69959836371';
const NOME_DA_CONTA = 'Fernanda Laura Nicole Drumond';
const PROCESSO = '0199e000-0000-7000-8000-0000000000d1';

const MEDICINA: OfertaDaInscricao = { id: 'oferta-1', nome: 'Medicina — Marabá' };
const DIREITO: OfertaDaInscricao = { id: 'oferta-2', nome: 'Direito — Marabá' };
const ENGENHARIA: OfertaDaInscricao = { id: 'oferta-3', nome: 'Engenharia da Computação — Marabá' };

const ok = <T>(data: T): Observable<ApiResult<T>> => of(apiOk(data, 200, new HttpHeaders()));

const SEM_DOCUMENTOS: AvaliacaoDaInscricaoDto['documentos'] = { fases: [] };

/** Uma exigência da fase da inscrição na avaliação, na finalidade dada. */
const documento = (
  nome: string,
  finalidade: string,
): AvaliacaoDaInscricaoDto['documentos']['fases'][number]['documentos'][number] => ({
  exigenciaId: `exigencia-${nome}`,
  tipoDocumentoCodigo: 'DOCUMENTO',
  nome,
  obrigatorio: true,
  finalidade,
  etapaId: null,
  formatos: { qualquer: true, lista: null },
  modelo: null,
  situacao: 'PENDENTE',
  grupoCodigo: null,
  ocorrenciaId: null,
  grupos: [],
  repetePorEntidade: null,
  formatosAceitos: ['PDF'],
  tamanhoMaximoBytes: 2 * 1024 * 1024,
  quantidadeMinima: 1,
  arquivos: [],
});

/** A avaliação em que o candidato concorre nas modalidades de nome dado. */
const concorrendoEm = (...nomes: string[]): AvaliacaoDaInscricaoDto => ({
  modalidades: {
    derivada: true,
    situacao: 'CONCORRE',
    itens: nomes.map((nome, ordem) => ({ codigo: `M${ordem}`, nome, ordem })),
    pendencias: [],
  },
  documentos: SEM_DOCUMENTOS,
});
const SEM_DERIVACAO: AvaliacaoDaInscricaoDto = {
  modalidades: { derivada: false, situacao: null, itens: [], pendencias: [] },
  documentos: SEM_DOCUMENTOS,
};

/** O formulário de teste com o bloco das modalidades, que dependem do nome. */
const COM_MODALIDADES: FormularioRenderizavelDto = {
  ...FORMULARIO_DE_INSCRICAO_MOCK,
  dependenciasDaAvaliacao: { fatos: ['NOME'], grupos: [] },
  dependenciasDoFator: null,
  etapas: [
    ...FORMULARIO_DE_INSCRICAO_MOCK.etapas,
    {
      codigo: 'MODALIDADES',
      codigoNasRegras: null,
      ordem: 3,
      tipo: 'BLOCO',
      bloco: 'MODALIDADES_CALCULADAS',
      titulo: 'Modalidades de concorrência',
      descricao: null,
      aviso: null,
    },
  ],
};

function inscricao(outros: Partial<InscricaoDto> = {}): InscricaoDto {
  return {
    id: 'inscricao-1',
    processoSeletivoId: PROCESSO,
    situacao: SituacaoInscricao.rascunho,
    numeroInscricao: null,
    versaoFormularioId: 'versao-1',
    ofertaCursoId: null,
    ofertaCursoSegundaOpcaoId: null,
    numeroDeOpcoesDeCurso: 1,
    ofertas: [],
    respostas: {},
    derivados: {},
    grupos: {},
    aceites: [],
    eTag: '"inscricao-1:1"',
    avaliacao: SEM_DERIVACAO,
    ...outros,
  };
}

/** Tudo o que o formulário de teste pede, com os dados da persona: o envio sai sem pendência. */
const RESPONDIDA: Partial<InscricaoDto> = {
  respostas: {
    NOME: 'Fernanda Laura Nicole Drumond',
    DATA_NASCIMENTO: '1970-02-02',
    ENDERECO_RESIDENCIAL: {
      cep: '79096730',
      logradouro: 'Rua Dario Tomazelli Júnior',
      numero: '743',
      bairro: 'Caiobá',
      cidade: { codigoIbge: '5002704', nome: 'Campo Grande', uf: 'MS' },
      nivelResolucao: 'logradouro',
      origem: 'logradouro',
    },
  },
  aceites: [{ codigo: 'VERACIDADE', versaoId: 'v1', hashVersao: 'h1' }],
};

class ServicoDublê extends InscricaoDoCandidatoService {
  inscricao = inscricao();
  formulario: FormularioRenderizavelDto = FORMULARIO_DE_INSCRICAO_MOCK;
  ofertas: readonly OfertaDaInscricao[] = [MEDICINA];
  /** Quantas opções de curso a versão fixada admite. */
  opcoes = 1;
  readonly salvos: InscricaoRequest[] = [];
  readonly enviados: InscricaoRequest[] = [];
  readonly avaliacoes: AvaliacaoDaInscricaoRequest[] = [];
  recusaDoEnvio: ApiResult<ComprovanteInscricaoDto> | null = null;

  /** A inscrição como a API a devolve: com as ofertas e o número de opções da versão fixada. */
  private lida(): InscricaoDto {
    return {
      ...this.inscricao,
      numeroDeOpcoesDeCurso: this.opcoes,
      ofertas: this.ofertas.map((o) => ({
        ofertaCursoOrigemId: o.id,
        cursoNome: o.nome,
        cursoGrau: 'Bacharelado',
        unidadeOfertanteNome: 'Campus Marabá',
        turnos: [],
      })),
    };
  }
  iniciar = () => ok(this.lida());
  obter = () => ok(this.lida());
  obterFormulario = () => ok(this.formulario);
  salvar = (_: string, request: InscricaoRequest) => {
    this.salvos.push(request);
    return ok(this.inscricao);
  };
  avaliar = (_: string, request: AvaliacaoDaInscricaoRequest) => {
    this.avaliacoes.push(request);
    return ok(concorrendoEm('Ampla concorrência'));
  };
  submeter = (_: string, request: InscricaoRequest) => {
    this.enviados.push(request);
    return this.recusaDoEnvio ? of(this.recusaDoEnvio) : ok({} as ComprovanteInscricaoDto);
  };
}

describe('InscricaoDoCandidatoPage', () => {
  const arquivosDoEnvio = signal<readonly ArquivoEnviado[]>([]);
  const mudancasDoEnvio = signal(0);
  const ocupadoDoEnvio = signal(false);

  let fixture: ComponentFixture<InscricaoDoCandidatoPage>;
  let servico: ServicoDublê;
  const conta = signal<Record<string, string | undefined>>({});

  /** O instante que o relógio da página devolve. */
  let agora = new Date('2026-12-11T13:30:00Z');

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    agora = new Date('2026-12-11T13:30:00Z');
    arquivosDoEnvio.set([]);
    mudancasDoEnvio.set(0);
    ocupadoDoEnvio.set(false);
    servico = new ServicoDublê();
    conta.set({ cpf: CPF_DA_CONTA });
    TestBed.configureTestingModule({
      imports: [InscricaoDoCandidatoPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: InscricaoDoCandidatoService, useValue: servico },
        {
          provide: EnvioDeDocumentosDaInscricao,
          useValue: {
            paraOProcesso: () => ({
              arquivos: arquivosDoEnvio,
              mudancas: mudancasDoEnvio,
              ocupado: ocupadoDoEnvio,
              enviar: vi.fn(),
              remover: vi.fn(),
            }),
          },
        },
        { provide: UserContextService, useValue: { user: conta } },
        { provide: BUSCA_DE_CEP, useValue: () => of({ ok: false }) },
        { provide: BUSCA_DE_MUNICIPIOS, useValue: () => of({ ok: true, data: [] }) },
        { provide: RELOGIO, useValue: () => agora },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const abrir = async (): Promise<HTMLElement> => {
    fixture = TestBed.createComponent(InscricaoDoCandidatoPage);
    fixture.componentRef.setInput('processoId', PROCESSO);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };
  const botao = (tela: HTMLElement, texto: string): HTMLButtonElement =>
    [...tela.querySelectorAll('button')].find((b) =>
      b.textContent?.trim().startsWith(texto),
    ) as HTMLButtonElement;
  const clicar = async (elemento: HTMLElement): Promise<void> => {
    elemento.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const passos = (tela: HTMLElement): HTMLButtonElement[] => [
    ...tela.querySelectorAll<HTMLButtonElement>('ui-formulario-do-candidato nav button'),
  ];
  const irAoPasso = async (tela: HTMLElement, nome: string): Promise<void> =>
    clicar(passos(tela).find((b) => b.textContent?.includes(nome)) as HTMLElement);
  const campoDe = (tela: HTMLElement, fato: string): HTMLInputElement =>
    tela.querySelector(`[data-campo="${fato}"] input`) as HTMLInputElement;

  it('o CPF da conta entra na resposta, aparece mascarado e não se edita', async () => {
    const tela = await abrir();

    const cpf = campoDe(tela, 'CPF');
    expect(cpf.readOnly).toBe(true);
    expect(cpf.value).toBe('***.598.363-**');

    await clicar(botao(tela, 'Salvar rascunho'));
    expect(servico.salvos[0].respostas?.['CPF']).toBe(CPF_DA_CONTA);
  });

  /** O formulário de teste que também coleta o nome social. */
  const COM_NOME_SOCIAL: FormularioRenderizavelDto = {
    ...FORMULARIO_DE_INSCRICAO_MOCK,
    fatosColetados: [
      ...FORMULARIO_DE_INSCRICAO_MOCK.fatosColetados,
      {
        ...FORMULARIO_DE_INSCRICAO_MOCK.fatosColetados[0],
        fatoCodigo: 'DESEJA_NOME_SOCIAL',
        ordem: 8,
        rotulo: 'Deseja usar nome social',
        tipoRenderizacao: 'BOOLEANO',
        formato: null,
      },
      {
        ...FORMULARIO_DE_INSCRICAO_MOCK.fatosColetados[0],
        fatoCodigo: 'NOME_SOCIAL',
        ordem: 9,
        rotulo: 'Nome social',
        formato: null,
      },
    ],
    regras: {
      ...FORMULARIO_DE_INSCRICAO_MOCK.regras,
      etapas: FORMULARIO_DE_INSCRICAO_MOCK.regras.etapas.map((e, i) =>
        i === 0
          ? {
              ...e,
              itens: [
                ...e.itens,
                { ...e.itens[0], fatoCodigo: 'DESEJA_NOME_SOCIAL', formato: null },
                { ...e.itens[0], fatoCodigo: 'NOME_SOCIAL', formato: null },
              ],
            }
          : e,
      ),
    },
  };

  it('o nome da conta entra na resposta e não se edita', async () => {
    conta.update((c) => ({ ...c, nomeCivil: NOME_DA_CONTA }));
    const tela = await abrir();

    const nome = campoDe(tela, 'NOME');
    expect(nome.readOnly).toBe(true);
    expect(nome.value).toBe(NOME_DA_CONTA);

    await clicar(botao(tela, 'Salvar rascunho'));
    expect(servico.salvos[0].respostas?.['NOME']).toBe(NOME_DA_CONTA);
  });

  const desejaDe = (tela: HTMLElement): HTMLInputElement[] =>
    Array.from(tela.querySelectorAll<HTMLInputElement>('[data-campo="DESEJA_NOME_SOCIAL"] input'));

  it('o nome social da conta entra na resposta e não se edita', async () => {
    conta.update((c) => ({ ...c, nomeSocial: 'Ariel Drumond' }));
    servico.formulario = COM_NOME_SOCIAL;
    servico.inscricao = inscricao({ respostas: { DESEJA_NOME_SOCIAL: true } });
    const tela = await abrir();

    const social = campoDe(tela, 'NOME_SOCIAL');
    expect(social.readOnly).toBe(true);
    expect(social.value).toBe('Ariel Drumond');
    await clicar(botao(tela, 'Salvar rascunho'));
    expect(servico.salvos[0].respostas?.['NOME_SOCIAL']).toBe('Ariel Drumond');
  });

  it('a conta sem nome social deixa o campo vazio e travado, sem enviar valor', async () => {
    servico.formulario = COM_NOME_SOCIAL;
    servico.inscricao = inscricao({ respostas: { DESEJA_NOME_SOCIAL: true } });
    const tela = await abrir();

    const social = campoDe(tela, 'NOME_SOCIAL');
    expect(social.readOnly).toBe(true);
    expect(social.value).toBe('');
    await clicar(botao(tela, 'Salvar rascunho'));
    expect(servico.salvos[0].respostas?.['NOME_SOCIAL']).toBeNull();
  });

  it('na inscrição retomada, o nome social da conta substitui o gravado no rascunho', async () => {
    conta.update((c) => ({ ...c, nomeSocial: 'Ariel Drumond' }));
    servico.formulario = COM_NOME_SOCIAL;
    servico.inscricao = inscricao({
      respostas: { DESEJA_NOME_SOCIAL: true, NOME_SOCIAL: 'Outro Nome Gravado' },
    });
    const tela = await abrir();

    expect(campoDe(tela, 'NOME_SOCIAL').value).toBe('Ariel Drumond');
    await clicar(botao(tela, 'Salvar rascunho'));
    expect(servico.salvos[0].respostas?.['NOME_SOCIAL']).toBe('Ariel Drumond');
  });

  it('a conta com nome social abre "deseja usar nome social" como sim quando nada foi gravado', async () => {
    conta.update((c) => ({ ...c, nomeSocial: 'Ariel Drumond' }));
    servico.formulario = COM_NOME_SOCIAL;
    const tela = await abrir();

    await clicar(botao(tela, 'Salvar rascunho'));
    expect(servico.salvos[0].respostas?.['DESEJA_NOME_SOCIAL']).toBe(true);
    expect(desejaDe(tela).some((r) => r.checked)).toBe(true);
  });

  it('a conta sem nome social não marca "deseja usar nome social"', async () => {
    servico.formulario = COM_NOME_SOCIAL;
    const tela = await abrir();

    await clicar(botao(tela, 'Salvar rascunho'));
    expect(servico.salvos[0].respostas?.['DESEJA_NOME_SOCIAL']).toBeUndefined();
  });

  it('a desistência do nome social gravada prevalece sobre o da conta, e o nome da conta não vai', async () => {
    conta.update((c) => ({ ...c, nomeSocial: 'Ariel Drumond' }));
    servico.formulario = COM_NOME_SOCIAL;
    servico.inscricao = inscricao({
      respostas: { DESEJA_NOME_SOCIAL: false },
    });
    const tela = await abrir();

    await clicar(botao(tela, 'Salvar rascunho'));
    expect(servico.salvos[0].respostas?.['DESEJA_NOME_SOCIAL']).toBe(false);
    expect(servico.salvos[0].respostas?.['NOME_SOCIAL']).toBeNull();
  });

  it('a recusa do envio sem nome social na conta aparece no campo travado, com a orientação', async () => {
    const mensagem =
      'Você marcou que deseja usar nome social, mas sua conta não tem nome social cadastrado. Cadastre o nome social em Meu perfil ou desmarque a opção.';
    servico.formulario = {
      ...COM_NOME_SOCIAL,
      fatosColetados: COM_NOME_SOCIAL.fatosColetados.map((c) =>
        c.fatoCodigo === 'NOME_SOCIAL'
          ? { ...c, ajuda: 'Cadastre o nome social em Meu perfil.' }
          : c,
      ),
    };
    servico.recusaDoEnvio = apiFailure(
      {
        type: 'about:blank',
        title: 'Recusada',
        status: 422,
        code: 'uniplus.selecao.inscricao.nome_social_ausente_na_conta',
        traceId: '',
        errors: [
          {
            field: 'NOME_SOCIAL',
            code: 'uniplus.selecao.inscricao.nome_social_ausente_na_conta',
            message: mensagem,
          },
        ],
      },
      422,
      new HttpHeaders(),
    );
    servico.inscricao = inscricao({
      ...RESPONDIDA,
      respostas: { ...RESPONDIDA.respostas, DESEJA_NOME_SOCIAL: true },
    });
    const tela = await abrir();

    await clicar(botao(tela, 'Enviar inscrição'));

    const social = tela.querySelector('[data-campo="NOME_SOCIAL"]');
    expect(social?.querySelector('.field__error')?.textContent).toContain(mensagem);
    expect(social?.querySelector('.field__error')?.textContent).not.toContain('Responda');
    expect(social?.querySelector('.field__hint')?.textContent).toContain('Meu perfil');
    expect(campoDe(tela, 'NOME_SOCIAL').readOnly).toBe(true);
  });

  /** O formulário de teste com o bloco de comprovação documental. */
  const COM_DOCUMENTOS: FormularioRenderizavelDto = {
    ...FORMULARIO_DE_INSCRICAO_MOCK,
    etapas: [
      ...FORMULARIO_DE_INSCRICAO_MOCK.etapas,
      {
        codigo: 'DOCUMENTOS',
        codigoNasRegras: null,
        ordem: 3,
        tipo: 'BLOCO',
        bloco: 'COMPROVACAO_DOCUMENTAL',
        titulo: 'Documentos',
        descricao: null,
        aviso: null,
      },
    ],
  };
  const irAosDocumentos = async (tela: HTMLElement): Promise<HTMLElement> => {
    await clicar(
      [...tela.querySelectorAll<HTMLButtonElement>('nav button')].find((b) =>
        b.textContent?.includes('Documentos'),
      ) as HTMLButtonElement,
    );
    return tela.querySelector('.formulario-candidato__secao') as HTMLElement;
  };

  it('a seção de documentos sem exigência nesta fase diz que nada se envia nesta etapa', async () => {
    servico.formulario = COM_DOCUMENTOS;
    servico.inscricao = inscricao(RESPONDIDA);
    const tela = await abrir();

    expect((await irAosDocumentos(tela)).textContent).toContain(
      'Você não envia documentos nesta etapa.',
    );
  });

  /**
   * O documento da isenção é pedido no formulário da isenção, e o de outra fase no formulário dela,
   * mesmo que tenha a mesma finalidade.
   */
  it('a seção de documentos lista o que a avaliação pede no formulário da inscrição', async () => {
    servico.formulario = COM_DOCUMENTOS;
    servico.inscricao = inscricao({
      ...RESPONDIDA,
      avaliacao: {
        ...SEM_DERIVACAO,
        documentos: {
          fases: [
            {
              faseId: FORMULARIO_DE_INSCRICAO_MOCK.faseId ?? '',
              codigo: 'INSCRICAO',
              ordem: 1,
              documentos: [
                documento('Histórico escolar', 'INSCRICAO'),
                documento('Comprovante de renda para a isenção', 'ISENCAO_TAXA'),
              ],
              pendencias: [],
            },
            {
              faseId: 'outra-fase',
              codigo: 'HABILITACAO',
              ordem: 2,
              documentos: [documento('Diploma', 'INSCRICAO')],
              pendencias: [],
            },
          ],
        },
      },
    });
    const tela = await abrir();

    const secao = await irAosDocumentos(tela);
    const nomes = [...secao.querySelectorAll('h4')].map((h) => h.textContent?.trim());
    expect(nomes).toEqual(['Histórico escolar']);

    // Com um envio em andamento a zona de escolha segue habilitada: desabilitá-la tira o foco do teclado.
    ocupadoDoEnvio.set(true);
    fixture.detectChanges();
    const campo = secao.querySelector<HTMLInputElement>('ui-envio-do-documento input[type="file"]');
    expect(campo).not.toBeNull();
    expect(campo?.disabled).toBe(false);
    expect(secao.textContent).toContain('Exigido pelas suas respostas');
  });

  /** A avaliação com um documento obrigatório cujo único arquivo está na situação dada. */
  const comArquivoEm = (situacao: SituacaoDoArquivoDoCandidato): AvaliacaoDaInscricaoDto => ({
    ...SEM_DERIVACAO,
    documentos: {
      fases: [
        {
          faseId: FORMULARIO_DE_INSCRICAO_MOCK.faseId ?? '',
          codigo: 'INSCRICAO',
          ordem: 1,
          documentos: [
            {
              ...documento('Histórico escolar', 'INSCRICAO'),
              arquivos: [
                {
                  arquivoId: 'arquivo-1',
                  apresentacaoId: 'apresentacao-1',
                  exigenciaId: 'exigencia-Histórico escolar',
                  ocorrenciaId: null,
                  tipoDeMidia: 'application/pdf',
                  tamanhoBytes: null,
                  hashSha256: null,
                  confirmadoEm: '2026-10-24T10:00:00Z',
                  situacao,
                  mensagem:
                    situacao === SituacaoDoArquivoDoCandidato.verificado
                      ? null
                      : 'Arquivo em verificação. Isso costuma levar poucos segundos.',
                },
              ],
            },
          ],
          pendencias: [],
        },
      ],
    },
  });
  const AGUARDE =
    'Aguarde a verificação completa dos documentos obrigatórios para enviar a inscrição.';

  it('documento obrigatório em verificação mantém o envio da inscrição inativo, com o aviso de aguardar', async () => {
    servico.formulario = COM_DOCUMENTOS;
    servico.inscricao = inscricao({
      ...RESPONDIDA,
      avaliacao: comArquivoEm(SituacaoDoArquivoDoCandidato.emVerificacao),
    });
    const tela = await abrir();

    expect(tela.querySelector('#inscricao-motivo-envio')?.textContent).toContain(AGUARDE);
    expect(botao(tela, 'Enviar inscrição').disabled).toBe(true);
  });

  it('consulta a verificação com espera crescente até o resultado e então libera o envio', async () => {
    vi.useRealTimers();
    // A consulta passa por debounce do RxJS, que usa setInterval: o relógio inteiro é simulado.
    vi.useFakeTimers();
    const respostas = [
      comArquivoEm(SituacaoDoArquivoDoCandidato.emVerificacao),
      comArquivoEm(SituacaoDoArquivoDoCandidato.verificado),
    ];
    servico.avaliar = (_: string, request: AvaliacaoDaInscricaoRequest) => {
      servico.avaliacoes.push(request);
      return ok(respostas[servico.avaliacoes.length - 1]);
    };
    servico.formulario = COM_DOCUMENTOS;
    servico.inscricao = inscricao({
      ...RESPONDIDA,
      avaliacao: comArquivoEm(SituacaoDoArquivoDoCandidato.emVerificacao),
    });
    const tela = await abrir();
    const avancar = async (ms: number): Promise<void> => {
      await vi.advanceTimersByTimeAsync(ms);
      fixture.detectChanges();
    };

    await avancar(1000 + ESPERA_DA_CONSULTA_MS);
    expect(servico.avaliacoes).toHaveLength(1);
    expect(tela.querySelector('#inscricao-motivo-envio')?.textContent).toContain(AGUARDE);

    await avancar(2000 + ESPERA_DA_CONSULTA_MS);
    expect(servico.avaliacoes).toHaveLength(2);
    expect(tela.textContent).not.toContain(AGUARDE);
    const secao = await irAosDocumentos(tela);
    expect(secao.querySelector('.uni-uploader__item.is-success')).not.toBeNull();

    await avancar(60_000);
    expect(servico.avaliacoes).toHaveLength(2);
  });

  const irAsModalidades = async (tela: HTMLElement): Promise<void> =>
    clicar(
      [...tela.querySelectorAll<HTMLButtonElement>('nav button')].find((b) =>
        b.textContent?.includes('Modalidades de concorrência'),
      ) as HTMLButtonElement,
    );

  it('mostra as modalidades que vieram com a inscrição, sem consultar a API ao abrir', async () => {
    servico.formulario = COM_MODALIDADES;
    servico.inscricao = inscricao({
      ...RESPONDIDA,
      avaliacao: concorrendoEm('Ampla concorrência'),
    });
    const tela = await abrir();
    await irAsModalidades(tela);

    expect(tela.querySelector('ui-modalidades-da-inscricao')?.textContent).toContain(
      'Ampla concorrência',
    );
    expect(servico.avaliacoes).toHaveLength(0);
  });

  it('responder o que decide as modalidades consulta a avaliação com as respostas da tela', async () => {
    // A espera da consulta corre no agendador do RxJS, que usa `setInterval`, e não `setTimeout`.
    vi.useRealTimers();
    servico.formulario = COM_MODALIDADES;
    const tela = await abrir();

    const nome = campoDe(tela, 'NOME');
    nome.value = 'Ariel Drumond';
    nome.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await new Promise((resolver) => setTimeout(resolver, ESPERA_DA_CONSULTA_MS + 50));

    expect(servico.avaliacoes.map((a) => a.respostas?.['NOME'])).toEqual(['Ariel Drumond']);
  });

  it('enviar ou remover um arquivo de documento consulta a avaliação, mesmo sem mudar nenhuma resposta', async () => {
    vi.useRealTimers();
    servico.formulario = COM_MODALIDADES;
    await abrir();
    expect(servico.avaliacoes).toHaveLength(0);

    // Também vale para o arquivo que veio da avaliação: remover não muda a lista do envio.
    mudancasDoEnvio.update((n) => n + 1);
    await fixture.whenStable();
    fixture.detectChanges();
    await new Promise((resolver) => setTimeout(resolver, ESPERA_DA_CONSULTA_MS + 50));

    expect(servico.avaliacoes).toHaveLength(1);
  });

  it('o arquivo de documento avança a revisão da inscrição: o próximo salvar leva o ETag novo', async () => {
    vi.useRealTimers();
    servico.formulario = COM_MODALIDADES;
    const tela = await abrir();
    const eTags: string[] = [];
    servico.salvar = (_: string, request: InscricaoRequest, eTag?: string) => {
      eTags.push(eTag ?? '');
      servico.salvos.push(request);
      return ok(servico.inscricao);
    };

    servico.inscricao = inscricao({ eTag: '"inscricao-1:3"' });
    mudancasDoEnvio.update((n) => n + 1);
    await fixture.whenStable();
    fixture.detectChanges();
    await clicar(botao(tela, 'Salvar rascunho'));

    expect(eTags).toEqual(['"inscricao-1:3"']);
  });

  it('outra aba gravou enquanto o ETag era relido: o próximo salvar leva o ETag velho e cai no conflito', async () => {
    vi.useRealTimers();
    servico.formulario = COM_MODALIDADES;
    const tela = await abrir();
    const eTagInicial = servico.inscricao.eTag;
    const eTags: string[] = [];
    servico.salvar = (_: string, request: InscricaoRequest, eTag?: string) => {
      eTags.push(eTag ?? '');
      servico.salvos.push(request);
      return ok(servico.inscricao);
    };

    servico.inscricao = inscricao({ eTag: '"inscricao-1:3"', ofertaCursoId: 'outra-oferta' });
    mudancasDoEnvio.update((n) => n + 1);
    await fixture.whenStable();
    fixture.detectChanges();
    await clicar(botao(tela, 'Salvar rascunho'));

    expect(eTags).toEqual([eTagInicial]);
  });

  it('releitura do ETag que falha depois de um arquivo de documento pede recarregar, sem gravar com o velho', async () => {
    vi.useRealTimers();
    servico.formulario = COM_MODALIDADES;
    const tela = await abrir();

    servico.obter = () => of(problema(503, 'uniplus.teste'));
    mudancasDoEnvio.update((n) => n + 1);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(tela.textContent).toContain('Recarregue a página para continuar');
    expect(botao(tela, 'Salvar rascunho')?.disabled).toBe(true);
  });

  it('com envio de documento em andamento, não deixa gravar com a revisão velha', async () => {
    servico.formulario = COM_MODALIDADES;
    const tela = await abrir();

    ocupadoDoEnvio.set(true);
    fixture.detectChanges();

    expect(botao(tela, 'Salvar rascunho')?.disabled).toBe(true);
  });

  it('a consulta de avaliação leva a oferta escolhida na tela, ou null quando não há escolha', async () => {
    // A espera da consulta corre no agendador do RxJS, que usa `setInterval`, e não `setTimeout`.
    vi.useRealTimers();
    servico.formulario = COM_MODALIDADES;
    servico.ofertas = [MEDICINA, DIREITO];
    servico.inscricao = inscricao({ ofertaCursoId: DIREITO.id });
    const tela = await abrir();
    const digitar = async (nome: string): Promise<void> => {
      const campo = campoDe(tela, 'NOME');
      campo.value = nome;
      campo.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      await new Promise((resolver) => setTimeout(resolver, ESPERA_DA_CONSULTA_MS + 50));
    };

    await irAoPasso(tela, 'Dados pessoais');
    await digitar('Ariel Drumond');
    await irAoPasso(tela, 'Curso');
    await escolherCurso(tela, '');
    await new Promise((resolver) => setTimeout(resolver, ESPERA_DA_CONSULTA_MS + 50));

    expect(servico.avaliacoes.map((a) => a.ofertaCursoId)).toEqual([DIREITO.id, null]);
  });

  it('trocar a oferta no seletor consulta a avaliação de novo com a oferta nova e as respostas gravadas', async () => {
    vi.useRealTimers();
    servico.formulario = COM_MODALIDADES;
    servico.ofertas = [MEDICINA, DIREITO];
    servico.inscricao = inscricao({
      ofertaCursoId: MEDICINA.id,
      respostas: { NOME: 'Ariel Drumond' },
    });
    const tela = await abrir();

    await escolherCurso(tela, DIREITO.id);
    await new Promise((resolver) => setTimeout(resolver, ESPERA_DA_CONSULTA_MS + 50));

    expect(servico.avaliacoes).toHaveLength(1);
    expect(servico.avaliacoes[0].ofertaCursoId).toBe(DIREITO.id);
    expect(servico.avaliacoes[0].respostas?.['NOME']).toBe('Ariel Drumond');
  });

  it('a avaliação que volta do rascunho salvo passa a ser a mostrada', async () => {
    servico.formulario = COM_MODALIDADES;
    servico.inscricao = inscricao({
      ...RESPONDIDA,
      avaliacao: concorrendoEm('Ampla concorrência'),
    });
    const tela = await abrir();
    servico.inscricao = inscricao({ avaliacao: concorrendoEm('Ampla concorrência', 'Cotas') });

    await clicar(botao(tela, 'Salvar rascunho'));
    await irAsModalidades(tela);

    expect(tela.querySelector('ui-modalidades-da-inscricao')?.textContent).toContain('Cotas');
  });

  it('o titular revela o CPF da conta para conferir, sem nova consulta', async () => {
    const tela = await abrir();
    const consultas = (['iniciar', 'obter', 'obterFormulario', 'salvar', 'submeter'] as const).map(
      (metodo) => vi.spyOn(servico, metodo),
    );

    await clicar(
      tela.querySelector('[data-campo="CPF"] button[aria-label="Mostrar CPF"]') as HTMLElement,
    );

    expect(campoDe(tela, 'CPF').value).toBe('699.598.363-71');
    for (const consulta of consultas) expect(consulta).not.toHaveBeenCalled();
    TestBed.inject(HttpTestingController).verify();
  });

  it('a correção depois do envio é um novo envio, com o ETag da inscrição relida', async () => {
    servico.inscricao = inscricao(RESPONDIDA);
    const tela = await abrir();
    servico.inscricao = inscricao({
      ...RESPONDIDA,
      situacao: SituacaoInscricao.submetida,
      eTag: '"inscricao-1:2"',
    });
    await clicar(botao(tela, 'Enviar inscrição'));

    const eTags: string[] = [];
    servico.submeter = (_: string, request: InscricaoRequest, eTag?: string) => {
      eTags.push(eTag ?? '');
      servico.enviados.push(request);
      return ok({} as ComprovanteInscricaoDto);
    };
    await clicar(botao(tela, 'Enviar inscrição'));

    expect(eTags).toEqual(['"inscricao-1:2"']);
  });

  it('com pendência o botão de enviar fica inativo, com o motivo e as seções ao lado, e não envia', async () => {
    const tela = await abrir();

    const enviar = botao(tela, 'Enviar inscrição');
    expect(enviar.disabled).toBe(true);
    const motivo = tela.querySelector('#inscricao-motivo-envio');
    expect(motivo?.textContent).toMatch(/Falt(a|am) corrigir \d+ itens?\./);
    expect(motivo?.querySelectorAll('li button').length).toBeGreaterThan(0);
    expect(enviar.getAttribute('aria-describedby')).toBe('inscricao-motivo-envio');

    await clicar(enviar);
    expect(servico.enviados).toEqual([]);
  });

  it('sem curso escolhido o passo Curso não avança e mostra a recusa no campo', async () => {
    servico.ofertas = [MEDICINA, DIREITO];
    const tela = await abrir();

    await clicar(botao(tela, 'Próximo passo'));

    expect(passos(tela)[0].getAttribute('aria-current')).toBe('step');
    expect(tela.querySelector('#inscricao-oferta-erro')).not.toBeNull();

    await escolherCurso(tela, DIREITO.id);
    await clicar(botao(tela, 'Próximo passo'));
    expect(passos(tela)[1].getAttribute('aria-current')).toBe('step');
  });

  it('com o formulário válido o envio fica ativo e sem motivo', async () => {
    servico.inscricao = inscricao(RESPONDIDA);
    const tela = await abrir();

    expect(botao(tela, 'Enviar inscrição').disabled).toBe(false);
    expect(tela.querySelector('#inscricao-motivo-envio')).toBeNull();
  });

  it('a inscrição enviada não oferece rascunho: o aviso diz que corrigir é enviar de novo', async () => {
    servico.inscricao = inscricao({ ...RESPONDIDA, situacao: SituacaoInscricao.submetida });
    const tela = await abrir();

    expect(botao(tela, 'Salvar rascunho')).toBeUndefined();
    const aviso = tela.querySelector('#inscricao-correcao');
    expect(aviso?.textContent).toContain('envie de novo: cada envio gera um novo comprovante');
    expect(botao(tela, 'Enviar inscrição').getAttribute('aria-describedby')).toBe(
      'inscricao-correcao',
    );
  });

  it('o rascunho deixa de ser oferecido logo depois do primeiro envio', async () => {
    servico.inscricao = inscricao(RESPONDIDA);
    const tela = await abrir();
    expect(botao(tela, 'Salvar rascunho')).toBeDefined();

    await clicar(botao(tela, 'Enviar inscrição'));

    expect(botao(tela, 'Salvar rascunho')).toBeUndefined();
  });

  it('a retomada volta com as respostas e os aceites gravados', async () => {
    servico.inscricao = inscricao({
      respostas: { NOME: 'Fernanda Laura Nicole Drumond' },
      aceites: [{ codigo: 'VERACIDADE', versaoId: 'v1', hashVersao: 'h1' }],
    });
    const tela = await abrir();

    expect(campoDe(tela, 'NOME').value).toBe('Fernanda Laura Nicole Drumond');
    await clicar(botao(tela, 'Salvar rascunho'));
    expect(servico.salvos[0].aceites?.map((a) => a.codigo)).toEqual(['VERACIDADE']);
  });

  it('a resposta apagada vai como nulo, para o servidor não manter a gravada', async () => {
    servico.inscricao = inscricao({ respostas: { NOME: 'Fernanda Laura Nicole Drumond' } });
    const tela = await abrir();
    const nome = campoDe(tela, 'NOME');
    nome.value = '';
    nome.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    await clicar(botao(tela, 'Salvar rascunho'));

    expect(servico.salvos[0].respostas).toHaveProperty('NOME', null);
  });

  it('o grupo que o candidato removeu vai como lista vazia, para o servidor não manter as ocorrências gravadas', async () => {
    servico.formulario = {
      ...FORMULARIO_DE_INSCRICAO_MOCK,
      grupos: [
        {
          codigo: 'FAMILIA',
          ordem: 0,
          etapaCodigo: 'Inscricao:DADOS_PESSOAIS',
          rotulo: 'Integrante',
          minimo: 0,
          maximo: null,
          incluiCandidato: false,
          subitens: [
            {
              fatoCodigo: 'RENDA',
              ordem: 0,
              rotulo: 'Renda',
              tipoRenderizacao: 'NUMERO',
              valoresSelecionaveis: null,
              etapaCodigo: 'Inscricao:DADOS_PESSOAIS',
              formato: null,
              ajuda: null,
              pedirConfirmacao: false,
            },
          ],
        },
      ],
      regras: {
        ...FORMULARIO_DE_INSCRICAO_MOCK.regras,
        etapas: FORMULARIO_DE_INSCRICAO_MOCK.regras.etapas.map((etapa, i) =>
          i > 0
            ? etapa
            : {
                ...etapa,
                grupos: [
                  {
                    codigo: 'FAMILIA',
                    exibicao: null,
                    obrigatoriedade: 'SEMPRE',
                    predicadoObrigatoriedade: null,
                    minimo: 0,
                    maximo: null,
                    incluiCandidato: false,
                    subitens: [{ ...etapa.itens[0], fatoCodigo: 'RENDA', formato: null }],
                  },
                ],
              },
        ),
      },
    };
    servico.inscricao = inscricao({
      grupos: { FAMILIA: [{ id: 'ocorrencia-1', respostas: { RENDA: 1500 } }] },
    });
    const tela = await abrir();
    await clicar(botao(tela, 'Remover'));

    await clicar(botao(tela, 'Salvar rascunho'));

    expect(servico.salvos[0].grupos).toHaveProperty('FAMILIA', []);
  });

  it('o aceite leva a versão e o hash do termo da versão fixada', async () => {
    servico.inscricao = inscricao(RESPONDIDA);
    const tela = await abrir();

    await clicar(botao(tela, 'Enviar inscrição'));

    const termo = FORMULARIO_DE_INSCRICAO_MOCK.termos[0];
    expect(servico.enviados[0].aceites).toEqual([
      { codigo: 'VERACIDADE', versaoId: termo.versaoId, hashVersao: termo.hashVersao },
    ]);
  });

  it('o envio leva o termo marcado antes dele', async () => {
    servico.inscricao = inscricao({ respostas: RESPONDIDA.respostas });
    const tela = await abrir();
    const secoes = tela.querySelectorAll<HTMLButtonElement>(
      'nav[aria-label="Seções do formulário"] button',
    );
    await clicar(secoes[secoes.length - 1]);

    await clicar(
      tela.querySelector('[data-campo="VERACIDADE"] input[type="checkbox"]') as HTMLElement,
    );
    await clicar(botao(tela, 'Enviar inscrição'));

    expect(servico.enviados[0].aceites?.map((a) => a.codigo)).toEqual(['VERACIDADE']);
  });

  it('a recusa por campo do envio aparece no campo, com a mensagem para o candidato', async () => {
    servico.recusaDoEnvio = apiFailure(
      {
        type: 'about:blank',
        title: 'Recusada',
        status: 422,
        code: 'uniplus.selecao.inscricao.item_obrigatorio_ausente',
        traceId: '',
        errors: [
          {
            field: 'NOME',
            code: 'uniplus.selecao.inscricao.item_obrigatorio_ausente',
            message: "O item 'NOME' é obrigatório e está sem resposta.",
          },
        ],
      },
      422,
      new HttpHeaders(),
    );
    servico.inscricao = inscricao(RESPONDIDA);
    const tela = await abrir();

    await clicar(botao(tela, 'Enviar inscrição'));

    const nome = tela.querySelector('[data-campo="NOME"]');
    expect(nome?.querySelector('.field__error')?.textContent).toContain('Responda este campo.');
    expect(tela.textContent).not.toContain("O item 'NOME'");
    const topo = tela.querySelector('.formulario-candidato__secao ui-alert');
    expect(topo?.textContent).toContain('O servidor recusou 1 resposta desta seção');
    expect(document.activeElement).toBe(campoDe(tela, 'NOME'));
  });

  const problema = (status: number, code: string) =>
    apiFailure(
      { type: 'about:blank', title: 'Recusa', status, code, traceId: '' },
      status,
      new HttpHeaders(),
    );

  it('gravar sobre uma revisão defasada relê a inscrição e o formulário e avisa que foi atualizada', async () => {
    const tela = await abrir();
    expect(tela.querySelector('[data-campo="DESEJA_NOME_SOCIAL"]')).toBeNull();
    servico.salvar = () => of(problema(412, 'uniplus.selecao.inscricao.precondicao_falhou'));
    servico.formulario = COM_NOME_SOCIAL;
    servico.inscricao = inscricao({ respostas: { NOME: 'Fernanda Laura Nicole Drumond' } });

    await clicar(botao(tela, 'Salvar rascunho'));

    expect(tela.textContent).toContain('A inscrição foi atualizada');
    expect(tela.querySelector('[data-campo="DESEJA_NOME_SOCIAL"]')).not.toBeNull();
    expect(campoDe(tela, 'NOME').value).toBe('Fernanda Laura Nicole Drumond');
  });

  it('o rascunho recusado porque outra janela já enviou a inscrição relê a inscrição e troca o rascunho pela correção', async () => {
    const tela = await abrir();
    servico.salvar = () =>
      of(problema(422, 'uniplus.selecao.inscricao.rascunho_so_antes_do_envio'));
    servico.inscricao = inscricao({ situacao: SituacaoInscricao.submetida });

    await clicar(botao(tela, 'Salvar rascunho'));

    expect(botao(tela, 'Salvar rascunho')).toBeUndefined();
    expect(tela.querySelector('#inscricao-correcao')).not.toBeNull();
  });

  it('a falha sem resposta cujo envio o servidor gravou não diz que a inscrição não foi gravada', async () => {
    servico.inscricao = inscricao(RESPONDIDA);
    const tela = await abrir();
    servico.recusaDoEnvio = problema(503, 'uniplus.teste');
    servico.inscricao = inscricao({
      ...RESPONDIDA,
      situacao: SituacaoInscricao.submetida,
      numeroInscricao: '2027-000001',
      eTag: '"inscricao-1:2"',
    });

    await clicar(botao(tela, 'Enviar inscrição'));

    expect(tela.querySelector('[aria-live]')?.textContent).toBe(
      'Inscrição enviada. Número 2027-000001.',
    );
    expect(tela.textContent).toContain('Sua inscrição já foi enviada');
    expect(tela.textContent).not.toContain('não foi gravada');
    expect(tela.textContent).not.toContain('Não conseguimos confirmar a gravação');
  });

  it('o rascunho que o servidor gravou apesar da falha sem resposta é confirmado no aviso', async () => {
    const tela = await abrir();
    servico.salvar = () => of(problema(503, 'uniplus.teste'));
    servico.inscricao = inscricao({ eTag: '"inscricao-1:2"' });

    await clicar(botao(tela, 'Salvar rascunho'));

    expect(tela.querySelector('[aria-live]')?.textContent).toBe('Rascunho salvo.');
    expect(tela.textContent).not.toContain('Não conseguimos confirmar a gravação');
  });

  it('a releitura sem gravação, depois da falha sem resposta, mantém a avaliação das respostas da tela', async () => {
    // A espera da consulta corre no agendador do RxJS, que usa `setInterval`, e não `setTimeout`.
    vi.useRealTimers();
    servico.formulario = COM_MODALIDADES;
    servico.inscricao = inscricao({
      ...RESPONDIDA,
      avaliacao: concorrendoEm('Ampla concorrência'),
    });
    servico.avaliar = () => ok(concorrendoEm('Cotas da tela'));
    const tela = await abrir();
    const nome = campoDe(tela, 'NOME');
    nome.value = 'Ariel Drumond';
    nome.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await new Promise((resolver) => setTimeout(resolver, ESPERA_DA_CONSULTA_MS + 50));
    servico.salvar = () => of(problema(503, 'uniplus.teste'));
    servico.inscricao = inscricao({ avaliacao: concorrendoEm('Gravada antiga') });

    await clicar(botao(tela, 'Salvar rascunho'));
    await irAsModalidades(tela);

    const modalidades = tela.querySelector('ui-modalidades-da-inscricao')?.textContent;
    expect(modalidades).toContain('Cotas da tela');
    expect(modalidades).not.toContain('Gravada antiga');
    expect(tela.textContent).toContain('Não conseguimos confirmar a gravação');
  });

  it('o envio que fica sem resposta relê a inscrição, e o reenvio sai com o ETag gravado', async () => {
    servico.inscricao = inscricao(RESPONDIDA);
    const tela = await abrir();
    servico.recusaDoEnvio = problema(0, 'uniplus.client.network_error');
    servico.inscricao = inscricao({
      ...RESPONDIDA,
      situacao: SituacaoInscricao.submetida,
      eTag: '"inscricao-1:2"',
    });
    await clicar(botao(tela, 'Enviar inscrição'));

    const eTags: string[] = [];
    servico.submeter = (_: string, request: InscricaoRequest, eTag?: string) => {
      eTags.push(eTag ?? '');
      servico.enviados.push(request);
      return ok({} as ComprovanteInscricaoDto);
    };
    await clicar(botao(tela, 'Enviar inscrição'));

    expect(eTags).toEqual(['"inscricao-1:2"']);
  });

  it('depois do envio, o formulário segue ocupado até a releitura do ETag terminar', async () => {
    servico.inscricao = inscricao(RESPONDIDA);
    const tela = await abrir();
    const releitura = new Subject<ApiResult<InscricaoDto>>();
    servico.obter = () => releitura;

    await clicar(botao(tela, 'Enviar inscrição'));
    expect(botao(tela, 'Enviar inscrição').disabled).toBe(true);

    releitura.next(
      apiOk(inscricao({ ...RESPONDIDA, eTag: '"inscricao-1:2"' }), 200, new HttpHeaders()),
    );
    fixture.detectChanges();

    expect(botao(tela, 'Enviar inscrição').disabled).toBe(false);
  });

  it('a releitura que falha depois do envio manda recarregar a página e não deixa enviar com o ETag velho', async () => {
    servico.inscricao = inscricao(RESPONDIDA);
    const tela = await abrir();
    servico.obter = () => of(problema(503, 'uniplus.teste'));

    await clicar(botao(tela, 'Enviar inscrição'));

    expect(tela.textContent).toContain('Recarregue a página antes de corrigir');
    expect(botao(tela, 'Enviar inscrição').disabled).toBe(true);
    botao(tela, 'Enviar inscrição').click();
    expect(servico.enviados).toHaveLength(1);
  });

  it('a falha sem resposta mantém o formulário ocupado até a releitura do ETag terminar', async () => {
    servico.inscricao = inscricao(RESPONDIDA);
    const tela = await abrir();
    servico.recusaDoEnvio = problema(0, 'uniplus.client.network_error');
    const releitura = new Subject<ApiResult<InscricaoDto>>();
    servico.obter = () => releitura;

    await clicar(botao(tela, 'Enviar inscrição'));
    expect(botao(tela, 'Enviar inscrição').disabled).toBe(true);

    releitura.next(
      apiOk(inscricao({ ...RESPONDIDA, eTag: '"inscricao-1:2"' }), 200, new HttpHeaders()),
    );
    fixture.detectChanges();

    expect(botao(tela, 'Enviar inscrição').disabled).toBe(false);
  });

  it('a releitura que falha depois de uma falha sem resposta manda recarregar a página', async () => {
    servico.inscricao = inscricao(RESPONDIDA);
    const tela = await abrir();
    servico.recusaDoEnvio = problema(503, 'uniplus.teste');
    servico.obter = () => of(problema(503, 'uniplus.teste'));

    await clicar(botao(tela, 'Enviar inscrição'));

    expect(tela.textContent).toContain('Não conseguimos confirmar se a inscrição foi gravada');
    expect(tela.textContent).not.toContain('foi enviada');
    expect(tela.textContent).not.toContain('A inscrição não foi gravada');
    expect(botao(tela, 'Enviar inscrição').disabled).toBe(true);
  });

  it('o seletor de curso só aparece quando o processo oferece mais de um', async () => {
    let tela = await abrir();
    expect(tela.querySelector('#inscricao-oferta')).toBeNull();
    await clicar(botao(tela, 'Salvar rascunho'));
    expect(servico.salvos[0].ofertaCursoId).toBe(MEDICINA.id);

    servico.ofertas = [MEDICINA, DIREITO];
    tela = await abrir();
    expect(tela.querySelector('#inscricao-oferta')).not.toBeNull();
  });

  const escolherCurso = async (tela: HTMLElement, id: string): Promise<void> => {
    const select = tela.querySelector('#inscricao-oferta') as HTMLSelectElement;
    select.value = id;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();
  };

  const recusaDaOferta = (codigo: string) =>
    apiFailure(
      {
        type: 'about:blank',
        title: 'Recusada',
        status: 422,
        code: codigo,
        traceId: '',
        errors: [{ field: 'ofertaCursoId', code: codigo, message: '' }],
      },
      422,
      new HttpHeaders(),
    );

  it('a recusa da oferta pela API marca o passo Curso, mostra a mensagem no campo e leva o foco até ele', async () => {
    servico.ofertas = [MEDICINA, DIREITO];
    servico.recusaDoEnvio = recusaDaOferta('uniplus.selecao.inscricao.oferta_fora_do_processo');
    servico.inscricao = inscricao(RESPONDIDA);
    const tela = await abrir();
    await escolherCurso(tela, DIREITO.id);
    await irAoPasso(tela, 'Dados pessoais');

    await clicar(botao(tela, 'Enviar inscrição'));

    const select = tela.querySelector('#inscricao-oferta') as HTMLSelectElement;
    expect(tela.querySelector('#inscricao-oferta-erro')?.textContent).toContain(
      'Este curso não é oferecido neste processo.',
    );
    expect(select.getAttribute('aria-describedby')).toBe('inscricao-oferta-erro');
    expect(document.activeElement).toBe(select);
    expect(passos(tela)[0].textContent).toContain('(com resposta recusada)');
  });

  it('enviar sem escolher o curso não envia e aponta o passo Curso', async () => {
    servico.ofertas = [MEDICINA, DIREITO];
    servico.inscricao = inscricao(RESPONDIDA);
    const tela = await abrir();
    await irAoPasso(tela, 'Dados pessoais');

    await clicar(botao(tela, 'Enviar inscrição'));

    expect(servico.enviados).toHaveLength(0);
    expect(tela.querySelector('#inscricao-oferta-erro')?.textContent).toContain(
      'Escolha a oferta de curso para enviar a inscrição.',
    );
    expect(passos(tela)[0].textContent).toContain('(com resposta recusada)');
    expect(passos(tela)[0].getAttribute('aria-current')).toBe('step');
  });

  it('a recusa do curso junto de outro campo mantém o candidato no passo Curso, com o foco no seletor', async () => {
    servico.ofertas = [MEDICINA, DIREITO];
    servico.recusaDoEnvio = apiFailure(
      {
        type: 'about:blank',
        title: 'Recusada',
        status: 422,
        code: 'uniplus.selecao.inscricao.oferta_fora_do_processo',
        traceId: '',
        errors: [
          { field: 'NOME', code: 'uniplus.selecao.inscricao.resposta_invalida', message: '' },
          {
            field: 'ofertaCursoId',
            code: 'uniplus.selecao.inscricao.oferta_fora_do_processo',
            message: '',
          },
        ],
      },
      422,
      new HttpHeaders(),
    );
    servico.inscricao = inscricao(RESPONDIDA);
    const tela = await abrir();
    await escolherCurso(tela, DIREITO.id);
    await irAoPasso(tela, 'Dados pessoais');

    await clicar(botao(tela, 'Enviar inscrição'));

    const select = tela.querySelector('#inscricao-oferta') as HTMLSelectElement;
    expect(select).not.toBeNull();
    expect(tela.querySelector('#inscricao-oferta-erro')).not.toBeNull();
    expect(document.activeElement).toBe(select);
    expect(passos(tela)[0].getAttribute('aria-current')).toBe('step');
    expect(passos(tela)[1].textContent).toContain('(com resposta recusada)');
  });

  it('o curso gravado que saiu das ofertas do processo não vale: o envio é barrado no passo Curso', async () => {
    servico.ofertas = [MEDICINA, DIREITO];
    servico.inscricao = inscricao({ ...RESPONDIDA, ofertaCursoId: 'oferta-que-saiu' });
    const tela = await abrir();
    await irAoPasso(tela, 'Dados pessoais');

    await clicar(botao(tela, 'Enviar inscrição'));

    expect(servico.enviados).toHaveLength(0);
    expect(tela.querySelector('#inscricao-oferta-erro')).not.toBeNull();
  });

  it('o rascunho salvo não leva o curso gravado que saiu das ofertas do processo', async () => {
    servico.ofertas = [MEDICINA, DIREITO];
    servico.inscricao = inscricao({ ofertaCursoId: 'oferta-que-saiu' });
    const tela = await abrir();

    await clicar(botao(tela, 'Salvar rascunho'));

    expect(servico.salvos[0].ofertaCursoId).toBeNull();
  });

  it('sem curso o envio fica inativo e o link do motivo leva o foco ao seletor do curso', async () => {
    servico.ofertas = [MEDICINA, DIREITO];
    servico.inscricao = inscricao(RESPONDIDA);
    const tela = await abrir();
    await clicar(passos(tela)[1]);

    expect(botao(tela, 'Enviar inscrição').disabled).toBe(true);
    expect(tela.querySelector('#inscricao-motivo-envio')?.textContent).toContain(
      'Escolha o curso.',
    );

    await clicar(botao(tela, 'Escolher o curso'));
    await fixture.whenStable();

    expect(servico.enviados).toHaveLength(0);
    expect(passos(tela)[0].getAttribute('aria-current')).toBe('step');
    expect(document.activeElement).toBe(tela.querySelector('#inscricao-oferta'));
  });

  it('o curso é o primeiro passo quando há mais de uma oferta e não há seletor fora do indicador', async () => {
    servico.ofertas = [MEDICINA, DIREITO];
    const tela = await abrir();

    expect(tela.querySelector('nav[aria-label="Passos da inscrição"]')).not.toBeNull();
    expect(passos(tela)[0].textContent).toContain('Curso');
    expect(passos(tela)[1].textContent).toContain('Dados pessoais');
    expect(passos(tela)[0].getAttribute('aria-current')).toBe('step');
    expect(tela.querySelector('ui-formulario-do-candidato #inscricao-oferta')).not.toBeNull();
    expect(tela.querySelector('ui-page-header ~ #inscricao-oferta')).toBeNull();
  });

  it('com uma oferta só, o curso gravado que saiu do processo cede lugar à oferta que resta', async () => {
    servico.inscricao = inscricao({ ...RESPONDIDA, ofertaCursoId: 'oferta-que-saiu' });
    const tela = await abrir();

    expect(tela.querySelector('.inscricao-curso')?.textContent).toContain(MEDICINA.nome);
    await clicar(botao(tela, 'Enviar inscrição'));

    expect(servico.enviados[0].ofertaCursoId).toBe(MEDICINA.id);
  });

  describe('1ª e 2ª opção de curso', () => {
    const select2 = (tela: HTMLElement): HTMLSelectElement =>
      tela.querySelector('#inscricao-segunda-oferta') as HTMLSelectElement;
    const escolherSegunda = async (tela: HTMLElement, id: string): Promise<void> => {
      select2(tela).value = id;
      select2(tela).dispatchEvent(new Event('change'));
      fixture.detectChanges();
      await fixture.whenStable();
    };
    const idsDasOpcoes = (select: HTMLSelectElement): string[] =>
      [...select.options].map((o) => o.value).filter((v) => v !== '');
    const dosDoisCursos = (): void => {
      servico.ofertas = [MEDICINA, DIREITO, ENGENHARIA];
      servico.opcoes = 2;
    };
    const recusaDaSegunda = (codigo: string) =>
      apiFailure(
        {
          type: 'about:blank',
          title: 'Recusada',
          status: 422,
          code: codigo,
          traceId: '',
          errors: [{ field: 'ofertaCursoSegundaOpcaoId', code: codigo, message: '' }],
        },
        422,
        new HttpHeaders(),
      );

    it('com 2 opções, a 2ª fica desabilitada até a 1ª ser escolhida e não lista o curso da 1ª', async () => {
      dosDoisCursos();
      const tela = await abrir();

      expect(tela.querySelector('label[for="inscricao-oferta"]')?.textContent).toContain(
        '1ª opção',
      );
      expect(tela.querySelector('label[for="inscricao-segunda-oferta"]')?.textContent).toContain(
        '2ª opção (opcional)',
      );
      expect(select2(tela).disabled).toBe(true);

      await escolherCurso(tela, DIREITO.id);

      expect(select2(tela).disabled).toBe(false);
      expect(idsDasOpcoes(select2(tela))).toEqual([ENGENHARIA.id, MEDICINA.id]);
    });

    it('com 1 opção, o passo mostra um campo só, mesmo com vários cursos', async () => {
      servico.ofertas = [MEDICINA, DIREITO];
      servico.opcoes = 1;
      const tela = await abrir();

      expect(tela.querySelector('#inscricao-oferta')).not.toBeNull();
      expect(tela.querySelector('#inscricao-segunda-oferta')).toBeNull();
      await clicar(botao(tela, 'Salvar rascunho'));
      expect(servico.salvos[0].ofertaCursoSegundaOpcaoId).toBeNull();
    });

    it('trocar a 1ª para o curso da 2ª limpa a 2ª e avisa o candidato', async () => {
      dosDoisCursos();
      servico.inscricao = inscricao({
        ofertaCursoId: DIREITO.id,
        ofertaCursoSegundaOpcaoId: ENGENHARIA.id,
      });
      const tela = await abrir();
      expect(select2(tela).value).toBe(ENGENHARIA.id);

      await escolherCurso(tela, ENGENHARIA.id);

      expect(select2(tela).value).toBe('');
      expect(tela.querySelector('#inscricao-segunda-oferta-aviso')?.textContent).toContain(
        'A 2ª opção foi limpa',
      );
      expect(select2(tela).getAttribute('aria-describedby')).toContain(
        'inscricao-segunda-oferta-aviso',
      );
      await clicar(botao(tela, 'Salvar rascunho'));
      expect(servico.salvos[0].ofertaCursoId).toBe(ENGENHARIA.id);
      expect(servico.salvos[0].ofertaCursoSegundaOpcaoId).toBeNull();
    });

    it('a oferta que a versão nova retirou aparece sem seleção e sem aviso', async () => {
      dosDoisCursos();
      servico.inscricao = inscricao({
        ofertaCursoId: DIREITO.id,
        ofertaCursoSegundaOpcaoId: 'oferta-que-saiu',
      });
      const tela = await abrir();

      expect(select2(tela).value).toBe('');
      expect(tela.querySelector('#inscricao-segunda-oferta-aviso')).toBeNull();
    });

    it('trocar a 1ª para outro curso mantém a 2ª, e as duas vão no corpo do envio', async () => {
      dosDoisCursos();
      servico.inscricao = inscricao({
        ...RESPONDIDA,
        ofertaCursoId: DIREITO.id,
        ofertaCursoSegundaOpcaoId: ENGENHARIA.id,
      });
      const tela = await abrir();

      await escolherCurso(tela, MEDICINA.id);

      expect(select2(tela).value).toBe(ENGENHARIA.id);
      expect(tela.querySelector('#inscricao-segunda-oferta-aviso')).toBeNull();
      await clicar(botao(tela, 'Enviar inscrição'));
      expect(servico.enviados[0].ofertaCursoId).toBe(MEDICINA.id);
      expect(servico.enviados[0].ofertaCursoSegundaOpcaoId).toBe(ENGENHARIA.id);
    });

    it('a avaliação é pedida de novo com a 2ª opção quando só ela muda', async () => {
      vi.useRealTimers();
      dosDoisCursos();
      servico.formulario = COM_MODALIDADES;
      servico.inscricao = inscricao({ ofertaCursoId: DIREITO.id });
      const tela = await abrir();

      await escolherSegunda(tela, ENGENHARIA.id);
      await new Promise((resolver) => setTimeout(resolver, ESPERA_DA_CONSULTA_MS + 50));

      expect(servico.avaliacoes.map((a) => a.ofertaCursoSegundaOpcaoId)).toEqual([ENGENHARIA.id]);
    });

    it('a recusa da 2ª opção aparece junto do campo dela, com o foco nele', async () => {
      dosDoisCursos();
      servico.recusaDoEnvio = recusaDaSegunda(
        'uniplus.selecao.inscricao.segunda_opcao_igual_a_primeira',
      );
      servico.inscricao = inscricao({
        ...RESPONDIDA,
        ofertaCursoId: DIREITO.id,
        ofertaCursoSegundaOpcaoId: ENGENHARIA.id,
      });
      const tela = await abrir();
      await irAoPasso(tela, 'Dados pessoais');

      await clicar(botao(tela, 'Enviar inscrição'));

      expect(tela.querySelector('#inscricao-segunda-oferta-erro')?.textContent).toContain(
        'A 2ª opção tem de ser um curso diferente da 1ª.',
      );
      expect(tela.querySelector('#inscricao-oferta-erro')).toBeNull();
      expect(select2(tela).getAttribute('aria-invalid')).toBe('true');
      expect(select2(tela).getAttribute('aria-describedby')).toContain(
        'inscricao-segunda-oferta-erro',
      );
      expect(document.activeElement).toBe(select2(tela));
      expect(passos(tela)[0].textContent).toContain('(com resposta recusada)');

      await escolherCurso(tela, MEDICINA.id);

      expect(tela.querySelector('#inscricao-segunda-oferta-erro')).toBeNull();
      expect(select2(tela).getAttribute('aria-invalid')).toBeNull();
    });

    it('trocar a 1ª mantém a recusa da 2ª que não depende da 1ª', async () => {
      dosDoisCursos();
      servico.recusaDoEnvio = recusaDaSegunda('uniplus.selecao.inscricao.nenhuma_modalidade');
      servico.inscricao = inscricao({
        ...RESPONDIDA,
        ofertaCursoId: DIREITO.id,
        ofertaCursoSegundaOpcaoId: ENGENHARIA.id,
      });
      const tela = await abrir();

      await clicar(botao(tela, 'Enviar inscrição'));
      await escolherCurso(tela, MEDICINA.id);

      expect(tela.querySelector('#inscricao-segunda-oferta-erro')).not.toBeNull();
      expect(select2(tela).getAttribute('aria-invalid')).toBe('true');
    });

    it('a recusa de nenhuma modalidade na 2ª opção diz o que fazer com a opção', async () => {
      dosDoisCursos();
      servico.recusaDoEnvio = recusaDaSegunda('uniplus.selecao.inscricao.nenhuma_modalidade');
      servico.inscricao = inscricao({
        ...RESPONDIDA,
        ofertaCursoId: DIREITO.id,
        ofertaCursoSegundaOpcaoId: ENGENHARIA.id,
      });
      const tela = await abrir();

      await clicar(botao(tela, 'Enviar inscrição'));

      expect(tela.querySelector('#inscricao-segunda-oferta-erro')?.textContent).toContain(
        'retire a 2ª opção',
      );
    });

    it('a revisão mostra as duas opções, e a 2ª como não declarada quando fica vazia', async () => {
      dosDoisCursos();
      servico.inscricao = inscricao({
        ...RESPONDIDA,
        ofertaCursoId: DIREITO.id,
        ofertaCursoSegundaOpcaoId: ENGENHARIA.id,
      });
      let tela = await abrir();
      await irAoPasso(tela, 'Revisão e aceite');
      let revisao = tela.querySelector('ui-formulario-do-candidato')?.textContent ?? '';
      expect(revisao).toContain('1ª opção');
      expect(revisao).toContain(DIREITO.nome);
      expect(revisao).toContain('2ª opção');
      expect(revisao).toContain(ENGENHARIA.nome);

      servico.inscricao = inscricao({ ...RESPONDIDA, ofertaCursoId: DIREITO.id });
      tela = await abrir();
      await irAoPasso(tela, 'Revisão e aceite');
      revisao = tela.querySelector('ui-formulario-do-candidato')?.textContent ?? '';
      expect(revisao).toContain('Não declarada');
    });
  });

  it('com uma oferta só não há passo Curso e o cabeçalho informa o curso', async () => {
    const tela = await abrir();

    expect(tela.querySelector('nav[aria-label="Seções do formulário"]')).not.toBeNull();
    expect(passos(tela)[0].textContent).toContain('Dados pessoais');
    expect(passos(tela).some((b) => b.textContent?.includes('Curso'))).toBe(false);
    expect(tela.querySelector('.inscricao-curso')?.textContent).toContain(MEDICINA.nome);
  });

  it('a revisão mostra o curso escolhido e volta ao passo Curso', async () => {
    servico.ofertas = [MEDICINA, DIREITO];
    servico.inscricao = inscricao({ ...RESPONDIDA, ofertaCursoId: DIREITO.id });
    const tela = await abrir();
    await clicar(passos(tela)[passos(tela).length - 1]);

    const revisao = tela.querySelector('.formulario-candidato__resumo') as HTMLElement;
    expect(revisao.textContent).toContain(DIREITO.nome);
    await clicar(revisao.querySelector('button') as HTMLElement);

    expect(passos(tela)[0].getAttribute('aria-current')).toBe('step');
    expect(document.activeElement?.textContent).toContain('Curso');
  });

  it('a releitura depois de uma falha sem resposta mantém o curso escolhido', async () => {
    servico.ofertas = [MEDICINA, DIREITO];
    servico.recusaDoEnvio = problema(0, 'uniplus.client.network_error');
    servico.inscricao = inscricao(RESPONDIDA);
    const tela = await abrir();
    await escolherCurso(tela, DIREITO.id);

    await clicar(botao(tela, 'Enviar inscrição'));
    servico.recusaDoEnvio = null;
    await clicar(botao(tela, 'Enviar inscrição'));

    expect(servico.enviados.map((r) => r.ofertaCursoId)).toEqual([DIREITO.id, DIREITO.id]);
  });

  /** A data de nascimento até o dia do envio, como o conjunto básico a declara. */
  const comNascimentoAteOEnvio = (): FormularioRenderizavelDto => ({
    ...FORMULARIO_DE_INSCRICAO_MOCK,
    regras: {
      ...FORMULARIO_DE_INSCRICAO_MOCK.regras,
      etapas: FORMULARIO_DE_INSCRICAO_MOCK.regras.etapas.map((etapa) => ({
        ...etapa,
        itens: etapa.itens.map((item) =>
          item.fatoCodigo === 'DATA_NASCIMENTO'
            ? {
                ...item,
                restricoes: [
                  {
                    tipo: 'FAIXA_DE_DATA',
                    minimo: null,
                    maximo: null,
                    entradas: null,
                    fatos: null,
                    dataMinima: null,
                    dataMaxima: { ancora: 'ENVIO', data: null, anos: 0, dias: 0 },
                  },
                ],
              }
            : item,
        ),
      })),
    },
  });

  it('o limite contado do envio anda um dia quando a meia-noite do fuso do envio passa', async () => {
    agora = new Date('2026-12-12T02:50:00Z'); // 23h50 de 11/12 em Belém
    servico.formulario = comNascimentoAteOEnvio();
    const tela = await abrir();
    expect(campoDe(tela, 'DATA_NASCIMENTO').getAttribute('max')).toBe('2026-12-11');

    agora = new Date('2026-12-12T03:00:01Z'); // 00h00 de 12/12 em Belém
    vi.advanceTimersByTime(10 * 60 * 1_000 + 1_000);
    fixture.detectChanges();

    expect(campoDe(tela, 'DATA_NASCIMENTO').getAttribute('max')).toBe('2026-12-12');
  });

  it('a aba que volta ao primeiro plano confere o dia, mesmo com o timer atrasado', async () => {
    agora = new Date('2026-12-12T02:50:00Z');
    servico.formulario = comNascimentoAteOEnvio();
    const tela = await abrir();

    agora = new Date('2026-12-12T09:00:00Z');
    document.dispatchEvent(new Event('visibilitychange'));
    fixture.detectChanges();

    expect(campoDe(tela, 'DATA_NASCIMENTO').getAttribute('max')).toBe('2026-12-12');
  });

  it('a última seção não oferece concluir: a ação final é enviar a inscrição', async () => {
    const tela = await abrir();
    const secoes = tela.querySelectorAll<HTMLButtonElement>(
      'nav[aria-label="Seções do formulário"] button',
    );

    await clicar(secoes[secoes.length - 1]);

    expect(botao(tela, 'Concluir a seção')).toBeUndefined();
    expect(botao(tela, 'Seção anterior')).toBeDefined();
    expect(botao(tela, 'Enviar inscrição')).toBeDefined();
  });

  it('o link da seção pendente leva ao primeiro campo a corrigir, sem dar nenhuma seção como concluída', async () => {
    servico.inscricao = inscricao({ ...RESPONDIDA, respostas: {} });
    const tela = await abrir();
    const pendente = tela.querySelector('#inscricao-motivo-envio li button') as HTMLElement;

    await clicar(pendente);
    await fixture.whenStable();

    expect(document.activeElement).toBe(campoDe(tela, 'NOME'));
    expect(
      tela.querySelectorAll('nav[aria-label="Passos da inscrição"] li.is-done, nav li.is-done'),
    ).toHaveLength(0);
    expect(botao(tela, 'Enviar inscrição').disabled).toBe(true);
  });

  it('o rascunho não vai para o armazenamento do navegador', async () => {
    const gravacao = vi.spyOn(Storage.prototype, 'setItem');
    const tela = await abrir();

    await clicar(botao(tela, 'Salvar rascunho'));

    expect(gravacao).not.toHaveBeenCalled();
  });
});
