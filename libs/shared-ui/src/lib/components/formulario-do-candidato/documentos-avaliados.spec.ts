import { arvoreDeDocumentos } from './arvore-de-documentos';
import { documentosDoFormulario, type DocumentosAvaliados } from './documentos-avaliados';
import {
  CANDIDATO,
  comoTexto,
  documento,
  e,
  FAMILIA,
  folhaRepetida,
  MAE,
  ou,
  PAI,
} from './documentos-avaliados.testing';

describe('documentosDoFormulario', () => {
  /** O processo pode ter mais de uma fase de coleta: a finalidade sozinha não diz a fase. */
  it('traz os documentos e as pendências da fase do formulário, e da finalidade dele', () => {
    const avaliados: DocumentosAvaliados = {
      fases: [
        {
          faseId: 'outra',
          codigo: 'INSCRICAO',
          ordem: 2,
          documentos: [documento('Histórico de outra fase')],
          pendencias: [{ fatoCodigo: 'RENDA', rotulo: 'Renda', secaoCodigo: null }],
        },
        {
          faseId: 'desta',
          codigo: 'INSCRICAO',
          ordem: 1,
          documentos: [
            documento('Histórico'),
            documento('Renda para a isenção', { finalidade: 'ISENCAO_TAXA' }),
          ],
          pendencias: [{ fatoCodigo: 'PCD', rotulo: 'Deficiência', secaoCodigo: null }],
        },
      ],
    };

    const { documentos, pendencias } = documentosDoFormulario(avaliados, 'desta', 'INSCRICAO');

    expect(documentos.map((d) => d.nome)).toEqual(['Histórico']);
    expect(pendencias.map((p) => p.fatoCodigo)).toEqual(['PCD']);
  });
});

