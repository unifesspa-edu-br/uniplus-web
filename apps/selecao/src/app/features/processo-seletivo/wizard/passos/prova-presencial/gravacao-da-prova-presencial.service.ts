import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import {
  isApiOk,
  paginaDoErro,
  ProblemI18nService,
  type ProblemDetails,
} from '@uniplus/shared-core/http';

import type { ValidacaoDoPasso } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicial } from '../../shared/cadastro-inicial.service';
import {
  gravarNoPasso,
  RESPOSTA_DESCARTADA,
  type RespostaDescartada,
} from '../../shared/gravacao/gravacao-no-passo';
import { provaPresencialDe } from '../../shared/hidratacao/hidratacao-da-prova-presencial';
import { NumeracaoDasRespostasRecusadas } from '../../shared/recusas/numeracao-das-respostas-recusadas';
import type { RecusaOrdenada } from '../../shared/recusas/ordem-das-recusas';
import {
  pedidoDaDeclaracao,
  type DeclaracaoDaProvaPresencial,
} from './declaracao-da-prova-presencial';
import { recusasDaProvaPresencial } from './recusas-da-prova-presencial';
import type { DefinirProvaPresencialRequest } from '@uniplus/shared-data/selecao';

const AVISO_RELEITURA =
  'Declaração salva. Não foi possível reler o processo agora; recarregue a página para ver os nomes dos municípios.';
const ERRO_LOCALIDADES =
  'O serviço de localidades não respondeu. Nada foi alterado; tente salvar de novo mais tarde.';

@Injectable()
export class GravacaoDaProvaPresencialService {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly cadastro = inject(CadastroInicial);
  private readonly numeracao = inject(NumeracaoDasRespostasRecusadas);
  private readonly problemI18n = inject(ProblemI18nService);
  readonly recusasDaGravacao = signal(recusasDaProvaPresencial([], []));
  readonly aviso = signal<string | null>(null);
  readonly gravadaNoServidor = signal<{
    processoId: string;
    declaracao: DeclaracaoDaProvaPresencial;
  } | null>(null);

  constructor() {
    let processoAnterior = this.store.processoSeletivoId();
    effect(() => {
      const processo = this.store.processoSeletivoId();
      if (processo === processoAnterior) return;
      processoAnterior = processo;
      untracked(() => this.esquecerOQueSobrouDoProcessoAnterior());
    });
  }

  private esquecerOQueSobrouDoProcessoAnterior(): void {
    this.gravadaNoServidor.set(null);
    this.recusasDaGravacao.set(recusasDaProvaPresencial([], []));
    this.aviso.set(null);
  }

  gravar(
    processoSeletivoId: string,
    declaracao: DeclaracaoDaProvaPresencial,
  ): Promise<ValidacaoDoPasso | RespostaDescartada> {
    const pedido = pedidoDaDeclaracao(declaracao);
    if (pedido === null)
      return Promise.resolve({
        valid: false,
        messages: ['Escolha se o processo tem prova presencial.'],
      });
    return gravarNoPasso(this.store, () => this.enviar(processoSeletivoId, declaracao, pedido));
  }

  private async enviar(
    processoId: string,
    declaracao: DeclaracaoDaProvaPresencial,
    pedido: DefinirProvaPresencialRequest,
  ) {
    const geracao = this.store.geracao();
    this.aviso.set(null);
    const resultado = await this.cadastro.definirProvaPresencial(processoId, pedido);
    if (!this.mesmoProcesso(processoId, geracao)) return RESPOSTA_DESCARTADA;
    if (!resultado.ok) return this.tratarFalha(resultado.problem, declaracao, processoId, geracao);
    this.registrarGravacao(processoId, declaracao);
    return this.confirmarGravacao(processoId, geracao);
  }

  private registrarGravacao(processoId: string, declaracao: DeclaracaoDaProvaPresencial): void {
    const municipios = declaracao.temProvaPresencial
      ? declaracao.municipios.map((municipio) => ({ ...municipio, nome: null }))
      : [];
    this.gravadaNoServidor.set({ processoId, declaracao: { ...declaracao, municipios } });
  }

  private async confirmarGravacao(processoId: string, geracao: number): Promise<ValidacaoDoPasso> {
    this.recusasDaGravacao.set(recusasDaProvaPresencial([], []));
    const lido = await this.reler(processoId, geracao);
    if (!this.mesmoProcesso(processoId, geracao)) return RESPOSTA_DESCARTADA;
    if (!lido) this.aviso.set(AVISO_RELEITURA);
    return { valid: true };
  }

  private async tratarFalha(
    problema: ProblemDetails,
    declaracao: DeclaracaoDaProvaPresencial,
    processoId: string,
    geracao: number,
  ): Promise<ValidacaoDoPasso> {
    if (problema.status === 400 || problema.status === 422)
      this.registrarRecusas(problema, declaracao);
    if (problema.status === 409) await this.reler(processoId, geracao);
    if (!this.mesmoProcesso(processoId, geracao)) return RESPOSTA_DESCARTADA;
    const mensagem =
      problema.status === 503 ? ERRO_LOCALIDADES : this.problemI18n.resolve(problema).title;
    return { valid: false, messages: [mensagem] };
  }

  private registrarRecusas(
    problema: ProblemDetails,
    declaracao: DeclaracaoDaProvaPresencial,
  ): void {
    const resposta = this.numeracao.proxima();
    const recusas = recusasOrdenadas(problema, resposta);
    const municipios = declaracao.temProvaPresencial ? declaracao.municipios : [];
    this.recusasDaGravacao.set(recusasDaProvaPresencial(recusas, municipios));
  }

  private mesmoProcesso(processoId: string, geracao: number): boolean {
    return this.store.geracao() === geracao && this.store.processoSeletivoId() === processoId;
  }

  private async reler(processoId: string, geracao: number): Promise<boolean> {
    try {
      const detalhe = await this.cadastro.obterDetalhe(processoId);
      if (!isApiOk(detalhe) || !this.mesmoProcesso(processoId, geracao)) return false;
      const declaracao = provaPresencialDe(detalhe.data);
      this.gravadaNoServidor.set({ processoId, declaracao });
      this.store.projetarSecao('provaPresencial', declaracao);
      return true;
    } catch {
      return false;
    }
  }
}

function recusasOrdenadas(problema: ProblemDetails, resposta: number): RecusaOrdenada[] {
  return (problema.errors ?? []).map((erro, ordem) => ({
    campo: erro.field ?? '',
    codigo: erro.code,
    mensagem: erro.message,
    pagina: paginaDoErro(problema, erro.code),
    ordem,
    resposta,
    origem: 'gravacao',
    aConferir: false,
  }));
}
