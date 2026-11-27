import {
  ClassificacaoDeProtecaoCodigo,
  EtapaDoPedidoCodigo,
  ResultadoDaDecisaoCodigo,
  SituacaoDoAnexoCodigo,
  SituacaoDoPedidoCodigo,
  TipoDeEscopoCodigo,
  TipoDeGovernancaCodigo,
  TipoDeOrigemCodigo,
} from '@uniplus/shared-data/autorizacao';
import { HttpErrorResponse, HttpHeaders, HttpRequest, HttpResponse } from '@angular/common/http';
import { throwError } from 'rxjs';
import {
  apiFailure,
  apiOk,
  apiResultInterceptor,
  type ApiResult,
  type ProblemDetails,
} from '@uniplus/shared-core/http';
import type { PedidoDeConcessaoDto, VersaoDoTermoDto } from '@uniplus/shared-data/autorizacao';

export const EU = {
  id: 'conta-eu-00000000',
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

/** Um valor de enum como a API o devolve: o código e o rótulo em português. */
function enumerado<C extends string>(codigo: C, rotulo: string) {
  return { codigo, rotulo } as const;
}

export const SITUACAO_DO_PEDIDO = {
  AGUARDANDO_DOCUMENTO: enumerado(
    SituacaoDoPedidoCodigo.AGUARDANDO_DOCUMENTO,
    'Aguardando documento',
  ),
  AGUARDANDO_BENEFICIARIO: enumerado(
    SituacaoDoPedidoCodigo.AGUARDANDO_BENEFICIARIO,
    'Aguardando beneficiário',
  ),
  AGUARDANDO_GESTOR: enumerado(SituacaoDoPedidoCodigo.AGUARDANDO_GESTOR, 'Aguardando gestor'),
  AGUARDANDO_PROTECAO_DE_DADOS: enumerado(
    SituacaoDoPedidoCodigo.AGUARDANDO_PROTECAO_DE_DADOS,
    'Aguardando proteção de dados',
  ),
  APROVADO: enumerado(SituacaoDoPedidoCodigo.APROVADO, 'Aprovado'),
  RECUSADO: enumerado(SituacaoDoPedidoCodigo.RECUSADO, 'Recusado'),
  DEVOLVIDO: enumerado(SituacaoDoPedidoCodigo.DEVOLVIDO, 'Devolvido'),
  CANCELADO: enumerado(SituacaoDoPedidoCodigo.CANCELADO, 'Cancelado'),
};

export const ETAPA_DO_PEDIDO = {
  GESTOR: enumerado(EtapaDoPedidoCodigo.GESTOR, 'Gestor'),
  PROTECAO_DE_DADOS: enumerado(EtapaDoPedidoCodigo.PROTECAO_DE_DADOS, 'Proteção de dados'),
};

export const RESULTADO_DA_DECISAO = {
  APROVADO: enumerado(ResultadoDaDecisaoCodigo.APROVADO, 'Aprovado'),
  RECUSADO: enumerado(ResultadoDaDecisaoCodigo.RECUSADO, 'Recusado'),
  PERFIL_ALTERADO: enumerado(ResultadoDaDecisaoCodigo.PERFIL_ALTERADO, 'Perfil alterado'),
};

export const CLASSIFICACAO_DE_PROTECAO = {
  PUBLICO: enumerado(ClassificacaoDeProtecaoCodigo.PUBLICO, 'Público'),
  INTERNO: enumerado(ClassificacaoDeProtecaoCodigo.INTERNO, 'Interno'),
  PESSOAL: enumerado(ClassificacaoDeProtecaoCodigo.PESSOAL, 'Pessoal'),
  IDENTIFICADOR: enumerado(ClassificacaoDeProtecaoCodigo.IDENTIFICADOR, 'Identificador'),
};

export const TIPO_DE_GOVERNANCA = {
  GESTOR_DE_ACESSOS: enumerado(TipoDeGovernancaCodigo.GESTOR_DE_ACESSOS, 'Gestor de acessos'),
  REPRESENTANTE_DO_CONTROLADOR: enumerado(
    TipoDeGovernancaCodigo.REPRESENTANTE_DO_CONTROLADOR,
    'Representante do controlador',
  ),
};

export const SITUACAO_DO_ANEXO = {
  AGUARDANDO_ENVIO: enumerado(SituacaoDoAnexoCodigo.AGUARDANDO_ENVIO, 'Aguardando envio'),
  EM_VERIFICACAO: enumerado(SituacaoDoAnexoCodigo.EM_VERIFICACAO, 'Em verificação'),
  VERIFICADO: enumerado(SituacaoDoAnexoCodigo.VERIFICADO, 'Verificado'),
};

export const TIPO_DE_ESCOPO = {
  UNIDADE: enumerado(TipoDeEscopoCodigo.UNIDADE, 'Unidade'),
  INSTITUICAO: enumerado(TipoDeEscopoCodigo.INSTITUICAO, 'Instituição'),
};

export const TIPO_DE_ORIGEM = {
  PEDIDO: enumerado(TipoDeOrigemCodigo.PEDIDO, 'Pedido'),
  INSTALACAO: enumerado(TipoDeOrigemCodigo.INSTALACAO, 'Instalação'),
};

const PEDIDO_AGUARDANDO_O_GESTOR = {
  id: 'pedido-1',
  situacao: SITUACAO_DO_PEDIDO.AGUARDANDO_GESTOR,
  etapaAtual: ETAPA_DO_PEDIDO.GESTOR,
  solicitante: { emissor: 'unifesspa', contaId: 'conta-outra-pessoa' },
  beneficiario: {
    email: 'betina.teste@unifesspa.edu.br',
    identidade: { emissor: 'unifesspa', contaId: 'conta-betina-000' },
    nome: 'Betina Teste',
  },
  perfil: { id: 'perfil-1', nome: 'Operador de inscrições' },
  escopo: { tipo: TIPO_DE_ESCOPO.UNIDADE, unidadeId: 'unidade-1' },
  justificativa: 'Atende a comissão do processo seletivo.',
  admitePrazo: true,
  validaAteSugerida: null,
  validaAte: null,
  criadoEm: '2026-10-28T12:00:00Z',
  encerradoEm: null,
  concessaoId: null,
  versao: null,
  anexaraDocumento: false,
  termo: null,
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

/** A versão vigente do termo, como a API a devolve. */
export function versaoDoTermo(parcial: Partial<VersaoDoTermoDto> = {}): VersaoDoTermoDto {
  return {
    id: 'termo-v2',
    numero: 2,
    texto: 'Declaro que tratarei os dados pessoais acessados apenas para a finalidade do processo.',
    resumo: 'a'.repeat(64),
    ato: 'Portaria 12/2026',
    publicadaEm: '2026-11-01T12:00:00Z',
    vigente: true,
    ...parcial,
  };
}
