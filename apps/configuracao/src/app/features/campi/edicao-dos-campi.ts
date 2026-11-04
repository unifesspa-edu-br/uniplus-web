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
import { idempotencyKey, withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { CampiApi, CampusDto } from '@uniplus/shared-data/configuracao';
import { ehErroDeEndereco } from '../../shared/endereco';
import { CampiStore } from './campi.store';
import {
  CAMPUS_EM_BRANCO,
  comandoDeAtualizacao,
  comandoDeCriacao,
  controleDoCampoDoServidor,
  criarFormularioDeCampus,
  valoresDoCampus,
} from './campus-form';

type ModoFormulario = 'criar' | 'editar';

/**
 * As escritas de campus: o formulário de cadastro e edição (abertura, validação, recusas do
 * servidor) e a remoção com confirmação. Salvar e remover compartilham um só indicador, então
 * enquanto uma escrita está em curso a outra não parte.
 */
@Injectable()
export class EdicaoDosCampi {
  private readonly api = inject(CampiApi);
  private readonly store = inject(CampiStore);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly form = criarFormularioDeCampus();
  readonly gravando = signal(false);
  readonly aberto = signal(false);
  readonly modo = signal<ModoFormulario>('criar');
  readonly erro = signal<string | null>(null);
  readonly erroDoEndereco = signal<string | null>(null);
  readonly titulo = computed(() => (this.modo() === 'criar' ? 'Novo campus' : 'Editar campus'));

  readonly confirmando = signal(false);
  readonly campusParaRemover = signal<CampusDto | null>(null);
  readonly mensagemDaConfirmacao = computed(() => {
    const campus = this.campusParaRemover();
    return campus
      ? `Deseja remover ${campus.sigla}? A remoção é lógica (soft-delete) e preserva o histórico.`
      : 'Deseja remover este campus?';
  });

  private readonly campusEmEdicaoId = signal<string | null>(null);
  private readonly chaveDeIdempotencia = signal(idempotencyKey.create());

  abrirCadastro(): void {
    this.modo.set('criar');
    this.campusEmEdicaoId.set(null);
    this.form.reset(CAMPUS_EM_BRANCO);
    this.abrir();
  }

  abrirEdicao(campus: CampusDto): void {
    this.modo.set('editar');
    this.campusEmEdicaoId.set(campus.id);
    this.form.reset(valoresDoCampus(campus));
    this.abrir();
  }

  fechar(): void {
    this.aberto.set(false);
  }

  salvar(): void {
    if (this.gravando()) {
      return;
    }
    if (this.form.invalid) {
      this.recusarFormularioInvalido();
      return;
    }
    this.erro.set(null);
    const chave = withIdempotencyKey(this.chaveDeIdempotencia());
    const valores = this.form.getRawValue();
    const id = this.campusEmEdicaoId();
    const operacao: Observable<ApiResult<string | void>> =
      this.modo() === 'criar'
        ? this.api.criar(comandoDeCriacao(valores), chave)
        : this.api.atualizar(id ?? '', comandoDeAtualizacao(id ?? '', valores), chave);
    this.gravar(operacao, (result) => this.concluirGravacao(result));
  }

  pedirRemocao(campus: CampusDto): void {
    this.campusParaRemover.set(campus);
    this.confirmando.set(true);
  }

  removerConfirmado(): void {
    const campus = this.campusParaRemover();
    if (campus === null) {
      return;
    }
    this.gravar(this.api.remover(campus.id), (result) => {
      if (result.ok) {
        this.notifications.success('Campus removido', campus.sigla);
        this.confirmando.set(false);
        this.campusParaRemover.set(null);
        this.store.recarregar();
        return;
      }
      this.notifications.errorFromProblem(result.problem, {
        title: this.problemI18n.resolve(result.problem).title,
      });
    });
  }

  private gravar<T>(
    operacao: Observable<ApiResult<T>>,
    aoConcluir: (result: ApiResult<T>) => void,
  ): void {
    if (this.gravando()) {
      return;
    }
    this.gravando.set(true);
    operacao.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      this.gravando.set(false);
      aoConcluir(result);
    });
  }

  private abrir(): void {
    this.erro.set(null);
    this.erroDoEndereco.set(null);
    this.renovarChaveDeIdempotencia();
    this.aberto.set(true);
  }

  private recusarFormularioInvalido(): void {
    this.form.markAllAsTouched();
    if (this.form.controls.endereco.hasError('cidadeObrigatoria')) {
      this.erroDoEndereco.set('Selecione a cidade do endereço (obrigatória para o campus).');
    }
  }

  private concluirGravacao(result: ApiResult<string | void>): void {
    if (!result.ok) {
      this.aplicarFalha(result.problem);
      return;
    }
    this.notifications.success(this.modo() === 'criar' ? 'Campus criado' : 'Campus atualizado');
    this.aberto.set(false);
    this.erroDoEndereco.set(null);
    this.renovarChaveDeIdempotencia();
    this.store.recarregar();
  }

  private aplicarFalha(problem: ProblemDetails): void {
    const errosDeCampo = problem.errors ?? [];
    if (problem.status === STATUS_HTTP.RECUSA_DE_NEGOCIO && errosDeCampo.length > 0) {
      this.renovarChaveDeIdempotencia();
      this.aplicarErrosDeValidacao(errosDeCampo);
      return;
    }
    if (ehErroDeEndereco(problem.code)) {
      this.renovarChaveDeIdempotencia();
      this.erroDoEndereco.set(this.problemI18n.resolve(problem).title);
      this.erro.set(null);
      return;
    }
    if (
      problem.status === STATUS_HTTP.CONFLITO ||
      problem.code === 'uniplus.idempotency.body_mismatch'
    ) {
      this.renovarChaveDeIdempotencia();
    }
    this.erro.set(this.problemI18n.resolve(problem).title);
    if (problem.status >= 500) {
      this.notifications.errorFromProblem(problem);
    }
  }

  private aplicarErrosDeValidacao(errors: ReadonlyArray<ProblemValidationError>): void {
    let aplicouAlgum = false;
    let erroEndereco: string | null = null;
    for (const erro of errors) {
      if (ehErroDeEndereco(erro.field) || ehErroDeEndereco(erro.code)) {
        erroEndereco ??= erro.message;
        aplicouAlgum = true;
        continue;
      }
      aplicouAlgum = this.marcarControle(erro) || aplicouAlgum;
    }
    this.erroDoEndereco.set(erroEndereco);
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
