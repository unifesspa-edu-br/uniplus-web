import { OrigemCandidatos, type ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import type { WizardDraft } from '../../processo-seletivo.models';
import { anoDaEdicao, declaraEdicoesDoEnem, edicoesDoEnemDe } from './edicoes-do-enem';

const rascunho = (baseadoEmEnem: boolean, origem: OrigemCandidatos): WizardDraft =>
  ({
    classificacao: { baseadoEmEnem, edicoesEnem: [] },
    identificacao: { origemCandidatos: origem },
  }) as unknown as WizardDraft;

describe('declaraEdicoesDoEnem', () => {
  it('só com a nota do ENEM e a inscrição feita no processo', () => {
    expect(declaraEdicoesDoEnem(rascunho(true, OrigemCandidatos.inscricaoPropria))).toBe(true);
    expect(declaraEdicoesDoEnem(rascunho(true, OrigemCandidatos.importacaoExterna))).toBe(false);
    expect(declaraEdicoesDoEnem(rascunho(false, OrigemCandidatos.inscricaoPropria))).toBe(false);
  });
});

describe('anoDaEdicao', () => {
  it('aceita da primeira edição ao ano seguinte ao atual, sem repetir', () => {
    expect(anoDaEdicao(' 2027 ', ['2025'], 2026)).toEqual({ ano: '2027' });
    expect(anoDaEdicao('1997', [], 2026)).toEqual({ recusa: 'Informe um ano de 1998 a 2027.' });
    expect(anoDaEdicao('2028', [], 2026)).toEqual({ recusa: 'Informe um ano de 1998 a 2027.' });
    expect(anoDaEdicao('2025', ['2025'], 2026)).toEqual({
      recusa: 'A edição 2025 já está na lista.',
    });
  });
});

describe('edicoesDoEnemDe', () => {
  it('lê as edições gravadas pela ordem declarada', () => {
    const dto = {
      opcoesDeclaradas: [
        {
          fatoCodigo: 'EDICAO_ENEM',
          opcoes: [
            { codigo: '2026', rotulo: 'ENEM 2026', ordem: 1 },
            { codigo: '2025', rotulo: 'ENEM 2025', ordem: 0 },
          ],
        },
      ],
    } as unknown as ProcessoSeletivoDto;
    expect(edicoesDoEnemDe(dto)).toEqual(['2025', '2026']);
  });
});
