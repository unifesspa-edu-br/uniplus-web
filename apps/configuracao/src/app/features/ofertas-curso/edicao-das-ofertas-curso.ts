import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import {
  ApiResult,
  ProblemDetails,
  ProblemI18nService,
  ProblemValidationError,
} from '@uniplus/shared-core/http';
import {
  deveRotacionarIdempotencyKey,
  idempotencyKey,
  withIdempotencyKey,
} from '@uniplus/shared-core/idempotency';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { OfertaCursoDto, OfertasCursoApi } from '@uniplus/shared-data/configuracao';
import { aguardarRecarga } from '../../shared/foco';
import {
  OFERTA_EM_BRANCO,
  OfertaCursoForm,
  comandoDeAtualizacao,
  comandoDeCriacao,
  controleDoCampoDoServidor,
  controleDoCodigoDoServidor,
  criarFormularioDeOferta,
  valoresDaOferta,
} from './oferta-curso-form';
import { OfertasCursoStore } from './ofertas-curso.store';
import { acompanharRegrasDaOferta } from './regras-do-formulario-da-oferta';
import { VinculosDaOferta } from './vinculos-da-oferta';

type ModoFormulario = 'criar' | 'editar';

type Escrita = 'salvando' | 'removendo';

/**
 * As escritas de oferta de curso: o formulário de cadastro e edição (abertura, validação e recusas
 * do servidor) e a remoção com confirmação. Salvar e remover compartilham um só indicador, então
 * enquanto uma escrita está em curso a outra não parte.
 */
