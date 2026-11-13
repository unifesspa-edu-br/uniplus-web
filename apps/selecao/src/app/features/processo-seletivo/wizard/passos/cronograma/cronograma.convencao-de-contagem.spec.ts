import { expect, it } from 'vitest';
import {
  PROCESSO_ID,
  ROTA_ETAPAS,
  ROTA_FASES,
  ROTA_ALGORITMO,
  ROTA_PROCESSO,
  PROBLEM_JSON,
  ID_INSCRICAO,
  PROCESSO_COM_ETAPA_GRAVADA,
} from './cronograma.testing';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';

describe('CronogramaPassoComponent: convenção de contagem', () => {
  let componente: ContextoDoCronograma['componente'];
  let cronograma: ContextoDoCronograma['cronograma'];
  let store: ContextoDoCronograma['store'];
  let controller: ContextoDoCronograma['controller'];
  let detectar: ContextoDoCronograma['detectar'];
  let nativo: ContextoDoCronograma['nativo'];
  let convencao: ContextoDoCronograma['convencao'];
  let proximoPasso: ContextoDoCronograma['proximoPasso'];
  let gravouExigencias: ContextoDoCronograma['gravouExigencias'];
  let gravouEtapas: ContextoDoCronograma['gravouEtapas'];
  let comFases: ContextoDoCronograma['comFases'];
  let opcoesDaConvencao: ContextoDoCronograma['opcoesDaConvencao'];

  usarCronograma((tela) => {
    ({
      componente,
      cronograma,
      store,
      controller,
      detectar,
      nativo,
      convencao,
      proximoPasso,
      gravouExigencias,
      gravouEtapas,
      comFases,
      opcoesDaConvencao,
    } = tela);
  });

  // ─── Convenção de contagem de prazo ──────────────────────────────

  /** Ausência é estado válido enquanto rascunho — nenhum default. */
  it('não pré-seleciona nenhuma convenção de contagem de prazo', () => {
    expect(cronograma.formulario.controls.algoritmoContagemCodigo.value).toBe('');
    expect(cronograma.formulario.controls.algoritmoContagemVersao.value).toBe('');
    expect(nativo.querySelector<HTMLSelectElement>('#cr-algoritmo-contagem')?.value ?? '').toBe('');
  });

  /**
   * O endpoint não tem operação de remoção — `DefinirAlgoritmoContagemPrazoRequest`
   * exige `codigo` e `versao`. Enquanto nada foi declarado, a opção continua
   * disponível: é o caminho normal para a primeira escolha.
   */
  it('não esconde a opção de remover enquanto a escolha ainda não foi gravada', () => {
    convencao().escolherAlgoritmo('CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL');
    detectar();

    expect(opcoesDaConvencao()).toContain('');
  });

  /**
   * A prova do defeito coberto: sem esconder a opção, o operador
   * escolhia "Nenhuma convenção declarada" sobre um processo que já tinha
   * convenção no servidor, `persistir()` pulava a terceira chamada em
   * silêncio e devolvia sucesso — a tela passava a mostrar "nenhuma" enquanto
   * o servidor continuava com a convenção anterior, e a divergência só
   * aparecia ao recarregar o processo.
   */
  it('esconde a opção de remover a convenção depois que ela chega declarada do servidor', () => {
    // `remoteSnapshot`, não `patchObjectSection`: é a última leitura completa
    // do servidor, não uma escrita local — molde de
    // `pagamento.component.spec.ts:511` e `anexo-edital.component.spec.ts:332`.
    store.remoteSnapshot.set({
      algoritmoContagemPrazo: { codigo: 'CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL', versao: 'v1' },
    } as never);
    detectar();

    expect(opcoesDaConvencao()).not.toContain('');
  });

  it('esconde a opção de remover a convenção logo após gravá-la nesta sessão', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFases(ID_INSCRICAO);
    convencao().escolherAlgoritmo('CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL');
    detectar();

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_FASES).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    await gravouEtapas();
    await gravouExigencias();
    controller.expectOne(ROTA_ALGORITMO).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    await gravacao;
    detectar();

    expect(opcoesDaConvencao()).not.toContain('');
  });

  /**
   * Falha na terceira chamada não confirma nada no servidor — a opção de
   * "nenhuma" continua disponível para a retentativa, exatamente como antes.
   */
  it('mantém a opção de remover disponível quando a gravação da convenção falha', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFases(ID_INSCRICAO);
    convencao().escolherAlgoritmo('CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL');
    detectar();

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_FASES).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    await gravouEtapas();
    await gravouExigencias();
    controller.expectOne(ROTA_ALGORITMO).flush(
      {
        type: 'about:blank',
        title: 'Convenção de contagem recusada',
        status: 422,
        code: 'uniplus.selecao.algoritmo_contagem_prazo.invalido',
        traceId: '00000000000000000000000000000006',
      },
      { status: 422, statusText: 'Unprocessable Content', headers: PROBLEM_JSON },
    );
    await proximoPasso();
    await gravacao;
    detectar();

    expect(opcoesDaConvencao()).toContain('');
  });

  /**
   * O `RegraCatalogoDto` não tem `nome` nem `descricao` — inventar um mapa código→rótulo no
   * frontend contradiz o contrato: ele não inventa rótulo. A opção mostra o código e a versão, que são o que
   * identifica a convenção; a base legal saiu do rótulo porque as três convenções de
   * contagem do catálogo têm a MESMA, com quatrocentos e sessenta e nove caracteres, e
   * repeti-la em cada linha empurrava o código para fora da largura do campo.
   */
  it('oferece cada convenção do catálogo pelo código e pela versão', () => {
    expect(convencao().regrasDeContagem()).toContainEqual({
      codigo: 'CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL',
      versao: 'v1',
      baseLegal: 'Lei 9.784/1999, art. 66',
    });
    expect(nativo.textContent ?? '').toContain('CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL (v1)');
    expect(nativo.textContent ?? '').not.toContain(
      'CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL (v1) — Lei 9.784/1999, art. 66',
    );
  });

  /**
   * O que separa uma convenção da outra são os invariantes que o catálogo publica — cada um
   * descreve um caso, com o exemplo do resultado. Aparecem depois da escolha, porque
   * descrevem a convenção escolhida, não as disponíveis.
   */
  it('mostra o que a convenção escolhida faz, na prosa do catálogo', () => {
    expect(convencao().invariantesDaContagem(), 'sem escolha, não há o que descrever').toEqual([]);

    convencao().escolherAlgoritmo('CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL');
    detectar();

    expect(convencao().invariantesDaContagem()).toEqual([
      'o dia da âncora não conta',
      'em horas, a contagem começa no primeiro dia útil seguinte',
    ]);
    expect(convencao().baseLegalDaContagem()).toBe('Lei 9.784/1999, art. 66');
    expect(nativo.textContent ?? '').toContain('O que esta convenção faz');
    expect(nativo.textContent ?? '').toContain('o dia da âncora não conta');
  });

  /** Catálogo que não publica invariante nenhum não ganha uma seção vazia. */
  it('esconde a descrição quando o catálogo não publica invariante', () => {
    convencao().escolherAlgoritmo('SEM-INVARIANTE');
    detectar();

    expect(convencao().invariantesDaContagem()).toEqual([]);
    expect(nativo.textContent ?? '').not.toContain('O que esta convenção faz');
  });

  /**
   * A convenção é identificada por código **e** versão. Escolher pelo código
   * e deduzir a versão do catálogo carregado é o que mantém o par coerente —
   * gravar código novo com versão velha é recusado pelo servidor.
   */
  it('escolher a convenção grava código e versão juntos no rascunho', () => {
    convencao().escolherAlgoritmo('CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL');
    detectar();

    expect(store.draft().cronograma.algoritmoContagemCodigo).toBe(
      'CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL',
    );
    expect(store.draft().cronograma.algoritmoContagemVersao).toBe('v1');
  });

  /** Hidratação: o rascunho que chega de fora aparece refletido na tela. */
  it('espelha no formulário a convenção de contagem que chega ao rascunho', () => {
    store.patchObjectSection('cronograma', {
      algoritmoContagemCodigo: 'CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL',
      algoritmoContagemVersao: 'v1',
    });
    detectar();

    expect(cronograma.formulario.controls.algoritmoContagemCodigo.value).toBe(
      'CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL',
    );
    expect(cronograma.formulario.controls.algoritmoContagemVersao.value).toBe('v1');
  });

  /**
   * O algoritmo é a terceira gravação, e só acontece quando há escolha
   * As etapas e o cronograma de fases já foram gravados quando o
   * `PUT` do algoritmo sai.
   */
  it('grava a convenção de contagem depois das etapas e do cronograma de fases', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFases(ID_INSCRICAO);
    convencao().escolherAlgoritmo('CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL');
    detectar();

    const gravacao = componente.persistir();

    const fases = controller.expectOne(ROTA_FASES);
    controller.expectNone(ROTA_ALGORITMO);
    fases.flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();

    const etapas = controller.expectOne(ROTA_ETAPAS);
    controller.expectNone(ROTA_ALGORITMO);
    etapas.flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();

    controller.expectOne(ROTA_PROCESSO).flush(PROCESSO_COM_ETAPA_GRAVADA);
    await proximoPasso();
    await gravouExigencias();

    const algoritmo = controller.expectOne(ROTA_ALGORITMO);
    expect(algoritmo.request.method).toBe('PUT');
    expect(algoritmo.request.body).toEqual({
      codigo: 'CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL',
      versao: 'v1',
    });
    algoritmo.flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();

    await expect(gravacao).resolves.toEqual({ valid: true });
  });

  /** Sem escolha, a terceira chamada simplesmente não acontece. */
  it('não grava convenção de contagem quando nenhuma foi escolhida', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFases(ID_INSCRICAO);

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_FASES).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    await gravouEtapas();
    await gravouExigencias();

    controller.expectNone(ROTA_ALGORITMO);
    await expect(gravacao).resolves.toEqual({ valid: true });
  });

  /**
   * Se a última chamada falhar, as duas primeiras já gravaram — a
   * mensagem tem de dizer isso, não "não foi possível concluir a operação".
   */
  it('diz que etapas e cronograma já gravaram quando só a convenção falha', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFases(ID_INSCRICAO);
    convencao().escolherAlgoritmo('CONTAGEM-PRAZO-EXCLUI-DIA-INICIAL');
    detectar();

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_FASES).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    await gravouEtapas();
    await gravouExigencias();

    controller.expectOne(ROTA_ALGORITMO).flush(
      {
        type: 'about:blank',
        title: 'Convenção de contagem recusada',
        status: 422,
        code: 'uniplus.selecao.algoritmo_contagem_prazo.invalido',
        traceId: '00000000000000000000000000000005',
      },
      { status: 422, statusText: 'Unprocessable Content', headers: PROBLEM_JSON },
    );
    await proximoPasso();

    const resultado = await gravacao;
    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.[0]).toContain('etapas e o cronograma de fases foram gravados');
    expect(resultado.messages?.[0]).toContain('Convenção de contagem recusada');
  });
});
