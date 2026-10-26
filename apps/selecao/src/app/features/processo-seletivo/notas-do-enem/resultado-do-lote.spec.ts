import type {
  AusenteDoLoteDto,
  LoteDeNotasDoEnemDto,
  OcorrenciaDoLoteDto,
} from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { agruparOcorrencias, fraseDoLote, listaDeLinhas, totaisDoLote } from './resultado-do-lote';

function ocorrencia(
  tipo: string,
  numeroDeInscricao: string | null,
  linhas: (number | string)[] | null = null,
  extra: Partial<OcorrenciaDoLoteDto> = {},
): OcorrenciaDoLoteDto {
  return {
    tipo,
    inscricaoId: null,
    numeroDeInscricao,
    numerosDasLinhas: linhas,
    nomeDoCandidato: null,
    cpfMascarado: null,
    sexo: null,
    opcoesDeCurso: null,
    ...extra,
  };
}

function lote(ocorrencias: OcorrenciaDoLoteDto[]): LoteDeNotasDoEnemDto {
  return { ocorrencias, ausentes: null } as unknown as LoteDeNotasDoEnemDto;
}

function ausente(
  numeroDeInscricao: string | null,
  areas: string[],
  extra: Partial<AusenteDoLoteDto> = {},
): AusenteDoLoteDto {
  return {
    inscricaoId: '01960000-0000-7000-0000-0000000005f0',
    numeroDeInscricao,
    nomeDoCandidato: null,
    cpfMascarado: null,
    areas,
    opcoesDeCurso: null,
    ...extra,
  };
}

describe('agruparOcorrencias', () => {
  it('devolve só os grupos com itens, na ordem sem nota, linha sem inscrito, conflito', () => {
    const grupos = agruparOcorrencias(
      lote([
        ocorrencia('CONFLITO', 'INS-1', [3, 9]),
        ocorrencia('LINHA_SEM_INSCRITO', null, [14]),
        ocorrencia('INSCRITO_SEM_LINHA', 'INS-10'),
        ocorrencia('INSCRITO_SEM_LINHA', 'INS-2'),
      ]),
    );

    expect(grupos.map((g) => g.tipo)).toEqual(['inscritoSemLinha', 'linhaSemInscrito', 'conflito']);
    expect(grupos[0].itens.map((i) => i.inscricao)).toEqual(['INS-2', 'INS-10']);
  });

  it('a linha sem inscrito vira um item por linha, em ordem, com nome, sexo por extenso e CPF', () => {
    const grupos = agruparOcorrencias(
      lote([
        ocorrencia('LINHA_SEM_INSCRITO', null, ['30', 4], {
          nomeDoCandidato: 'Fernanda Laura Nicole Drumond',
          sexo: 'F',
          cpfMascarado: '***.836.371-**',
        }),
        ocorrencia('LINHA_SEM_INSCRITO', null, [12], { sexo: 'M' }),
      ]),
    );

    const itens = grupos[0].itens;
    expect(itens.map((i) => i.linhas)).toEqual([[4], [12], [30]]);
    expect(itens[0]).toMatchObject({
      candidato: 'Fernanda Laura Nicole Drumond',
      sexo: 'Feminino',
      cpf: '***.836.371-**',
    });
    expect(itens[1]).toMatchObject({ candidato: null, sexo: 'Masculino' });
  });

  it('o sexo que a tela não conhece aparece como veio, e a ausência fica nula', () => {
    const [grupo] = agruparOcorrencias(
      lote([
        ocorrencia('LINHA_SEM_INSCRITO', null, [1], { sexo: 'X' }),
        ocorrencia('LINHA_SEM_INSCRITO', null, [2]),
      ]),
    );

    expect(grupo.itens.map((i) => i.sexo)).toEqual(['X', null]);
  });

  it('o conflito traz o inscrito e as linhas em conflito', () => {
    const [grupo] = agruparOcorrencias(lote([ocorrencia('CONFLITO', 'INS-1', ['9', 3])]));

    expect(grupo.itens[0]).toMatchObject({ inscricao: 'INS-1', linhas: [3, 9] });
    expect(grupo.texto).toContain('até o CEPS conferir');
  });

  it('um tipo desconhecido cai em outras ocorrências, com o tipo como veio', () => {
    const [grupo] = agruparOcorrencias(lote([ocorrencia('TIPO_NOVO', 'INS-1', [5])]));

    expect(grupo.tipo).toBe('outras');
    expect(grupo.itens[0]).toMatchObject({
      candidato: 'TIPO_NOVO',
      inscricao: 'INS-1',
      linhas: [5],
    });
  });

  it('os ausentes viram a aba Ausentes, com as áreas em nome curto e a desconhecida como veio', () => {
    const grupos = agruparOcorrencias({
      ocorrencias: null,
      ausentes: [ausente('INS-2', ['CIENCIAS_DA_NATUREZA', 'REDACAO', 'AREA_NOVA'])],
    } as unknown as LoteDeNotasDoEnemDto);

    expect(grupos.map((g) => g.rotulo)).toEqual(['Ausentes']);
    expect(grupos[0].itens[0].areas).toEqual(['Natureza', 'Redação', 'AREA_NOVA']);
  });

  it('o inscrito sem número de inscrição vai para o fim da ordenação', () => {
    const [grupo] = agruparOcorrencias({
      ocorrencias: null,
      ausentes: [ausente(null, ['LINGUAGENS']), ausente('INS-10', []), ausente('INS-2', [])],
    } as unknown as LoteDeNotasDoEnemDto);

    expect(grupo.itens.map((i) => i.inscricao)).toEqual(['INS-2', 'INS-10', null]);
  });

  it('os cursos seguem a ordem da opção, mesmo chegando invertidos', () => {
    const [grupo] = agruparOcorrencias(
      lote([
        ocorrencia('INSCRITO_SEM_LINHA', 'INS-1', null, {
          opcoesDeCurso: [
            { ordem: '2', oferta: 'Medicina — Marabá' },
            { ordem: '1', oferta: 'Medicina — Xinguara' },
          ],
        }),
      ]),
    );

    expect(grupo.itens[0].cursos).toEqual(['Medicina — Xinguara', 'Medicina — Marabá']);
  });

  it('sem ocorrências não há grupos', () => {
    expect(agruparOcorrencias({ ocorrencias: null } as unknown as LoteDeNotasDoEnemDto)).toEqual(
      [],
    );
  });
});

