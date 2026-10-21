import {
  anunciarMudancaDosDocumentos,
  arvoreDeDocumentos,
  type DocumentoAvaliado,
  documentosDoFormulario,
  type DocumentosAvaliados,
  type GrupoDoDocumento,
  type NoDeDocumentos,
  textoDoGrupo,
} from './documentos-avaliados';
import type { GrupoRenderizavel } from './formulario-do-candidato.model';

const documento = (nome: string, outros: Partial<DocumentoAvaliado> = {}): DocumentoAvaliado => ({
  exigenciaId: `exigencia-${nome}`,
  nome,
  obrigatorio: true,
  finalidade: 'INSCRICAO',
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
  ...outros,
});
const ou = (
  grupoId: string,
  minimo: number | null = 1,
  repetePorEntidade: string | null = null,
): GrupoDoDocumento => ({ grupoId, tipo: 'OU', minimo, repetePorEntidade });
const e = (grupoId: string): GrupoDoDocumento => ({
  grupoId,
  tipo: 'E',
  minimo: null,
  repetePorEntidade: null,
});

const FAMILIA: GrupoRenderizavel = {
  codigo: 'FAMILIA',
  ordem: 0,
  rotulo: 'Composição familiar',
  minimo: 1,
  incluiCandidato: true,
  subitens: [],
};
const CANDIDATO = { id: 'o1', respostas: { PARENTESCO: 'PROPRIO_CANDIDATO' } };
const MAE = { id: 'o2', respostas: { PARENTESCO: 'MAE' } };
const PAI = { id: 'o3', respostas: { PARENTESCO: 'PAI' } };

/** O documento que se repete por integrante a partir da própria folha, sob um OU escolhido uma vez. */
const folhaRepetida = (nome: string, ocorrenciaId: string, situacao = 'PENDENTE') =>
  documento(nome, {
    grupoCodigo: 'FAMILIA',
    ocorrenciaId,
    repetePorEntidade: 'FAMILIA',
    situacao,
    grupos: [ou('b1')],
  });

/** A árvore como texto: o grupo pelo que diz ao candidato, o documento pelo nome. */
const comoTexto = (nos: readonly NoDeDocumentos[]): unknown[] =>
  nos.map((no) =>
    no.tipo === 'DOCUMENTO' ? no.documento.rotulo : { [textoDoGrupo(no)]: comoTexto(no.itens) },
  );

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

