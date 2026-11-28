import {
  antecedenciaEfetivaEmSegundos,
  lerPrazoDaCredencial,
  MARGEM_DO_PERIODO_MAXIMO_EM_SEGUNDOS,
} from './prazo-da-credencial';

const INATIVIDADE_EM_SEGUNDOS = 1800;
const PERIODO_MAXIMO_EM_SEGUNDOS = 36000;
const AUTENTICADO_EM = 1000;

function ler(
  exp: number | undefined,
  autenticadoEm: number | undefined = AUTENTICADO_EM,
  diferenca = 0,
) {
  return lerPrazoDaCredencial({ exp }, autenticadoEm, diferenca, PERIODO_MAXIMO_EM_SEGUNDOS);
}

describe('lerPrazoDaCredencial', () => {
  it('não há prazo sem credencial ou sem vencimento', () => {
    expect(
      lerPrazoDaCredencial(undefined, AUTENTICADO_EM, 0, PERIODO_MAXIMO_EM_SEGUNDOS),
    ).toBeNull();
    expect(ler(undefined)).toBeNull();
  });

  it('deriva o vencimento no relógio do navegador pela diferença para o do servidor', () => {
    expect(ler(2000, AUTENTICADO_EM, 5)?.venceEm).toBe(2005 * 1000);
  });

  it('na primeira leitura, vencimento no fim do período máximo é período máximo', () => {
    const exp = AUTENTICADO_EM + PERIODO_MAXIMO_EM_SEGUNDOS;

    expect(ler(exp)?.limite).toBe('periodoMaximo');
  });

  it('vencimento longe do fim do período máximo é inatividade', () => {
    const exp = AUTENTICADO_EM + INATIVIDADE_EM_SEGUNDOS;

    expect(ler(exp)?.limite).toBe('inatividade');
  });

  it('no limite da margem ainda é período máximo', () => {
    const exp = AUTENTICADO_EM + PERIODO_MAXIMO_EM_SEGUNDOS - MARGEM_DO_PERIODO_MAXIMO_EM_SEGUNDOS;

    expect(ler(exp)?.limite).toBe('periodoMaximo');
  });

  it('um segundo além da margem é inatividade', () => {
    const exp =
      AUTENTICADO_EM + PERIODO_MAXIMO_EM_SEGUNDOS - MARGEM_DO_PERIODO_MAXIMO_EM_SEGUNDOS - 1;

    expect(ler(exp)?.limite).toBe('inatividade');
  });

  it('sem o instante da autenticação o limite é inatividade', () => {
    const exp = AUTENTICADO_EM + PERIODO_MAXIMO_EM_SEGUNDOS;

    const prazo = lerPrazoDaCredencial({ exp }, undefined, 0, PERIODO_MAXIMO_EM_SEGUNDOS);

    expect(prazo?.limite).toBe('inatividade');
  });

  it('a diferença de relógio muda o vencimento, não o limite', () => {
    const exp = AUTENTICADO_EM + PERIODO_MAXIMO_EM_SEGUNDOS;

    const prazo = ler(exp, AUTENTICADO_EM, 500);

    expect(prazo?.limite).toBe('periodoMaximo');
    expect(prazo?.venceEm).toBe((exp + 500) * 1000);
  });

  it('nova autenticação, com vencimento igual ao fim do período antigo, é inatividade', () => {
    const fimAntigo = AUTENTICADO_EM + PERIODO_MAXIMO_EM_SEGUNDOS;
    const novaAutenticacao = fimAntigo - INATIVIDADE_EM_SEGUNDOS;

    expect(ler(fimAntigo, novaAutenticacao)?.limite).toBe('inatividade');
  });
});

describe('antecedenciaEfetivaEmSegundos', () => {
  it('sem prazo do acesso, vale a configurada', () => {
    expect(antecedenciaEfetivaEmSegundos(60, null)).toBe(60);
  });

  it('com acesso longo, vale a configurada', () => {
    expect(antecedenciaEfetivaEmSegundos(60, { emitidoEm: 0, venceEm: 300_000 })).toBe(60);
  });

  it('com acesso curto, vale a metade da duração', () => {
    expect(antecedenciaEfetivaEmSegundos(600, { emitidoEm: 0, venceEm: 300_000 })).toBe(150);
  });
});
