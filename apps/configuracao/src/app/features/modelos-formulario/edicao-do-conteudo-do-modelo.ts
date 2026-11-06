import { DOCUMENT } from '@angular/common';
import {
  DestroyRef,
  Injectable,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import {
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
import { ModeloFormularioView, ModelosFormularioApi } from '@uniplus/shared-data/configuracao';
import {
  distribuirRecusas,
  distribuirRecusasDosDocumentos,
  ehRecusaDeDocumento,
  conteudoParaEnvio,
  semDadosBasicos,
  type ConteudoDoFormulario,
  type DocumentoExigidoDoFormulario,
  type RecusasDoDocumento,
  type RecusasDoConteudo,
} from '@uniplus/shared-ui/components';
import { focoEstaLivre } from '../../shared/foco';
import { ModeloFormularioEdicaoStore } from './modelo-formulario-edicao.store';

interface CabecalhoForm {
  nome: FormControl<string>;
  descricao: FormControl<string>;
  tipoProcessoCodigo: FormControl<string>;
}

@Injectable()
export class EdicaoDoConteudoDoModelo {
  private readonly api = inject(ModelosFormularioApi);
  private readonly store = inject(ModeloFormularioEdicaoStore);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly documento = inject(DOCUMENT);
  private readonly id = this.store.id;
  readonly modelo = this.store.modelo;
  readonly conteudo = signal<ConteudoDoFormulario | null>(null);
  readonly salvando = signal(false);
  private readonly aguardandoRecarga = signal(false);
  /** Inclui a espera pela recarga: o formulário só volta a aceitar edição quando reflete o que foi gravado. */
  readonly somenteLeitura = computed(() => this.salvando() || this.aguardandoRecarga());
  readonly recusas = signal<RecusasDoConteudo | null>(null);
  readonly recusasGerais = signal<readonly string[]>([]);
  readonly recusasDosDocumentos = signal<{
    readonly porDocumento: ReadonlyMap<DocumentoExigidoDoFormulario, RecusasDoDocumento>;
    readonly gerais: readonly string[];
  }>({ porDocumento: new Map(), gerais: [] });
  private chaveDaGravacao = idempotencyKey.create();
  readonly form = new FormGroup<CabecalhoForm>({
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    descricao: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
    tipoProcessoCodigo: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      const modelo = this.modelo();
      const esperavaARecarga = untracked(this.aguardandoRecarga);
      if (modelo !== null) this.preencher(modelo);
      else if (esperavaARecarga) this.focarTituloSeLivre();
      this.aguardandoRecarga.set(false);
    });
  }

  trocarDocumentos(documentos: readonly DocumentoExigidoDoFormulario[]): void {
    const atual = this.conteudo();
    if (atual !== null) this.conteudo.set({ ...atual, documentosExigidos: documentos });
  }

  /** A releitura falhou: o alerta substitui o formulário e leva o botão focado; o título fica. */
  private focarTituloSeLivre(): void {
    afterNextRender(
      () => {
        if (focoEstaLivre()) this.documento.getElementById('cfg-modelo-titulo')?.focus();
      },
      { injector: this.injector },
    );
  }

  private focarInvalido(): void {
    afterNextRender(
      () => this.documento.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      { injector: this.injector },
    );
  }

  salvar(): boolean {
    const conteudo = this.conteudo();
    if (this.somenteLeitura() || conteudo === null) return false;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focarInvalido();
      return false;
    }
    const enviado = conteudoParaEnvio(semDadosBasicos(conteudo));
    if (enviado === null) {
      this.notifications.warning(
        'Há campos que não são números',
        'Corrija os campos marcados no formulário antes de salvar.',
      );
      return true;
    }
    this.enviar(enviado);
    return false;
  }

  private enviar(enviado: NonNullable<ReturnType<typeof conteudoParaEnvio>>): void {
    const v = this.form.getRawValue();
    this.salvando.set(true);
    this.api
      .atualizar(
        this.id,
        {
          nome: v.nome.trim(),
          descricao: v.descricao.trim() || null,
          tipoProcessoCodigo: v.tipoProcessoCodigo || null,
          conteudo: enviado,
        },
        withIdempotencyKey(this.chaveDaGravacao),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        this.salvando.set(false);
        if (resultado.ok) {
          this.chaveDaGravacao = idempotencyKey.create();
          this.notifications.success('Modelo salvo', this.modelo()?.codigo ?? '');
          // Relê o que a API gravou: ela repõe os dados básicos e pode deslocar a ordem.
          this.aguardandoRecarga.set(true);
          this.store.recarregar();
          return;
        }
        this.aplicarFalha(resultado.problem, enviado);
      });
  }

  private preencher(modelo: ModeloFormularioView): void {
    this.conteudo.set(modelo.conteudo);
    this.recusas.set(null);
    this.recusasGerais.set([]);
    this.recusasDosDocumentos.set({ porDocumento: new Map(), gerais: [] });
    this.form.reset({
      nome: modelo.nome,
      descricao: modelo.descricao ?? '',
      tipoProcessoCodigo: modelo.tipoProcessoCodigo ?? '',
    });
  }

  /**
   * A recusa que aponta um item ou uma etapa vai para ele; a do cabeçalho, para o campo; o resto —
   * a do grafo, que só cita o fato na mensagem — para o resumo, que recebe o foco.
   */
  private aplicarFalha(problem: ProblemDetails, enviado: ConteudoDoFormulario): void {
    if (deveRotacionarIdempotencyKey(problem)) {
      this.chaveDaGravacao = idempotencyKey.create();
    }
    const erros = problem.status === STATUS_HTTP.RECUSA_DE_NEGOCIO ? (problem.errors ?? []) : [];
    const doConteudo = erros.filter(
      (erro) => campoDoCabecalho(erro.field) === null && !ehRecusaDeDocumento(erro.field),
    );
    const dosDocumentos = erros.filter((erro) => ehRecusaDeDocumento(erro.field));
    const marcouCampo = this.marcarCamposDoCabecalho(erros);

    const recusas = distribuirRecusas(doConteudo, enviado);
    this.recusas.set(recusas);
    this.recusasDosDocumentos.set(
      distribuirRecusasDosDocumentos(dosDocumentos, enviado.documentosExigidos ?? []),
    );
    this.recusasGerais.set(
      recusas.gerais.length > 0
        ? recusas.gerais
        : erros.length > 0
          ? ['Há recusas nos campos marcados abaixo.']
          : [this.problemI18n.resolve(problem).title],
    );
    if (problem.status >= 500) this.notifications.errorFromProblem(problem);
    if (!marcouCampo) this.focarResumo();
  }

  /** Com um campo do cabeçalho recusado, o foco é dele: quem o leva é o acompanhamento do envio. */
  private focarResumo(): void {
    afterNextRender(
      () => this.documento.querySelector<HTMLElement>('#cfg-modelo-resumo')?.focus(),
      { injector: this.injector },
    );
  }

  private marcarCamposDoCabecalho(erros: readonly ProblemValidationError[]): boolean {
    let marcou = false;
    for (const erro of erros) {
      const campo = campoDoCabecalho(erro.field);
      if (campo !== null) {
        this.form.controls[campo].setErrors({ backend: { message: erro.message } });
        this.form.controls[campo].markAsTouched();
        marcou = true;
      }
    }
    return marcou;
  }
}

/** O campo do cabeçalho que a recusa aponta: as do conteúdo vêm com o caminho dentro dele. */
function campoDoCabecalho(campo: string): keyof CabecalhoForm | null {
  const campos: readonly (keyof CabecalhoForm)[] = ['nome', 'descricao', 'tipoProcessoCodigo'];
  return (
    campos.find((nome) => nome.toLocaleLowerCase('pt-BR') === campo.toLocaleLowerCase('pt-BR')) ??
    null
  );
}
