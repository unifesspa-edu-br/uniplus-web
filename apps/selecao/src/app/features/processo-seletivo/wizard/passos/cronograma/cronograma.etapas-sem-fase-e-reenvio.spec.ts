import { expect, it } from 'vitest';
import {
  PROCESSO_ID,
  ROTA_ETAPAS,
  ROTA_FASES,
  ROTA_PROCESSO,
  ROTA_DOCUMENTOS,
  ID_ETAPA_GRAVADA,
  PROBLEM_JSON,
  ID_INSCRICAO,
  ID_AVALIACAO,
  ID_BANCA_HETERO,
  ID_CATEGORIA_RACA,
  ID_CATEGORIA_RENDA,
} from './cronograma.testing';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';

describe('CronogramaPassoComponent: etapas sem fase e reenvio', () => {
  let componente: ContextoDoCronograma['componente'];
  let leitura: ContextoDoCronograma['leitura'];
  let conferencia: ContextoDoCronograma['conferencia'];
  let cronograma: ContextoDoCronograma['cronograma'];
  let store: ContextoDoCronograma['store'];
  let controller: ContextoDoCronograma['controller'];
  let detectar: ContextoDoCronograma['detectar'];
  let nativo: ContextoDoCronograma['nativo'];
  let proximoPasso: ContextoDoCronograma['proximoPasso'];
  let gravouExigencias: ContextoDoCronograma['gravouExigencias'];
  let gravouEtapas: ContextoDoCronograma['gravouEtapas'];
  let comFases: ContextoDoCronograma['comFases'];
  let comFaseQuePublica: ContextoDoCronograma['comFaseQuePublica'];
  let comUmaEtapa: ContextoDoCronograma['comUmaEtapa'];

  usarCronograma((tela) => {
    ({
      componente,
      leitura,
      conferencia,
      cronograma,
      store,
      controller,
      detectar,
      nativo,
      proximoPasso,
      gravouExigencias,
      gravouEtapas,
      comFases,
      comFaseQuePublica,
      comUmaEtapa,
    } = tela);
  });

  /**
   * Sem a fase que as agrupa, as etapas não aparecem em nenhuma fase da linha
   * do tempo — e a conferência manda removê-las. Sem esta lista à parte, a
   * ordem é para remover algo que não está na tela.
   */
  it('mostra e remove as etapas que nenhuma fase agrupa', () => {
    comFases(ID_INSCRICAO);
    comUmaEtapa();
    detectar();

    expect(leitura.etapasOrfas().map((orfa) => orfa.rotulo)).toEqual(['Prova objetiva']);
    expect(nativo.textContent ?? '').toContain('Etapas sem a fase que as agrupa');
    expect(conferencia.problemas().some((p) => p.includes('não dizem a que fase pertencem'))).toBe(
      true,
    );

    cronograma.removerTodasAsEtapas();
    detectar();

    expect(leitura.etapasOrfas()).toEqual([]);
    expect(store.draft().cronograma.etapas).toEqual([]);
    expect(conferencia.problemas().some((p) => p.includes('não dizem a que fase pertencem'))).toBe(
      false,
    );
  });

  /**
   * O que a reformulação do eixo fase→etapa habilita: uma fase que o cadastro NÃO marca
   * como agrupadora passa a poder subdividir-se, porque é a etapa que declara a fase a
   * que pertence. Sem isso, a habilitação com oito etapas — que todas as três planilhas
   * do CEPS descrevem — não tem onde existir.
   */
  it('acrescenta etapa em fase que o cadastro não marca como agrupadora', () => {
    comFases(ID_INSCRICAO);
    detectar();

    cronograma.acrescentarEtapa('COLETA_INSCRICAO');
    detectar();

    expect(leitura.etapasDaFase('COLETA_INSCRICAO', false)).toHaveLength(1);
    expect(leitura.etapasOrfas()).toEqual([]);
  });

  it('mantém cada etapa na fase que ela declara', () => {
    comFases(ID_INSCRICAO, ID_AVALIACAO);
    detectar();

    cronograma.acrescentarEtapa('COLETA_INSCRICAO');
    cronograma.acrescentarEtapa('AVALIACAO');
    detectar();

    expect(leitura.etapasDaFase('COLETA_INSCRICAO', false)).toHaveLength(1);
    expect(leitura.etapasDaFase('AVALIACAO', true)).toHaveLength(1);
  });

  it('envia ao comando a fase que a etapa declara', () => {
    comFases(ID_INSCRICAO);
    detectar();

    cronograma.acrescentarEtapa('COLETA_INSCRICAO');
    detectar();

    expect(store.draft().cronograma.etapas[0].faseCodigo).toBe('COLETA_INSCRICAO');
  });

  it('não repete como órfã a etapa que a fase de avaliação já agrupa', () => {
    comFases(ID_AVALIACAO);
    comUmaEtapa();

    expect(leitura.etapasOrfas()).toEqual([]);
  });

  /**
   * O ato cujo rótulo o catálogo não resolve descreve o cronograma gravado do
   * mesmo jeito. Escondê-lo faria a fase parecer publicar menos do que publica.
   */
  it('mostra pelo código o ato que o catálogo não nomeia', () => {
    comFaseQuePublica([{ atoCodigo: 'EDITAL_ANTIGO', papel: 'PRELIMINAR' }]);

    const mostrados = leitura.produtosDaFase(cronograma.fases.at(0));

    expect(mostrados).toEqual([
      { atoCodigo: 'EDITAL_ANTIGO', nome: 'EDITAL_ANTIGO', papel: 'resultado preliminar' },
    ]);
  });

  /**
   * O papel que esta tela ainda não sabe nomear aparece como veio: inventar
   * rótulo para o desconhecido esconderia do operador que a fase declara algo
   * que a tela não descreve.
   */
  it('mostra o papel desconhecido pelo token que o contrato entregou', () => {
    comFaseQuePublica([{ atoCodigo: 'EDITAL', papel: 'RETIFICACAO' }]);

    expect(leitura.produtosDaFase(cronograma.fases.at(0))[0].papel).toBe('RETIFICACAO');
  });

  /**
   * A prova do apagamento silencioso: produtos, fase concluinte e parecer
   * individual não são editados neste passo, e a gravação substitui o
   * cronograma inteiro. Fora do formulário, uma simples mudança de data os
   * apagaria — junto com o que a fase produz e com a âncora do recurso, que
   * deles derivam.
   */
  it('reenvia na gravação o que a tela não edita, depois de mexer na janela', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFaseQuePublica([
      { atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' },
      { atoCodigo: 'COMUNICADO', papel: null },
    ]);

    cronograma.fases.at(0).controls.fim.setValue('2026-03-11T18:00');
    detectar();

    const gravacao = componente.persistir();
    const enviadas = controller.expectOne(ROTA_FASES);

    expect(
      (
        enviadas.request.body as {
          produtos: unknown;
          faseConcluinteCodigo: unknown;
          emiteParecerIndividual: unknown;
        }[]
      )[0],
    ).toMatchObject({
      produtos: [
        { atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' },
        { atoCodigo: 'COMUNICADO', papel: null },
      ],
      faseConcluinteCodigo: 'RECURSOS',
      emiteParecerIndividual: true,
    });

    enviadas.flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    await gravouEtapas();
    await gravouExigencias();
    await gravacao;
  });

  /**
   * As bancas requeridas e o recorte que cada uma julga são editados
   * na superfície da fase, e este passo apenas os carrega. A gravação substitui
   * a coleção inteira: sem reenviá-los, mudar uma data desfaria a competência
   * declarada de cada banca.
   */
  it('reenvia na gravação as bancas requeridas com o recorte de cada uma', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFaseQuePublica(
      [{ atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' }],
      [
        { tipoBancaId: ID_BANCA_HETERO, categoriasDocumentoIds: [ID_CATEGORIA_RACA] },
        { tipoBancaId: ID_BANCA_HETERO, categoriasDocumentoIds: [ID_CATEGORIA_RENDA] },
      ],
    );

    cronograma.fases.at(0).controls.fim.setValue('2026-03-11T18:00');
    detectar();

    const gravacao = componente.persistir();
    const enviadas = controller.expectOne(ROTA_FASES);

    expect((enviadas.request.body as { bancasRequeridas: unknown }[])[0].bancasRequeridas).toEqual([
      { tipoBancaId: ID_BANCA_HETERO, categoriasDocumentoIds: [ID_CATEGORIA_RACA] },
      { tipoBancaId: ID_BANCA_HETERO, categoriasDocumentoIds: [ID_CATEGORIA_RENDA] },
    ]);

    enviadas.flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    await gravouEtapas();
    await gravouExigencias();
    await gravacao;
  });

  /** Etapa recusada interrompe o passo: as exigências documentais dependem dela e não vão. */
  it('não tenta gravar as exigências quando as etapas são recusadas', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFases(ID_AVALIACAO);
    comUmaEtapa();

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_FASES).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();

    controller.expectOne(ROTA_ETAPAS).flush(
      {
        type: 'about:blank',
        title: 'Etapa recusada',
        status: 422,
        code: 'uniplus.selecao.etapa_processo.invalida',
        traceId: '00000000000000000000000000000001',
      },
      { status: 422, statusText: 'Unprocessable Content', headers: PROBLEM_JSON },
    );
    await proximoPasso();

    const resultado = await gravacao;
    expect(resultado.valid).toBe(false);
    controller.expectNone(ROTA_DOCUMENTOS);
  });

  /**
   * As duas gravações passaram, mas sem os ids relidos a próxima omitiria o
   * identificador de etapas que já existem. Reportar sucesso aqui deixaria o
   * operador seguir para o estado que a releitura existe para impedir.
   */
  it('recusa a gravação quando não consegue reler as etapas', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFases(ID_AVALIACAO);
    comUmaEtapa();

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_FASES).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    controller.expectOne(ROTA_ETAPAS).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();

    controller.expectOne(ROTA_PROCESSO).flush(
      {
        type: 'about:blank',
        title: 'Indisponível',
        status: 503,
        code: 'uniplus.selecao.indisponivel',
        traceId: '00000000000000000000000000000003',
      },
      { status: 503, statusText: 'Service Unavailable', headers: PROBLEM_JSON },
    );
    await proximoPasso();

    const resultado = await gravacao;
    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.[0]).toContain('Releia as etapas');
    controller.expectNone(ROTA_FASES);
  });

  /**
   * A navegação do wizard é livre: dá para editar outro passo sem gravá-lo e
   * vir gravar o cronograma. Hidratar o processo inteiro aqui apagaria aquele
   * trabalho, por causa de uma gravação que nem era daquele passo.
   */
  it('relê só as etapas, preservando o que outro passo tem sem gravar', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFases(ID_AVALIACAO);
    comUmaEtapa();
    // `nome` é campo que a hidratação completa sobrescreve com o do servidor —
    // é por ele que se enxerga a diferença entre projetar as etapas e projetar
    // o processo inteiro.
    store.patchObjectSection('identificacao', { nome: 'Nome ainda não gravado' });

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_FASES).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    await gravouEtapas();
    await gravouExigencias();

    await gravacao;

    expect(store.draft().cronograma.etapas[0].id).toBe(ID_ETAPA_GRAVADA);
    expect(store.draft().identificacao.nome).toBe('Nome ainda não gravado');
  });
});
