import { describe, expect, it } from 'vitest';

import { textoDaRecusaDaFase } from './recusas-do-servidor-da-fase';

const QUORUM_FORA_DO_INTERVALO = 'uniplus.selecao.banca.quorum_fora_do_intervalo';

describe('textoDaRecusaDaFase', () => {
  it('nomeia a fase de origem quando o caminho a aponta', () => {
    const texto = textoDaRecusaDaFase({
      field: 'fases[1].bancasRequeridas[0].regraDeDeliberacao.quorum',
      code: QUORUM_FORA_DO_INTERVALO,
    });

    expect(texto).toBe('Fase 2: O quórum precisa ficar entre 1 e o número de integrantes.');
  });

  it('mostra o texto sem a fase quando o caminho não a nomeia', () => {
    const texto = textoDaRecusaDaFase({ field: '', code: QUORUM_FORA_DO_INTERVALO });

    expect(texto).toBe('O quórum precisa ficar entre 1 e o número de integrantes.');
  });

  it('deixa a recusa de outra natureza ao título do servidor', () => {
    expect(
      textoDaRecusaDaFase({ field: 'fases[0].codigo', code: 'uniplus.selecao.outra.recusa' }),
    ).toBeNull();
  });

  it.each([
    ['uniplus.selecao.motivo_de_decisao.tipo_invalido', 'não é reconhecido'],
    ['uniplus.selecao.motivo_de_decisao.tipo_de_decisao_duplicado', 'mais de uma vez'],
    ['uniplus.selecao.regra_recurso_fase.procedimento_para_decisao_nao_declarada', 'marque o tipo'],
  ])('dá texto à recusa %s e nomeia a fase', (code, trecho) => {
    const texto = textoDaRecusaDaFase({ field: 'fases[2].tiposDeDecisao[0]', code });

    expect(texto).toContain('Fase 3: ');
    expect(texto).toContain(trecho);
  });
});
