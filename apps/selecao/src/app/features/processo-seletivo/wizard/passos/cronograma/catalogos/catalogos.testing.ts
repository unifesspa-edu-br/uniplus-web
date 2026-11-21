import { HttpHeaders } from '@angular/common/http';
import { of } from 'rxjs';
import { apiFailure, apiOk } from '@uniplus/shared-core/http';
import {
  EfeitoSuspensivoCodigo,
  GuardaDaVagaCodigo,
  UnidadePrazoCodigo,
} from '@uniplus/shared-data/selecao';

/** Página única: sem header `Link`, `coletarPaginas` para na primeira. */
export function pagina<T>(dados: readonly T[]) {
  return of(apiOk(dados, 200, new HttpHeaders()));
}

/** Resposta de falha do servidor, no formato que a API devolve. */
export function falhaDoServidor() {
  return of(
    apiFailure(
      { type: 'about:blank', title: 'x', status: 500, code: 'uniplus.erro', traceId: '' },
      500,
      new HttpHeaders(),
    ),
  );
}

export const UNIDADES_DO_PRAZO_DE_TESTE = [
  { codigo: UnidadePrazoCodigo.horas, rotulo: 'Horas' },
  { codigo: UnidadePrazoCodigo.dias, rotulo: 'Dias corridos' },
  { codigo: UnidadePrazoCodigo.diasUteis, rotulo: 'Dias úteis' },
] as const;

export const EFEITOS_SUSPENSIVOS_DE_TESTE = [
  {
    codigo: EfeitoSuspensivoCodigo.semEfeitoSuspensivo,
    rotulo: 'Sem efeito suspensivo',
    descricao: 'O recurso não suspende o processo.',
  },
] as const;

export const GUARDAS_DA_VAGA_DE_TESTE = [
  {
    codigo: GuardaDaVagaCodigo.ateOResultadoDefinitivo,
    rotulo: 'Guarda até o resultado definitivo',
    descricao: 'A vaga fica guardada até o resultado definitivo.',
  },
  {
    codigo: GuardaDaVagaCodigo.naoGuarda,
    rotulo: 'Não guarda',
    descricao: 'A vaga não fica guardada.',
  },
] as const;

/** O cliente das opções do recurso, respondendo com as listas de teste; `falhar` derruba uma delas. */
export function opcoesDoRecursoApiDeTeste(
  falhar: 'unidades' | 'efeitos' | 'guardas' | null = null,
) {
  const resposta = <T>(nome: string, dados: readonly T[]) =>
    nome === falhar ? falhaDoServidor() : pagina(dados);
  return {
    listarUnidadesDoPrazo: () => resposta('unidades', UNIDADES_DO_PRAZO_DE_TESTE),
    listarEfeitosSuspensivos: () => resposta('efeitos', EFEITOS_SUSPENSIVOS_DE_TESTE),
    listarGuardasDaVaga: () => resposta('guardas', GUARDAS_DA_VAGA_DE_TESTE),
  };
}
