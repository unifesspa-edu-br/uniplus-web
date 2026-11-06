import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
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
import { TermosConsentimentoApi } from '@uniplus/shared-data/configuracao';
import { TermoConsentimentoStore } from './termo-consentimento.store';
import {
  AcaoTermo,
  CriarForm,
  RascunhoForm,
  comandoDeCriacao,
  comandoDeRascunho,
  controleDoCampoDoServidor,
  criarFormulario,
  criarFormularioRascunho,
  valoresDoRascunho,
} from './termo-consentimento-form';
import { marcarRecusaDoServidor, MENSAGEM_SEM_MAPEAMENTO } from '../../shared/formulario';

type Escrita = AcaoTermo | 'criar';

const ANUNCIO_DO_ANDAMENTO: Readonly<Record<Exclude<Escrita, 'remover'>, string>> = {
  criar: 'Criando o termo.',
  rascunho: 'Salvando o rascunho.',
  revisar: 'Marcando o termo como revisado.',
  promover: 'Promovendo a nova versão.',
};

const CODIGO_DE_CONFLITO_DE_CONCORRENCIA =
  'uniplus.configuracao.termo_consentimento.conflito_de_concorrencia';

/**
 * Todas as escritas do termo de consentimento: criação, rascunho, revisão, promoção e remoção.
 * É a única dona do indicador de gravação, então uma escrita impede a outra, e o termo só volta
 * a aceitar ação quando a releitura que segue a escrita termina.
 */
@Injectable()
export class EdicaoDosTermosConsentimento {
  private readonly api = inject(TermosConsentimentoApi);
  private readonly store = inject(TermoConsentimentoStore);
  private readonly router = inject(Router);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly termo = this.store.termo;

  readonly criarForm = criarFormulario();
  readonly rascunhoForm = criarFormularioRascunho();
  readonly formError = signal<string | null>(null);
  readonly acaoErro = signal<string | null>(null);
  readonly confirmRemoverAberto = signal(false);
  /** Pergunta se as alterações não salvas do rascunho podem ser descartadas pela recarga. */
  readonly confirmRecarregarAberto = signal(false);
  /**
   * O servidor recusou a escrita por concorrência: o termo na tela pode não ser o que está
   * gravado. Até a recarga terminar, revisar e promover agiriam sobre um texto que ninguém leu.
   */
  readonly leituraDefasada = signal(false);

  private readonly escrita = signal<Escrita | null>(null);
  private readonly chave = signal(idempotencyKey.create());

  readonly criando = computed(() => this.escrita() === 'criar');
  readonly removendo = computed(() => this.escrita() === 'remover');
  readonly acaoEmAndamento = computed<AcaoTermo | null>(() => {
    const escrita = this.escrita();
    return escrita === 'criar' ? null : escrita;
  });
  /** Inclui a releitura que segue a escrita: o termo só aceita nova ação quando reflete o gravado. */
  readonly processando = computed(() => this.escrita() !== null || this.store.atualizando());

  readonly podeRevisar = computed(() => {
    const termo = this.termo();
    return (
      termo !== null &&
      !this.leituraDefasada() &&
      (termo.textoRascunho ?? '').trim().length > 0 &&
      (termo.baseLegalRascunho ?? '').trim().length > 0
    );
  });
  readonly podePromover = computed(
    () => this.termo()?.revisado === true && !this.leituraDefasada(),
  );
  readonly podeRemover = computed(
    () => this.termo() !== null && this.termo()?.versoes.length === 0,
  );

  /** Fora do diálogo de remoção, que tem a própria região: o que está em curso. */
  readonly anuncioDaAcao = computed(() => {
    const escrita = this.escrita();
    return escrita === null || escrita === 'remover' ? '' : ANUNCIO_DO_ANDAMENTO[escrita];
  });
  /** Dentro do diálogo de remoção: o andamento e a recusa, que só fazem sentido com ele aberto. */
  readonly anuncioDaRemocao = computed(() => {
    const nome = this.termo()?.nome ?? '';
    if (this.removendo()) return `Removendo o termo ${nome}.`;
    const motivo = this.acaoErro();
    return motivo && this.confirmRemoverAberto()
      ? `Não foi possível remover o termo ${nome}. ${motivo}`
      : '';
  });

  constructor() {
    effect(() => {
      const termo = this.store.leituraParaFormulario();
      if (!termo) return;
      this.leituraDefasada.set(false);
      this.rascunhoForm.patchValue(valoresDoRascunho(termo), { emitEvent: false });
      this.rascunhoForm.markAsPristine();
    });
    this.liberarLeituraAoFimDaReleituraBemSucedida();
  }

  criar(): void {
    this.formError.set(null);
    this.limparRecusas(this.criarForm);
    if (this.criarForm.invalid) {
      this.criarForm.markAllAsTouched();
      return;
    }
    const comando = comandoDeCriacao(this.criarForm);
    this.gravar('criar', this.api.criar(comando, withIdempotencyKey(this.chave())), (id) =>
      this.concluirCriacao(id, comando.nome ?? ''),
    );
  }

  salvarRascunho(): void {
    const id = this.id();
    if (id === null || this.termo() === null) return;
    this.acaoErro.set(null);
    this.limparRecusas(this.rascunhoForm);
    if (this.rascunhoForm.invalid) {
      this.rascunhoForm.markAllAsTouched();
      return;
    }
    const comando = comandoDeRascunho(id, this.rascunhoForm);
    this.gravar(
      'rascunho',
      this.api.editarRascunho(id, comando, withIdempotencyKey(this.chave())),
      () => this.concluirMutacao('rascunho', 'Rascunho salvo'),
    );
  }

