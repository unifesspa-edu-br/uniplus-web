import { describe, expect, it } from 'vitest';

import { ID_AVALIACAO, ID_RESULTADO, ROTA_FASES } from './cronograma.testing';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';
import {
  AjudantesDeRecusasDasFases,
  type ErroDaFase,
} from './cronograma-recusas-das-fases.testing';

const SEM_PRODUTO = 'uniplus.selecao.produto_da_fase.ato_nao_encontrado_no_catalogo';
const SEM_CONTEUDO = { status: 204, statusText: 'No Content' };

const doProduto = (fase: number): ErroDaFase => ({
  field: `fases[${fase}].produtos[0]`,
  code: SEM_PRODUTO,
  message: 'Sem ato.',
});
const daBanca = (fase: number): ErroDaFase => ({
  field: `fases[${fase}].bancasRequeridas[0]`,
  code: 'uniplus.selecao.banca.recorte_em_banca_de_recursos',
  message: 'Falta a categoria de documento da banca.',
});

describe('CronogramaPassoComponent: ciclo de vida das recusas das fases', () => {
  let componente: ContextoDoCronograma['componente'];
  let cronograma: ContextoDoCronograma['cronograma'];
  let expansao: ContextoDoCronograma['expansao'];
  let controller: ContextoDoCronograma['controller'];
  let store: ContextoDoCronograma['store'];
  let detectar: ContextoDoCronograma['detectar'];
  let proximoPasso: ContextoDoCronograma['proximoPasso'];
  let gravouEtapas: ContextoDoCronograma['gravouEtapas'];
  let gravouExigencias: ContextoDoCronograma['gravouExigencias'];
  let comFases: ContextoDoCronograma['comFases'];
  let comUmaEtapa: ContextoDoCronograma['comUmaEtapa'];
  let recusarFases: AjudantesDeRecusasDasFases['recusarFases'];
  let bloco: AjudantesDeRecusasDasFases['bloco'];

  usarCronograma((tela) => {
    ({
      componente,
      cronograma,
      expansao,
      controller,
      store,
      detectar,
      proximoPasso,
      gravouEtapas,
      gravouExigencias,
      comFases,
      comUmaEtapa,
    } = tela);
    ({ recusarFases, bloco } = new AjudantesDeRecusasDasFases(tela));
  });

  it('leva o foco ao alvo da primeira recusa que a API deu', async () => {
    comFases(ID_AVALIACAO, ID_RESULTADO);
    comUmaEtapa();

    await recusarFases([doProduto(1), daBanca(0)]);
    await proximoPasso();
    detectar();

    expect(document.activeElement?.id).toBe('fase-RESULTADO_FINAL-produtos-erro');
  });

  it('segue a fase pelo identificador quando a ordem muda depois da recusa', async () => {
    comFases(ID_AVALIACAO, ID_RESULTADO);
    comUmaEtapa();
    await recusarFases([doProduto(1)]);

    cronograma.mover(1, -1);
    expansao.abrirFases([0, 1]);
    detectar();

    expect(bloco('fase-RESULTADO_FINAL-produtos-erro')).toContain('Sem ato.');
    expect(bloco('fase-AVALIACAO-produtos-erro')).toBeNull();
  });

  it('troca as recusas pelas da resposta recusada seguinte', async () => {
    comFases(ID_AVALIACAO);
    comUmaEtapa();
    await recusarFases([doProduto(0)]);

    await recusarFases([daBanca(0)]);

    expect(bloco('fase-AVALIACAO-produtos-erro')).toBeNull();
    expect(bloco('fase-AVALIACAO-bancas-erro')).toContain(
      'Falta a categoria de documento da banca.',
    );
  });

  it('tira as recusas quando a gravação seguinte é aceita', async () => {
    comFases(ID_AVALIACAO);
    comUmaEtapa();
    await recusarFases([doProduto(0)]);

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_FASES).flush(null, SEM_CONTEUDO);
    await proximoPasso();
    await gravouEtapas();
    await gravouExigencias();
    await gravacao;
    detectar();

    expect(bloco('fase-AVALIACAO-produtos-erro')).toBeNull();
  });

  it('tira as recusas quando o processo muda', async () => {
    comFases(ID_AVALIACAO);
    comUmaEtapa();
    await recusarFases([doProduto(0)]);

    store.reset();
    comFases(ID_AVALIACAO);
    detectar();

    expect(bloco('fase-AVALIACAO-produtos-erro')).toBeNull();
  });
});
