import { HttpErrorResponse, HttpHeaders, HttpRequest, HttpResponse } from '@angular/common/http';
import { throwError } from 'rxjs';
import {
  apiFailure,
  apiOk,
  apiResultInterceptor,
  type ApiResult,
  type ProblemDetails,
} from '@uniplus/shared-core/http';
import type { PedidoDeConcessaoDto } from '@uniplus/shared-data/autorizacao';

export const EU = {
  id: 'sub-eu-00000000',
  username: 'leandro',
  email: 'leandro.teste@unifesspa.edu.br',
  nomeCivil: 'Leandro Teste',
  cpf: '',
};

export function ok<T>(dados: T, link?: string): ApiResult<T> {
  return apiOk(dados, 200, new HttpHeaders(link ? { Link: link } : {}));
}

export function recusa(code: string, status = 422, title = 'Recusado'): ApiResult<never> {
  const problem: ProblemDetails = { type: 'x', title, status, code, traceId: '' };
  return apiFailure(problem, status, new HttpHeaders());
}

/** A resposta de erro do servidor com o problema no corpo, como o `HttpClient` a entrega. */
function respostaComProblema(problema: ProblemDetails): HttpErrorResponse {
  return new HttpErrorResponse({
    status: problema.status,
    error: problema,
    headers: new HttpHeaders({ 'content-type': 'application/problem+json' }),
  });
}

/** A recusa como a tela a recebe: o problema do servidor depois de passar pelo interceptor. */
export function recusaPeloInterceptor(
  code: string,
  status: number,
  title: string,
): ApiResult<never> {
  const problema: ProblemDetails = { type: 'x', title, status, code, traceId: '' };
  let resultado: ApiResult<never> | undefined;
  apiResultInterceptor(new HttpRequest('GET', '/x'), () =>
    throwError(() => respostaComProblema(problema)),
  ).subscribe((evento) => {
    if (evento instanceof HttpResponse) resultado = evento.body as ApiResult<never>;
  });
  return resultado as ApiResult<never>;
}

export function concedidas(...codigos: string[]) {
  return { tem: (codigo: string) => codigos.includes(codigo) };
}

const PEDIDO_AGUARDANDO_O_GESTOR = {
  id: 'pedido-1',
  situacao: 'aguardando_gestor',
  etapaAtual: 'gestor',
  solicitante: { emissor: 'unifesspa', sub: 'sub-outra-pessoa' },
  beneficiario: {
    email: 'betina.teste@unifesspa.edu.br',
    identidade: { emissor: 'unifesspa', sub: 'sub-betina-000' },
    nome: 'Betina Teste',
  },
  perfil: { id: 'perfil-1', nome: 'Operador de inscrições' },
  escopo: { tipo: 'unidade', unidadeId: 'unidade-1' },
  justificativa: 'Atende a comissão do processo seletivo.',
  admitePrazo: true,
  validaAteSugerida: null,
  validaAte: null,
  criadoEm: '2026-10-28T12:00:00Z',
  encerradoEm: null,
  concessaoId: null,
  versao: null,
} as const satisfies Partial<PedidoDeConcessaoDto>;

/** Um pedido na fila do gestor; as listas são novas a cada chamada, para um teste não afetar outro. */
export function pedido(parcial: Partial<PedidoDeConcessaoDto> = {}): PedidoDeConcessaoDto {
  return {
    ...PEDIDO_AGUARDANDO_O_GESTOR,
    anexos: [],
    decisoes: [],
    trocasDeVersao: [],
    ...parcial,
  };
}

export const UNIDADES = [{ id: 'unidade-1', nome: 'Centro de Seleção', sigla: 'CEPS' }] as const;
