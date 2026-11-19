import { expect, it } from 'vitest';
import {
  PROCESSO_ID,
  ROTA_ETAPAS,
  ROTA_FASES,
  ROTA_PROCESSO,
  ID_ETAPA_GRAVADA,
  PROBLEM_JSON,
  ID_AVALIACAO,
  PROCESSO_COM_ETAPA_GRAVADA,
} from './cronograma.testing';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';

describe('CronogramaPassoComponent: gravação', () => {
  let componente: ContextoDoCronograma['componente'];
  let raiz: ContextoDoCronograma['raiz'];
  let cronograma: ContextoDoCronograma['cronograma'];
  let releituraDasEtapas: ContextoDoCronograma['releituraDasEtapas'];
  let store: ContextoDoCronograma['store'];
  let controller: ContextoDoCronograma['controller'];
  let detectar: ContextoDoCronograma['detectar'];
  let proximoPasso: ContextoDoCronograma['proximoPasso'];
  let gravouExigencias: ContextoDoCronograma['gravouExigencias'];
  let comFases: ContextoDoCronograma['comFases'];
  let comUmaEtapa: ContextoDoCronograma['comUmaEtapa'];

  usarCronograma((tela) => {
    ({
      componente,
      raiz,
      cronograma,
      releituraDasEtapas,
      store,
      controller,
      detectar,
      proximoPasso,
      gravouExigencias,
      comFases,
      comUmaEtapa,
    } = tela);
  });

  /**
   * A etapa declara a fase em que acontece, e o servidor recusa etapa cuja fase ainda não esteja
   * no cronograma. Quem monta um certame do zero — nenhuma fase gravada — não conseguiria
   * gravar etapa nenhuma na ordem inversa.
   */
  it('grava o cronograma de fases antes das etapas', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFases(ID_AVALIACAO);
    comUmaEtapa();

    const gravacao = componente.persistir();

    const fases = controller.expectOne(ROTA_FASES);
    expect(fases.request.method).toBe('PUT');
    controller.expectNone(ROTA_ETAPAS);
    fases.flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();

    const etapas = controller.expectOne(ROTA_ETAPAS);
    expect(etapas.request.method).toBe('PUT');
    etapas.flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();

    // A gravação de etapas responde 204 sem corpo, e o `id` de uma etapa nova é
    // atribuído pelo servidor: a releitura vem logo em seguida para recolhê-los.
    const releitura = controller.expectOne(ROTA_PROCESSO);
    expect(releitura.request.method).toBe('GET');
    releitura.flush(PROCESSO_COM_ETAPA_GRAVADA);
    await proximoPasso();
    await gravouExigencias();

    await expect(gravacao).resolves.toEqual({ valid: true });
    expect(store.draft().cronograma.etapas[0].id).toBe(ID_ETAPA_GRAVADA);
  });

  it('a recusa do servidor à etapa de nota do ENEM chega com texto próprio', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFases(ID_AVALIACAO);
    comUmaEtapa();

    const gravacao = componente.persistir();

    controller.expectOne(ROTA_FASES).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    controller.expectOne(ROTA_ETAPAS).flush(
      {
        type: 'about:blank',
        title: 'Etapa de nota do ENEM não admite banca',
        status: 422,
        code: 'uniplus.selecao.processo_seletivo.etapa_nota_enem_com_banca',
        traceId: '00000000000000000000000000000005',
      },
      { status: 422, statusText: 'Unprocessable Content', headers: PROBLEM_JSON },
    );

    const resultado = await gravacao;
    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.join(' ')).toContain('quem julga o recurso');
  });

  it('mantém o texto da recusa do ENEM da raiz mesmo com erros de campo', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFases(ID_AVALIACAO);
    comUmaEtapa();

    const gravacao = componente.persistir();

    controller.expectOne(ROTA_FASES).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    controller.expectOne(ROTA_ETAPAS).flush(
      {
        type: 'about:blank',
        title: 'Validação',
        status: 422,
        code: 'uniplus.selecao.processo_seletivo.etapa_nota_enem_com_banca',
        traceId: '00000000000000000000000000000007',
        errors: [
          {
            field: 'etapas[0].notaMaxima',
            code: 'uniplus.selecao.etapa_processo.nota_maxima_invalida',
            message: 'x',
          },
        ],
      },
      { status: 422, statusText: 'Unprocessable Content', headers: PROBLEM_JSON },
    );

    const resultado = await gravacao;
    const texto = resultado.messages?.join(' ');
    expect(texto).toContain('quem julga o recurso');
    expect(texto).toContain('Prova objetiva: A nota máxima precisa ser maior que zero.');
  });

  /**
   * O cronograma vem primeiro: recusado ele, as etapas não chegam a ser enviadas. É o que
   * evita deixar no servidor etapas apontando para uma fase que a recusa impediu de existir —
   * e é por isso que o rascunho segue sem os identificadores que só a gravação atribui.
   */
  it('não envia as etapas quando o cronograma é recusado', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFases(ID_AVALIACAO);
    comUmaEtapa();

    const gravacao = componente.persistir();

    controller.expectOne(ROTA_FASES).flush(
      {
        type: 'about:blank',
        title: 'Cronograma recusado',
        status: 422,
        code: 'uniplus.selecao.fase_cronograma.invalida',
        traceId: '00000000000000000000000000000004',
      },
      { status: 422, statusText: 'Unprocessable Content', headers: PROBLEM_JSON },
    );
    await proximoPasso();
    controller.expectNone(ROTA_ETAPAS);

    const resultado = await gravacao;
    expect(resultado.valid).toBe(false);
    expect(
      store.draft().cronograma.etapas[0].id,
      'sem gravação de etapas não há identificador a recolher',
    ).toBeNull();
  });

  /**
   * O cenário que corrompe: o `PUT` das etapas passa, a releitura que recolheria
   * os identificadores não vem, e o botão de gravar volta a ficar disponível.
   * Sem o bloqueio, a segunda gravação reenvia etapas que já existem sem o
   * `id`, e o servidor cria outras no lugar — deixando desempate e eliminação
   * apontando para as que deixaram de existir.
   */
  it('recusa nova gravação enquanto as etapas gravadas estão sem identificador', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFases(ID_AVALIACAO);
    comUmaEtapa();

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_FASES).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    controller.expectOne(ROTA_ETAPAS).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    controller
      .expectOne(ROTA_PROCESSO)
      .flush(null, { status: 503, statusText: 'Service Unavailable' });
    await proximoPasso();

    const primeira = await gravacao;
    expect(primeira.valid).toBe(false);
    expect(primeira.messages?.[0]).toContain('identificadores');
    expect(store.draft().cronograma.etapas[0].id).toBeNull();

    const segunda = await componente.persistir();

    expect(segunda.valid).toBe(false);
    // A prova do bug: sem o bloqueio, esta segunda gravação teria enviado as
    // etapas de novo — sem `id`, porque a releitura nunca chegou.
    controller.expectNone(ROTA_ETAPAS);
    controller.expectNone(ROTA_FASES);
  });

  it('suspende a edição enquanto a releitura não recolhe os identificadores', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFases(ID_AVALIACAO);
    comUmaEtapa();

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_FASES).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    controller.expectOne(ROTA_ETAPAS).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    controller
      .expectOne(ROTA_PROCESSO)
      .flush(null, { status: 503, statusText: 'Service Unavailable' });
    await proximoPasso();
    await gravacao;
    detectar();

    expect(cronograma.edicaoLiberada()).toBe(false);
    expect(cronograma.formulario.disabled).toBe(true);
  });

  /**
   * A saída fica no próprio passo: refeita a releitura, os identificadores
   * chegam ao rascunho e a gravação seguinte os envia — que é o que impede a
   * recriação de acontecer mais tarde.
   */
  it('releitura bem-sucedida destrava a tela e a gravação seguinte leva o identificador', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFases(ID_AVALIACAO);
    comUmaEtapa();

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_FASES).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    controller.expectOne(ROTA_ETAPAS).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    controller
      .expectOne(ROTA_PROCESSO)
      .flush(null, { status: 503, statusText: 'Service Unavailable' });
    await proximoPasso();
    await gravacao;

    const releitura = releituraDasEtapas.relerEtapas();
    controller.expectOne(ROTA_PROCESSO).flush(PROCESSO_COM_ETAPA_GRAVADA);
    await releitura;
    detectar();

    expect(releituraDasEtapas.releituraPendente()).toBe(false);
    expect(cronograma.edicaoLiberada()).toBe(true);
    expect(store.draft().cronograma.etapas[0].id).toBe(ID_ETAPA_GRAVADA);

    const segunda = componente.persistir();
    controller.expectOne(ROTA_FASES).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    const reenvio = controller.expectOne(ROTA_ETAPAS);
    expect((reenvio.request.body as { id: string | null }[])[0].id).toBe(ID_ETAPA_GRAVADA);
    reenvio.flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    controller.expectOne(ROTA_PROCESSO).flush(PROCESSO_COM_ETAPA_GRAVADA);
    await proximoPasso();
    await gravouExigencias();
    await segunda;
  });

  it('a releitura que falha mantém o bloqueio, com o motivo e a nova tentativa', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    releituraDasEtapas.releituraPendente.set(true);
    detectar();
    const tela = (): HTMLElement => raiz.nativeElement as HTMLElement;
    const alerta = (): string => tela().textContent ?? '';
    expect(alerta()).toContain('a edição fica suspensa');

    const tentar = Array.from(tela().querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Tentar novamente'),
    );
    tentar?.click();
    controller
      .expectOne(ROTA_PROCESSO)
      .flush(null, { status: 503, statusText: 'Service Unavailable' });
    await proximoPasso();
    detectar();

    expect(releituraDasEtapas.releituraPendente()).toBe(true);
    expect(alerta()).toContain('Não foi possível reler as etapas agora');
  });

  /**
   * O bloqueio pertence ao processo que o provocou. Outro cadastro entrando na
   * tela recomeça do que o servidor disser sobre ele.
   */
  it('troca de processo desfaz o bloqueio da releitura', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFases(ID_AVALIACAO);
    comUmaEtapa();

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_FASES).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    controller.expectOne(ROTA_ETAPAS).flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    controller
      .expectOne(ROTA_PROCESSO)
      .flush(null, { status: 503, statusText: 'Service Unavailable' });
    await proximoPasso();
    await gravacao;

    store.reset();
    detectar();

    expect(releituraDasEtapas.releituraPendente()).toBe(false);
  });
});
