import { describe, expect, it } from 'vitest';
import { OrigemCandidatos } from '@uniplus/shared-data/selecao';
import type { ItemConformidadeDto, ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';

import { PASSOS } from '../processo-seletivo.data';
import { passosConcluidosDe } from './passos-concluidos';

/** O detalhe sempre traz a origem dos candidatos; o teste só a varia onde ela importa. */
function rotulosConcluidos(
  dto: Partial<ProcessoSeletivoDto>,
  checklist: ItemConformidadeDto[] = [],
) {
  const completo = {
    origemCandidatos: OrigemCandidatos.inscricaoPropria,
    ...dto,
  } as ProcessoSeletivoDto;
  const concluidos = passosConcluidosDe(completo, checklist);
  return PASSOS.filter((_, i) => concluidos.has(i)).map((passo) => passo.rotulo);
}

describe('passosConcluidosDe', () => {
  it('conta a Fórmula e a Eliminação juntas, porque a classificação é gravada num comando só', () => {
    const rotulos = rotulosConcluidos({
      classificacao: {} as ProcessoSeletivoDto['classificacao'],
    });

    expect(rotulos).toContain('Fórmula e precisão');
    expect(rotulos).toContain('Eliminação');
  });

  it('conta o Bônus nas duas respostas e não conta enquanto o servidor não tem a declaração', () => {
    expect(rotulosConcluidos({ aplicaBonusRegional: true })).toContain('Bônus');
    expect(rotulosConcluidos({ aplicaBonusRegional: false })).toContain('Bônus');
    expect(rotulosConcluidos({ aplicaBonusRegional: null })).not.toContain('Bônus');
  });

  it('exige critério de desempate com inscrição própria e dispensa com resultado importado', () => {
    expect(rotulosConcluidos({ criteriosDesempate: [] })).not.toContain('Desempate');
    expect(rotulosConcluidos({ criteriosDesempate: [{}] as never })).toContain('Desempate');
    expect(
      rotulosConcluidos({
        origemCandidatos: OrigemCandidatos.importacaoExterna,
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
        classificacao: {} as ProcessoSeletivoDto['classificacao'],
        criteriosDesempate: [{}] as never,
      },
      checklist,
    );

    expect(rotulos).not.toContain('Desempate');
    expect(rotulos).toContain('Fórmula e precisão');
  });

  it('aponta o Bônus e o Desempate pelas dimensões novas do checklist', () => {
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

    expect(rotulos).not.toContain('Bônus');
    expect(rotulos).not.toContain('Desempate');
  });

  it('nunca conta a Revisão, que publica e não declara conteúdo', () => {
    expect(rotulosConcluidos({})).not.toContain('Revisão e publicação');
  });
});