@Injectable()
export class EdicaoDasOfertasCurso {
  private readonly api = inject(OfertasCursoApi);
  private readonly store = inject(OfertasCursoStore);
  private readonly vinculos = inject(VinculosDaOferta);
  private readonly destroyRef = inject(DestroyRef);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);

  readonly form = criarFormularioDeOferta();
  readonly modo = signal<ModoFormulario>('criar');
  readonly aberto = signal(false);
  readonly erro = signal<string | null>(null);
  readonly titulo = computed(() =>
    this.modo() === 'criar' ? 'Nova oferta de curso' : 'Editar oferta de curso',
  );
  private readonly ofertaEmEdicao = signal<OfertaCursoDto | null>(null);
  private readonly acompanhamento = acompanharRegrasDaOferta(this.form, this.ofertaEmEdicao);
  readonly regras = this.acompanhamento.regras;
  readonly vinculosDoFormulario = this.vinculos.doFormulario(
    this.acompanhamento.escolhidos,
    this.ofertaEmEdicao,
  );

  private readonly escrita = signal<Escrita | null>(null);
  private readonly recarga = aguardarRecarga(
    this.store.carregando,
    computed(() => this.store.mensagemDeErro() !== null),
  );
  /** Há escrita em curso ou a lista ainda não refletiu o que foi gravado: outra não parte. */
  readonly gravando = computed(() => this.escrita() !== null || this.recarga.aguardando());
  /** O formulário está sendo enviado. */
  readonly salvando = computed(() => this.escrita() === 'salvando');
  /** Uma remoção está em curso; o formulário não foi enviado. */
  readonly removendo = computed(() => this.escrita() === 'removendo');

  readonly confirmando = signal(false);
  readonly erroDaRemocao = signal<string | null>(null);
  private readonly ofertaParaRemover = signal<OfertaCursoDto | null>(null);
  private readonly recusaDoSalvamento = signal('');
  private readonly resultadoDoSalvamento = signal('');
  private readonly resultadoDaRemocao = signal('');
  private readonly chaveDeIdempotencia = signal(idempotencyKey.create());

  /** Dentro do diálogo de remoção: o andamento e a recusa, que só fazem sentido com ele aberto. */
  readonly anuncioDaRemocao = computed(() => {
    const oferta = this.ofertaParaRemover();
    if (oferta === null) {
      return '';
    }
    const nome = this.vinculos.rotuloCompletoDoCurso(oferta.cursoId);
    if (this.removendo()) {
      return `Removendo a oferta de curso ${nome}.`;
    }
    const motivo = this.erroDaRemocao();
    return motivo ? `Não foi possível remover a oferta de curso ${nome}. ${motivo}` : '';
  });
  /** Dentro do drawer: o andamento e a recusa, que só fazem sentido com ele aberto. */
  readonly anuncioDoSalvamento = computed(() =>
    this.salvando() ? 'Salvando oferta de curso.' : this.recusaDoSalvamento(),
  );
  /** Na página: o desfecho, anunciado quando nenhuma sobreposição está aberta para dizê-lo. */
  readonly anuncioDaPagina = computed(() =>
    this.confirmando() || this.aberto()
      ? ''
      : this.resultadoDaRemocao() || this.resultadoDoSalvamento(),
  );

  readonly mensagemDaConfirmacao = computed(() => {
    const oferta = this.ofertaParaRemover();
    return oferta
      ? `Deseja remover esta oferta (${this.vinculos.rotuloCompletoDoCurso(oferta.cursoId)})? A remoção é lógica (soft-delete). Cópias já congeladas em quadros de vagas de processos publicados não são afetadas.`
      : 'Deseja remover esta oferta de curso?';
  });

  abrirCadastro(): void {
    if (this.gravando()) {
      return;
    }
    this.modo.set('criar');
    this.ofertaEmEdicao.set(null);
    this.form.reset(OFERTA_EM_BRANCO);
    this.alternarVinculos(true);
    this.vinculos.carregarUnidades();
    this.abrir();
  }

  abrirEdicao(oferta: OfertaCursoDto): void {
    if (this.gravando()) {
      return;
    }
    this.modo.set('editar');
    this.ofertaEmEdicao.set(oferta);
    this.form.reset(valoresDaOferta(oferta));
    this.alternarVinculos(false);
    this.abrir();
  }

  fechar(): void {
    if (!this.salvando()) {
      this.aberto.set(false);
    }
  }

  salvar(): void {
    this.erro.set(null);
    this.recusaDoSalvamento.set('');
    this.descartarRecusasDoServidor();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const chave = withIdempotencyKey(this.chaveDeIdempotencia());
    const valores = this.form.getRawValue();
    const oferta = this.ofertaEmEdicao();
    const modo = this.modo();
    const operacao: Observable<ApiResult<string | void>> =
      oferta === null
        ? this.api.criar(comandoDeCriacao(valores), chave)
        : this.api.atualizar(oferta.id, comandoDeAtualizacao(oferta.id, valores), chave);
    this.gravar('salvando', operacao, (result) => this.concluirGravacao(result, modo));
  }

  pedirRemocao(oferta: OfertaCursoDto): void {
    if (this.gravando()) {
      return;
    }
    this.limparResultados();
    this.ofertaParaRemover.set(oferta);
    this.erroDaRemocao.set(null);
    this.confirmando.set(true);
  }

  removerConfirmado(): void {
    const oferta = this.ofertaParaRemover();
    if (oferta === null) {
      return;
    }
    this.erroDaRemocao.set(null);
    this.gravar('removendo', this.api.remover(oferta.id), (result) => {
      if (result.ok) {
        this.concluirRemocao(oferta);
        return;
      }
      this.recusarRemocao(result.problem);
    });
  }

  /** Os três vínculos escolhem-se na criação e ficam fixos na edição (ADR-0066). */
  private alternarVinculos(editaveis: boolean): void {
    const { cursoId, localOfertaId, unidadeOfertanteOrigemId } = this.form.controls;
    for (const controle of [cursoId, localOfertaId, unidadeOfertanteOrigemId]) {
      if (editaveis) {
        controle.enable();
      } else {
        controle.disable();
      }
    }
  }

  private gravar<T>(
    tipo: Escrita,
    operacao: Observable<ApiResult<T>>,
    aoConcluir: (result: ApiResult<T>) => void,
  ): void {
    if (this.gravando()) {
      return;
    }
    this.escrita.set(tipo);
    operacao.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      aoConcluir(result);
      this.escrita.set(null);
    });
  }

  private concluirRemocao(oferta: OfertaCursoDto): void {
    const nome = this.vinculos.rotuloCompletoDoCurso(oferta.cursoId);
    this.resultadoDaRemocao.set(`Oferta de curso ${nome} removida.`);
    this.notifications.success('Oferta de curso removida');
    this.confirmando.set(false);
    this.ofertaParaRemover.set(null);
    this.recarregar();
  }

  private recusarRemocao(problem: ProblemDetails): void {
    const titulo = this.problemI18n.resolve(problem).title;
    this.erroDaRemocao.set(titulo);
    if (problem.status >= 500) {
      this.notifications.errorFromProblem(problem, { title: titulo });
    }
  }

  private abrir(): void {
    this.limparResultados();
    this.erro.set(null);
    this.recusaDoSalvamento.set('');
    this.renovarChaveDeIdempotencia();
    this.aberto.set(true);
  }

  private concluirGravacao(result: ApiResult<string | void>, modo: ModoFormulario): void {
    if (!result.ok) {
      this.aplicarFalha(result.problem);
      this.recusaDoSalvamento.set(this.erro() ? '' : 'Revise os campos indicados.');
      return;
    }
    const criada = modo === 'criar';
    this.resultadoDoSalvamento.set(
      criada ? 'Oferta de curso criada.' : 'Oferta de curso atualizada.',
    );
    this.notifications.success(criada ? 'Oferta de curso criada' : 'Oferta de curso atualizada');
    this.aberto.set(false);
    this.renovarChaveDeIdempotencia();
    this.recarregar();
  }

  private recarregar(): void {
    this.recarga.iniciar();
    this.store.recarregar();
  }

  private limparResultados(): void {
    this.resultadoDaRemocao.set('');
    this.resultadoDoSalvamento.set('');
  }

  private aplicarFalha(problem: ProblemDetails): void {
    if (problem.errors?.length && this.aplicarErrosDeValidacao(problem.errors)) {
      this.renovarChaveDeIdempotencia();
      return;
    }
    const campo = controleDoCodigoDoServidor(problem.code);
    if (campo !== null) {
      this.renovarChaveDeIdempotencia();
      this.marcarCampo(campo, problem.code, this.problemI18n.resolve(problem).title);
      return;
    }
    // O 409 do envio é `processing_conflict`: pede repetir o mesmo comando com a mesma chave.
    if (deveRotacionarIdempotencyKey(problem)) {
      this.renovarChaveDeIdempotencia();
    }
    this.erro.set(this.problemI18n.resolve(problem).title);
    if (problem.status >= 500) {
      this.notifications.errorFromProblem(problem);
    }
  }

  /** Marca cada campo recusado com a própria mensagem; devolve se algum erro pôde ser mapeado. */
  private aplicarErrosDeValidacao(errors: ReadonlyArray<ProblemValidationError>): boolean {
    let aplicouAlgum = false;
    for (const recusa of errors) {
      const nome = controleDoCampoDoServidor(recusa.field);
      if (nome === null) continue;
      this.marcarCampo(nome, recusa.code, recusa.message);
      aplicouAlgum = true;
    }
    return aplicouAlgum;
  }

  /** A recusa do servidor vale para o envio que a causou: ao reenviar, só a validação local barra. */
  private descartarRecusasDoServidor(): void {
    for (const controle of Object.values(this.form.controls)) {
      controle.updateValueAndValidity({ emitEvent: false });
    }
  }

  private marcarCampo(campo: keyof OfertaCursoForm, code: string, message: string): void {
    const controle = this.form.controls[campo];
    controle.setErrors({ backend: { code, message } });
    controle.markAsTouched();
  }

  private renovarChaveDeIdempotencia(): void {
    this.chaveDeIdempotencia.set(idempotencyKey.create());
  }
}