describe('totaisDoLote e fraseDoLote', () => {
  const lote = {
    totalDeLinhas: '1300',
    totalDeInscritosComNota: '1230',
    totalDeLancamentos: 6150,
    totalDeInscritosSemLinha: '12',
    totalDeLinhasSemInscrito: 1,
    totalDeInscritosEmConflito: '0',
  } as unknown as LoteDeNotasDoEnemDto;

  it('converte os totais que chegam como texto', () => {
    expect(totaisDoLote(lote)).toMatchObject({
      linhasLidas: 1300,
      inscritosComNota: 1230,
      notasLancadas: 6150,
    });
  });

  it('a frase omite o conflito quando não há e concorda o plural', () => {
    expect(fraseDoLote(totaisDoLote(lote))).toBe(
      '1.230 inscritos com nota, 12 sem nota, 1 linha sem inscrito.',
    );
  });
});

describe('listaDeLinhas', () => {
  it('reúne três ou mais seguidas em intervalo e liga a última com "e"', () => {
    expect(listaDeLinhas([10, 13, 16, 17, 18, 19, 22])).toBe('10, 13, 16–19 e 22');
  });

  it('mantém separadas duas seguidas', () => {
    expect(listaDeLinhas([4, 5])).toBe('4 e 5');
  });

  it('uma única linha sai sem conectivo', () => {
    expect(listaDeLinhas([14])).toBe('14');
  });
});

describe('fraseDoLote com ausentes', () => {
  const base = {
    linhasLidas: 10,
    inscritosComNota: 8,
    notasLancadas: 40,
    inscritosSemNota: 1,
    linhasSemInscrito: 0,
    inscritosEmConflito: 0,
    inscritosAusentes: 0,
  };

  it('só cita os ausentes quando há algum', () => {
    expect(fraseDoLote(base)).not.toContain('ausente');
    expect(fraseDoLote({ ...base, inscritosAusentes: 2 })).toBe(
      '8 inscritos com nota, 1 sem nota, 0 linhas sem inscrito, 2 inscritos ausentes.',
    );
  });
});
