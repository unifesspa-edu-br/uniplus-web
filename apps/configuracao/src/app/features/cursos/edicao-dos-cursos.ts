import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import {
  ApiResult,
  ProblemDetails,
  ProblemI18nService,
  ProblemValidationError,
  STATUS_HTTP,
} from '@uniplus/shared-core/http';
import {
  deveRotacionarIdempotencyKey,
  idempotencyKey,
  withIdempotencyKey,
} from '@uniplus/shared-core/idempotency';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { CursoDto, CursosApi } from '@uniplus/shared-data/configuracao';
import { aguardarRecarga } from '../../shared/foco/aguardar-recarga';
import {
  CURSO_EM_BRANCO,
  comandoDeAtualizacao,
  comandoDeCriacao,
  controleDoCampoDoServidor,
  criarFormularioDeCurso,
  valoresDoCurso,
} from './curso-form';
import { CursosStore } from './cursos.store';
import { GruposDoCurso } from './grupos-do-curso';
import { OfertasDoCursoStore } from './ofertas-do-curso.store';

type ModoFormulario = 'criar' | 'editar';

type Escrita = 'salvando' | 'removendo';

/** Vendor code do DomainError `Curso.CodigoJaExiste` (uniplus-api, 409 em POST e PUT). */
const CURSO_CODIGO_JA_EXISTE_CODE = 'uniplus.configuracao.curso.codigo_ja_existe';

/** Vendor code do DomainError `Curso.RemocaoBloqueadaPorOfertaCurso` (uniplus-api, 409 em DELETE). */
const REMOCAO_BLOQUEADA_POR_OFERTA_CODE =
  'uniplus.configuracao.curso.remocao_bloqueada_por_oferta_curso';

/**
 * As escritas de curso: o formulário de cadastro e edição (abertura, validação e recusas do
 * servidor) e a remoção com confirmação. Salvar e remover compartilham um só indicador, então
 * enquanto uma escrita está em curso a outra não parte.
 */
