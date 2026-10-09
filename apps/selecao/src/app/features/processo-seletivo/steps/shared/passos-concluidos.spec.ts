import { describe, expect, it } from 'vitest';
import type { ItemConformidadeDto, ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';

import { PASSOS } from '../processo-seletivo.data';
import { passosConcluidosDe } from './passos-concluidos';

function rotulosConcluidos(
  dto: Partial<ProcessoSeletivoDto>,
  checklist: ItemConformidadeDto[] = [],
) {
  const concluidos = passosConcluidosDe(dto as ProcessoSeletivoDto, checklist);
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

  it('não conta Bônus nem Desempate sem conteúdo: o servidor não distingue vazio de nunca gravado', () => {
    const rotulos = rotulosConcluidos({ bonusRegional: null, criteriosDesempate: [] });

    expect(rotulos).not.toContain('Bônus');
    expect(rotulos).not.toContain('Desempate');
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

  it('nunca conta a Revisão, que publica e não declara conteúdo', () => {
    expect(rotulosConcluidos({})).not.toContain('Revisão e publicação');
  });
});
