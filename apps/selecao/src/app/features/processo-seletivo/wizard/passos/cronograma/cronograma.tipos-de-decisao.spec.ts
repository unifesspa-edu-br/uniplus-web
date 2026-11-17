import { describe, expect, it } from 'vitest';

import {
  ID_AVALIACAO,
  TIPO_ETAPA_NOTA_ENEM,
  PROBLEM_JSON,
  PROCESSO_COM_ETAPA_GRAVADA,
  PROCESSO_ID,
  ROTA_ETAPAS,
  ROTA_FASES,
  ROTA_PROCESSO,
} from './cronograma.testing';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';

const CODIGO_TIPO_INVALIDO = 'uniplus.selecao.motivo_de_decisao.tipo_invalido';
const CODIGO_TIPO_DUPLICADO = 'uniplus.selecao.motivo_de_decisao.tipo_de_decisao_duplicado';
const CODIGO_PROCEDIMENTO_DA_FASE =
  'uniplus.selecao.regra_recurso_fase.procedimento_para_decisao_nao_declarada';
const CODIGO_PROCEDIMENTO_DA_ETAPA =
  'uniplus.selecao.recurso_da_etapa.procedimento_para_decisao_nao_declarada';
const SEM_CONTEUDO = { status: 204, statusText: 'No Content' };

