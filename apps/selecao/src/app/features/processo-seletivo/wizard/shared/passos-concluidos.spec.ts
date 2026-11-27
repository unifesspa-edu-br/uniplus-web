import { describe, expect, it } from 'vitest';
import { OrigemCandidatosCodigo } from '@uniplus/shared-data/selecao';
import type { ItemConformidadeDto, ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';

import { PASSOS } from '../processo-seletivo.data';
import { passosConcluidosDe } from './passos-concluidos';

/** O detalhe sempre traz a origem dos candidatos; o teste só a varia onde ela importa. */
function rotulosConcluidos(
  dto: Partial<ProcessoSeletivoDto>,
  checklist: ItemConformidadeDto[] = [],
) {
  const completo = {
    origemCandidatos: OrigemCandidatosCodigo.INSCRICAO_PROPRIA,
    ...dto,
  } as ProcessoSeletivoDto;
  const concluidos = passosConcluidosDe(completo, checklist);
  return PASSOS.filter((_, i) => concluidos.has(i)).map((passo) => passo.rotulo);
}

describe('passosConcluidosDe', () => {
  describe('classificação gravada', () => {
    const regraDeCalculo = (codigo: string) => ({ codigo, versao: '1.0' });
    const classificacaoCom = (codigo: string, regrasEliminacao: readonly object[]) =>
      ({
        regraCalculo: regraDeCalculo(codigo),
        regrasEliminacao,
      }) as unknown as ProcessoSeletivoDto['classificacao'];

    it('sem regra de eliminação, conta a Fórmula e a Eliminação: a lista vazia é uma gravação válida', () => {
      const rotulos = rotulosConcluidos({
        classificacao: classificacaoCom('FORMULA_MEDIA_PONDERADA', []),
      });

      expect(rotulos).toContain('Fórmula e precisão');
      expect(rotulos).toContain('Eliminação');
    });

    it('com ao menos uma regra de eliminação, conta a Fórmula e a Eliminação', () => {
      const rotulos = rotulosConcluidos({
        classificacao: classificacaoCom('FORMULA_MEDIA_PONDERADA', [{}]),
      });

      expect(rotulos).toContain('Fórmula e precisão');
      expect(rotulos).toContain('Eliminação');
    });

    it('importada, que dispensa a lista de regras, conta a Fórmula e a Eliminação', () => {
      const rotulos = rotulosConcluidos({
        classificacao: classificacaoCom('CLASSIFICACAO_IMPORTADA', []),
      });

      expect(rotulos).toContain('Fórmula e precisão');
      expect(rotulos).toContain('Eliminação');
    });

    it('sem classificação gravada, não conta nenhum dos dois', () => {
      const rotulos = rotulosConcluidos({ classificacao: null });

      expect(rotulos).not.toContain('Fórmula e precisão');
      expect(rotulos).not.toContain('Eliminação');
    });
  });

  it('conta o FADA nas duas respostas e não conta enquanto o servidor não tem a declaração', () => {
    expect(rotulosConcluidos({ aplicaBonusRegional: true })).toContain('FADA');
    expect(rotulosConcluidos({ aplicaBonusRegional: false })).toContain('FADA');
    expect(rotulosConcluidos({ aplicaBonusRegional: null })).not.toContain('FADA');
  });

  it('exige critério de desempate com inscrição própria e dispensa com resultado importado', () => {
    expect(rotulosConcluidos({ criteriosDesempate: [] })).not.toContain('Desempate');
    expect(rotulosConcluidos({ criteriosDesempate: [{}] as never })).toContain('Desempate');
    expect(
      rotulosConcluidos({
        origemCandidatos: {
          codigo: OrigemCandidatosCodigo.IMPORTACAO_EXTERNA,
          rotulo: 'Importação externa',
        },
        criteriosDesempate: [],
      }),
    ).toContain('Desempate');
  });

  it('tira do conjunto o passo que o item reprovado aponta, mesmo gravado', () => {
    const checklist: ItemConformidadeDto[] = [
      {
        codigo: 'criterios_desempate_em_excesso',
        dimensao: 'classificacao',
        mensagem: '',
        ok: false,
      },
    ];

    const rotulos = rotulosConcluidos(
      {
        classificacao: { regraCalculo: { codigo: 'X' }, regrasEliminacao: [] } as never,
        criteriosDesempate: [{}] as never,
      },
      checklist,
    );

    expect(rotulos).not.toContain('Desempate');
    expect(rotulos).toContain('Fórmula e precisão');
  });

  it('aponta o FADA e o Desempate pelas dimensões novas do checklist', () => {
    const checklist: ItemConformidadeDto[] = [
      {
        codigo: 'bonus_regional_nao_declarado',
        dimensao: 'bonus_regional',
        mensagem: '',
        ok: false,
      },
      { codigo: 'criterios_desempate_ausentes', dimensao: 'desempate', mensagem: '', ok: false },
    ];

    const rotulos = rotulosConcluidos(
      { aplicaBonusRegional: true, criteriosDesempate: [{}] as never },
      checklist,
    );

    expect(rotulos).not.toContain('FADA');
    expect(rotulos).not.toContain('Desempate');
  });

  it('nunca conta a Revisão, que publica e não declara conteúdo', () => {
    expect(rotulosConcluidos({})).not.toContain('Revisão e publicação');
  });
});
