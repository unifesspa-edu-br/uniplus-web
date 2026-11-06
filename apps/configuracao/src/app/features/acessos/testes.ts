import { HttpHeaders } from '@angular/common/http';
import { apiFailure, apiOk, type ApiResult, type ProblemDetails } from '@uniplus/shared-core/http';
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

export function concedidas(...codigos: string[]) {
  return { tem: (codigo: string) => codigos.includes(codigo) };
}

export function pedido(parcial: Partial<PedidoDeConcessaoDto> = {}): PedidoDeConcessaoDto {
  return {
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
    anexos: [],
    decisoes: [],
    ...parcial,
  };
}

export const UNIDADES = [{ id: 'unidade-1', nome: 'Centro de Seleção', sigla: 'CEPS' }] as const;
