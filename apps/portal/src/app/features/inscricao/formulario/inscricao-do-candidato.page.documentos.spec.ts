import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { of } from 'rxjs';
import {
  type AvaliacaoDaInscricaoDto,
  type AvaliacaoDaInscricaoRequest,
  type InscricaoRequest,
  SituacaoDoArquivoDoCandidato,
} from '@uniplus/shared-data/selecao';
import { passarOTempo } from '@uniplus/shared-testing';
import { esperaDaConsulta } from './acompanhamento-da-verificacao';
import { ESPERA_DA_CONSULTA_MS } from './avaliacao-da-inscricao.estado';
import { FORMULARIO_DE_INSCRICAO_MOCK, comFormulario } from './inscricao-do-candidato.testing';
import {
  ok,
  problema,
  SEM_DERIVACAO,
  COM_MODALIDADES,
  inscricao,
  RESPONDIDA,
  botao,
  indisponivel,
  CenarioDaInscricao,
} from './inscricao-do-candidato.page.testing';

describe('InscricaoDoCandidatoPage', () => {
  let cenario: CenarioDaInscricao;

  beforeEach(() => {
    cenario = CenarioDaInscricao.preparar();
  });

  afterEach(() => {
    cenario.encerrar();
  });

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

  /** O formulário de teste com o bloco de comprovação documental. */
  const COM_DOCUMENTOS = comFormulario(FORMULARIO_DE_INSCRICAO_MOCK, {
    etapas: [
      ...FORMULARIO_DE_INSCRICAO_MOCK.formulario.etapas,
      {
        codigo: 'DOCUMENTOS',
        codigoNasRegras: null,
        ordem: 3,
        tipo: 'BLOCO',
        bloco: 'COMPROVACAO_DOCUMENTAL',
        apresentacao: { titulo: 'Documentos', descricao: null, aviso: null },
      },
    ],
  });
  const irAosDocumentos = async (tela: HTMLElement): Promise<HTMLElement> => {
    await cenario.clicar(
      [...tela.querySelectorAll<HTMLButtonElement>('nav button')].find((b) =>
        b.textContent?.includes('Documentos'),
      ) as HTMLButtonElement,
    );
    return tela.querySelector('.formulario-candidato__secao') as HTMLElement;
  };

  it('a seção de documentos sem exigência nesta fase diz que nada se envia nesta etapa', async () => {
    cenario.servico.formulario = COM_DOCUMENTOS;
    cenario.servico.inscricao = inscricao(RESPONDIDA);
    const tela = await cenario.abrir();

    expect((await irAosDocumentos(tela)).textContent).toContain(
      'Você não envia documentos nesta etapa.',
    );
  });

  /**
   * O documento da isenção é pedido no formulário da isenção, e o de outra fase no formulário dela,
   * mesmo que tenha a mesma finalidade.
   */
  it('a seção de documentos lista o que a avaliação pede no formulário da inscrição', async () => {
    cenario.servico.formulario = COM_DOCUMENTOS;
    cenario.servico.inscricao = inscricao({
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
    const tela = await cenario.abrir();

    const secao = await irAosDocumentos(tela);
    const nomes = [...secao.querySelectorAll('h4')].map((h) => h.textContent?.trim());
    expect(nomes).toEqual(['Histórico escolar']);

    // Com um envio em andamento a zona de escolha segue habilitada: desabilitá-la tira o foco do teclado.
    cenario.ocupadoDoEnvio.set(true);
    cenario.fixture.detectChanges();
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
                  rotulo: 'Arquivo 1',
                  nomeParaDownload: null,
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
    cenario.servico.formulario = COM_DOCUMENTOS;
    cenario.servico.inscricao = inscricao({
      ...RESPONDIDA,
      avaliacao: comArquivoEm(SituacaoDoArquivoDoCandidato.emVerificacao),
    });
    const tela = await cenario.abrir();

    expect(tela.querySelector('#inscricao-motivo-envio')?.textContent).toContain(AGUARDE);
    expect(indisponivel(botao(tela, 'Enviar inscrição'))).toBe(true);
  });

  it('consulta a verificação com espera crescente até o resultado e então libera o envio', async () => {
    const respostas = [
      comArquivoEm(SituacaoDoArquivoDoCandidato.emVerificacao),
      comArquivoEm(SituacaoDoArquivoDoCandidato.verificado),
    ];
    cenario.servico.avaliar = (_: string, request: AvaliacaoDaInscricaoRequest) => {
      cenario.servico.avaliacoes.push(request);
      return ok(respostas[cenario.servico.avaliacoes.length - 1]);
    };
    cenario.servico.formulario = COM_DOCUMENTOS;
    cenario.servico.inscricao = inscricao({
      ...RESPONDIDA,
      avaliacao: comArquivoEm(SituacaoDoArquivoDoCandidato.emVerificacao),
    });
    const tela = await cenario.abrir();
    const avancar = async (ms: number): Promise<void> => {
      await passarOTempo(ms);
      cenario.fixture.detectChanges();
    };

    await avancar(esperaDaConsulta(0) + ESPERA_DA_CONSULTA_MS);
    expect(cenario.servico.avaliacoes).toHaveLength(1);
    expect(tela.querySelector('#inscricao-motivo-envio')?.textContent).toContain(AGUARDE);

    await avancar(esperaDaConsulta(1) + ESPERA_DA_CONSULTA_MS);
    expect(cenario.servico.avaliacoes).toHaveLength(2);
    expect(tela.textContent).not.toContain(AGUARDE);
    const secao = await irAosDocumentos(tela);
    expect(secao.querySelector('.uni-uploader__item.is-success')).not.toBeNull();

    // Passado o fim da lista de esperas vale o teto: nem ele traz consulta nova depois do resultado.
    await avancar(esperaDaConsulta(Number.MAX_SAFE_INTEGER) + ESPERA_DA_CONSULTA_MS);
    expect(cenario.servico.avaliacoes).toHaveLength(2);
  });

  it('enviar ou remover um arquivo de documento consulta a avaliação, mesmo sem mudar nenhuma resposta', async () => {
    cenario.servico.formulario = COM_MODALIDADES;
    await cenario.abrir();
    expect(cenario.servico.avaliacoes).toHaveLength(0);

    // Também vale para o arquivo que veio da avaliação: remover não muda a lista do envio.
    cenario.mudancasDoEnvio.update((n) => n + 1);
    await passarOTempo(0);
    cenario.fixture.detectChanges();
    await passarOTempo(ESPERA_DA_CONSULTA_MS);

    expect(cenario.servico.avaliacoes).toHaveLength(1);
  });

  it('o arquivo de documento avança a revisão da inscrição: o próximo salvar leva o ETag novo', async () => {
    cenario.servico.formulario = COM_MODALIDADES;
    const tela = await cenario.abrir();
    const eTags: string[] = [];
    cenario.servico.salvar = (_: string, request: InscricaoRequest, eTag?: string) => {
      eTags.push(eTag ?? '');
      cenario.servico.salvos.push(request);
      return ok(cenario.servico.inscricao);
    };

    cenario.servico.inscricao = inscricao({ eTag: '"inscricao-1:3"' });
    cenario.mudancasDoEnvio.update((n) => n + 1);
    await passarOTempo(0);
    cenario.fixture.detectChanges();
    await cenario.clicar(botao(tela, 'Salvar rascunho'));

    expect(eTags).toEqual(['"inscricao-1:3"']);
  });

  it('outra aba gravou enquanto o ETag era relido: o próximo salvar leva o ETag velho e cai no conflito', async () => {
    cenario.servico.formulario = COM_MODALIDADES;
    const tela = await cenario.abrir();
    const eTagInicial = cenario.servico.inscricao.eTag;
    const eTags: string[] = [];
    cenario.servico.salvar = (_: string, request: InscricaoRequest, eTag?: string) => {
      eTags.push(eTag ?? '');
      cenario.servico.salvos.push(request);
      return ok(cenario.servico.inscricao);
    };

    cenario.servico.inscricao = inscricao({
      eTag: '"inscricao-1:3"',
      ofertaCursoId: 'outra-oferta',
    });
    cenario.mudancasDoEnvio.update((n) => n + 1);
    await passarOTempo(0);
    cenario.fixture.detectChanges();
    await cenario.clicar(botao(tela, 'Salvar rascunho'));

    expect(eTags).toEqual([eTagInicial]);
  });

  it('releitura do ETag que falha depois de um arquivo de documento pede recarregar, sem gravar com o velho', async () => {
    cenario.servico.formulario = COM_MODALIDADES;
    const tela = await cenario.abrir();

    cenario.servico.obter = () => of(problema(503, 'uniplus.teste'));
    cenario.mudancasDoEnvio.update((n) => n + 1);
    await passarOTempo(0);
    cenario.fixture.detectChanges();

    expect(tela.textContent).toContain('Recarregue a página para continuar');
    expect(indisponivel(botao(tela, 'Salvar rascunho'))).toBe(true);
  });

  it('com envio de documento em andamento, não deixa gravar com a revisão velha', async () => {
    cenario.servico.formulario = COM_MODALIDADES;
    const tela = await cenario.abrir();

    cenario.ocupadoDoEnvio.set(true);
    cenario.fixture.detectChanges();

    expect(indisponivel(botao(tela, 'Salvar rascunho'))).toBe(true);
  });
});
