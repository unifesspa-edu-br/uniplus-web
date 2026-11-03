import { HttpContext } from '@angular/common/http';
import { Injectable, Signal, signal } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { ApiResult, ChaveDeSubstituicao, isApiOk } from '@uniplus/shared-core/http';

import { ChaveRetida } from './chave-retida';
import { ResultadoDaGravacao, SUPERADO } from './resultado-da-gravacao';

export type RecursoDoProcesso =
  | 'taxa'
  | 'distribuicao'
  | 'opcoesDeCurso'
  | 'cascata'
  | 'etapas'
  | 'documentosExigidos'
  | 'cronograma'
  | 'algoritmoContagem'
  | 'classificacao'
  | 'opcoesDeclaradas'
  | 'bonus'
  | 'desempate'
  | 'atendimento'
  | 'publicacao'
  | 'cabecalhoDoFormulario'
  | 'itensDoFormulario'
  | 'termosDoFormulario'
  | 'aplicacaoDeModelo'
  | 'referenciaTemporal'
  | 'identificadorLegivel'
  | 'iniciacaoDoEdital';

export type OperacaoRetida = 'criacao' | 'confirmacaoDoEdital';

type Enviar<T> = (contexto: HttpContext) => Observable<ApiResult<T>>;

/**
 * Ponto único por onde a configuração do processo é gravada: a geração do cadastro, a
 * `Idempotency-Key` de cada recurso e a tradução da resposta em `ResultadoDaGravacao`.
 *
 * A geração muda a cada descarte. Uma resposta que chega depois de o editor passar a outro
 * processo não pode escrever por cima das chaves novas: a retentativa do cadastro atual usaria
 * uma chave diferente da que o servidor viu.
 */
@Injectable()
export class GravacaoDoProcesso {
  private readonly numeroDaGeracao = signal(0);
  readonly geracao: Signal<number> = this.numeroDaGeracao.asReadonly();

  // Cada recurso tem a sua chave: compartilhá-la faria a gravação de um invalidar a do outro.
  private readonly chaves = new Map<RecursoDoProcesso, ChaveDeSubstituicao>();
  private readonly retidas: Record<OperacaoRetida, ChaveRetida> = {
    criacao: new ChaveRetida(),
    confirmacaoDoEdital: new ChaveRetida(),
  };

  async gravar<T = void>(
    recurso: RecursoDoProcesso,
    intencao: unknown,
    enviar: Enviar<T>,
  ): Promise<ResultadoDaGravacao<T>> {
    const geracao = this.geracao();
    const chave = this.chaveDe(recurso);
    const result = await firstValueFrom(enviar(chave.contextoPara(intencao)));

    if (geracao !== this.geracao()) return superado();
    if (isApiOk(result)) {
      chave.renovar();
      return { ok: true, dados: result.data };
    }
    return { ok: false, problem: result.problem, inconclusiva: chave.recusada(result) };
  }

  /** Remoção sem `Idempotency-Key`: repetir encontra o recurso já removido. */
  async remover(enviar: Enviar<void>): Promise<ResultadoDaGravacao<void>> {
    const geracao = this.geracao();
    const result = await firstValueFrom(enviar(new HttpContext()));

    if (geracao !== this.geracao()) return superado();
    return isApiOk(result)
      ? { ok: true, dados: undefined }
      : { ok: false, problem: result.problem, inconclusiva: false };
  }

  async gravarRetida<T = void>(
    operacao: OperacaoRetida,
    enviar: Enviar<T>,
  ): Promise<ResultadoDaGravacao<T>> {
    const geracao = this.geracao();
    const chave = this.retidas[operacao];
    const result = await firstValueFrom(enviar(chave.contexto()));

    if (geracao !== this.geracao()) return superado();
    chave.concluir(result);
    return isApiOk(result)
      ? { ok: true, dados: result.data }
      : { ok: false, problem: result.problem, inconclusiva: chave.pendente };
  }

  retidaPendente(operacao: OperacaoRetida): boolean {
    return this.retidas[operacao].pendente;
  }

  /**
   * Esquece o cadastro acompanhado. A criação perde a pendência; a confirmação do edital só
   * ganha chave nova e mantém a pendência, que é de quem a registrou.
   */
  descartar(): void {
    this.numeroDaGeracao.update((n) => n + 1);
    this.chaves.forEach((chave) => chave.renovar());
    this.retidas.criacao.descartar({ esquecerPendente: true });
    this.retidas.confirmacaoDoEdital.descartar({ esquecerPendente: false });
  }

  private chaveDe(recurso: RecursoDoProcesso): ChaveDeSubstituicao {
    let chave = this.chaves.get(recurso);
    if (chave === undefined) {
      chave = new ChaveDeSubstituicao();
      this.chaves.set(recurso, chave);
    }
    return chave;
  }
}

function superado(): ResultadoDaGravacao<never> {
  return { ok: false, problem: SUPERADO, inconclusiva: false };
}