describe('arvoreDeDocumentos', () => {
  it('a alternativa dentro de outra não faz a outra opção parecer obrigatória', () => {
    const arvore = arvoreDeDocumentos(
      [
        documento('RG', { grupos: [ou('externo'), ou('identidade')] }),
        documento('CNH', { grupos: [ou('externo'), ou('identidade')] }),
        documento('Passaporte', { grupos: [ou('externo')] }),
      ],
      [],
      {},
    );

    expect(comoTexto(arvore)).toEqual([
      {
        'Envie uma das opções abaixo, à sua escolha:': [
          { 'Envie um dos documentos abaixo, à sua escolha:': ['RG', 'CNH'] },
          'Passaporte',
        ],
      },
    ]);
  });

  it('o conjunto que vale junto aparece como uma opção, não como documentos soltos', () => {
    const arvore = arvoreDeDocumentos(
      [
        documento('RG', { grupos: [ou('a1')] }),
        documento('CNH', { grupos: [ou('a1'), e('a2')] }),
        documento('Comprovante de residência', { grupos: [ou('a1'), e('a2')] }),
        documento('Histórico'),
      ],
      [],
      {},
    );

    expect(comoTexto(arvore)).toEqual([
      {
        'Envie uma das opções abaixo, à sua escolha:': [
          'RG',
          { 'Envie todos estes documentos, juntos:': ['CNH', 'Comprovante de residência'] },
        ],
      },
      'Histórico',
    ]);
  });

  it('o N-de diz quantos bastam', () => {
    const arvore = arvoreDeDocumentos(
      ['A', 'B', 'C'].map((nome) => documento(nome, { grupos: [ou('n', 2)] })),
      [],
      {},
    );

    expect(comoTexto(arvore)).toEqual([
      { 'Envie 2 dos documentos abaixo, à sua escolha:': ['A', 'B', 'C'] },
    ]);
  });

  it('o documento repetido por integrante leva o título dele no formulário, sem dado pessoal', () => {
    const arvore = arvoreDeDocumentos(
      [
        documento('Comprovante de renda', { grupoCodigo: 'FAMILIA', ocorrenciaId: 'o1' }),
        documento('Comprovante de renda', { grupoCodigo: 'FAMILIA', ocorrenciaId: 'o2' }),
        documento('Comprovante de renda', { grupoCodigo: 'FAMILIA', ocorrenciaId: null }),
      ],
      [FAMILIA],
      { FAMILIA: [CANDIDATO, MAE] },
    );

    expect(comoTexto(arvore)).toEqual([
      'Comprovante de renda — Você (candidato)',
      'Comprovante de renda — Integrante 1',
      'Comprovante de renda — de cada integrante (composição familiar)',
    ]);
  });

  /** O OU que se repete: cada integrante escolhe o seu documento. */
  it('a escolha do grupo que se repete por integrante é feita integrante a integrante', () => {
    const porMembro = ou('a1', 1, 'FAMILIA');
    const doMembro = (nome: string, ocorrenciaId: string) =>
      documento(nome, { grupoCodigo: 'FAMILIA', ocorrenciaId, grupos: [porMembro] });
    const arvore = arvoreDeDocumentos(
      [doMembro('RG', 'o1'), doMembro('CNH', 'o1'), doMembro('RG', 'o2'), doMembro('CNH', 'o2')],
      [FAMILIA],
      { FAMILIA: [CANDIDATO, MAE] },
    );

    expect(comoTexto(arvore)).toEqual([
      {
        'Você (candidato): Envie um dos documentos abaixo, à sua escolha:': [
          'RG — Você (candidato)',
          'CNH — Você (candidato)',
        ],
      },
      {
        'Integrante 1: Envie um dos documentos abaixo, à sua escolha:': [
          'RG — Integrante 1',
          'CNH — Integrante 1',
        ],
      },
    ]);
  });

  /** A folha que se repete sob um OU escolhido uma vez: o RG de todos, ou a CNH de todos. */
  it('a escolha entre documentos que se repetem é uma só, e o escolhido vale para todos', () => {
    const arvore = arvoreDeDocumentos(
      [
        folhaRepetida('RG', 'o1', 'PODE_SER_EXIGIDO'),
        folhaRepetida('CNH', 'o1'),
        folhaRepetida('RG', 'o2'),
        folhaRepetida('CNH', 'o2'),
      ],
      [FAMILIA],
      { FAMILIA: [CANDIDATO, MAE] },
    );

    expect(comoTexto(arvore)).toEqual([
      {
        'Envie um dos documentos abaixo, à sua escolha:': [
          'RG — do Integrante 1; pode ser exigido de Você (candidato)',
          'CNH — de Você (candidato) e do Integrante 1',
        ],
      },
    ]);
    const [rg, cnh] = arvore[0].tipo === 'DOCUMENTO' ? [] : arvore[0].itens;
    expect(rg.tipo === 'DOCUMENTO' && rg.documento.situacao).toBe(
      'Conforme o integrante, como indicado no nome',
    );
    expect(cnh.tipo === 'DOCUMENTO' && cnh.documento.situacao).toBe('Exigido pelas suas respostas');
  });

  /** O irmão sem renda não recebe o comprovante: a avaliação não traz a linha dele. */
  it('o documento que se repete nomeia só os integrantes a que se aplica', () => {
    const arvore = arvoreDeDocumentos(
      [folhaRepetida('Comprovante de renda', 'o1'), folhaRepetida('Comprovante de renda', 'o3')],
      [FAMILIA],
      { FAMILIA: [CANDIDATO, MAE, PAI] },
    );

    expect(comoTexto(arvore)).toEqual([
      {
        'Envie o documento abaixo:': [
          'Comprovante de renda — de Você (candidato) e do Integrante 2',
        ],
      },
    ]);
  });

  /** "A e B de cada integrante" é uma opção do OU, não uma opção por integrante. */
  it('o grupo que se repete dentro de uma escolha que não se repete é uma opção só', () => {
    const doMembro = (nome: string, ocorrenciaId: string) =>
      documento(nome, {
        grupoCodigo: 'FAMILIA',
        ocorrenciaId,
        grupos: [ou('ext'), { ...e('in'), repetePorEntidade: 'FAMILIA' }],
      });
    const arvore = arvoreDeDocumentos(
      [
        doMembro('A', 'o1'),
        doMembro('B', 'o1'),
        doMembro('A', 'o2'),
        doMembro('B', 'o2'),
        documento('C', { grupos: [ou('ext')] }),
      ],
      [FAMILIA],
      { FAMILIA: [CANDIDATO, MAE] },
    );

    expect(comoTexto(arvore)).toEqual([
      {
        'Envie uma das opções abaixo, à sua escolha:': [
          {
            'De cada integrante:': [
              {
                'Você (candidato): Envie todos estes documentos, juntos:': [
                  'A — Você (candidato)',
                  'B — Você (candidato)',
                ],
              },
              {
                'Integrante 1: Envie todos estes documentos, juntos:': [
                  'A — Integrante 1',
                  'B — Integrante 1',
                ],
              },
            ],
          },
          'C',
        ],
      },
    ]);
  });

  it('o documento do integrante que já saiu do formulário não aparece', () => {
    const arvore = arvoreDeDocumentos(
      [documento('Comprovante de renda', { grupoCodigo: 'FAMILIA', ocorrenciaId: 'o2' })],
      [FAMILIA],
      { FAMILIA: [CANDIDATO] },
    );

    expect(arvore).toEqual([]);
  });

  it('diz a situação no lugar de a quem a exigência se aplica', () => {
    const situacoes = arvoreDeDocumentos(
      [
        documento('A'),
        documento('B', { situacao: 'PODE_SER_EXIGIDO' }),
        documento('C', { situacao: 'DEPENDE_DE_FASE_POSTERIOR' }),
      ],
      [],
      {},
    ).map((no) => (no.tipo === 'DOCUMENTO' ? [no.documento.situacao, no.documento.exigido] : []));

    expect(situacoes).toEqual([
      ['Exigido pelas suas respostas', true],
      ['Pode ser exigido, conforme as respostas', false],
      ['Pode ser exigido, conforme uma fase posterior do processo', false],
    ]);
  });
});
