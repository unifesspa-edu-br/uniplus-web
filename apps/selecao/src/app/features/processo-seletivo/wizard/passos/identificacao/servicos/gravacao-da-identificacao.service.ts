import { computed, effect, inject, Injectable, Injector, signal } from '@angular/core';
import { type ProblemDetails, ProblemI18nService } from '@uniplus/shared-core/http';
import { OrigemCandidatosCodigo } from '@uniplus/shared-data/selecao';
import type { RecusaDoCampo } from '@uniplus/shared-ui/components';

import { ValidacaoDoPasso } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { CadastroInicial } from '../../../shared/cadastro-inicial.service';
import {
  gravarNoPasso,
  RESPOSTA_DESCARTADA,
  respostaFoiDescartada,
} from '../../../shared/gravacao/gravacao-no-passo';
import { recusaDoServidor } from '../../../shared/gravacao/recusa-do-servidor';
import { focarAposRenderizar } from '../../../shared/foco-apos-renderizar';
import { normalizarIdentificadorLegivel } from '../../../shared/identificador-legivel';
import {
  CAMPOS_NA_ORDEM_DA_TELA,
  type CampoDaIdentificacao,
  ID_DO_CAMPO,
  idDaRecusaDoCampo,
  recusasDosCampos,
  resumoDasRecusas,
} from '../recusas-da-criacao';
import type { ResultadoDaValidacao } from '../validacao-da-identificacao';

const AVISO_DE_CRIACAO_INDEFINIDA =
  'Não é possível saber se o cadastro chegou a ser criado; use "Tentar novamente" para repetir o mesmo envio.';

/**
 * A recusa de um campo do passo: as que o servidor fez, com código e página, ou o texto da
 * conferência local, que não tem código nem página.
 */
export interface ErroDoCampo {
  readonly recusas: readonly RecusaDoCampo[];
  readonly local: string | null;
}

/**
 * A gravação da identificação: cria o processo ao concluir o passo e, com o processo criado,
 * declara o identificador legível quando ele mudou.
 */
@Injectable()
export class GravacaoDaIdentificacao {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly cadastro = inject(CadastroInicial);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly injector = inject(Injector);

  /** Resumo da recusa da criação, exibido no passo: uma mensagem por recusa, na ordem recebida. */
  readonly errosDaCriacao = signal<readonly string[]>([]);

  /** A resposta do servidor que recusou a criação; some quando a criação é tentada de novo. */
  private problemaDaCriacao: ProblemDetails | null = null;

  /** A recusa que o servidor fez a cada campo na última resposta; vale até o campo ser corrigido. */
  private readonly recusasDoServidor = signal<
    ReadonlyMap<CampoDaIdentificacao, readonly RecusaDoCampo[]>
  >(new Map());

  /** O que a conferência local achou na última validação. */
  private readonly camposInvalidosLocais = signal<ReadonlySet<string>>(new Set());
  private readonly erroLocalDoIdentificador = signal<string | null>(null);

  /** A recusa de cada campo do passo, local ou do servidor, exibida junto ao campo. */
  readonly errosDosCampos = computed<ReadonlyMap<CampoDaIdentificacao, ErroDoCampo>>(() => {
    const local = this.erroLocalDoIdentificador();
    const doServidor = new Map<CampoDaIdentificacao, ErroDoCampo>(
      [...this.recusasDoServidor()].map(([campo, recusas]) => [campo, { recusas, local: null }]),
    );
    return local === null
      ? doServidor
      : doServidor.set('identificadorLegivel', { recusas: [], local });
  });

  /** Campos marcados como inválidos: os que a conferência local achou e os que o servidor recusou. */
  readonly camposInvalidos = computed<ReadonlySet<string>>(
    () => new Set([...this.camposInvalidosLocais(), ...this.recusasDoServidor().keys()]),
  );

  /**
   * O valor que o servidor tem, contra o qual se decide se há o que gravar ao avançar. Vem do
   * detalhe lido e é atualizado por cada gravação aceita nesta sessão, que o detalhe só
   * refletiria numa releitura.
   *
   * `undefined` quando não se sabe: uma gravação sem resposta conclusiva pode ter aplicado o
   * valor enviado, e comparar com o anterior deixaria de reenviar justamente quando o operador
   * voltasse a ele — o processo publicaria com o valor que o servidor gravou, não com o da tela.
   */
  private readonly identificadorGravado = signal<string | null | undefined>(null);

  /**
   * O processo admite declarar o identificador: é rascunho (ou ainda não existe) e não há
   * criação inconclusiva — nela o comando retido será reenviado com o corpo original, e editar
   * o campo não mudaria o que vai.
   *
   * É o que decide conferir e gravar, e por isso não depende de gravação em curso: a publicação
   * liga a trava de orquestração antes de conferir e regravar os passos, e um critério que a
   * enxergasse deixaria o identificador editado sem conferência nem PUT — o processo publicaria
   * com o valor antigo, que dali em diante não muda mais.
   */
  readonly identificadorDeclaravel = computed(
    () => this.store.edicaoPermitida() && !this.store.criacaoIndefinida(),
  );

