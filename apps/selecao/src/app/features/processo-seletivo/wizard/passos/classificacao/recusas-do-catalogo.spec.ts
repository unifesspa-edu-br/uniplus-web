import type { ProblemDetails } from '@uniplus/shared-core/http';
import { describe, expect, it } from 'vitest';

import { NOME_DO_PASSO_DA_FORMULA } from '../../processo-seletivo.data';
import {
  controleDoCatalogo,
  recusaDaRegraDaFormula,
  recusasDoCatalogo,
} from './recusas-do-catalogo';

const BASE = 'https://erros.exemplo.test/erros';
const NAO_ENCONTRADA = 'uniplus.selecao.configuracao_classificacao.regra_nao_encontrada';
const TIPO_INVALIDO = 'uniplus.selecao.configuracao_classificacao.regra_tipo_invalido';

function problema(
  errors: readonly { field?: string; code: string; message: string }[],
  type = `${BASE}/uniplus.selecao.validacao`,
): ProblemDetails {
  return {
    type,
    title: 'Campos inválidos.',
    status: 422,
    code: 'uniplus.selecao.validacao',
    traceId: 'trace-1',
    errors,
  } as ProblemDetails;
}

describe('recusas do catálogo da classificação', () => {
  it.each([
    ['regraCalculoCodigo', 'regraCalculo'],
    ['regraArredondamentoCodigo', 'regraArredondamento'],
    ['regraOrdemAlocacaoCodigo', 'regraOrdemAlocacao'],
    ['regrasEliminacao[0].regraCodigo', 'regraEliminacao.0'],
    ['regrasEliminacao[12].regraCodigo', 'regraEliminacao.12'],
  ] as const)('leva o campo %s ao controle %s', (campo, controle) => {
    const mapa = recusasDoCatalogo(
      problema([{ field: campo, code: NAO_ENCONTRADA, message: 'M' }]),
    );

    expect([...mapa.keys()]).toEqual([controle]);
    expect(mapa.get(controle)).toEqual([
      { codigo: NAO_ENCONTRADA, mensagem: 'M', pagina: `${BASE}/${NAO_ENCONTRADA}` },
    ]);
  });

  it('reconhece o campo pelo último segmento, sem diferenciar maiúsculas', () => {
    expect(controleDoCatalogo('$.RegraCalculoCodigo')).toBe('regraCalculo');
    expect(controleDoCatalogo('request.regraarredondamentocodigo')).toBe('regraArredondamento');
    expect(controleDoCatalogo('$.regrasEliminacao[3].REGRACODIGO')).toBe('regraEliminacao.3');
    expect(controleDoCatalogo('Request.RegrasEliminacao[1].RegraCodigo')).toBe('regraEliminacao.1');
  });

  it('deixa de fora o campo desconhecido, o da regra sem posição e o item sem sufixo', () => {
    const mapa = recusasDoCatalogo(
      problema([
        { field: 'casasArredondamento', code: 'a', message: 'Das casas.' },
        { field: 'regrasEliminacao.regraCodigo', code: 'b', message: 'Sem posição.' },
        { field: 'regrasEliminacao[0]', code: 'c', message: 'Do item.' },
        { field: 'regrasEliminacao[0].etapaRef', code: 'd', message: 'Da etapa.' },
        { code: 'e', message: 'Geral.' },
      ]),
    );

    expect(mapa.size).toBe(0);
  });

  it('guarda várias recusas do mesmo controle na ordem recebida', () => {
    const mapa = recusasDoCatalogo(
      problema([
        { field: 'regraCalculoCodigo', code: NAO_ENCONTRADA, message: 'Primeira.' },
        { field: 'regraOrdemAlocacaoCodigo', code: TIPO_INVALIDO, message: 'Da ordem.' },
        { field: 'regraCalculoCodigo', code: TIPO_INVALIDO, message: 'Segunda.' },
      ]),
    );

    expect(mapa.get('regraCalculo')?.map((r) => r.mensagem)).toEqual(['Primeira.', 'Segunda.']);
    expect(mapa.get('regraOrdemAlocacao')?.map((r) => r.mensagem)).toEqual(['Da ordem.']);
  });

  it('mostra uma só vez a mesma mensagem com o mesmo código, mas não com outro código', () => {
    const mapa = recusasDoCatalogo(
      problema([
        { field: 'regrasEliminacao[1].regraCodigo', code: TIPO_INVALIDO, message: 'Igual.' },
        { field: '$.regrasEliminacao[1].regraCodigo', code: TIPO_INVALIDO, message: 'Igual.' },
        { field: 'regrasEliminacao[1].regraCodigo', code: NAO_ENCONTRADA, message: 'Igual.' },
      ]),
    );

    expect(mapa.get('regraEliminacao.1')?.map((r) => r.codigo)).toEqual([
      TIPO_INVALIDO,
      NAO_ENCONTRADA,
    ]);
  });

  it('separa a recusa de cada regra de eliminação pela posição', () => {
    const mapa = recusasDoCatalogo(
      problema([
        { field: 'regrasEliminacao[2].regraCodigo', code: NAO_ENCONTRADA, message: 'Da terceira.' },
        { field: 'regrasEliminacao[0].regraCodigo', code: TIPO_INVALIDO, message: 'Da primeira.' },
      ]),
    );

    expect(mapa.get('regraEliminacao.0')?.[0].mensagem).toBe('Da primeira.');
    expect(mapa.get('regraEliminacao.2')?.[0].mensagem).toBe('Da terceira.');
    expect(mapa.has('regraEliminacao.1')).toBe(false);
  });

  it('leva a página do código só quando o type é https e termina no código do problema', () => {
    const erros = [{ field: 'regraCalculoCodigo', code: NAO_ENCONTRADA, message: 'M' }];

    expect(recusasDoCatalogo(problema(erros)).get('regraCalculo')?.[0].pagina).toBe(
      `${BASE}/${NAO_ENCONTRADA}`,
    );
    expect(
      recusasDoCatalogo(problema(erros, 'http://erros.exemplo.test/uniplus.selecao.validacao')).get(
        'regraCalculo',
      )?.[0].pagina,
    ).toBeNull();
  });

  it('devolve mapa vazio para o problema sem causas', () => {
    expect(recusasDoCatalogo({ ...problema([]), errors: undefined }).size).toBe(0);
  });

  it('diz o campo e o passo da recusa de cada regra da fórmula com a mensagem da API', () => {
    const texto = (field: string) => recusaDaRegraDaFormula({ field, message: 'Mensagem da API.' });

    expect(texto('regraCalculoCodigo')).toBe(
      `Regra de cálculo, no passo ${NOME_DO_PASSO_DA_FORMULA}: Mensagem da API.`,
    );
    expect(texto('regraArredondamentoCodigo')).toContain('Regra de arredondamento, no passo');
    expect(texto('regraOrdemAlocacaoCodigo')).toContain('Ordem de alocação, no passo');
    expect(texto('regrasEliminacao[0].regraCodigo')).toBeNull();
    expect(texto('casasArredondamento')).toBeNull();
  });
});
