import { expect, it } from 'vitest';
import {
  PROCESSO_ID,
  ROTA_ETAPAS,
  ROTA_FASES,
  PROBLEM_JSON,
  CICLO_DE_ORDEM,
  ID_INSCRICAO,
  ID_AVALIACAO,
} from './cronograma.testing';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';

describe('CronogramaPassoComponent: remoção e ordem das fases', () => {
  let componente: ContextoDoCronograma['componente'];
  let expansao: ContextoDoCronograma['expansao'];
  let cronograma: ContextoDoCronograma['cronograma'];
  let store: ContextoDoCronograma['store'];
  let controller: ContextoDoCronograma['controller'];
  let detectar: ContextoDoCronograma['detectar'];
  let nativo: ContextoDoCronograma['nativo'];
  let proximoPasso: ContextoDoCronograma['proximoPasso'];
  let gravouExigencias: ContextoDoCronograma['gravouExigencias'];
  let gravouEtapas: ContextoDoCronograma['gravouEtapas'];
  let ordensDe: ContextoDoCronograma['ordensDe'];
  let comFases: ContextoDoCronograma['comFases'];
  let comEtapasEmFases: ContextoDoCronograma['comEtapasEmFases'];
  let comUmaEtapa: ContextoDoCronograma['comUmaEtapa'];

  usarCronograma((tela) => {
    ({
      componente,
      expansao,
      cronograma,
      store,
      controller,
      detectar,
      nativo,
      proximoPasso,
      gravouExigencias,
      gravouEtapas,
      ordensDe,
      comFases,
      comEtapasEmFases,
      comUmaEtapa,
    } = tela);
  });

  /**
   * A etapa existe por causa da fase em que acontece: some a fase, some ela. O que a
   * gravação recusava antes — etapa apontando para uma fase que não está mais no cronograma
   * — deixa de poder acontecer.
   */
  it('remover a fase leva junto as etapas que declaram acontecer nela', () => {
    comFases(ID_INSCRICAO, ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO']);

    cronograma.removerFase(1);

    expect(store.draft().cronograma.fases).toHaveLength(1);
    expect(store.draft().cronograma.etapas).toEqual([]);
  });

  /**
   * O defeito que existia: remover a fase que o cadastro marca como agrupadora limpava todas
   * as etapas do processo, inclusive as das outras fases.
   */
  it('remover a fase não toca nas etapas das outras', () => {
    comFases(ID_INSCRICAO, ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO', 'INSCRICAO', 'INSCRICAO']);

    cronograma.removerFase(1);

    expect(store.draft().cronograma.etapas).toHaveLength(2);
    expect(store.draft().cronograma.etapas.map((e) => e.faseCodigo)).toEqual([
      'INSCRICAO',
      'INSCRICAO',
    ]);
  });

  /** Etapa que não declara fase nenhuma não pertence a nenhuma, e não sai com a remoção. */
  it('remover a fase preserva a etapa que não declara fase', () => {
    comFases(ID_AVALIACAO, ID_INSCRICAO);
    comUmaEtapa();

    cronograma.removerFase(1);

    expect(store.draft().cronograma.etapas).toHaveLength(1);
  });

  it('conta o que a remoção leva junto antes de acontecer', () => {
    comFases(ID_INSCRICAO, ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO', 'AVALIACAO']);

    expansao.pedirRemocaoDaFase(1);
    detectar();

    expect(expansao.remocaoAConfirmar()).toBe(1);
    expect(expansao.resumoDaRemocao(1)).toBe('2 etapas');
    expect(store.draft().cronograma.fases, 'nada sai antes de confirmar').toHaveLength(2);
    expect(nativo.textContent).toContain('apaga também 2 etapas desta fase');
  });

  /** Sem nada pendurado não há o que avisar: perguntar seria cerimônia vazia. */
  it('remove direto a fase que não tem etapa nem documento', () => {
    comFases(ID_INSCRICAO, ID_AVALIACAO);

    expansao.pedirRemocaoDaFase(1);

    expect(expansao.remocaoAConfirmar()).toBeNull();
    expect(store.draft().cronograma.fases).toHaveLength(1);
  });

  it('desistir da remoção mantém a fase e o que é dela', () => {
    comFases(ID_INSCRICAO, ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO']);

    expansao.pedirRemocaoDaFase(1);
    expansao.desistirDaRemocao();

    expect(store.draft().cronograma.fases).toHaveLength(2);
    expect(store.draft().cronograma.etapas).toHaveLength(1);
  });

  /**
   * Toda troca entre fases vizinhas forma o ciclo de ordem que o servidor não
   * aplica numa chamada só. Recusar aqui deixaria a linha do tempo impossível
   * de reordenar — o rascunho aceita, e quem arbitra é a gravação.
   */
  it('reordena no rascunho, renumerando a partir de 1', () => {
    comFases(ID_INSCRICAO, ID_AVALIACAO);

    cronograma.mover(0, 1);

    const depois = store.draft().cronograma.fases;
    expect(depois.map((fase) => fase.faseCanonicaId)).toEqual([ID_AVALIACAO, ID_INSCRICAO]);
    expect(depois.map((fase) => fase.ordem)).toEqual([1, 2]);
  });

  /**
   * Toda reordenação é uma permutação de 1..N, e toda permutação não-trivial
   * fecha o ciclo que o servidor recusa numa chamada só. Mandar o operador
   * "mover uma para o fim" não resolvia: renumerar devolve 1..N e o ciclo
   * volta. A gravação passa por uma faixa que ninguém ocupa e fecha a ordem
   * pretendida em seguida, sem pedir nada a quem edita.
   */
  it('resolve o ciclo de ordem gravando por uma faixa livre', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFases(ID_AVALIACAO, ID_INSCRICAO);
    comUmaEtapa();

    const gravacao = componente.persistir();

    const pretendida = controller.expectOne(ROTA_FASES);
    expect(ordensDe(pretendida.request.body)).toEqual([1, 2]);
    pretendida.flush(CICLO_DE_ORDEM, {
      status: 422,
      statusText: 'Unprocessable Content',
      headers: PROBLEM_JSON,
    });
    await proximoPasso();

    const intermediaria = controller.expectOne(ROTA_FASES);
    expect(
      ordensDe(intermediaria.request.body),
      'a faixa livre é a que nenhuma fase ocupa hoje',
    ).toEqual([3, 4]);
    intermediaria.flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();

    const final = controller.expectOne(ROTA_FASES);
    expect(ordensDe(final.request.body)).toEqual([1, 2]);
    final.flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    await gravouEtapas();
    await gravouExigencias();

    await expect(gravacao).resolves.toEqual({ valid: true });
  });

  /**
   * Quando nem a gravação em duas etapas resolve, a recusa precisa dizer o que
   * fazer — a mensagem do servidor descreve o ciclo, não o caminho.
   */
  it('orienta a gravar em duas vezes quando o ciclo persiste', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFases(ID_AVALIACAO, ID_INSCRICAO);
    comUmaEtapa();

    const gravacao = componente.persistir();

    // Duas tentativas: a ordem pretendida e a faixa livre — as duas recusadas.
    for (let tentativa = 0; tentativa < 2; tentativa += 1) {
      controller.expectOne(ROTA_FASES).flush(CICLO_DE_ORDEM, {
        status: 422,
        statusText: 'Unprocessable Content',
        headers: PROBLEM_JSON,
      });
      await proximoPasso();
    }
    controller.expectNone(ROTA_ETAPAS);

    const resultado = await gravacao;
    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.[0]).toContain('duas gravações');
  });

  it('renumera a partir de 1 ao acrescentar fase', () => {
    comFases(ID_INSCRICAO);
    cronograma.formulario.controls.faseAAcrescentar.setValue(ID_AVALIACAO);

    cronograma.acrescentarFase();

    expect(store.draft().cronograma.fases.map((fase) => fase.ordem)).toEqual([1, 2]);
    expect(cronograma.formulario.controls.faseAAcrescentar.value).toBe('');
  });

  /**
   * A hora digitada vale no fuso do certame. Guardá-la como veio do campo — sem
   * fuso — deixaria o instante à mercê de quem o lê depois.
   */
  it('grava a janela como instante no fuso institucional', () => {
    comFases(ID_INSCRICAO);

    cronograma.fases.at(0).controls.inicio.setValue('2026-03-05T09:30');

    expect(store.draft().cronograma.fases[0].inicio).toBe('2026-03-05T09:30:00-03:00');
    // O controle guarda a hora de parede; quem carimba o fuso é a saída para o
    // rascunho, e é ela que o campo lê de volta ao reabrir o processo.
    expect(cronograma.fases.at(0).controls.inicio.value).toBe('2026-03-05T09:30');
  });

  it('campo de janela esvaziado volta a não declarar instante', () => {
    comFases(ID_INSCRICAO);

    cronograma.fases.at(0).controls.fim.setValue('');

    expect(store.draft().cronograma.fases[0].fim).toBeNull();
  });
});
