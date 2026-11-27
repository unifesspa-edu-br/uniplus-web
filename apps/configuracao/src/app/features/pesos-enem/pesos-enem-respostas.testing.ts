import { TestRequest } from '@angular/common/http/testing';

export function problem(
  status: number,
  code: string,
  title: string,
  errors?: readonly { field: string; code: string; message: string }[],
): string {
  return JSON.stringify({
    type: `https://unifesspa-edu-br.github.io/uniplus-developers/erros/${code}`,
    title,
    status,
    code,
    traceId: 'test-trace',
    errors,
  });
}

export const ERRO_500 = {
  status: 500,
  statusText: 'Internal Server Error',
  headers: { 'content-type': 'application/problem+json' },
};

export const SEM_CORPO = { status: 204, statusText: 'No Content' } as const;
export const CRIADO = { status: 201, statusText: 'Created' } as const;

export function recusa(status: number, code: string, errors?: Parameters<typeof problem>[3]) {
  return [
    problem(status, code, 'Falha', errors),
    { status, statusText: 'Erro', headers: { 'content-type': 'application/problem+json' } },
  ] as const;
}

export function recusa422(
  req: TestRequest | undefined,
  errors: readonly { field: string; code: string; message: string }[],
): void {
  req?.flush(
    problem(422, errors[0]?.code ?? 'uniplus.configuracao.peso_area_enem.regra', 'Recusa', errors),
    {
      status: 422,
      statusText: 'Unprocessable Entity',
      headers: { 'content-type': 'application/problem+json' },
    },
  );
}

export const NAO_PROCESSAVEL = { status: 422, statusText: 'Unprocessable Entity' } as const;
export const NAO_ENCONTRADO = { status: 404, statusText: 'Not Found' } as const;
export const PROIBIDO = { status: 403, statusText: 'Forbidden' } as const;

export const PROBLEMA_PESO_EXCEDE_MAXIMO = problem(
  422,
  'uniplus.configuracao.peso_area_enem.peso_excede_maximo',
  'Peso excede o máximo',
);
export const PROBLEMA_LINHA_NAO_ENCONTRADA = problem(
  404,
  'uniplus.configuracao.peso_area_enem.nao_encontrado',
  'Linha de pesos não encontrada',
);

/** Responde a requisição com o corpo de problema e a situação HTTP dada. */
export function flushProblema(
  req: TestRequest | undefined,
  situacao: { readonly status: number; readonly statusText: string },
  corpo: string,
): void {
  req?.flush(corpo, { ...situacao, headers: { 'content-type': 'application/problem+json' } });
}

export function confirmarSemCorpo(req: TestRequest): void {
  req.flush(null, SEM_CORPO);
}

/** Responde cada criação com um identificador novo. */
export function responderCriacoes(requisicoes: readonly TestRequest[]): void {
  requisicoes.forEach((req, indice) => req.flush(`novo-id-${indice}`, CRIADO));
}
