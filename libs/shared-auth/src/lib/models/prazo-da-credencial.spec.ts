import { lerPrazoDaCredencial, type PrazoDaCredencial } from './prazo-da-credencial';

const INATIVIDADE_EM_SEGUNDOS = 600;

function credencial(iat: number, duracaoEmSegundos: number) {
  return { iat, exp: iat + duracaoEmSegundos };
}

describe('lerPrazoDaCredencial', () => {
  it('não há prazo sem credencial ou sem os instantes', () => {
    expect(lerPrazoDaCredencial(undefined, 0, null)).toBeNull();
    expect(lerPrazoDaCredencial({ iat: 100 }, 0, null)).toBeNull();
    expect(lerPrazoDaCredencial({ exp: 100 }, 0, null)).toBeNull();
  });

  it('deriva o vencimento no relógio do navegador pela diferença para o do servidor', () => {
    const prazo = lerPrazoDaCredencial(credencial(1000, INATIVIDADE_EM_SEGUNDOS), 5, null);

    expect(prazo?.venceEm).toBe((1000 + INATIVIDADE_EM_SEGUNDOS + 5) * 1000);
    expect(prazo?.concedidoMs).toBe(INATIVIDADE_EM_SEGUNDOS * 1000);
  });

  it('a primeira credencial vale como inatividade', () => {
    const prazo = lerPrazoDaCredencial(credencial(1000, INATIVIDADE_EM_SEGUNDOS), 0, null);

    expect(prazo?.limite).toBe('inatividade');
    expect(prazo?.maiorConcedidoMs).toBe(INATIVIDADE_EM_SEGUNDOS * 1000);
  });

  it('o mesmo prazo concedido de novo segue sendo inatividade', () => {
    const primeiro = lerPrazoDaCredencial(credencial(1000, INATIVIDADE_EM_SEGUNDOS), 0, null);

    const segundo = lerPrazoDaCredencial(credencial(1300, INATIVIDADE_EM_SEGUNDOS), 0, primeiro);

    expect(segundo?.limite).toBe('inatividade');
  });

  it('um prazo menor que o maior já concedido revela o período máximo', () => {
    const primeiro = lerPrazoDaCredencial(credencial(1000, INATIVIDADE_EM_SEGUNDOS), 0, null);

    const proximo = lerPrazoDaCredencial(credencial(1500, 100), 0, primeiro);

    expect(proximo?.limite).toBe('periodoMaximo');
    expect(proximo?.maiorConcedidoMs).toBe(INATIVIDADE_EM_SEGUNDOS * 1000);
  });

  it('depois do período máximo o limite não volta a ser inatividade', () => {
    const preso: PrazoDaCredencial = {
      venceEm: 0,
      concedidoMs: 100_000,
      maiorConcedidoMs: INATIVIDADE_EM_SEGUNDOS * 1000,
      limite: 'periodoMaximo',
    };

    const proximo = lerPrazoDaCredencial(credencial(2000, INATIVIDADE_EM_SEGUNDOS), 0, preso);

    expect(proximo?.limite).toBe('periodoMaximo');
  });
});
