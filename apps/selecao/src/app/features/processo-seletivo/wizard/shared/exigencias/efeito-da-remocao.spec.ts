import { describe, expect, it } from 'vitest';
import { efeitoDaRemocao, textoDoEfeito } from './efeito-da-remocao';
import { regraDeDocumento } from './exigencias-documentais';
import { exigencia, rascunho, regraDoRascunho } from './exigencias.testing';

function grupo(quantidade: number, minimo: number) {
  const itens = Array.from({ length: quantidade }, (_, indice) => ({
    ...regraDeDocumento(exigencia({ tipoDocumentoId: `documento-${indice}` })),
    identificadorNoRascunho: `regra-${indice}`,
  }));
  return {
    regrasDeComprovacao: [
      regraDoRascunho({ forma: 'QUANTIDADE_MINIMA_DE_ITENS', quantidadeMinima: minimo, itens }),
    ],
    emTodasAsFases: [],
  };
}

describe('efeito da remoção', () => {
  it('informa a remoção de documento sem grupo', () => {
    const exigencias = rascunho(exigencia());
    const efeito = efeitoDaRemocao(
      exigencias,
      exigencias.regrasDeComprovacao[0].identificadorNoRascunho,
    );
    expect(efeito).toEqual({ tipo: 'semEfeitoNoGrupo' });
    expect(textoDoEfeito(efeito, 'RG', '')).toContain('RG');
  });

  it('mantém o mínimo quando ainda cabe na combinação', () => {
    expect(efeitoDaRemocao(grupo(3, 2), 'regra-2')).toEqual({
      tipo: 'semEfeitoNoGrupo',
      documentos: ['documento-0', 'documento-1'],
    });
  });

  it('informa a redução da quantidade mínima', () => {
    const efeito = efeitoDaRemocao(grupo(3, 3), 'regra-2');
    expect(efeito).toEqual({ tipo: 'quantidadeMinimaReduzida', de: 3, para: 2 });
    expect(textoDoEfeito(efeito, 'Passaporte', '')).toContain('de 3 para 2');
  });

  it('mantém a combinação com um documento', () => {
    const efeito = efeitoDaRemocao(grupo(2, 2), 'regra-1');
    expect(efeito).toEqual({
      tipo: 'grupoComUmDocumento',
      documento: 'documento-0',
      de: 2,
      para: 1,
    });
    expect(textoDoEfeito(efeito, 'CIN', 'RG')).toContain('um só documento: RG');
  });

  it('remove a combinação que fica sem documentos', () => {
    const efeito = efeitoDaRemocao(grupo(1, 1), 'regra-0');
    expect(efeito).toEqual({ tipo: 'grupoVazio' });
    expect(textoDoEfeito(efeito, 'RG', '')).toContain('será removida');
  });
});