@Injectable()
export class EdicaoDosCursos {
  private readonly api = inject(CursosApi);
  private readonly store = inject(CursosStore);
  private readonly ofertas = inject(OfertasDoCursoStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly grupos = inject(GruposDoCurso);

  readonly form = criarFormularioDeCurso();
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
  /** O mesmo sinal que a leitura dos grupos observa para saber se o drawer está aberto. */
  readonly aberto = this.grupos.formularioAberto;
  readonly modo = signal<ModoFormulario>('criar');
  readonly erro = signal<string | null>(null);
  readonly titulo = computed(() => (this.modo() === 'criar' ? 'Novo curso' : 'Editar curso'));

  readonly confirmando = signal(false);
  readonly erroDaRemocao = signal<string | null>(null);
  private readonly cursoParaRemover = signal<CursoDto | null>(null);
  private readonly recusaDoSalvamento = signal('');
  private readonly resultadoDoSalvamento = signal('');
  private readonly resultadoDaRemocao = signal('');

  /** Dentro do diálogo de remoção: o andamento e a recusa, que só fazem sentido com ele aberto. */
  readonly anuncioDaRemocao = computed(() => {
    const curso = this.cursoParaRemover();
    if (curso === null) {
      return '';
    }
    if (this.removendo()) {
      return `Removendo o curso ${curso.codigo}.`;
    }
    const motivo = this.erroDaRemocao();
    return motivo ? `Não foi possível remover o curso ${curso.codigo}. ${motivo}` : '';
  });
  /** Dentro do drawer: o andamento e a recusa, que só fazem sentido com ele aberto. */
  readonly anuncioDoSalvamento = computed(() =>
    this.salvando() ? 'Salvando curso.' : this.recusaDoSalvamento(),
  );
  /** Na página: o desfecho, anunciado quando nenhuma sobreposição está aberta para dizê-lo. */
  readonly anuncioDaPagina = computed(() =>
    this.confirmando() || this.aberto()
      ? ''
      : this.resultadoDaRemocao() || this.resultadoDoSalvamento(),
  );

  readonly mensagemDaConfirmacao = computed(() => {
    const curso = this.cursoParaRemover();
    return curso
      ? `Deseja remover ${curso.codigo} — ${curso.nome}? A remoção é lógica (soft-delete) e preserva o histórico. Se o curso for a matriz de uma oferta de curso ativa, a remoção será bloqueada.`
      : 'Deseja remover este curso?';
  });

  private readonly cursoEmEdicaoId = signal<string | null>(null);
  private readonly chaveDeIdempotencia = signal(idempotencyKey.create());

  abrirCadastro(): void {
    if (this.gravando()) {
      return;
    }
    this.modo.set('criar');
    this.cursoEmEdicaoId.set(null);
    this.form.reset(CURSO_EM_BRANCO);
    this.grupos.preparar(null);
    this.abrir();
  }

  abrirEdicao(curso: CursoDto): void {
    if (this.gravando()) {
      return;
    }
    this.modo.set('editar');
    this.cursoEmEdicaoId.set(curso.id);
    this.form.reset(valoresDoCurso(curso));
    this.grupos.preparar(curso.grupoAreaEnem);
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
    const id = this.cursoEmEdicaoId();
    const modo = this.modo();
    const operacao: Observable<ApiResult<string | void>> =
      modo === 'criar'
        ? this.api.criar(comandoDeCriacao(valores), chave)
        : this.api.atualizar(id ?? '', comandoDeAtualizacao(id ?? '', valores), chave);
    this.gravar('salvando', operacao, (result) => this.concluirGravacao(result, modo));
  }

  pedirRemocao(curso: CursoDto): void {
    if (this.gravando()) {
      return;
    }
    this.limparResultados();
    this.cursoParaRemover.set(curso);
    this.erroDaRemocao.set(null);
    this.confirmando.set(true);
  }

  removerConfirmado(): void {
    const curso = this.cursoParaRemover();
    if (curso === null) {
      return;
    }
    this.erroDaRemocao.set(null);
    this.gravar('removendo', this.api.remover(curso.id), (result) => {
      if (result.ok) {
        this.concluirRemocao(curso);
        return;
      }
      this.recusarRemocao(curso, result.problem);
    });
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

  private concluirRemocao(curso: CursoDto): void {
    this.resultadoDaRemocao.set(`Curso ${curso.codigo} removido.`);
    this.notifications.success('Curso removido', curso.codigo);
    this.confirmando.set(false);
    this.cursoParaRemover.set(null);
    this.recarregar();
  }

  private recusarRemocao(curso: CursoDto, problem: ProblemDetails): void {
    const titulo = this.problemI18n.resolve(problem).title;
    // Só a oferta viva bloqueia a remoção com 409: em vez de reexibir o texto, abre o drawer de
    // ofertas com as que a impedem. Qualquer outra recusa mantém a confirmação aberta.
    if (problem.code === REMOCAO_BLOQUEADA_POR_OFERTA_CODE) {
      this.resultadoDaRemocao.set(`Não foi possível remover o curso ${curso.codigo}.`);
      this.confirmando.set(false);
      this.cursoParaRemover.set(null);
      this.ofertas.abrirPorBloqueio(curso, titulo);
      return;
    }
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
    const criado = modo === 'criar';
    this.resultadoDoSalvamento.set(criado ? 'Curso criado.' : 'Curso atualizado.');
    this.notifications.success(criado ? 'Curso criado' : 'Curso atualizado');
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
    const errosDeCampo = problem.errors ?? [];
    if (problem.status === STATUS_HTTP.RECUSA_DE_NEGOCIO && errosDeCampo.length > 0) {
      this.renovarChaveDeIdempotencia();
      this.aplicarErrosDeValidacao(errosDeCampo);
      return;
    }
    // Curso.CodigoJaExiste é um DomainError único (409, sem `errors[]` — esse array só existe no
    // pipeline FluentValidation/422); mapeado ao campo manualmente para exibir o erro inline.
    if (problem.code === CURSO_CODIGO_JA_EXISTE_CODE) {
      this.renovarChaveDeIdempotencia();
      this.marcarCodigoJaExistente(problem);
      return;
    }
    // O outro 409 do envio é `processing_conflict`: pede repetir o mesmo comando com a mesma chave.
    if (deveRotacionarIdempotencyKey(problem)) {
      this.renovarChaveDeIdempotencia();
    }
    this.erro.set(this.problemI18n.resolve(problem).title);
    if (problem.status >= 500) {
      this.notifications.errorFromProblem(problem);
    }
  }

  /** A recusa do servidor vale para o envio que a causou: ao reenviar, só a validação local barra. */
  private descartarRecusasDoServidor(): void {
    for (const controle of Object.values(this.form.controls)) {
      controle.updateValueAndValidity();
    }
  }

  private marcarCodigoJaExistente(problem: ProblemDetails): void {
    this.form.controls.codigo.setErrors({
      backend: { code: problem.code, message: this.problemI18n.resolve(problem).title },
    });
    this.form.controls.codigo.markAsTouched();
  }

  private aplicarErrosDeValidacao(errors: ReadonlyArray<ProblemValidationError>): void {
    let aplicouAlgum = false;
    for (const erro of errors) {
      aplicouAlgum = this.marcarControle(erro) || aplicouAlgum;
    }
    this.erro.set(
      aplicouAlgum ? null : 'Não foi possível mapear os erros de validação. Revise os campos.',
    );
  }

  private marcarControle(erro: ProblemValidationError): boolean {
    const nome = controleDoCampoDoServidor(erro.field);
    if (nome === null) {
      return false;
    }
    const control = this.form.controls[nome];
    control.setErrors({ backend: { code: erro.code, message: erro.message } });
    control.markAsTouched();
    return true;
  }

  private renovarChaveDeIdempotencia(): void {
    this.chaveDeIdempotencia.set(idempotencyKey.create());
  }
}
