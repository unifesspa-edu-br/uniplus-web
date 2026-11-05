import { DOCUMENT } from '@angular/common';
import {
  DestroyRef,
  Injectable,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  ApiResult,
  ProblemDetails,
  ProblemI18nService,
  STATUS_HTTP,
} from '@uniplus/shared-core/http';
import {
  deveRotacionarIdempotencyKey,
  idempotencyKey,
  withIdempotencyKey,
} from '@uniplus/shared-core/idempotency';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { ModeloFormularioView, ModelosFormularioApi } from '@uniplus/shared-data/configuracao';
import {
  CODIGO_CADASTRO_FORMATO,
  CODIGO_CADASTRO_TAMANHO_MAXIMO,
  sugerirCodigoDeCadastro,
} from '@uniplus/shared-utils';
import { conteudoInicial } from '@uniplus/shared-ui/components';
import { ModelosFormularioStore } from './modelos-formulario.store';

/** O código do modelo já existe — código de modelo nunca se reutiliza. */
const CODIGO_JA_EXISTE = 'uniplus.configuracao.modelo_formulario.codigo_ja_existe';

interface CriacaoForm {
  codigo: FormControl<string>;
  nome: FormControl<string>;
  descricao: FormControl<string>;
  finalidade: FormControl<string>;
  tipoProcessoCodigo: FormControl<string>;
}

type CampoDaCriacao = keyof CriacaoForm;

