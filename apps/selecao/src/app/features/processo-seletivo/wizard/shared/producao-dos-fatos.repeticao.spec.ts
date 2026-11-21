import { describe, expect, it } from 'vitest';

import { recusaDaRepeticao } from './producao-dos-fatos';
import {
  FAMILIA,
  familiaNa,
  FASE_DIVIDIDA,
  na,
  producao,
  SEM_RENDA,
} from './producao-dos-fatos.testing';

describe('a repetição do documento pelas ocorrências de um grupo do formulário', () => {
  it('o grupo respondido na habilitação só repete documento da habilitação em diante', () => {
    const naHabilitacao = familiaNa('HABILITACAO', 'HABILITACAO');

    expect(recusaDaRepeticao('FAMILIA', na('INSCRICAO'), naHabilitacao)).toEqual({
      tipo: 'GRUPO_FORA_DO_LUGAR',
      grupo: FAMILIA,
      recusa: { tipo: 'FASE_POSTERIOR', fato: 'SEM_RENDA', faseCodigo: 'HABILITACAO' },
    });
    expect(recusaDaRepeticao('FAMILIA', na('HABILITACAO'), naHabilitacao)).toBeNull();
  });

  it('o grupo só da isenção não repete documento do outro formulário da mesma fase', () => {
    const dividida = familiaNa('ISENCAO_TAXA', 'INSCRICAO', { fases: FASE_DIVIDIDA.fases });

    expect(recusaDaRepeticao('FAMILIA', na('INSCRICAO', 'INSCRICAO'), dividida)?.tipo).toBe(
      'GRUPO_FORA_DO_LUGAR',
    );
    expect(recusaDaRepeticao('FAMILIA', na('INSCRICAO', 'ISENCAO_TAXA'), dividida)).toBeNull();
  });

  it('a fase em que o catálogo situa o campo de membro não restringe a repetição, como no servidor', () => {
    const tardioNoCatalogo = familiaNa('INSCRICAO', 'INSCRICAO', {
      catalogo: new Map([['SEM_RENDA', { ...SEM_RENDA, pontoResolucao: 'HABILITACAO' }]]),
    });

    expect(recusaDaRepeticao('FAMILIA', na('INSCRICAO'), tardioNoCatalogo)).toBeNull();
  });

  it('o grupo que nenhum formulário tem não repete documento algum', () => {
    expect(recusaDaRepeticao('FAMILIA', na('INSCRICAO'), producao())).toEqual({
      tipo: 'GRUPO_INEXISTENTE',
      grupo: 'FAMILIA',
    });
  });
});
