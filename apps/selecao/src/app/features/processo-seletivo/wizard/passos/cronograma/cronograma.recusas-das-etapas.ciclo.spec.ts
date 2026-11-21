import { describe, expect, it } from 'vitest';

import { umRecursoDaEtapa } from '../../shared/etapa-do-cronograma.testing';
import { ID_AVALIACAO, ROTA_FASES } from './cronograma.testing';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';
import {
  AjudantesDeRecusasDasEtapas,
  recusaDaEtapa,
} from './cronograma-recusas-das-etapas.testing';

const SEM_CONTEUDO = { status: 204, statusText: 'No Content' };

describe('CronogramaPassoComponent: ciclo de vida das recusas das etapas', () => {
  let componente: ContextoDoCronograma['componente'];
  let cronograma: ContextoDoCronograma['cronograma'];
  let expansao: ContextoDoCronograma['expansao'];
  let edicao: ContextoDoCronograma['edicao'];
  let nativo: ContextoDoCronograma['nativo'];
  let controller: ContextoDoCronograma['controller'];
  let store: ContextoDoCronograma['store'];
  let detectar: ContextoDoCronograma['detectar'];
  let proximoPasso: ContextoDoCronograma['proximoPasso'];
  let gravouEtapas: ContextoDoCronograma['gravouEtapas'];
  let gravouExigencias: ContextoDoCronograma['gravouExigencias'];
  let comFases: ContextoDoCronograma['comFases'];
  let comEtapasEmFases: ContextoDoCronograma['comEtapasEmFases'];
  let recusarEtapas: AjudantesDeRecusasDasEtapas['recusarEtapas'];
  let bloco: AjudantesDeRecusasDasEtapas['bloco'];

  usarCronograma((tela) => {
    ({
      componente,
      cronograma,
      expansao,
      edicao,
      nativo,
      controller,
      store,
      detectar,
      proximoPasso,
      gravouEtapas,
      gravouExigencias,
      comFases,
      comEtapasEmFases,
    } = tela);
    ({ recusarEtapas, bloco } = new AjudantesDeRecusasDasEtapas(tela));
  });

  function etapasAbertas(quantas: number): void {
    comFases(ID_AVALIACAO);
    comEtapasEmFases(Array.from({ length: quantas }, () => 'AVALIACAO'));
    expansao.alternarFase(0);
    expansao.abrirEtapas(Array.from({ length: quantas }, (_, posicao) => posicao));
    detectar();
  }

  it('leva o foco ao alvo da primeira recusa que a API deu, na etapa que a recebeu', async () => {
    etapasAbertas(2);

    await recusarEtapas([
      recusaDaEtapa('etapas[1].notaMaxima'),
      recusaDaEtapa('etapas[0].notaMaxima'),
    ]);
    await proximoPasso();
    detectar();

    expect(document.activeElement?.id).toBe('cr-etapa-nota-maxima-1');
  });

  it('segue a etapa pelo formulário quando a ordem muda depois da recusa', async () => {
    etapasAbertas(2);
    await recusarEtapas([recusaDaEtapa('etapas[1].notaMaxima', 'Nota da segunda.')]);

    cronograma.moverEtapa(1, -1);
    detectar();

    expect(bloco('cr-etapa-nota-maxima-erro-0')).toContain('Nota da segunda.');
    expect(bloco('cr-etapa-nota-maxima-erro-1')).toBeNull();
  });

  function doisRecursos(): void {
    etapasAbertas(1);
    const recurso = (prazoValor: string) =>
      umRecursoDaEtapa({ ancora: 'cienciaIndividual', atoAncoraCodigo: '', prazoValor });
    cronograma.etapas.at(0).controls.recursos.setValue([recurso('1'), recurso('2')]);
    expansao.abrirBloco(0, 'recursos');
    detectar();
  }

  const doPrazo = (recurso: number) => `cr-rec-recusa-prazoValor-0-${recurso}`;

  it('leva a recusa do recurso seguinte ao remover o anterior, sem herdar a do removido', async () => {
    doisRecursos();
    await recusarEtapas([
      recusaDaEtapa('etapas[0].recursos[0].prazoValor', 'Prazo do primeiro.'),
      recusaDaEtapa('etapas[0].recursos[1].prazoValor', 'Prazo do segundo.'),
    ]);

    edicao.removerRecursoDaEtapa(cronograma.etapas.at(0), 0);
    detectar();

    expect(bloco(doPrazo(0))).toContain('Prazo do segundo.');
    expect(bloco(doPrazo(0))).not.toContain('Prazo do primeiro.');
    expect(bloco(doPrazo(1))).toBeNull();
  });

  it('não passa a recusa do recurso removido ao que ocupa o lugar dele', async () => {
    doisRecursos();
    await recusarEtapas([recusaDaEtapa('etapas[0].recursos[0].prazoValor', 'Prazo do primeiro.')]);

    edicao.removerRecursoDaEtapa(cronograma.etapas.at(0), 0);
    detectar();

    expect(bloco(doPrazo(0))).toBeNull();
    expect(nativo.querySelector('#cr-rec-prazo-0-0')?.getAttribute('aria-invalid')).not.toBe(
      'true',
    );
  });

  it('troca as recusas pelas da resposta recusada seguinte', async () => {
    etapasAbertas(1);
    await recusarEtapas([recusaDaEtapa('etapas[0].notaMaxima')]);

    await recusarEtapas([recusaDaEtapa('etapas[0].peso')]);

    expect(bloco('cr-etapa-nota-maxima-erro-0')).toBeNull();
    expect(bloco('cr-etapa-recusas-0')).toContain('Recusa de etapas[0].peso.');
  });

  it('tira as recusas quando a gravação seguinte é aceita', async () => {
    etapasAbertas(1);
    await recusarEtapas([recusaDaEtapa('etapas[0].notaMaxima')]);

    const gravacao = componente.persistir();
    controller.expectOne(ROTA_FASES).flush(null, SEM_CONTEUDO);
    await proximoPasso();
    await gravouEtapas();
    await gravouExigencias();
    await gravacao;
    detectar();

    expect(bloco('cr-etapa-nota-maxima-erro-0')).toBeNull();
  });

  it('tira as recusas quando o processo muda', async () => {
    etapasAbertas(1);
    await recusarEtapas([recusaDaEtapa('etapas[0].notaMaxima')]);

    store.reset();
    detectar();

    expect(bloco('cr-etapa-nota-maxima-erro-0')).toBeNull();
  });

  it('tira as recusas quando o passo Cronograma deixa de ser o corrente', async () => {
    etapasAbertas(1);
    store.irParaFase('AVALIACAO');
    detectar();
    await recusarEtapas([recusaDaEtapa('etapas[0].notaMaxima')]);
    expect(bloco('cr-etapa-nota-maxima-erro-0')).not.toBeNull();

    store.goTo(0);
    detectar();

    expect(bloco('cr-etapa-nota-maxima-erro-0')).toBeNull();
  });
});