@Injectable()
export class EdicaoDosModelosFormulario {
  private readonly api = inject(ModelosFormularioApi);
  private readonly router = inject(Router);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly documento = inject(DOCUMENT);
  private readonly store = inject(ModelosFormularioStore);
  readonly drawerAberto = signal(false);
  private readonly escrita = signal<'salvando' | 'situacao' | null>(null);
  readonly gravando = computed(() => this.escrita() !== null);
  readonly salvando = computed(() => this.escrita() === 'salvando');
  readonly erroDaCriacao = signal<string | null>(null);
  readonly emAndamento = signal<string | null>(null);
  readonly anuncioDaSituacao = signal('');
  private chaveDaCriacao = idempotencyKey.create();
  private ultimaSugestao = '';
  readonly form = new FormGroup<CriacaoForm>({
    codigo: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.maxLength(CODIGO_CADASTRO_TAMANHO_MAXIMO),
        Validators.pattern(CODIGO_CADASTRO_FORMATO),
      ],
    }),
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    descricao: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
    finalidade: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    tipoProcessoCodigo: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    this.form.controls.nome.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((nome) => this.sugerirCodigo(nome));
    this.form.controls.codigo.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((codigo) => this.normalizarCaixaDoCodigo(codigo));
  }

  abrirCriacao(): void {
    if (this.gravando()) return;
    this.form.reset();
    this.erroDaCriacao.set(null);
    this.ultimaSugestao = '';
    this.chaveDaCriacao = idempotencyKey.create();
    this.drawerAberto.set(true);
  }

  fechar(visivel: boolean): void {
    if (!this.salvando()) this.drawerAberto.set(visivel);
  }

  criar(): void {
    if (this.gravando()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focarCampoInvalido();
      return;
    }
    this.enviarCriacao();
  }

  private enviarCriacao(): void {
    this.escrita.set('salvando');
    this.erroDaCriacao.set(null);
    const v = this.form.getRawValue();
    this.api
      .criar(
        {
          codigo: v.codigo.trim(),
          nome: v.nome.trim(),
          descricao: v.descricao.trim() || null,
          finalidade: v.finalidade,
          tipoProcessoCodigo: v.tipoProcessoCodigo || null,
          conteudo: conteudoInicial(),
        },
        withIdempotencyKey(this.chaveDaCriacao),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        this.escrita.set(null);
        if (resultado.ok) {
          this.notifications.success('Modelo criado', v.codigo);
          this.drawerAberto.set(false);
          void this.router.navigate(['/modelos-formulario', resultado.data]);
          return;
        }
        this.aplicarFalha(resultado.problem);
      });
  }

  desativar(modelo: ModeloFormularioView): void {
    if (this.gravando()) return;
    this.escrita.set('situacao');
    this.emAndamento.set(modelo.id);
    this.anuncioDaSituacao.set(`Desativando o modelo ${modelo.codigo}.`);
    this.api
      .desativar(modelo.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => this.aoTrocarSituacao(resultado, 'Modelo desativado', modelo));
  }

  ativar(modelo: ModeloFormularioView): void {
    if (this.gravando()) return;
    this.escrita.set('situacao');
    this.emAndamento.set(modelo.id);
    this.anuncioDaSituacao.set(`Ativando o modelo ${modelo.codigo}.`);
    this.api
      .ativar(modelo.id, withIdempotencyKey(idempotencyKey.create()))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => this.aoTrocarSituacao(resultado, 'Modelo ativado', modelo));
  }

  erro(campo: CampoDaCriacao): string | null {
    const controle = this.form.controls[campo];
    if (!(controle.touched || controle.dirty) || controle.errors === null) return null;
    const backend = controle.errors['backend'] as { message: string } | undefined;
    if (backend) return backend.message;
    if (controle.errors['required']) return 'Campo obrigatório.';
    if (controle.errors['pattern'])
      return 'Use caixa alta, começando por letra, com letras, números e sublinhado.';
    if (controle.errors['maxlength']) return 'Valor acima do tamanho permitido.';
    return 'Valor inválido.';
  }

  private aoTrocarSituacao(
    resultado: ApiResult<void>,
    mensagem: string,
    modelo: ModeloFormularioView,
  ): void {
    this.escrita.set(null);
    this.emAndamento.set(null);
    if (resultado.ok) {
      this.anuncioDaSituacao.set(`${mensagem}: ${modelo.codigo}.`);
      this.notifications.success(mensagem, modelo.codigo);
      this.store.recarregar();
      return;
    }
    this.anuncioDaSituacao.set(`Não foi possível alterar a situação do modelo ${modelo.codigo}.`);
    this.notifications.errorFromProblem(resultado.problem, {
      title: this.problemI18n.resolve(resultado.problem).title,
    });
  }

  private aplicarFalha(problem: ProblemDetails): void {
    if (deveRotacionarIdempotencyKey(problem)) {
      this.chaveDaCriacao = idempotencyKey.create();
    }
    if (problem.code === CODIGO_JA_EXISTE) {
      this.marcarCampo('codigo', this.problemI18n.resolve(problem).title);
      return;
    }
    if (this.aplicarErrosDeCampo(problem)) return;
    this.erroDaCriacao.set(this.problemI18n.resolve(problem).title);
    if (problem.status >= 500) this.notifications.errorFromProblem(problem);
  }

  private aplicarErrosDeCampo(problem: ProblemDetails): boolean {
    if (problem.status !== STATUS_HTTP.RECUSA_DE_NEGOCIO) return false;
    let aplicou = false;
    for (const erro of problem.errors ?? []) {
      const campo = campoDaRecusa(erro.field);
      if (campo !== null) {
        this.marcarCampo(campo, erro.message);
        aplicou = true;
      }
    }
    return aplicou;
  }

  private marcarCampo(campo: CampoDaCriacao, mensagem: string): void {
    const controle = this.form.controls[campo];
    controle.setErrors({ backend: { message: mensagem } });
    controle.markAsTouched();
    this.focarCampoInvalido();
  }

  private focarCampoInvalido(): void {
    afterNextRender(
      () =>
        this.documento
          .querySelector<HTMLElement>('#cfg-modelo-criacao [aria-invalid="true"]')
          ?.focus(),
      { injector: this.injector },
    );
  }

  /** A API só aceita código em caixa alta; a caixa alta na tela é do estilo do campo. */
  private normalizarCaixaDoCodigo(codigo: string): void {
    const emCaixaAlta = codigo.toLocaleUpperCase('pt-BR');
    if (emCaixaAlta !== codigo) {
      this.form.controls.codigo.setValue(emCaixaAlta, {
        emitEvent: false,
        emitModelToViewChange: false,
      });
    }
  }

  /** A sugestão de código acompanha o nome até o administrador escrever outro código. */
  private sugerirCodigo(nome: string): void {
    const atual = this.form.controls.codigo.value;
    if (atual !== '' && atual !== this.ultimaSugestao) return;
    this.ultimaSugestao = sugerirCodigoDeCadastro(nome);
    this.form.controls.codigo.setValue(this.ultimaSugestao, { emitEvent: false });
  }
}

/** O campo do drawer a que a recusa se refere, pelo último segmento; nulo quando é do conteúdo. */
function campoDaRecusa(campo: string): CampoDaCriacao | null {
  const ultimo = (campo.split('.').at(-1) ?? campo).replace(/^./u, (letra) =>
    letra.toLocaleLowerCase('pt-BR'),
  );
  const campos: readonly CampoDaCriacao[] = [
    'codigo',
    'nome',
    'descricao',
    'finalidade',
    'tipoProcessoCodigo',
  ];
  return campos.includes(ultimo as CampoDaCriacao) && !/conteudo/iu.test(campo)
    ? (ultimo as CampoDaCriacao)
    : null;
}
