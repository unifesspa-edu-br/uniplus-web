import { describe, expect, it } from 'vitest';

import { prefixoDoRecursoDaFase } from '../fase/ids-da-fase';
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

const PARAMETROS = prefixoDoRecursoDaFase(ID_AVALIACAO);
const ID_PRAZO = `${PARAMETROS}-prazo-interposicao-valor`;
const ID_UNIDADE = `${PARAMETROS}-prazo-interposicao-unidade`;
const RECUSAS_DO_PRAZO = `${PARAMETROS}-prazo-interposicao-recusas-valor`;
const RECUSAS_DA_UNIDADE = `${PARAMETROS}-prazo-interposicao-recusas-unidade`;

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

    expect(descricaoDe(ID_PRAZO)).toContain(RECUSAS_DO_PRAZO);
    expect(descricaoDe(ID_PRAZO)).not.toContain('fase-AVALIACAO-recusa-recurso-regra');
    expect(descricaoDe('fase-AVALIACAO-regra')).toContain('fase-AVALIACAO-recusa-recurso-regra');
    expect(descricaoDe('fase-AVALIACAO-regra')).not.toContain(RECUSAS_DO_PRAZO);
  });

  it('põe a mensagem de cada recusa no bloco do controle dela', async () => {
    await recusarNaRegra(
      recusa('.prazoValor', 'Prazo recusado.'),
      recusa('.regraCodigo', 'Regra recusada.'),
    );

    expect(bloco(RECUSAS_DO_PRAZO)).toContain('Prazo recusado.');
    expect(bloco(RECUSAS_DO_PRAZO)).not.toContain('Regra recusada.');
    expect(bloco('fase-AVALIACAO-recusa-recurso-regra')).toContain('Regra recusada.');
    expect(bloco('fase-AVALIACAO-recusa-recurso-regra')).not.toContain('Prazo recusado.');
  });

  it('reúne todas as recusas no bloco geral, cada uma com o botão que leva ao campo', async () => {
    await recusarNaRegra(
      recusa('.prazoValor', 'Prazo recusado.'),
      recusa('.regraCodigo', 'Regra recusada.'),
    );

    expect(bloco('fase-AVALIACAO-recurso-recusa')).toContain('Prazo recusado.');
    expect(bloco('fase-AVALIACAO-recurso-recusa')).toContain('Regra recusada.');
    expect(nativo.querySelectorAll('#fase-AVALIACAO-recurso-recusa button')).toHaveLength(2);
  });

  it('deixa a recusa da regra inteira só no bloco geral, fora da descrição dos controles', async () => {
    await recusarNaRegra(recusa('.prazoValor', 'Prazo recusado.'), recusa('', 'Regra inteira.'));

    expect(bloco('fase-AVALIACAO-recurso-recusa')).toContain('Regra inteira.');
    expect(bloco(RECUSAS_DO_PRAZO)).not.toContain('Regra inteira.');
    expect(descricaoDe(ID_PRAZO)).not.toContain('fase-AVALIACAO-recurso-recusa');
  });

  it('leva ao bloco geral a recusa do prazo da 2ª instância que a tela não mostra', async () => {
    await recusarNaRegra(recusa('.prazoSegundaInstanciaValor', 'Prazo da 2ª recusado.'));

    expect(bloco('fase-AVALIACAO-recurso-recusa')).toContain('Prazo da 2ª recusado.');
    expect(bloco(`${PARAMETROS}-prazo-segunda-recusas-valor`)).toBeNull();
  });

  const invalido = (id: string) => nativo.querySelector(`#${id}`)?.getAttribute('aria-invalid');

  it('marca e descreve só a unidade do prazo quando só a unidade é recusada', async () => {
    await recusarNaRegra(recusa('.prazoUnidade', 'Unidade recusada.'));

    expect(invalido(ID_UNIDADE)).toBe('true');
    expect(descricaoDe(ID_UNIDADE)).toContain(RECUSAS_DA_UNIDADE);
    expect(invalido(ID_PRAZO)).not.toBe('true');
    expect(descricaoDe(ID_PRAZO)).not.toContain(RECUSAS_DA_UNIDADE);
  });

  it('marca e descreve só o valor do prazo quando só o valor é recusado', async () => {
    await recusarNaRegra(recusa('.prazoValor', 'Valor recusado.'));

    expect(invalido(ID_PRAZO)).toBe('true');
    expect(invalido(ID_UNIDADE)).not.toBe('true');
    expect(descricaoDe(ID_UNIDADE)).not.toContain(RECUSAS_DO_PRAZO);
  });

  it.each([
    ['efeitoSuspensivo', 'efeito'],
    ['guardaDaVaga', 'guarda'],
  ])('marca o grupo de opções quando a recusa é de %s', async (campo, grupo) => {
    await recusarNaRegra(recusa(`.${campo}`, 'Opção recusada.'));

    expect(invalido(`${PARAMETROS}-${grupo}-grupo`)).toBe('true');
    expect(nativo.querySelector(`#${PARAMETROS}-${grupo}-grupo`)?.textContent).toContain(
      'Opção recusada.',
    );
  });

  it('marca a pergunta da instância superior quando ela é recusada', async () => {
    await recusarNaRegra(recusa('.admiteInstanciaSuperior', 'Resposta recusada.'));

    expect(bloco(`${PARAMETROS}-superior-recusas`)).toContain('Resposta recusada.');
    expect(invalido(`${PARAMETROS}-superior-nao`)).toBe('true');
  });
});
