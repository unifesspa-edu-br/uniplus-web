import { computed, DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import {
  ApiResult,
  ProblemDetails,
  ProblemI18nService,
  ProblemValidationError,
  STATUS_HTTP,
} from '@uniplus/shared-core/http';
import {
  deveRotacionarIdempotencyKey,
  IDEMPOTENCY_PROBLEM_CODES,
  idempotencyKey,
  withIdempotencyKey,
} from '@uniplus/shared-core/idempotency';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { CODIGO_CADASTRO_FORMATO, CODIGO_CADASTRO_TAMANHO_MAXIMO } from '@uniplus/shared-utils';
import { Observable } from 'rxjs';
import { TiposDeficienciaStore } from './tipos-deficiencia.store';
import { ligarCodigoDeCadastro } from '../../shared/codigo-de-cadastro';
import {
  AtualizarTipoDeficienciaCommand,
  CriarTipoDeficienciaCommand,
  TipoDeficienciaApi,
  TipoDeficienciaDto,
} from '@uniplus/shared-data/configuracao';

type ModoFormulario = 'criar' | 'editar';

export interface TipoDeficienciaForm {
  nome: FormControl<string>;
  descricao: FormControl<string>;
  codigo: FormControl<string>;
}

const TIPO_DEFICIENCIA_CONTROL_NAMES: ReadonlySet<string> = new Set<keyof TipoDeficienciaForm>([
  'nome',
  'descricao',
  'codigo',
]);

/**
 * Conflitos de unicidade (409) que pertencem a um campo do formulário. Só eles
 * precisam do vendor code literal: violação de unicidade não é erro de validação
 * de campo, então o corpo não traz `errors[]` e não há outra chave que diga a
 * qual campo o conflito se refere. Todo erro que chega em `errors[]` é ancorado
 * pelo `field` que o próprio contrato manda — sem repetir código aqui.
 */
const CAMPO_POR_CONFLITO: ReadonlyMap<string, keyof TipoDeficienciaForm> = new Map([
  ['uniplus.configuracao.tipo_deficiencia.codigo_ja_existe', 'codigo' as const],
  ['uniplus.configuracao.tipo_deficiencia.nome_ja_existe', 'nome' as const],
]);

function controlNameFromBackendField(field: string): keyof TipoDeficienciaForm | null {
  const normalized =
    field
      .split('.')
      .at(-1)
      ?.replace(/\[\d+\]$/u, '') ?? field;
  const camelCase = normalized.charAt(0).toLocaleLowerCase('pt-BR') + normalized.slice(1);
  return TIPO_DEFICIENCIA_CONTROL_NAMES.has(camelCase)
    ? (camelCase as keyof TipoDeficienciaForm)
    : null;
}

@Injectable()
export class EdicaoDosTiposDeficiencia {
  private readonly api = inject(TipoDeficienciaApi);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly store = inject(TiposDeficienciaStore);
  readonly idempotencyKeyAtual = signal(idempotencyKey.create());
  private readonly escrita = signal<'salvando' | 'removendo' | null>(null);
  private readonly recarregando = signal(false);
  readonly gravando = computed(() => this.escrita() !== null || this.recarregando());
  readonly salvando = computed(() => this.escrita() === 'salvando');
  readonly removendo = computed(() => this.escrita() === 'removendo');
  readonly saving = this.gravando;
  readonly idEmAndamento = signal<string | null>(null);
  readonly anuncio = signal('');
  readonly rotuloEmAndamento = computed(() =>
    this.removendo()
      ? 'Removendo...'
      : this.salvando()
        ? 'Salvando...'
        : this.recarregando()
          ? 'Recarregando...'
          : '',
  );
  readonly modo = signal<ModoFormulario>('criar');
  readonly formOpen = signal(false);
  readonly tipoDeficienciaParaRemover = signal<TipoDeficienciaDto | null>(null);
  readonly confirmOpen = signal(false);
  readonly form = new FormGroup<TipoDeficienciaForm>({
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(255)],
    }),
    descricao: new FormControl('', {
      nonNullable: true,
      // `Validators.required` aceita uma string só de espaços, que o `trim()`
      // do payload reduziria a vazio e o backend recusaria com 422; o padrão
      // exige ao menos um caractere significativo.
      validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(1000)],
    }),
    codigo: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(CODIGO_CADASTRO_TAMANHO_MAXIMO),
        Validators.pattern(CODIGO_CADASTRO_FORMATO),
      ],
    }),
  });
  private readonly ligacaoDoCodigo = ligarCodigoDeCadastro(
    this.form.controls,
    () => this.modo() === 'criar',
  );
  readonly formError = signal<string | null>(null);
  readonly tipoDeficienciaEmEdicaoId = signal<string | null>(null);
  /** Classificação de permanência do registro em edição — lida, não editável aqui. */
  private readonly permanenteEmEdicao = signal<boolean | null>(null);
  constructor() {
    let iniciou = false;
    effect(() => {
      if (!this.recarregando()) {
        iniciou = false;
        return;
      }
      if (this.store.carregando()) {
        iniciou = true;
        return;
      }
      if (iniciou) {
        this.recarregando.set(false);
        this.idEmAndamento.set(null);
      }
    });
  }

  abrirDrawerCriacao(): void {
    if (this.gravando()) return;
    this.modo.set('criar');
    this.tipoDeficienciaEmEdicaoId.set(null);
    this.ligacaoDoCodigo.reiniciar();
    this.form.reset({
      nome: '',
      descricao: '',
      codigo: '',
    });
    this.formError.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.formOpen.set(true);
  }

  abrirEdicao(tipoDeficiencia: TipoDeficienciaDto): void {
    if (this.gravando()) return;
    this.modo.set('editar');
    this.tipoDeficienciaEmEdicaoId.set(tipoDeficiencia.id);
    this.permanenteEmEdicao.set(tipoDeficiencia.permanente);
    this.ligacaoDoCodigo.reiniciar();
    this.form.reset({
      codigo: tipoDeficiencia.codigo,
      nome: tipoDeficiencia.nome,
      descricao: tipoDeficiencia.descricao ?? '',
    });
    this.formError.set(null);
    this.idempotencyKeyAtual.set(idempotencyKey.create());
    this.formOpen.set(true);
  }

  abrirRemoverTipoDeficiencia(tipoDeficiencia: TipoDeficienciaDto): void {
    if (this.gravando()) return;
    this.tipoDeficienciaParaRemover.set(tipoDeficiencia);
    this.confirmOpen.set(true);
  }

  salvar(): void {
    this.formError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const operacao =
      this.modo() === 'criar'
        ? this.api.criar(this.criarCommand(), withIdempotencyKey(this.idempotencyKeyAtual()))
        : this.api.atualizar(
            this.tipoDeficienciaEmEdicaoId() ?? '',
            this.atualizarCommand(),
            withIdempotencyKey(this.idempotencyKeyAtual()),
          );
    if (!this.gravando()) {
      this.idEmAndamento.set(this.tipoDeficienciaEmEdicaoId());
      this.anuncio.set('Salvando tipo de deficiência.');
    }
    this.gravar<string | void>('salvando', operacao, (result) => this.handleSalvarResult(result));
  }

  /**
   * O PUT substitui o registro inteiro: campo omitido é campo apagado. Como esta
   * tela não edita a classificação de permanência, ela reenvia o valor lido para
   * não zerá-la em toda atualização de nome, código ou descrição.
   */
  private atualizarCommand(): AtualizarTipoDeficienciaCommand {
    return {
      id: this.tipoDeficienciaEmEdicaoId() ?? '',
      ...this.criarCommand(),
      permanente: this.permanenteEmEdicao(),
    };
  }

  private criarCommand(): CriarTipoDeficienciaCommand {
    const raw = this.form.getRawValue();
    return {
      codigo: raw.codigo.trim(),
      nome: raw.nome.trim(),
      descricao: raw.descricao.trim(),
    };
  }

  private renovarIdempotencyKey(): void {
    this.idempotencyKeyAtual.set(idempotencyKey.create());
  }

  private aplicarErrosDeValidacao(errors: ReadonlyArray<ProblemValidationError>): void {
    let aplicouAlgum = false;
    for (const erro of errors) {
      const controlName = controlNameFromBackendField(erro.field);
      if (controlName === null) continue;
      const control = this.form.controls[controlName];
      control.setErrors({ backend: { code: erro.code, message: erro.message } });
      control.markAsTouched();
      aplicouAlgum = true;
    }

    if (aplicouAlgum) {
      this.formError.set(null);
      return;
    }
    this.formError.set('Não foi possível mapear os erros de validação. Revise os campos.');
  }

  private aplicarFalha(problem: ProblemDetails): void {
    if (deveRotacionarIdempotencyKey(problem)) {
      this.renovarIdempotencyKey();
    }

    // A validação do backend acumula toda violação de campo em `errors[]` e só
    // repete a primeira na raiz do problema (ADR-0125). Percorrer o array é o que
    // ancora cada erro no seu campo; ler apenas `problem.code` marcaria um campo
    // e deixaria os demais sem indicação.
    if (problem.errors && problem.errors.length > 0) {
      this.notifications.errorFromProblem(problem);
      this.aplicarErrosDeValidacao(problem.errors);
      return;
    }

    const campoDoConflito = CAMPO_POR_CONFLITO.get(problem.code);
    if (campoDoConflito) {
      this.notifications.errorFromProblem(problem);
      const control = this.form.controls[campoDoConflito];
      control.setErrors({
        backend: { code: problem.code, message: this.problemI18n.resolve(problem).title },
      });
      control.markAsTouched();
      return;
    }

    if (
      problem.status === STATUS_HTTP.CONFLITO ||
      problem.code === IDEMPOTENCY_PROBLEM_CODES.BODY_MISMATCH
    ) {
      this.notifications.errorFromProblem(problem);
    }

    this.formError.set(this.problemI18n.resolve(problem).title);
    if (problem.status >= 500) {
      this.notifications.errorFromProblem(problem);
    }
  }

  private handleSalvarResult(result: ApiResult<string | void>): void {
    if (result.ok) {
      this.anuncio.set('Tipo de deficiência salvo.');
      this.notifications.success(
        this.modo() === 'criar' ? 'Tipo de deficiência criado' : 'Tipo de deficiência atualizado',
      );
      this.formOpen.set(false);
      this.idempotencyKeyAtual.set(idempotencyKey.create());
      this.recarregar();
      return;
    }
    this.anuncio.set('Não foi possível salvar o tipo de deficiência.');
    this.aplicarFalha(result.problem);
  }

  private handleRemoverResult(result: ApiResult<void>): void {
    if (result.ok) {
      this.anuncio.set(
        `Tipo de deficiência ${this.tipoDeficienciaParaRemover()?.nome ?? ''} removido.`,
      );
      this.notifications.success('Tipo de deficiência removido');
      this.formOpen.set(false);
      this.confirmOpen.set(false);
      this.tipoDeficienciaParaRemover.set(null);
      this.recarregar();
      return;
    }
    // A falha da remoção é mostrada no toast: aplicarFalha() escreve no formulário,
    // que está fechado enquanto o diálogo de confirmação está aberto.
    this.anuncio.set('Não foi possível remover o tipo de deficiência.');
    this.notifications.errorFromProblem(result.problem);
  }

  removerConfirmado(): void {
    const tipo = this.tipoDeficienciaParaRemover();
    if (tipo === null || this.gravando()) return;
    this.idEmAndamento.set(tipo.id);
    this.anuncio.set(`Removendo o tipo de deficiência ${tipo.nome}.`);
    this.gravar('removendo', this.api.remover(tipo.id), (result) =>
      this.handleRemoverResult(result),
    );
  }

  private gravar<T>(
    tipo: 'salvando' | 'removendo',
    operacao: Observable<ApiResult<T>>,
    concluir: (resultado: ApiResult<T>) => void,
  ): void {
    if (this.gravando()) return;
    this.escrita.set(tipo);
    operacao.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((resultado) => {
      concluir(resultado);
      this.escrita.set(null);
      if (!this.recarregando()) this.idEmAndamento.set(null);
    });
  }

  private recarregar(): void {
    this.recarregando.set(true);
    this.store.recarregar();
  }
}
