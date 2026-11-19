import { expect, it } from 'vitest';
import {
  type ContextoDoCertame,
  PROCESSO_ID,
  ROTA_FASES,
  ROTA_ETAPAS,
  ROTA_PROCESSO,
  ROTA_DOCUMENTOS,
  ID_AVALIACAO,
  ID_RESULTADO,
  ID_BANCA_HETERO,
  ID_CATEGORIA_RACA,
  PROCESSO_COM_ETAPA_GRAVADA,
  usarFaseECronograma,
} from './fase-e-cronograma.testing';

/**
 * Os dois passos que escrevem a mesma coleção de fases, montados sobre o mesmo
 * rascunho — que é como eles existem na página do wizard.
 *
 * O que se prova aqui não é alcançável testando cada um sozinho: a linha do
 * tempo e a superfície da fase espelham e reescrevem `cronograma.fases`, e a
 * gravação substitui a coleção inteira. Uma reescrita que não respeitasse o que
 * o outro passo acabou de declarar apagaria trabalho sem erro nenhum, e só a
 * releitura do processo revelaria — depois.
 */
describe('a linha do tempo e a superfície da fase sobre o mesmo cronograma', () => {
  let cronograma: ContextoDoCertame['cronograma'];
  let superficie: ContextoDoCertame['superficie'];
  let publicacoes: ContextoDoCertame['publicacoes'];
  let bancas: ContextoDoCertame['bancas'];
  let store: ContextoDoCertame['store'];
  let controller: ContextoDoCertame['controller'];
  let detectar: ContextoDoCertame['detectar'];
  let proximoPasso: ContextoDoCertame['proximoPasso'];
  let comCertame: ContextoDoCertame['comCertame'];

  usarFaseECronograma((tela) => {
    ({
      cronograma,
      superficie,
      publicacoes,
      bancas,
      store,
      controller,
      detectar,
      proximoPasso,
      comCertame,
    } = tela);
  });

  /**
   * O caminho real do operador: ele desenha a linha do tempo, entra na fase
   * para declarar o que ela publica e quem a julga, volta para acertar uma data
   * e grava. Nada do que ele fez em qualquer um dos dois passos pode ficar para
   * trás no corpo que sai.
   */
  it('não perde o que foi declarado num passo quando o outro é editado', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comCertame();

    // 1. Linha do tempo: acerta o fim da primeira fase.
    cronograma.fases.at(0).controls.fim.setValue('2026-03-11T18:00');
    detectar();

    // 2. Superfície da fase: declara o que a segunda publica e quem a julga.
    superficie.abrirFase(ID_RESULTADO);
    detectar();
    publicacoes().acrescentarProduto();
    publicacoes().escolherAto(0, 'RESULTADO_FINAL');
    publicacoes().escolherPapel(0, 'DEFINITIVO');
    bancas().acrescentarBanca();
    bancas().escolherTipoDeBanca(0, ID_BANCA_HETERO);
    bancas().alternarCategoria(0, ID_CATEGORIA_RACA, true);
    detectar();

    // 3. Linha do tempo de novo: acerta o início da segunda fase. A superfície
    //    reescreveu a coleção entre as duas edições; se ela tivesse partido de
    //    uma cópia velha, a mudança do passo 1 sumiria aqui.
    expect(cronograma.fases.at(0).controls.fim.value).toBe('2026-03-11T18:00');
    cronograma.fases.at(1).controls.inicio.setValue('2026-04-02T08:00');
    detectar();

    // A superfície continua mostrando o que declarou, depois de duas reescritas
    // vindas da outra tela.
    expect(publicacoes().produtos).toEqual([{ atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' }]);
    expect(bancas().bancas).toEqual([
      {
        tipoBancaId: ID_BANCA_HETERO,
        categoriasDocumentoIds: [ID_CATEGORIA_RACA],
        regraDeDeliberacao: null,
      },
    ]);

    // 4. Grava pela linha do tempo — é ela que leva as etapas junto.
    const gravacao = cronograma.persistir();

    // O cronograma vai primeiro: a etapa declara a fase e o servidor recusa etapa cuja fase
    // ainda não esteja lá.
    const enviadas = controller.expectOne(ROTA_FASES);
    const corpo = enviadas.request.body as Record<string, unknown>[];

    expect(corpo[0]).toMatchObject({
      faseCanonicaId: ID_AVALIACAO,
      ordem: 1,
      inicio: '2026-03-01T08:00:00-03:00',
      fim: '2026-03-11T18:00:00-03:00',
    });
    expect(corpo[1]).toMatchObject({
      faseCanonicaId: ID_RESULTADO,
      ordem: 2,
      inicio: '2026-04-02T08:00:00-03:00',
      fim: '2026-04-05T18:00:00-03:00',
      produtos: [{ atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' }],
      bancasRequeridas: [
        { tipoBancaId: ID_BANCA_HETERO, categoriasDocumentoIds: [ID_CATEGORIA_RACA] },
      ],
    });

    enviadas.flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    controller.expectOne(ROTA_ETAPAS).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    controller.expectOne(ROTA_PROCESSO).flush(PROCESSO_COM_ETAPA_GRAVADA);
    await proximoPasso();

    // A última gravação do passo: relê as fases para traduzir o código canônico que o
    // rascunho guarda no id que a exigência referencia, e substitui a árvore documental.
    controller.expectOne(ROTA_PROCESSO).flush(PROCESSO_COM_ETAPA_GRAVADA);
    await proximoPasso();
    controller.expectOne(ROTA_DOCUMENTOS).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();

    expect((await gravacao).valid).toBe(true);
  });

  /**
   * A linha em branco nasce no rascunho no instante em que o operador clica em
   * "Acrescentar publicação", e a gravação do cronograma substitui a coleção
   * inteira. A conferência da linha do tempo precisa cobrar o que a superfície
   * deixou pela metade: sem isso, mexer numa data manda a publicação sem ato ao
   * servidor, e a recusa volta falando de um campo que aquele passo não mostra.
   */
  it('recusa gravar pela linha do tempo a publicação que a fase deixou sem ato', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comCertame();

    publicacoes().acrescentarProduto();
    detectar();

    cronograma.fases.at(0).controls.fim.setValue('2026-03-11T18:00');
    detectar();

    const resultado = await cronograma.persistir();

    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.join(' ')).toContain('Escolha o tipo de ato');
    expect(resultado.messages?.join(' ')).toContain('Configuração por fase');
    controller.expectNone(ROTA_FASES);
    controller.expectNone(ROTA_ETAPAS);
  });

  it('recusa gravar pela linha do tempo a banca que a fase deixou sem tipo', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comCertame();

    bancas().acrescentarBanca();
    detectar();

    const resultado = await cronograma.persistir();

    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.join(' ')).toContain('Escolha o tipo de cada banca requerida');
    controller.expectNone(ROTA_FASES);
  });

  /**
   * "Cabe recurso" marcado sem regra nem prazo: `comoComandoDeFase` converteria
   * o prazo vazio em zero e mandaria a unidade em branco, e o servidor recusaria
   * a gravação inteira por causa de um campo que a linha do tempo não edita.
   */
  it('recusa gravar pela linha do tempo o recurso declarado pela metade', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comCertame();

    superficie.formulario()?.controls.admiteRecurso.setValue(true);
    detectar();

    const resultado = await cronograma.persistir();

    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.join(' ')).toContain('prazo de interposição');
    controller.expectNone(ROTA_FASES);
  });
});