  marcarRevisado(): void {
    const id = this.id();
    if (id === null || !this.podeRevisar()) return;
    this.gravar('revisar', this.api.revisar(id, withIdempotencyKey(this.chave())), () =>
      this.concluirMutacao('revisar', 'Termo marcado como revisado'),
    );
  }

  promoverVersao(): void {
    const id = this.id();
    if (id === null || !this.podePromover()) return;
    this.gravar('promover', this.api.promover(id, withIdempotencyKey(this.chave())), () =>
      this.concluirMutacao('promover', 'Nova versão promovida'),
    );
  }

  pedirRemocao(): void {
    if (this.processando() || !this.podeRemover()) return;
    this.acaoErro.set(null);
    this.confirmRemoverAberto.set(true);
  }

  removerConfirmado(): void {
    const id = this.id();
    if (id === null || !this.podeRemover()) return;
    this.acaoErro.set(null);
    this.gravar('remover', this.api.remover(id), () => this.concluirRemocao());
  }

  /** Com alterações não salvas no rascunho, a recarga só parte depois da confirmação. */
  recarregarTermo(): void {
    if (this.id() === null || this.processando()) return;
    if (this.rascunhoForm.dirty) {
      this.confirmRecarregarAberto.set(true);
      return;
    }
    this.recarregar();
  }

  recarregarConfirmado(): void {
    this.confirmRecarregarAberto.set(false);
    if (this.id() === null || this.processando()) return;
    this.recarregar();
  }

  /**
   * A releitura que segue uma escrita é silenciosa e não troca a leitura do formulário: o bloqueio
   * só cai quando ela termina sem erro. Se falhar, o termo na tela segue sem prova de ser o gravado.
   */
  private liberarLeituraAoFimDaReleituraBemSucedida(): void {
    let releituraEmCurso = false;
    effect(() => {
      if (this.store.atualizando()) {
        releituraEmCurso = true;
        return;
      }
      if (!releituraEmCurso) return;
      releituraEmCurso = false;
      if (this.store.erro() === null) this.leituraDefasada.set(false);
    });
  }

  private recarregar(): void {
    this.acaoErro.set(null);
    this.store.recarregar();
  }

  private id(): string | null {
    return this.store.id();
  }

  /** A única trava: nada parte enquanto outra escrita, ou a releitura dela, não terminou. */
  private gravar<T>(
    escrita: Escrita,
    operacao: Observable<ApiResult<T>>,
    concluir: (dados: T) => void,
  ): void {
    if (this.processando()) return;
    this.escrita.set(escrita);
    if (escrita !== 'criar') this.store.invalidar();
    operacao.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (result.ok) concluir(result.data);
      else this.aplicarFalha(escrita, result.problem);
      this.escrita.set(null);
    });
  }

  private concluirCriacao(id: string, nome: string): void {
    this.notifications.success('Termo criado', nome);
    this.renovarChave();
    void this.router.navigate(['/termos-consentimento', id]);
  }

  private concluirMutacao(acao: AcaoTermo, sucesso: string): void {
    this.store.atualizar();
    this.notifications.success(sucesso);
    this.renovarChave();
    if (acao === 'rascunho') this.rascunhoForm.markAsPristine();
  }

  private concluirRemocao(): void {
    this.confirmRemoverAberto.set(false);
    this.notifications.success('Termo removido', this.termo()?.nome);
    void this.router.navigate(['/termos-consentimento']);
  }

  private aplicarFalha(escrita: Escrita, problem: ProblemDetails): void {
    if (deveRotacionarIdempotencyKey(problem)) this.renovarChave();
    if (problem.code === CODIGO_DE_CONFLITO_DE_CONCORRENCIA) this.leituraDefasada.set(true);
    const erros = problem.status === STATUS_HTTP.RECUSA_DE_NEGOCIO ? problem.errors : undefined;
    if (erros?.length && (escrita === 'criar' || escrita === 'rascunho')) {
      this.aplicarRecusaDosCampos(escrita, erros);
      return;
    }
    const erro = escrita === 'criar' ? this.formError : this.acaoErro;
    erro.set(this.problemI18n.resolve(problem).title);
    if (problem.status >= 500) this.notifications.errorFromProblem(problem);
  }

  private aplicarRecusaDosCampos(
    escrita: 'criar' | 'rascunho',
    errors: ReadonlyArray<ProblemValidationError>,
  ): void {
    const form = escrita === 'criar' ? this.criarForm : this.rascunhoForm;
    const controles: Partial<Record<keyof CriarForm, FormControl<string>>> = form.controls;
    let aplicouAlgum = false;
    for (const erro of errors) {
      const nome = controleDoCampoDoServidor(erro.field);
      const controle = nome === null ? undefined : controles[nome];
      if (controle === undefined) continue;
      marcarRecusaDoServidor(controle, erro.code, erro.message);
      aplicouAlgum = true;
    }
    (escrita === 'criar' ? this.formError : this.acaoErro).set(
      aplicouAlgum ? null : MENSAGEM_SEM_MAPEAMENTO,
    );
  }

  private limparRecusas(form: FormGroup<CriarForm> | FormGroup<RascunhoForm>): void {
    Object.values(form.controls).forEach((controle) => {
      if (controle.hasError('backend')) controle.updateValueAndValidity();
    });
  }

  private renovarChave(): void {
    this.chave.set(idempotencyKey.create());
  }
}
