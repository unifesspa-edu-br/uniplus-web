import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { type ProblemDetails, ProblemI18nService } from '@uniplus/shared-core/http';
import { OrigemCandidatos } from '@uniplus/shared-data/selecao';

import { StepValidation } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { CadastroInicialService } from '../../../shared/cadastro-inicial.service';
import {
  gravarNoPasso,
  RESPOSTA_DESCARTADA,
  respostaFoiDescartada,
} from '../../../shared/gravacao/gravacao-no-passo';
import {
  ehRecusaDoIdentificadorLegivel,
  normalizarIdentificadorLegivel,
} from '../../../shared/identificador-legivel';

/**
 * A gravação da identificação: cria o processo ao concluir o passo e, com o processo criado,
 * declara o identificador legível quando ele mudou.
 */
@Injectable()
export class GravacaoDaIdentificacaoService {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly cadastro = inject(CadastroInicialService);
  private readonly problemI18n = inject(ProblemI18nService);

  /** Recusa da criação, exibida no passo: o anexo tem o erro dele próprio. */
  readonly erroDeCriacao = signal<string | null>(null);

  /** Recusa do identificador, local ou do servidor, exibida junto ao campo. */
  readonly erroDoIdentificador = signal<string | null>(null);

  /** Campos inválidos detectados na última validação (chave → `.is-invalid`). */
  readonly camposInvalidos = signal<ReadonlySet<string>>(new Set());

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
  async persistir(): Promise<StepValidation> {
    const existente = this.store.processoSeletivoId();
    if (existente !== null) return this.gravarIdentificador(existente);

    const processoId = await this.garantirProcessoCriado();
    if (processoId === null) {
      return {
        valid: false,
        messages: [
          this.erroDeCriacao() ?? 'Não foi possível criar o cadastro inicial. Tente novamente.',
        ],
      };
    }
    return { valid: true };
  }

  /**
   * Cria o processo se ainda não existe, a partir de um instantâneo do rascunho: os campos ficam
   * bloqueados durante a requisição, para que a resposta nunca descreva um estado diferente do enviado.
   */
  private async garantirProcessoCriado(): Promise<string | null> {
    const existente = this.store.processoSeletivoId();
    if (existente !== null) return existente;
    if (this.store.salvando()) return null;

    const faltando = this.camposFaltantesDoComando();
    if (faltando.length > 0) {
      this.erroDeCriacao.set(`Para avançar, preencha: ${faltando.join(', ')}.`);
      return null;
    }

    const criado = await gravarNoPasso(this.store, () => this.criar());
    return respostaFoiDescartada(criado) ? null : criado;
  }

  private async criar(): Promise<string | null> {
    const geracao = this.store.geracao();
    const identificacao = this.store.draft().identificacao;
    const identificador = normalizarIdentificadorLegivel(identificacao.identificadorLegivel);
    const resultado = await this.cadastro.criar({
      nome: identificacao.nome.trim(),
      identificadorLegivel: identificador,
      tipoProcessoOrigemId: this.store.draft().tipoProcesso.selected,
      origemCandidatos: identificacao.origemCandidatos as OrigemCandidatos,
      unidadeAdministradoraOrigemId: identificacao.unidadeAdministradoraId,
      localidadeCodigoIbge: identificacao.localidade?.codigoIbge ?? null,
      localidadeNome: identificacao.localidade?.nome ?? null,
      localidadeUf: identificacao.localidade?.uf ?? null,
    });

    // O editor pode ter passado a outro processo enquanto a criação corria: registrar o id agora
    // o atribuiria ao processo que está em tela.
    if (geracao !== this.store.geracao()) return null;

    if (!resultado.ok) {
      this.store.criacaoIndefinida.set(this.cadastro.temCriacaoPendente());
      this.apontarRecusaDoIdentificador(resultado.problem);
      this.erroDeCriacao.set(
        this.store.criacaoIndefinida()
          ? `${this.problemI18n.resolve(resultado.problem).title} Não é possível saber se o cadastro chegou a ser criado; use "Tentar novamente" para repetir o mesmo envio.`
          : this.problemI18n.resolve(resultado.problem).title,
      );
      return null;
    }

    this.store.criacaoIndefinida.set(false);
    this.identificadorGravado.set(identificador);
    this.store.processoSeletivoId.set(resultado.processoSeletivoId);
    return resultado.processoSeletivoId;
  }

  /** Grava o identificador de um processo já criado, quando ele mudou. */
  private async gravarIdentificador(processoId: string): Promise<StepValidation> {
    const identificador = this.identificadorAGravar();
    if (identificador === null) return { valid: true };
    if (this.store.salvando()) return { valid: false, messages: [] };

    return gravarNoPasso(this.store, async () => {
      const geracao = this.store.geracao();
      const resultado = await this.cadastro.definirIdentificadorLegivel(processoId, {
        identificadorLegivel: identificador,
      });
      if (geracao !== this.store.geracao()) return RESPOSTA_DESCARTADA;

      if (!resultado.ok) {
        if (resultado.inconclusiva) this.identificadorGravado.set(undefined);
        this.apontarRecusaDoIdentificador(resultado.problem);
        return { valid: false, messages: [this.problemI18n.resolve(resultado.problem).title] };
      }

      this.identificadorGravado.set(identificador);
      return { valid: true };
    });
  }

  /** Recusa do servidor sobre o identificador vai para junto do campo, além do aviso do passo. */
  private apontarRecusaDoIdentificador(problem: ProblemDetails): void {
    if (!ehRecusaDoIdentificadorLegivel(problem.code)) return;
    this.erroDoIdentificador.set(this.problemI18n.resolve(problem).title);
    this.camposInvalidos.update((campos) => new Set([...campos, 'identificadorLegivel']));
  }
}
