import { describe, expect, it } from 'vitest';

import { umRecursoDaEtapa } from '../../shared/etapa-do-cronograma.testing';
import { ID_AVALIACAO } from './cronograma.testing';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';
import {
  AjudantesDeRecusasDasEtapas,
  recusaDaEtapa,
} from './cronograma-recusas-das-etapas.testing';

const NOTA = 'conferida de novo na próxima gravação';

describe('CronogramaPassoComponent: recusas das etapas a conferir de novo', () => {
  let cronograma: ContextoDoCronograma['cronograma'];
  let expansao: ContextoDoCronograma['expansao'];
  let recusas: ContextoDoCronograma['recusas'];
  let nativo: ContextoDoCronograma['nativo'];
  let detectar: ContextoDoCronograma['detectar'];
  let comFases: ContextoDoCronograma['comFases'];
  let comEtapasEmFases: ContextoDoCronograma['comEtapasEmFases'];
  let recusarEtapas: AjudantesDeRecusasDasEtapas['recusarEtapas'];
  let bloco: AjudantesDeRecusasDasEtapas['bloco'];

  usarCronograma((tela) => {
    ({ cronograma, expansao, recusas, nativo, detectar, comFases, comEtapasEmFases } = tela);
    ({ recusarEtapas, bloco } = new AjudantesDeRecusasDasEtapas(tela));
  });

  const etapa = () => cronograma.etapas.at(0);
  const aConferir = (id: string) => bloco(id)?.includes(NOTA) === true;
  const digitar = (id: string, valor: string) => {
    const campo = nativo.querySelector<HTMLInputElement>(`#${id}`) as HTMLInputElement;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    detectar();
  };

  const recusarNotaEPrazo = async () => {
    comFases(ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO']);
    const recurso = umRecursoDaEtapa({ ancora: 'cienciaIndividual', atoAncoraCodigo: '' });
    etapa().controls.recursos.setValue([recurso]);
    expansao.alternarFase(0);
    detectar();
    await recusarEtapas([
      recusaDaEtapa('etapas[0].notaMaxima'),
      recusaDaEtapa('etapas[0].recursos[0].prazoValor'),
    ]);
  };

  it('começa com as duas recusas valendo', async () => {
    await recusarNotaEPrazo();

    expect(aConferir('cr-etapa-nota-maxima-erro-0')).toBe(false);
    expect(aConferir('cr-rec-0-0-prazo-interposicao-recusas-valor')).toBe(false);
  });

  it('passa só a recusa do recurso a conferir quando o prazo é digitado', async () => {
    await recusarNotaEPrazo();

    digitar('cr-rec-0-0-prazo-interposicao-valor', '5');

    expect(aConferir('cr-rec-0-0-prazo-interposicao-recusas-valor')).toBe(true);
    expect(aConferir('cr-etapa-nota-maxima-erro-0')).toBe(false);
  });

  it('passa só a recusa da etapa a conferir quando outro campo dela muda', async () => {
    await recusarNotaEPrazo();

    etapa().controls.nome.setValue('Outro nome');
    detectar();

    expect(aConferir('cr-etapa-nota-maxima-erro-0')).toBe(true);
    expect(aConferir('cr-rec-0-0-prazo-interposicao-recusas-valor')).toBe(false);
  });

  it('tira a marcação de inválido do campo que passou a conferir de novo', async () => {
    await recusarNotaEPrazo();

    digitar('cr-etapa-nota-maxima-0', '9');

    const campo = nativo.querySelector('#cr-etapa-nota-maxima-0');
    expect(campo?.getAttribute('aria-invalid')).not.toBe('true');
  });

  it('registra a alteração na hora, antes de a tela ser desenhada de novo', async () => {
    await recusarNotaEPrazo();

    etapa().controls.nome.setValue('Outro nome');

    expect(recusas.recusasDoCampo(etapa(), 'notaMaxima')[0].aConferir).toBe(true);
  });

  it('não volta a valer quando a alteração é desfeita', async () => {
    await recusarNotaEPrazo();
    const enviado = etapa().controls.nome.value;

    etapa().controls.nome.setValue('Outro nome');
    etapa().controls.nome.setValue(enviado);
    detectar();

    expect(aConferir('cr-etapa-nota-maxima-erro-0')).toBe(true);
  });
});
