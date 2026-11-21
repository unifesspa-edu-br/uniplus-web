import { describe, expect, it } from 'vitest';

import { ID_AVALIACAO } from './cronograma.testing';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';
import {
  AjudantesDeRecusasDasFases,
  type ErroDaFase,
} from './cronograma-recusas-das-fases.testing';

const recusa = (campo: string, mensagem: string): ErroDaFase => ({
  field: `fases[0].regraRecurso${campo}`,
  code: 'uniplus.selecao.regra_recurso_fase.recusa_de_teste',
  message: mensagem,
});

describe('CronogramaPassoComponent: descrição de cada controle da regra de recurso recusado', () => {
  let nativo: ContextoDoCronograma['nativo'];
  let comFases: ContextoDoCronograma['comFases'];
  let comUmaEtapa: ContextoDoCronograma['comUmaEtapa'];
  let recusarFases: AjudantesDeRecusasDasFases['recusarFases'];
  let declararRegraDeRecurso: AjudantesDeRecusasDasFases['declararRegraDeRecurso'];
  let bloco: AjudantesDeRecusasDasFases['bloco'];

  usarCronograma((tela) => {
    ({ nativo, comFases, comUmaEtapa } = tela);
    ({ recusarFases, declararRegraDeRecurso, bloco } = new AjudantesDeRecusasDasFases(tela));
  });

  const recusarNaRegra = async (...erros: ErroDaFase[]) => {
    comFases(ID_AVALIACAO);
    comUmaEtapa();
    declararRegraDeRecurso();
    await recusarFases(erros);
  };

  const descricaoDe = (id: string): string[] =>
    (nativo.querySelector(`#${id}`)?.getAttribute('aria-describedby') ?? '').split(' ');

  it('liga cada controle só à recusa dele quando duas são recusadas juntas', async () => {
    await recusarNaRegra(
      recusa('.prazoValor', 'Prazo recusado.'),
      recusa('.regraCodigo', 'Regra recusada.'),
    );

    expect(descricaoDe('fase-AVALIACAO-prazo-valor')).toContain(
      'fase-AVALIACAO-recusa-recurso-prazoValor',
    );
    expect(descricaoDe('fase-AVALIACAO-prazo-valor')).not.toContain(
      'fase-AVALIACAO-recusa-recurso-regra',
    );
    expect(descricaoDe('fase-AVALIACAO-regra')).toContain('fase-AVALIACAO-recusa-recurso-regra');
    expect(descricaoDe('fase-AVALIACAO-regra')).not.toContain(
      'fase-AVALIACAO-recusa-recurso-prazoValor',
    );
  });

  it('põe a mensagem de cada recusa só no bloco do controle dela', async () => {
    await recusarNaRegra(
      recusa('.prazoValor', 'Prazo recusado.'),
      recusa('.regraCodigo', 'Regra recusada.'),
    );

    expect(bloco('fase-AVALIACAO-recusa-recurso-prazoValor')).toContain('Prazo recusado.');
    expect(bloco('fase-AVALIACAO-recusa-recurso-prazoValor')).not.toContain('Regra recusada.');
    expect(bloco('fase-AVALIACAO-recusa-recurso-regra')).toContain('Regra recusada.');
    expect(bloco('fase-AVALIACAO-recusa-recurso-regra')).not.toContain('Prazo recusado.');
    expect(bloco('fase-AVALIACAO-recurso-recusa')).toBeNull();
  });

  it('deixa o bloco geral só para a recusa sem controle próprio, fora da descrição dos controles', async () => {
    await recusarNaRegra(recusa('.prazoValor', 'Prazo recusado.'), recusa('', 'Regra inteira.'));

    expect(bloco('fase-AVALIACAO-recurso-recusa')).toContain('Regra inteira.');
    expect(bloco('fase-AVALIACAO-recurso-recusa')).not.toContain('Prazo recusado.');
    expect(descricaoDe('fase-AVALIACAO-prazo-valor')).not.toContain(
      'fase-AVALIACAO-recurso-recusa',
    );
  });

  it('leva ao bloco geral a recusa de um controle que a tela não mostra', async () => {
    await recusarNaRegra(
      recusa('.suspensividadeSegundaInstanciaValor', 'Suspensividade recusada.'),
    );

    expect(bloco('fase-AVALIACAO-recurso-recusa')).toContain('Suspensividade recusada.');
    expect(bloco('fase-AVALIACAO-recusa-recurso-suspensividadeSegundaInstanciaValor')).toBeNull();
  });

  const invalido = (id: string) => nativo.querySelector(`#${id}`)?.getAttribute('aria-invalid');

  it('marca e descreve só a unidade do prazo quando só a unidade é recusada', async () => {
    await recusarNaRegra(recusa('.prazoUnidade', 'Unidade recusada.'));

    expect(invalido('fase-AVALIACAO-prazo-unidade')).toBe('true');
    expect(descricaoDe('fase-AVALIACAO-prazo-unidade')).toContain(
      'fase-AVALIACAO-recusa-recurso-prazoUnidade',
    );
    expect(invalido('fase-AVALIACAO-prazo-valor')).not.toBe('true');
    expect(descricaoDe('fase-AVALIACAO-prazo-valor').join(' ')).not.toContain('prazoUnidade');
  });

  it('marca e descreve só o valor do prazo quando só o valor é recusado', async () => {
    await recusarNaRegra(recusa('.prazoValor', 'Valor recusado.'));

    expect(invalido('fase-AVALIACAO-prazo-valor')).toBe('true');
    expect(invalido('fase-AVALIACAO-prazo-unidade')).not.toBe('true');
    expect(descricaoDe('fase-AVALIACAO-prazo-unidade').join(' ')).not.toContain('prazoValor');
  });

  it('separa valor e unidade também na suspensividade da 1ª instância', async () => {
    await recusarNaRegra(recusa('.suspensividadePrimeiraInstanciaUnidade', 'Unidade recusada.'));

    expect(invalido('fase-AVALIACAO-susp1-unidade')).toBe('true');
    expect(invalido('fase-AVALIACAO-susp1-valor')).not.toBe('true');
    expect(descricaoDe('fase-AVALIACAO-susp1-valor').join(' ')).not.toContain(
      'suspensividadePrimeiraInstanciaUnidade',
    );
  });
});
