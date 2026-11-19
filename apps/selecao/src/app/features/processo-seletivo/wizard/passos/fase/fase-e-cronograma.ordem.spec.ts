import { expect, it } from 'vitest';
import {
  type ContextoDoCertame,
  PROCESSO_ID,
  ROTA_FASES,
  PROBLEM_JSON,
  CICLO_DE_ORDEM,
  ID_AVALIACAO,
  ID_RESULTADO,
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
  let formularioDoCronograma: ContextoDoCertame['formularioDoCronograma'];
  let superficie: ContextoDoCertame['superficie'];
  let publicacoes: ContextoDoCertame['publicacoes'];
  let store: ContextoDoCertame['store'];
  let controller: ContextoDoCertame['controller'];
  let detectar: ContextoDoCertame['detectar'];
  let proximoPasso: ContextoDoCertame['proximoPasso'];
  let ordensDe: ContextoDoCertame['ordensDe'];
  let fasesDe: ContextoDoCertame['fasesDe'];
  let comCertame: ContextoDoCertame['comCertame'];

  usarFaseECronograma((tela) => {
    ({
      cronograma,
      formularioDoCronograma,
      superficie,
      publicacoes,
      store,
      controller,
      detectar,
      proximoPasso,
      ordensDe,
      fasesDe,
      comCertame,
    } = tela);
  });

  /**
   * A reordenação fica no rascunho até alguém gravar, e quem grava pode ser a
   * superfície da fase. Toda permutação não-trivial fecha ciclo de ordem, que o
   * servidor não persiste numa chamada só — o contorno de duas gravações precisa
   * valer em qualquer caminho que substitua a coleção.
   */
  it('contorna o ciclo de ordem também quando quem grava é a superfície da fase', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comCertame();

    // Troca as duas fases de lugar pela linha do tempo, sem gravar ali.
    formularioDoCronograma.mover(0, 1);
    detectar();

    const gravacao = superficie.persistir();

    // Renumerar produz 1..N de novo: a permutação está em qual fase ocupa cada
    // posição, não nos valores.
    const pretendida = controller.expectOne(ROTA_FASES);
    expect(fasesDe(pretendida.request.body)).toEqual([ID_RESULTADO, ID_AVALIACAO]);
    expect(ordensDe(pretendida.request.body)).toEqual([1, 2]);
    pretendida.flush(CICLO_DE_ORDEM, {
      status: 422,
      statusText: 'Unprocessable Content',
      headers: PROBLEM_JSON,
    });
    await proximoPasso();

    // A gravação intermediária tira as duas da faixa disputada.
    const intermediaria = controller.expectOne(ROTA_FASES);
    expect(ordensDe(intermediaria.request.body)).toEqual([3, 4]);
    intermediaria.flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();

    const definitiva = controller.expectOne(ROTA_FASES);
    expect(fasesDe(definitiva.request.body)).toEqual([ID_RESULTADO, ID_AVALIACAO]);
    expect(ordensDe(definitiva.request.body)).toEqual([1, 2]);
    definitiva.flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();

    expect((await gravacao).valid).toBe(true);
  });

  /**
   * Quando o contorno não resolve, o operador precisa da orientação — não do
   * título cru de uma recusa que fala de uma tela onde ele nem reordena.
   */
  it('explica a permutação de ordem que a superfície da fase não consegue contornar', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comCertame();

    formularioDoCronograma.mover(0, 1);
    detectar();

    const gravacao = superficie.persistir();

    controller.expectOne(ROTA_FASES).flush(CICLO_DE_ORDEM, {
      status: 422,
      statusText: 'Unprocessable Content',
      headers: PROBLEM_JSON,
    });
    await proximoPasso();
    controller.expectOne(ROTA_FASES).flush(CICLO_DE_ORDEM, {
      status: 422,
      statusText: 'Unprocessable Content',
      headers: PROBLEM_JSON,
    });
    await proximoPasso();

    const resultado = await gravacao;
    expect(resultado.messages?.join(' ')).toContain('exige duas gravações');
    expect(superficie.recusasGerais().join(' ')).toContain('exige duas gravações');
  });

  /**
   * O mesmo trajeto visto do outro lado: gravar pela superfície da fase envia a
   * coleção inteira, e o que a linha do tempo declarou tem de ir junto.
   */
  it('leva a linha do tempo inteira quando quem grava é a superfície da fase', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comCertame();

    cronograma.fases.at(1).controls.fim.setValue('2026-04-06T18:00');
    detectar();

    superficie.abrirFase(ID_RESULTADO);
    detectar();
    publicacoes().acrescentarProduto();
    publicacoes().escolherAto(0, 'RESULTADO_FINAL');
    publicacoes().escolherPapel(0, 'DEFINITIVO');
    detectar();

    const gravacao = superficie.persistir();
    const enviadas = controller.expectOne(ROTA_FASES);
    const corpo = enviadas.request.body as Record<string, unknown>[];

    expect(corpo).toHaveLength(2);
    expect(corpo[0]).toMatchObject({ faseCanonicaId: ID_AVALIACAO, ordem: 1, produtos: [] });
    expect(corpo[1]).toMatchObject({
      faseCanonicaId: ID_RESULTADO,
      ordem: 2,
      fim: '2026-04-06T18:00:00-03:00',
      produtos: [{ atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' }],
    });

    // A gravação da superfície não toca as etapas, e o rascunho as mantém.
    expect(store.draft().cronograma.etapas).toHaveLength(1);

    enviadas.flush(null, { status: 204, statusText: 'No Content' });
    await proximoPasso();
    expect((await gravacao).valid).toBe(true);
  });
});