  /** O controle aceita digitação — além de declarável, nenhuma gravação em curso. */
  readonly identificadorEditavel = computed(
    () => this.identificadorDeclaravel() && !this.store.operacaoEmAndamento(),
  );

  constructor() {
    effect(() => {
      const detalhe = this.store.remoteSnapshot();
      this.identificadorGravado.set(detalhe?.identificadorLegivel ?? null);
    });
  }

  erroDoCampo(campo: CampoDaIdentificacao): ErroDoCampo | null {
    return this.errosDosCampos().get(campo) ?? null;
  }

  /** Os ids que descrevem o campo: a recusa dele, quando há, e a dica que ele já tinha. */
  descritoPor(campo: CampoDaIdentificacao, dica?: string): string | null {
    const recusa = this.erroDoCampo(campo) === null ? [] : [idDaRecusaDoCampo(campo)];
    return [...recusa, ...(dica ? [dica] : [])].join(' ') || null;
  }

  /**
   * A conferência local atualiza só o que ela mesma achou: a recusa do servidor a um campo que a
   * pessoa não corrigiu continua à vista, porque só uma nova resposta do servidor a desfaz.
   */
  registrarValidacaoLocal(resultado: ResultadoDaValidacao): void {
    this.camposInvalidosLocais.set(resultado.camposInvalidos);
    this.erroLocalDoIdentificador.set(resultado.erroDoIdentificador ?? null);
  }

  /** Corrigir um campo retira a recusa dele; as dos outros campos permanecem. */
  retirarRecusa(campo: CampoDaIdentificacao): void {
    this.recusasDoServidor.update((erros) => new Map([...erros].filter(([c]) => c !== campo)));
    this.camposInvalidosLocais.update((campos) => new Set([...campos].filter((c) => c !== campo)));
    if (campo === 'identificadorLegivel') this.erroLocalDoIdentificador.set(null);
  }

  /** Campos que compõem o comando de criação e ainda estão vazios. */
  camposFaltantesDoComando(): string[] {
    const identificacao = this.store.draft().identificacao;
    const faltando: string[] = [];
    if (!this.store.draft().tipoProcesso.selected) faltando.push('tipo do processo (passo 1)');
    if (!identificacao.nome.trim()) faltando.push('nome do processo seletivo');
    if (!identificacao.unidadeAdministradoraId) faltando.push('unidade administradora');
    if (!identificacao.origemCandidatos) faltando.push('origem dos candidatos');
    if (identificacao.localidade === null) faltando.push('município que rege os prazos');
    if (normalizarIdentificadorLegivel(identificacao.identificadorLegivel) === '') {
      faltando.push('identificador legível');
    }
    return faltando;
  }

  /**
   * O identificador que precisa ir ao servidor, ou `null` quando o servidor já tem o que está na
   * tela (ou quando o campo está travado e não há o que gravar).
   */
  identificadorAGravar(): string | null {
    if (!this.identificadorDeclaravel()) return null;
    const desejado = normalizarIdentificadorLegivel(
      this.store.draft().identificacao.identificadorLegivel,
    );
    const gravado = this.identificadorGravado();
    if (gravado === undefined) return desejado;
    return desejado === (gravado ?? '') ? null : desejado;
  }

  /**
   * Commit assíncrono do passo: cria o cadastro inicial ao concluir a identificação. É aqui que o
   * processo nasce. Idempotente: repetir o passo não cria um segundo.
   */
  async persistir(): Promise<ValidacaoDoPasso> {
    const existente = this.store.processoSeletivoId();
    if (existente !== null) return this.gravarIdentificador(existente);

    const processoId = await this.garantirProcessoCriado();
    if (processoId === null) return this.recusaDaCriacao();
    return { valid: true };
  }

  private recusaDaCriacao(): ValidacaoDoPasso {
    const mensagens = [...this.resumoDaFalhaDaCriacao()];
    return this.problemaDaCriacao === null
      ? { valid: false, messages: mensagens }
      : recusaDoServidor(this.problemaDaCriacao, mensagens);
  }

  private resumoDaFalhaDaCriacao(): readonly string[] {
    const erros = this.errosDaCriacao();
    return erros.length > 0
      ? erros
      : ['Não foi possível criar o cadastro inicial. Tente novamente.'];
  }

