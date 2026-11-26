import { CODIGO_CADASTRO_FORMATO } from './codigo-cadastro.util';
import { formarCodigoDoNome, formarCodigoUnicoDoNome } from './codigo-do-nome.util';

const casosDeCodigo = [
  ['1ª etapa', 'PRIMEIRA_ETAPA'],
  ['2º ciclo', 'SEGUNDO_CICLO'],
  ['21 de abril', 'VINTE_E_UM_DE_ABRIL'],
  ['123', 'CENTO_E_VINTE_E_TRES'],
  ['2026 resultados', 'NUMERO_2026_RESULTADOS'],
  ['Etapa 2', 'ETAPA_2'],
  ['Etapa 1', 'ETAPA_1'],
  ['1', 'UM'],
  ['999', 'NOVECENTOS_E_NOVENTA_E_NOVE'],
  ['1000', 'NUMERO_1000'],
  ['1.000 vagas', 'NUMERO_1000_VAGAS'],
  ['01 etapa', 'UM_ETAPA'],
  ['0', 'ZERO'],
  ['000º', 'ZERO'],
  ['2° ciclo', 'SEGUNDO_CICLO'],
  ['  ! 1ª ação', 'PRIMEIRA_ACAO'],
  ['Educação especial', 'EDUCACAO_ESPECIAL'],
  ['nome__do termo', 'NOME_DO_TERMO'],
  ['_sublinhado inicial', 'SUBLINHADO_INICIAL'],
  ['Comprovante  de   residência.', 'COMPROVANTE_DE_RESIDENCIA'],
  ['RG / CIN', 'RG_CIN'],
  ['Autodeclaração étnico-racial', 'AUTODECLARACAO_ETNICO_RACIAL'],
  ['Declaração de IRPF 2025', 'DECLARACAO_DE_IRPF_2025'],
  ['Lei 12711', 'LEI_12711'],
];

describe('formarCodigoDoNome', () => {
  it.each(casosDeCodigo)('forma código válido para %s', (nome, codigo) => {
    const resultado = formarCodigoDoNome(nome, 80);
    expect(resultado).toEqual({ ok: true, codigo });
    expect(codigo).toMatch(CODIGO_CADASTRO_FORMATO);
  });

  it.each(['', '  ', '!@#$%', '---'])('não forma código para %j', (nome) => {
    expect(formarCodigoDoNome(nome, 80)).toBeNull();
  });

  it('normaliza uma sequência longa de sublinhados no meio do nome', () => {
    expect(formarCodigoDoNome(`nome${'_'.repeat(100_000)}termo`, 80)).toEqual({
      ok: true,
      codigo: 'NOME_TERMO',
    });
  });

  it('não forma código para sequências longas de sublinhados e símbolos', () => {
    expect(formarCodigoDoNome('_'.repeat(100_000), 80)).toBeNull();
    expect(formarCodigoDoNome('!_'.repeat(50_000), 80)).toBeNull();
  });

  it.each([
    'Laudo médico',
    'Ção',
    'nome__do termo',
    '_sublinhado inicial',
    'Histórico do ensino médio',
  ])('forma código válido para %j', (nome) => {
    const resultado = formarCodigoDoNome(nome, 80);
    expect(resultado?.ok).toBe(true);
    if (resultado?.ok) expect(resultado.codigo).toMatch(CODIGO_CADASTRO_FORMATO);
  });

  it('aceita o limite exato e recusa um caractere a mais sem cortar', () => {
    expect(formarCodigoDoNome('etapa', 5)).toEqual({ ok: true, codigo: 'ETAPA' });
    expect(formarCodigoDoNome('etapas', 5)).toEqual({ ok: false, limite: 5 });
    expect(formarCodigoDoNome('nome muito acima do limite', 5)).toEqual({ ok: false, limite: 5 });
  });
});

describe('formarCodigoUnicoDoNome', () => {
  it('preserva os códigos existentes, inclusive o que termina em número', () => {
    const usados = new Set(['ETAPA', 'ETAPA_2']);
    expect(formarCodigoUnicoDoNome('Etapa', 'GRUPO', usados, 80)).toEqual({
      ok: true,
      codigo: 'ETAPA_3',
    });
    expect(formarCodigoUnicoDoNome('Etapa 2', 'GRUPO', usados, 80)).toEqual({
      ok: true,
      codigo: 'ETAPA_2_2',
    });
  });

  it('recusa quando o sufixo não cabe, sem encurtar', () => {
    expect(formarCodigoUnicoDoNome('Etapa', 'GRUPO', new Set(['ETAPA']), 6)).toEqual({
      ok: false,
      limite: 6,
    });
  });

  it('usa e verifica a reserva quando o nome não forma código', () => {
    expect(formarCodigoUnicoDoNome('!', 'GRUPO', new Set(['GRUPO']), 80)).toEqual({
      ok: true,
      codigo: 'GRUPO_2',
    });
    expect(formarCodigoUnicoDoNome('', 'GRUPO', new Set(), 4)).toEqual({ ok: false, limite: 4 });
  });

  it('propaga a recusa do nome longo', () => {
    expect(formarCodigoUnicoDoNome('Etapas', 'GRUPO', new Set(), 5)).toEqual({
      ok: false,
      limite: 5,
    });
  });
});
