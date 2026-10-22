import {
  SituacaoDoProdutoPrevisto,
  SituacaoDoRegistroDoAto,
  type AtoDoProcessoDto,
  type ProdutoPrevistoDto,
  type ProdutosPrevistosDoProcessoDto,
} from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import {
  atoQueACorrecaoCorrige,
  fasesDePrevistos,
  politicaParaConfirmar,
} from './previstos-do-edital';

function ato(id: string, sobrescritas: Partial<AtoDoProcessoDto> = {}): AtoDoProcessoDto {
  return {
    id,
    tipoCodigo: 'RESULTADO_HOMOLOGACAO',
    tipoNome: 'Resultado da homologação',
    numero: null,
    dataDoAto: '2026-10-10',
    publicadoEm: '2026-10-10T15:00:00Z',
    assinante: 'Pró-reitoria de Ensino',
    situacao: SituacaoDoRegistroDoAto.registrado,
    registradoEm: '2026-10-10T15:01:00Z',
    pendenciaAcimaDoLimiar: false,
    atoCorrigidoId: null,
    motivoDaCorrecao: null,
    politicaDeDivulgacaoConfirmada: true,
    documentoPrincipal: {
      documentoAPublicarId: `doc-${id}`,
      nomeArquivo: `${id}.pdf`,
      nomeDeExibicao: null,
      tipoDeMidia: 'application/pdf',
      hashSha256: 'a'.repeat(64),
    },
    anexos: [],
    ...sobrescritas,
  };
}

function item(id: string, sobrescritas: Partial<ProdutoPrevistoDto> = {}): ProdutoPrevistoDto {
  return {
    id,
    tipoCodigo: 'RESULTADO_HOMOLOGACAO',
    tipoNome: 'Resultado da homologação',
    papel: 'PRELIMINAR',
    situacao: SituacaoDoProdutoPrevisto.aberto,
    ato: null,
    correcoes: [],
    podePublicar: true,
    impedimento: null,
    ...sobrescritas,
  };
}

const nomeDaFase = (codigo: string): string => (codigo === 'INSCRICAO' ? 'Inscrição' : codigo);

describe('fasesDePrevistos', () => {
  const consulta: ProdutosPrevistosDoProcessoDto = {
    numeroDaVersao: 1,
    politicaDeDivulgacao: { camposPublicos: ['numero_inscricao'], justificativa: null },
    fases: [
      {
        id: 'f1',
        codigo: 'INSCRICAO',
        ordem: 1,
        produtos: [item('p1')],
        etapas: [
          { id: 'e1', nome: 'Análise documental', ordem: 1, produtos: [item('p2')] },
          { id: 'e2', nome: 'Sem itens', ordem: 2, produtos: [] },
        ],
      },
      { id: 'f2', codigo: 'MATRICULA', ordem: 2, produtos: [], etapas: [] },
    ],
    etapasSemFase: [{ id: 'e3', nome: 'Avulsa', ordem: null, produtos: [item('p3')] }],
  };

  it('agrupa por fase e etapa e deixa de fora o que não declara item algum', () => {
    const fases = fasesDePrevistos(consulta, nomeDaFase, 'Etapas fora de uma fase');

    expect(fases.map((f) => f.nome)).toEqual(['Inscrição', 'Etapas fora de uma fase']);
    expect(fases[0].itens.map((i) => i.id)).toEqual(['p1']);
    expect(fases[0].etapas.map((e) => e.nome)).toEqual(['Análise documental']);
  });

  it('mantém as etapas sem fase num grupo à parte, para não sumirem da tela', () => {
    const [, semFase] = fasesDePrevistos(consulta, nomeDaFase, 'Etapas fora de uma fase');

    expect(semFase.itens).toEqual([]);
    expect(semFase.etapas.map((e) => e.itens.map((i) => i.id))).toEqual([['p3']]);
  });
});

describe('atoQueACorrecaoCorrige', () => {
  it('aponta a publicação original enquanto o item não foi corrigido', () => {
    const original = ato('original');

    expect(atoQueACorrecaoCorrige(item('p', { ato: original }))?.id).toBe('original');
  });

  it('aponta a correção mais recente da cadeia, e não a original', () => {
    const original = ato('original');
    const errata1 = ato('errata-1', { atoCorrigidoId: 'original' });
    const errata2 = ato('errata-2', { atoCorrigidoId: 'errata-1' });

    const corrigido = atoQueACorrecaoCorrige(item('p', { ato: original, correcoes: [errata1, errata2] }));

    expect(corrigido?.id).toBe('errata-2');
  });

  it('não oferece nova correção enquanto a última ainda aguarda o registro', () => {
    const original = ato('original');
    const pendente = ato('errata', {
      atoCorrigidoId: 'original',
      situacao: SituacaoDoRegistroDoAto.pendente,
      registradoEm: null,
    });

    expect(atoQueACorrecaoCorrige(item('p', { ato: original, correcoes: [pendente] }))).toBeNull();
  });

  it('não oferece correção ao item que ainda não foi publicado ou aguarda o registro', () => {
    expect(atoQueACorrecaoCorrige(item('aberto'))).toBeNull();
    const pendente = ato('original', { situacao: SituacaoDoRegistroDoAto.pendente, registradoEm: null });
    expect(atoQueACorrecaoCorrige(item('pendente', { ato: pendente }))).toBeNull();
  });
});

describe('politicaParaConfirmar', () => {
  const campos = [
    { codigo: 'numero_inscricao', nome: 'Número de inscrição', obrigatorio: true, exigeJustificativa: false },
    { codigo: 'nome', nome: 'Nome', obrigatorio: false, exigeJustificativa: true },
  ];

  it('mostra os campos pelo nome e a justificativa sem espaços sobrando', () => {
    const politica = politicaParaConfirmar(
      { camposPublicos: ['numero_inscricao', 'nome'], justificativa: '  Lista nominal.  ' },
      campos,
    );

    expect(politica).toEqual({ campos: ['Número de inscrição', 'Nome'], justificativa: 'Lista nominal.' });
  });

  it('mostra o código do campo que o vocabulário não conhece e omite a justificativa em branco', () => {
    const politica = politicaParaConfirmar(
      { camposPublicos: ['nome_abreviado'], justificativa: '   ' },
      campos,
    );

    expect(politica).toEqual({ campos: ['nome_abreviado'], justificativa: null });
  });
});
