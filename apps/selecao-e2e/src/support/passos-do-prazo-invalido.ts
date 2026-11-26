import { expect } from '@playwright/test';

export function corpoComPrazoInvalido<D, R, P extends object>(
  documento: D,
  requisitos: R,
  prazo: P,
) {
  const documentoInvalido = {
    ...documento,
    requisitos: { ...requisitos, prazoDeEmissao: { ...prazo, escolha: 'comPrazo' } },
  };
  return [regraComDocumento(documentoInvalido)];
}

function regraComDocumento<D>(documento: D) {
  return { forma: 'DOCUMENTO', cardinalidade: null, indeferimento: null, itens: null, documento };
}

export function conferirRecusaDoPrazo(resposta: {
  status: number;
  corpo: { errors: { field: string; code: string }[] };
}): void {
  expect(resposta.status).toBe(422);
  expect(resposta.corpo.errors).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        field: 'regrasDeComprovacao[0].documento.requisitos.prazoDeEmissao.escolha',
        code: 'uniplus.selecao.prazo_de_emissao.escolha_invalida',
      }),
    ]),
  );
}
