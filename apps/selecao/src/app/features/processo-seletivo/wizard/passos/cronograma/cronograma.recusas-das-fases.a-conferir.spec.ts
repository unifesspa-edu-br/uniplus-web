import { describe, expect, it } from 'vitest';

import { ID_AVALIACAO } from './cronograma.testing';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';
import {
  AjudantesDeRecusasDasFases,
  type ErroDaFase,
} from './cronograma-recusas-das-fases.testing';

const NOTA = 'conferida de novo na próxima gravação';
const DO_PRODUTO: ErroDaFase = {
  field: 'fases[0].produtos[0]',
  code: 'uniplus.selecao.produto_da_fase.ato_nao_encontrado_no_catalogo',
  message: 'Sem ato.',
};
const DO_PRAZO: ErroDaFase = {
  field: 'fases[0].regraRecurso.prazoValor',
  code: 'uniplus.selecao.regra_recurso_fase.prazo_nao_positivo',
  message: 'O prazo precisa ser maior que zero.',
};

describe('CronogramaPassoComponent: recusas das fases a conferir de novo', () => {
  let cronograma: ContextoDoCronograma['cronograma'];
  let nativo: ContextoDoCronograma['nativo'];
  let detectar: ContextoDoCronograma['detectar'];
  let comFases: ContextoDoCronograma['comFases'];
  let comUmaEtapa: ContextoDoCronograma['comUmaEtapa'];
  let recusarFases: AjudantesDeRecusasDasFases['recusarFases'];
  let declararRegraDeRecurso: AjudantesDeRecusasDasFases['declararRegraDeRecurso'];
  let bloco: AjudantesDeRecusasDasFases['bloco'];

  usarCronograma((tela) => {
    ({ cronograma, nativo, detectar, comFases, comUmaEtapa } = tela);
    ({ recusarFases, declararRegraDeRecurso, bloco } = new AjudantesDeRecusasDasFases(tela));
  });

  const recusarProdutoEPrazo = async () => {
    comFases(ID_AVALIACAO);
    comUmaEtapa();
    declararRegraDeRecurso();
    await recusarFases([DO_PRODUTO, DO_PRAZO]);
  };

  const aConferir = (id: string) => bloco(id)?.includes(NOTA) === true;
  const digitar = (id: string, valor: string, renderizar = true) => {
    const campo = nativo.querySelector<HTMLInputElement>(`#${id}`) as HTMLInputElement;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    if (renderizar) detectar();
  };

  it('começa com as duas recusas valendo', async () => {
    await recusarProdutoEPrazo();

    expect(bloco('fase-AVALIACAO-recusa-recurso-prazo')).toContain('O prazo precisa ser maior');
    expect(aConferir('fase-AVALIACAO-produtos-erro')).toBe(false);
    expect(aConferir('fase-AVALIACAO-recusa-recurso-prazo')).toBe(false);
  });

  it('passa só a recusa da regra de recurso a conferir quando o prazo é digitado', async () => {
    await recusarProdutoEPrazo();

    digitar('fase-AVALIACAO-prazo-valor', '5');

    expect(aConferir('fase-AVALIACAO-recusa-recurso-prazo')).toBe(true);
    expect(aConferir('fase-AVALIACAO-produtos-erro')).toBe(false);
  });

  it('passa só a recusa da fase a conferir quando outro campo dela muda no passo da fase', async () => {
    await recusarProdutoEPrazo();

    const caixa = nativo.querySelector<HTMLInputElement>(
      '#fase-AVALIACAO-tipos-de-decisao-GABARITO_DA_PROVA',
    ) as HTMLInputElement;
    caixa.checked = true;
    caixa.dispatchEvent(new Event('change'));
    detectar();

    expect(aConferir('fase-AVALIACAO-produtos-erro')).toBe(true);
    expect(aConferir('fase-AVALIACAO-recusa-recurso-prazo')).toBe(false);
  });

  it('passa só a recusa da fase a conferir quando o Fim muda na linha do tempo', async () => {
    await recusarProdutoEPrazo();

    cronograma.fases.at(0).controls.fim.setValue('2026-04-01T18:00');
    detectar();

    expect(aConferir('fase-AVALIACAO-produtos-erro')).toBe(true);
    expect(aConferir('fase-AVALIACAO-recusa-recurso-prazo')).toBe(false);
  });

  it('mantém a recusa da regra de recurso a conferir, sem marca de inválido, quando o prazo volta ao valor enviado', async () => {
    await recusarProdutoEPrazo();
    const prazo = () => nativo.querySelector('#fase-AVALIACAO-prazo-valor');
    expect(prazo()?.getAttribute('aria-invalid')).toBe('true');

    digitar('fase-AVALIACAO-prazo-valor', '5', false);
    digitar('fase-AVALIACAO-prazo-valor', '3', false);
    detectar();

    expect(aConferir('fase-AVALIACAO-recusa-recurso-prazo')).toBe(true);
    expect(prazo()?.getAttribute('aria-invalid')).toBeNull();
  });

  it('mantém a recusa da fase a conferir quando o Fim volta ao valor enviado', async () => {
    await recusarProdutoEPrazo();
    const fim = cronograma.fases.at(0).controls.fim;
    const enviado = fim.value;

    fim.setValue('2026-04-01T18:00');
    fim.setValue(enviado);
    detectar();

    expect(aConferir('fase-AVALIACAO-produtos-erro')).toBe(true);
  });
});