describe('CronogramaPassoComponent: tipos de decisão da etapa', () => {
  let componente: ContextoDoCronograma['componente'];
  let expansao: ContextoDoCronograma['expansao'];
  let edicao: ContextoDoCronograma['edicao'];
  let cronograma: ContextoDoCronograma['cronograma'];
  let store: ContextoDoCronograma['store'];
  let controller: ContextoDoCronograma['controller'];
  let detectar: ContextoDoCronograma['detectar'];
  let nativo: ContextoDoCronograma['nativo'];
  let proximoPasso: ContextoDoCronograma['proximoPasso'];
  let gravouExigencias: ContextoDoCronograma['gravouExigencias'];
  let comFases: ContextoDoCronograma['comFases'];
  let comEtapasEmFases: ContextoDoCronograma['comEtapasEmFases'];

  usarCronograma((tela) => {
    ({
      componente,
      expansao,
      edicao,
      cronograma,
      store,
      controller,
      detectar,
      nativo,
      proximoPasso,
      gravouExigencias,
      comFases,
      comEtapasEmFases,
    } = tela);
  });

  function comEtapaAberta(): void {
    comFases(ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO']);
    expansao.alternarFase(0);
    expansao.alternarEtapa(0);
    detectar();
  }

  const caixa = (codigo: string) =>
    nativo.querySelector<HTMLInputElement>(`#cr-etapa-tipos-0-${codigo}`) as HTMLInputElement;

  function marcar(codigo: string): void {
    caixa(codigo).checked = true;
    caixa(codigo).dispatchEvent(new Event('change'));
    detectar();
  }

  async function recusarEm(rota: string, erros: readonly { field: string; code: string }[]) {
    store.processoSeletivoId.set(PROCESSO_ID);
    const gravacao = componente.persistir();
    if (rota === ROTA_ETAPAS) {
      controller.expectOne(ROTA_FASES).flush(null, SEM_CONTEUDO);
      await proximoPasso();
    }
    controller.expectOne(rota).flush(
      {
        type: 'about:blank',
        title: 'Validação',
        status: 422,
        code: 'uniplus.validacao',
        traceId: '00000000000000000000000000000009',
        errors: erros.map((erro) => ({ ...erro, message: 'detalhe do servidor' })),
      },
      { status: 422, statusText: 'Unprocessable Content', headers: PROBLEM_JSON },
    );
    return gravacao;
  }

  it('oferece a declaração dos tipos de decisão na etapa aberta, com legenda e dica', () => {
    comEtapaAberta();

    const grupo = nativo.querySelector('sel-tipos-de-decisao-da-fase-ou-etapa');
    expect(grupo?.querySelector('legend')?.textContent).toContain('Decisões que esta etapa toma');
    expect(nativo.querySelector('#cr-etapa-tipos-0-ajuda')).not.toBeNull();
  });

  it('mostra marcado o tipo que a etapa já declara', () => {
    comFases(ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO']);
    cronograma.etapas.at(0).controls.tiposDeDecisao.setValue(['NOTA_DA_ETAPA']);
    expansao.alternarFase(0);
    expansao.alternarEtapa(0);
    detectar();

    expect(caixa('NOTA_DA_ETAPA').checked).toBe(true);
    expect(caixa('CLASSIFICACAO').checked).toBe(false);
  });

  it('oferece a declaração também na etapa de nota do ENEM', () => {
    comFases(ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO']);
    edicao.escolherTipoEtapa(cronograma.etapas.at(0), TIPO_ETAPA_NOTA_ENEM);
    expansao.alternarFase(0);
    expansao.alternarEtapa(0);
    detectar();

    expect(caixa('NOTA_DA_ETAPA')).not.toBeNull();
  });

  it('leva os tipos da etapa nova, ainda sem identificador, no envio das etapas', async () => {
    comEtapaAberta();
    marcar('NOTA_DA_ETAPA');
    marcar('GABARITO_DA_PROVA');
    expect(cronograma.etapas.at(0).controls.id.value).toBeNull();
    store.processoSeletivoId.set(PROCESSO_ID);

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_FASES).flush(null, SEM_CONTEUDO);
    await proximoPasso();
    const enviadas = controller.expectOne(ROTA_ETAPAS);

    expect((enviadas.request.body as { tiposDeDecisao: unknown }[])[0].tiposDeDecisao).toEqual([
      'GABARITO_DA_PROVA',
      'NOTA_DA_ETAPA',
    ]);
    enviadas.flush(null, SEM_CONTEUDO);
    await proximoPasso();
    controller.expectOne(ROTA_PROCESSO).flush(PROCESSO_COM_ETAPA_GRAVADA);
    await proximoPasso();
    await gravouExigencias();
    await gravacao;
  });

  it('envia em ordem alfabética, sem tocar nas caixas, a lista que chegou fora de ordem com código desconhecido', async () => {
    comEtapaAberta();
    const fora = ['NOTA_DA_ETAPA', 'TIPO_DO_FUTURO', 'CLASSIFICACAO'];
    cronograma.fases.at(0).controls.tiposDeDecisao.setValue(fora);
    cronograma.etapas.at(0).controls.tiposDeDecisao.setValue(fora);
    store.processoSeletivoId.set(PROCESSO_ID);

    const gravacao = componente.persistir();
    const fases = controller.expectOne(ROTA_FASES);
    const dasFases = (fases.request.body as { tiposDeDecisao: unknown }[])[0].tiposDeDecisao;
    fases.flush(null, SEM_CONTEUDO);
    await proximoPasso();
    const etapas = controller.expectOne(ROTA_ETAPAS);
    const dasEtapas = (etapas.request.body as { tiposDeDecisao: unknown }[])[0].tiposDeDecisao;
    etapas.flush(null, SEM_CONTEUDO);
    await proximoPasso();
    controller.expectOne(ROTA_PROCESSO).flush(PROCESSO_COM_ETAPA_GRAVADA);
    await proximoPasso();
    await gravouExigencias();
    await gravacao;

    const ordenados = ['CLASSIFICACAO', 'NOTA_DA_ETAPA', 'TIPO_DO_FUTURO'];
    expect(dasFases).toEqual(ordenados);
    expect(dasEtapas).toEqual(ordenados);
  });

  it('diz no resumo, com o nome da etapa, que o tipo enviado não é reconhecido', async () => {
    comEtapaAberta();

    const resultado = await recusarEm(ROTA_ETAPAS, [
      { field: 'etapas[0].tiposDeDecisao[0]', code: CODIGO_TIPO_INVALIDO },
    ]);

    expect(resultado.messages).toEqual([
      'Etapa 1: Um tipo de decisão enviado não é reconhecido pelo servidor.',
    ]);
  });

  it('diz no resumo que o mesmo tipo foi enviado mais de uma vez', async () => {
    comEtapaAberta();

    const resultado = await recusarEm(ROTA_ETAPAS, [
      { field: 'etapas[0].tiposDeDecisao[1]', code: CODIGO_TIPO_DUPLICADO },
    ]);

    expect(resultado.messages).toEqual([
      'Etapa 1: O mesmo tipo de decisão foi enviado mais de uma vez.',
    ]);
  });

  it('orienta a marcar o tipo de novo quando o recurso da etapa ainda tem procedimento para ele', async () => {
    comEtapaAberta();

    const resultado = await recusarEm(ROTA_ETAPAS, [
      { field: 'etapas[0].recursos[0]', code: CODIGO_PROCEDIMENTO_DA_ETAPA },
    ]);

    expect(resultado.messages).toEqual([
      'Etapa 1: O recurso tem procedimento para uma decisão que deixou de ser declarada aqui; marque o tipo de novo.',
    ]);
  });

  it('orienta a marcar o tipo de novo quando a regra de recurso da fase ainda tem procedimento para ele', async () => {
    comEtapaAberta();

    const resultado = await recusarEm(ROTA_FASES, [
      { field: 'fases[0].regraRecurso', code: CODIGO_PROCEDIMENTO_DA_FASE },
    ]);

    expect(resultado.messages).toEqual([
      'Fase 1: O recurso tem procedimento para uma decisão que deixou de ser declarada aqui; marque o tipo de novo.',
    ]);
  });

  it('diz no resumo, com o número da fase, que o tipo da fase não é reconhecido', async () => {
    comEtapaAberta();

    const resultado = await recusarEm(ROTA_FASES, [
      { field: 'fases[0].tiposDeDecisao[0]', code: CODIGO_TIPO_INVALIDO },
    ]);

    expect(resultado.messages).toEqual([
      'Fase 1: Um tipo de decisão enviado não é reconhecido pelo servidor.',
    ]);
  });
});
