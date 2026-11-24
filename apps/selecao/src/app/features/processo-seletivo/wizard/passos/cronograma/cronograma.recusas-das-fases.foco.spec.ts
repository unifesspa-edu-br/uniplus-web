import { describe, expect, it } from 'vitest';

import { prefixoDoRecursoDaFase } from '../fase/ids-da-fase';
import { ID_AVALIACAO } from './cronograma.testing';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';
import {
  AjudantesDeRecusasDasFases,
  type ErroDaFase,
  REGRA_DO_RECURSO,
} from './cronograma-recusas-das-fases.testing';

const PREFIXO = 'fases[0].regraRecurso';
const PARAMETROS = prefixoDoRecursoDaFase(ID_AVALIACAO);
const recusaDoRecurso = (campo: string): ErroDaFase => ({
  field: `${PREFIXO}${campo}`,
  code: 'uniplus.selecao.regra_recurso_fase.recusa_de_teste',
  message: `Recusa de ${campo || 'regra'}.`,
});

describe('CronogramaPassoComponent: foco na primeira recusa da regra de recurso', () => {
  let detectar: ContextoDoCronograma['detectar'];
  let comFases: ContextoDoCronograma['comFases'];
  let comUmaEtapa: ContextoDoCronograma['comUmaEtapa'];
  let proximoPasso: ContextoDoCronograma['proximoPasso'];
  let recusarFases: AjudantesDeRecusasDasFases['recusarFases'];
  let declararRegraDeRecurso: AjudantesDeRecusasDasFases['declararRegraDeRecurso'];

  usarCronograma((tela) => {
    ({ detectar, comFases, comUmaEtapa, proximoPasso } = tela);
    ({ recusarFases, declararRegraDeRecurso } = new AjudantesDeRecusasDasFases(tela));
  });

  const focoDepoisDeRecusar = async (...erros: ErroDaFase[]): Promise<string | undefined> => {
    comFases(ID_AVALIACAO);
    comUmaEtapa();
    declararRegraDeRecurso(REGRA_DO_RECURSO);
    await recusarFases(erros);
    await proximoPasso();
    detectar();
    return document.activeElement?.id;
  };

  it('leva o foco ao controle da primeira recusa que a API deu, não ao mais alto da tela', async () => {
    const foco = await focoDepoisDeRecusar(
      recusaDoRecurso('.prazoValor'),
      recusaDoRecurso('.regraCodigo'),
    );

    expect(foco).toBe(`${PARAMETROS}-prazo-interposicao-valor`);
  });

  it('leva o foco ao seletor da regra quando a API a deu primeiro', async () => {
    const foco = await focoDepoisDeRecusar(
      recusaDoRecurso('.regraCodigo'),
      recusaDoRecurso('.prazoValor'),
    );

    expect(foco).toBe('fase-AVALIACAO-regra');
  });

  it('leva o foco à publicação de que o prazo corre', async () => {
    expect(await focoDepoisDeRecusar(recusaDoRecurso('.atoAncoraCodigo'))).toBe(
      'fase-AVALIACAO-ancora',
    );
  });

  it('leva o foco à opção marcada da instância superior', async () => {
    expect(await focoDepoisDeRecusar(recusaDoRecurso('.admiteInstanciaSuperior'))).toBe(
      `${PARAMETROS}-superior-nao`,
    );
  });

  it('leva o foco ao bloco das recusas quando a recusa não tem controle próprio', async () => {
    expect(await focoDepoisDeRecusar(recusaDoRecurso(''))).toBe('fase-AVALIACAO-recurso-recusa');
  });

  it('leva o foco ao bloco das recusas quando o prazo da 2ª instância não existe na tela', async () => {
    expect(await focoDepoisDeRecusar(recusaDoRecurso('.prazoSegundaInstanciaValor'))).toBe(
      'fase-AVALIACAO-recurso-recusa',
    );
  });

  it.each([
    ['.prazoUnidade', 'prazo-interposicao-unidade'],
    ['.efeitoSuspensivo', 'efeito-opcao-SEM_EFEITO_SUSPENSIVO'],
    ['.guardaDaVaga', 'guarda-opcao-ATE_O_RESULTADO_DEFINITIVO'],
  ])(
    'leva o foco ao controle de %s dos parâmetros, na opção marcada quando é uma escolha',
    async (campo, sufixo) => {
      expect(await focoDepoisDeRecusar(recusaDoRecurso(campo))).toBe(`${PARAMETROS}-${sufixo}`);
    },
  );
});
