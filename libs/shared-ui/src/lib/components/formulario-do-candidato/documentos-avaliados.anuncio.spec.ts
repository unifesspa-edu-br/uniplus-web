import { anunciarMudancaDosDocumentos } from './anuncio-dos-documentos';
import { arvoreDeDocumentos } from './arvore-de-documentos';
import type { DocumentoAvaliado, GrupoDoDocumento } from './documentos-avaliados';
import { CANDIDATO, documento, e, FAMILIA, MAE, ou, PAI } from './documentos-avaliados.testing';

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

  /** O limite de cada unidade é o ponto: o documento solto não é mais uma alternativa da escolha. */
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
   * seguinte tem o mesmo nome que ele. Anunciar a saída diria que deixou de ser exigido o documento
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
