import { describe, expect, it } from 'vitest';

import { indiceDaFaseEm, recusaDaBancaNaFase } from './recusas-da-fase';

const PREFIXO = 'uniplus.selecao.banca.';

describe('recusa da regra de deliberação da banca na fase', () => {
  it('leva a recusa ao campo da regra que o caminho aponta, na posição da banca', () => {
    const recusa = recusaDaBancaNaFase({
      field: 'fases[0].bancasRequeridas[1].regraDeDeliberacao.quorum',
      code: `${PREFIXO}quorum_fora_do_intervalo`,
    });

    expect(recusa?.campo).toBe('bancasRequeridas.1.quorum');
    expect(recusa?.mensagem).toContain('entre 1 e o número');
  });

  it('leva ao campo da tabela a recusa cujo caminho aponta só a banca', () => {
    const recusa = recusaDaBancaNaFase({
      field: 'fases[0].bancasRequeridas[0]',
      code: `${PREFIXO}regra_de_deliberacao_obrigatoria`,
    });

    expect(recusa?.campo).toBe('bancasRequeridas.0.regra');
    expect(recusa?.mensagem).toContain('Declare a regra');
  });

  it('mostra o mínimo de integrantes que só vem na mensagem do servidor', () => {
    const recusa = recusaDaBancaNaFase({
      field: 'fases[0].bancasRequeridas[0].regraDeDeliberacao.integrantes',
      code: `${PREFIXO}integrantes_abaixo_do_minimo`,
      message: 'A banca precisa de 3 integrantes.',
    });

    expect(recusa?.mensagem).toBe('A banca precisa de 3 integrantes.');
  });

  it('não reconhece como recusa de banca o código que não é de regra', () => {
    expect(recusaDaBancaNaFase({ field: 'fases[0]', code: 'outro' })).toBeUndefined();
  });
});

describe('posição da fase no caminho da recusa', () => {
  it.each([
    ['fases[2].regraRecurso', 2],
    ['$.fases[0]', 0],
    ['request.Fases[1].fim', 1],
  ])('lê a posição em %s', (caminho, posicao) => {
    expect(indiceDaFaseEm(caminho)).toBe(posicao);
  });

  it('devolve nulo quando o caminho não nomeia fase', () => {
    expect(indiceDaFaseEm('etapas[0].notaMinima')).toBeNull();
  });
});