  /**
   * Cria o processo se ainda não existe, a partir de um instantâneo do rascunho: os campos ficam
   * bloqueados durante a requisição, para que a resposta nunca descreva um estado diferente do enviado.
   */
  private async garantirProcessoCriado(): Promise<string | null> {
    const existente = this.store.processoSeletivoId();
    if (existente !== null) return existente;
    if (this.store.salvando()) return null;

    this.problemaDaCriacao = null;
    const faltando = this.camposFaltantesDoComando();
    if (faltando.length > 0) {
      this.errosDaCriacao.set([`Para avançar, preencha: ${faltando.join(', ')}.`]);
      return null;
    }

    const criado = await gravarNoPasso(this.store, () => this.criar());
    return respostaFoiDescartada(criado) ? null : criado;
  }

  private async criar(): Promise<string | null> {
    const geracao = this.store.geracao();
    const identificador = normalizarIdentificadorLegivel(
      this.store.draft().identificacao.identificadorLegivel,
    );
    const resultado = await this.cadastro.criar(this.comandoDeCriacao(identificador));

    if (geracao !== this.store.geracao()) return null;
    if (!resultado.ok) {
      this.registrarRecusaDaCriacao(resultado.problem);
      return null;
    }

    return this.registrarCriacao(resultado.processoSeletivoId, identificador);
  }

  private registrarCriacao(processoId: string, identificador: string): string {
    this.recusasDoServidor.set(new Map());
    this.store.criacaoIndefinida.set(false);
    this.identificadorGravado.set(identificador);
    this.store.processoSeletivoId.set(processoId);
    return processoId;
  }

  private comandoDeCriacao(identificador: string) {
    const identificacao = this.store.draft().identificacao;
    return {
      nome: identificacao.nome.trim(),
      identificadorLegivel: identificador,
      tipoProcessoOrigemId: this.store.draft().tipoProcesso.selected,
      origemCandidatos: identificacao.origemCandidatos as OrigemCandidatosCodigo,
      unidadeAdministradoraOrigemId: identificacao.unidadeAdministradoraId,
      localidadeCodigoIbge: identificacao.localidade?.codigoIbge ?? null,
      localidadeNome: identificacao.localidade?.nome ?? null,
      localidadeUf: identificacao.localidade?.uf ?? null,
    };
  }

  private registrarRecusaDaCriacao(problem: ProblemDetails): void {
    this.store.criacaoIndefinida.set(this.cadastro.temCriacaoPendente());
    this.problemaDaCriacao = problem;
    this.apontarRecusasDosCampos(problem);
    const resumo = this.resumoDaRecusa(problem);
    this.errosDaCriacao.set(
      this.store.criacaoIndefinida() ? [...resumo, AVISO_DE_CRIACAO_INDEFINIDA] : resumo,
    );
  }

  /** Cada recusa, uma vez, na ordem recebida — inclusive a que não aponta campo deste passo. */
  private resumoDaRecusa(problem: ProblemDetails): string[] {
    return resumoDasRecusas(problem, this.problemI18n.resolve(problem).title);
  }

  /** Grava o identificador de um processo já criado, quando ele mudou. */
  private async gravarIdentificador(processoId: string): Promise<ValidacaoDoPasso> {
    const identificador = this.identificadorAGravar();
    if (identificador === null) return { valid: true };
    if (this.store.salvando()) return { valid: false, messages: [] };

    return gravarNoPasso(this.store, () => this.declararIdentificador(processoId, identificador));
  }

  private async declararIdentificador(processoId: string, identificador: string) {
    const geracao = this.store.geracao();
    const resultado = await this.cadastro.definirIdentificadorLegivel(processoId, {
      identificadorLegivel: identificador,
    });
    if (geracao !== this.store.geracao()) return RESPOSTA_DESCARTADA;
    if (!resultado.ok) return this.recusaDoIdentificador(resultado);
    this.recusasDoServidor.set(new Map());
    this.identificadorGravado.set(identificador);
    return { valid: true };
  }

  private recusaDoIdentificador(resultado: {
    readonly problem: ProblemDetails;
    readonly inconclusiva: boolean;
  }): ValidacaoDoPasso {
    if (resultado.inconclusiva) this.identificadorGravado.set(undefined);
    this.apontarRecusasDosCampos(resultado.problem);
    return recusaDoServidor(resultado.problem, this.resumoDaRecusa(resultado.problem));
  }

  /** Cada recusa que aponta um campo do passo vai para junto dele, e o foco vai ao primeiro. */
  private apontarRecusasDosCampos(problem: ProblemDetails): void {
    const erros = recusasDosCampos(problem, this.problemI18n.resolve(problem).title);
    if (erros.size === 0 && (problem.errors ?? []).length === 0) return;
    this.recusasDoServidor.set(erros);
    const primeiro = CAMPOS_NA_ORDEM_DA_TELA.find((campo) => erros.has(campo));
    if (primeiro !== undefined) focarAposRenderizar(this.injector, ID_DO_CAMPO[primeiro]);
  }
}