describe('anunciarMudancaDosDocumentos', () => {
  const familia = { FAMILIA: [CANDIDATO, MAE, PAI] };
  const arvore = (documentos: DocumentoAvaliado[]) =>
    arvoreDeDocumentos(documentos, [FAMILIA], familia);
  const noFormulario = new Set(familia.FAMILIA.map((o) => o.id));
  const anuncio = (antes: DocumentoAvaliado[], depois: DocumentoAvaliado[]) =>
    anunciarMudancaDosDocumentos(arvore(antes), arvore(depois), noFormulario);
  const P = 'PODE_SER_EXIGIDO';
  const naEscolha = (nome: string, situacao = 'PENDENTE', ...grupos: GrupoDoDocumento[]) =>
    documento(nome, { situacao, grupos: grupos.length > 0 ? grupos : [ou('id')] });
  /** O OU que se repete por integrante: cada um escolhe o seu. */
  const doIntegrante = (nome: string, ocorrenciaId: string) =>
    documento(nome, { grupoCodigo: 'FAMILIA', ocorrenciaId, grupos: [ou('id', 1, 'FAMILIA')] });
  /** "A e B de cada integrante, ou C". */
  const deCada = (nome: string, ocorrenciaId: string) =>
    documento(nome, {
      grupoCodigo: 'FAMILIA',
      ocorrenciaId,
      grupos: [ou('ext'), { ...e('in'), repetePorEntidade: 'FAMILIA' }],
    });
  const c = (situacao = 'PENDENTE') => documento('C', { situacao, grupos: [ou('ext')] });
  /** A folha que se repete sob um OU escolhido uma vez. */
  const juntada = (nome: string, ocorrenciaId: string) =>
    documento(nome, {
      grupoCodigo: 'FAMILIA',
      ocorrenciaId,
      repetePorEntidade: 'FAMILIA',
      grupos: [ou('b1')],
    });

  it('a primeira avaliação não é mudança', () => {
    expect(anunciarMudancaDosDocumentos(null, arvore([documento('Histórico')]), new Set())).toBe(
      '',
    );
  });

  it('cada documento que passou a ser ou deixou de ser exigido tem a sua frase', () => {
    expect(anuncio([documento('Histórico')], [documento('Laudo médico')])).toBe(
      'Passou a ser exigido: Laudo médico. Deixou de ser exigido: Histórico.',
    );
    expect(anuncio([documento('Laudo médico', { situacao: P })], [documento('Laudo médico')])).toBe(
      'Passou a ser exigido: Laudo médico.',
    );
  });

  /** O limite de cada unidade é o ponto: o documento solto não vira mais uma alternativa da escolha. */
  it('a folha e a escolha que entram juntas são ditas separadas', () => {
    expect(
      anuncio(
        [documento('Histórico', { situacao: P }), naEscolha('RG', P), naEscolha('CNH', P)],
        [documento('Histórico'), naEscolha('RG'), naEscolha('CNH')],
      ),
    ).toBe('Passou a ser exigido: Histórico. Passou a ser exigido, à sua escolha: RG ou CNH.');
  });

  it('a escolha que deixa de ser pedida é dita inteira', () => {
    expect(
      anuncio([naEscolha('RG'), naEscolha('CNH')], [naEscolha('RG', P), naEscolha('CNH', P)]),
    ).toBe('Deixou de ser exigido: RG ou CNH.');
  });

  /** Na escolha, basta a autodeclaração: o laudo passar a ser pedido não o torna obrigatório. */
  it('a alternativa comum que muda de situação não é anunciada', () => {
    const escolha = (laudo: string) => [
      naEscolha('Laudo médico', laudo),
      naEscolha('Autodeclaração'),
    ];

    expect(anuncio(escolha(P), escolha('PENDENTE'))).toBe('');
    expect(anuncio(escolha('PENDENTE'), escolha(P))).toBe('');
  });

  it('a escolha aninhada é lida delimitada, e o N-de fecha a lista com "e"', () => {
    const aninhada = (situacao: string) => [
      naEscolha('RG', situacao, ou('ext'), ou('in')),
      naEscolha('CNH', situacao, ou('ext'), ou('in')),
      naEscolha('Passaporte', situacao, ou('ext')),
    ];
    const nDe = (situacao: string) =>
      ['A', 'B', 'C'].map((n) => naEscolha(n, situacao, ou('n', 2)));

    expect(anuncio(aninhada(P), aninhada('PENDENTE'))).toBe(
      'Passou a ser exigido, à sua escolha: RG ou CNH, ou Passaporte.',
    );
    expect(anuncio(nDe(P), nDe('PENDENTE'))).toBe(
      'Passou a ser exigido, à sua escolha: 2 entre A, B e C.',
    );
  });

  it('o integrante que entra ou sai da escolha que se repete tem a escolha dele', () => {
    const doCandidato = [doIntegrante('RG', 'o1'), doIntegrante('CNH', 'o1')];
    const daMae = [doIntegrante('RG', 'o2'), doIntegrante('CNH', 'o2')];

    expect(anuncio(doCandidato, [...doCandidato, ...daMae])).toBe(
      'Passou a ser exigido, à sua escolha: RG — Integrante 1 ou CNH — Integrante 1.',
    );
    expect(anuncio([...doCandidato, ...daMae], doCandidato)).toBe(
      'Deixou de ser exigido: RG — Integrante 1 ou CNH — Integrante 1.',
    );
  });

  /**
   * Quem tira o integrante é o próprio candidato, e o título antigo do que saiu já é o de outro: o
   * seguinte passa a se chamar como ele. Anunciar a saída diria que deixou de ser exigido o documento
   * de quem continua.
   */
  describe('o integrante tirado do formulário', () => {
    const semAMae = { FAMILIA: [CANDIDATO, PAI] };
    const tirarAMae = (documentos: DocumentoAvaliado[]) =>
      anunciarMudancaDosDocumentos(
        arvoreDeDocumentos(documentos, [FAMILIA], familia),
        arvoreDeDocumentos(documentos, [FAMILIA], semAMae),
        new Set(semAMae.FAMILIA.map((o) => o.id)),
      );

    it('não anuncia a saída do documento dele', () => {
      const renda = (o: string) =>
        documento('Comprovante de renda', { grupoCodigo: 'FAMILIA', ocorrenciaId: o });

      expect(tirarAMae([renda('o1'), renda('o2'), renda('o3')])).toBe('');
    });

    it('não anuncia a saída da escolha dele, nem a troca de título de quem continua', () => {
      const escolhas = ['o1', 'o2', 'o3'].flatMap((o) => [
        doIntegrante('RG', o),
        doIntegrante('CNH', o),
      ]);

      expect(tirarAMae(escolhas)).toBe('');
    });
  });

  /** O C continua uma opção para todos: a saída do integrante muda a escolha, não a desfaz. */
  it('a saída de um integrante numa opção da escolha muda a escolha inteira', () => {
    const comMae = [
      deCada('A', 'o1'),
      deCada('B', 'o1'),
      deCada('A', 'o2'),
      deCada('B', 'o2'),
      c(),
    ];
    const soCandidato = [deCada('A', 'o1'), deCada('B', 'o1'), c()];

    expect(anuncio(comMae, soCandidato)).toBe(
      'Mudou a escolha: A — Você (candidato) e B — Você (candidato), ou C.',
    );
    expect(anuncio(soCandidato, comMae)).toBe(
      'Mudou a escolha: A — Você (candidato) e B — Você (candidato); e A — Integrante 1 e B — Integrante 1, ou C.',
    );
  });

  it('a escolha juntada que passa a ser pedida de outro integrante muda', () => {
    expect(
      anuncio(
        [juntada('RG', 'o1'), juntada('CNH', 'o1')],
        [juntada('RG', 'o1'), juntada('CNH', 'o1'), juntada('RG', 'o2'), juntada('CNH', 'o2')],
      ),
    ).toBe(
      'Mudou a escolha: RG — de Você (candidato) e do Integrante 1 ou CNH — de Você (candidato) e do Integrante 1.',
    );
  });

  it('o item juntado fora de escolha anuncia o integrante novo', () => {
    const renda = (o: string) =>
      documento('Comprovante de renda', {
        grupoCodigo: 'FAMILIA',
        ocorrenciaId: o,
        repetePorEntidade: 'FAMILIA',
        grupos: [e('b1')],
      });

    expect(anuncio([renda('o1')], [renda('o1'), renda('o3')])).toBe(
      'Passou a ser exigido: Comprovante de renda — Integrante 2.',
    );
  });
});
