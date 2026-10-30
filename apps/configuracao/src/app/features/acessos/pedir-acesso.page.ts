import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  Injector,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  API_MAX_PAGE_SIZE,
  ProblemI18nService,
  coletarPaginas,
  proximaChave,
} from '@uniplus/shared-core/http';
import { idempotencyKey, withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { PedidosDeConcessaoApi, type PerfilParaPedidoDto } from '@uniplus/shared-data/autorizacao';
import {
  AlertComponent,
  FileUploadComponent,
  PageHeaderComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { AnexoDoPedidoService, type FaseDoEnvio } from './anexo-do-pedido.service';
import { FALHA_INESPERADA, textoDaRecusa } from './mensagens-de-acesso';
import { nomesDeEscopo } from './nomes-de-escopo';

type ParaQuem = 'mim' | 'outra';

const DOCUMENTO_OBRIGATORIO =
  'O documento de designação é obrigatório para este perfil. Anexe o PDF.';

interface CorpoDoPedido {
  readonly beneficiarioEmail: string | null;
  readonly perfilId: string;
  readonly unidadeId: string | null;
  readonly justificativa: string;
}

const FASE: Readonly<Record<FaseDoEnvio, string>> = {
  registrando: 'Registrando o documento…',
  enviando: 'Enviando o documento…',
  confirmando: 'Confirmando o envio…',
};

/**
 * Pedido de acesso, para si ou para outra pessoa. O pedido não dá acesso: segue para o gestor de
 * acessos e, se o perfil tem dado pessoal ou sensível, para a proteção de dados.
 */
@Component({
  selector: 'cfg-pedir-acesso-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AlertComponent,
    FileUploadComponent,
    PageHeaderComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cfg-page' },
  template: `
    <ui-page-header
      heading="Pedir acesso"
      description="O pedido passa pela aprovação do gestor de acessos e, quando o perfil inclui dado pessoal ou sensível, também pela da proteção de dados."
    />

    @if (erro()) {
      <ui-alert variant="danger" heading="Não foi possível enviar o pedido">{{ erro() }}</ui-alert>
    }

    <form class="panel cfg-form" [formGroup]="form" (ngSubmit)="enviar()" novalidate>
      <fieldset class="field">
        <legend class="field__label">Para quem é o acesso</legend>
        <label class="radio">
          <input type="radio" formControlName="paraQuem" value="mim" />
          <span class="radio__dot" aria-hidden="true"></span>
          Para mim
        </label>
        <label class="radio">
          <input type="radio" formControlName="paraQuem" value="outra" />
          <span class="radio__dot" aria-hidden="true"></span>
          Para outra pessoa
        </label>
      </fieldset>

      @if (paraQuem() === 'outra') {
        <label class="field" [class.is-error]="invalido('beneficiarioEmail')">
          <span class="field__label is-required">E-mail institucional do beneficiário</span>
          <input
            class="input"
            type="email"
            autocomplete="off"
            formControlName="beneficiarioEmail"
            [attr.aria-invalid]="invalido('beneficiarioEmail') ? 'true' : null"
            [attr.aria-describedby]="
              invalido('beneficiarioEmail') ? 'cfg-pedir-beneficiarioEmail-erro' : null
            "
          />
          <span class="field__hint"
            >O pedido espera o aceite da pessoa antes de seguir para aprovação.</span
          >
          @if (invalido('beneficiarioEmail')) {
            <span class="field__error" id="cfg-pedir-beneficiarioEmail-erro"
              >Informe um e-mail válido.</span
            >
          }
        </label>
      }

      @if (perfisIndisponiveis(); as indisponivel) {
        <ui-alert variant="danger" heading="Não foi possível listar os perfis de acesso">{{
          indisponivel
        }}</ui-alert>
      } @else {
        <label class="field" [class.is-error]="invalido('perfilId')">
          <span class="field__label is-required">Perfil de acesso</span>
          <select
            class="select"
            formControlName="perfilId"
            [attr.aria-invalid]="invalido('perfilId') ? 'true' : null"
            [attr.aria-describedby]="invalido('perfilId') ? 'cfg-pedir-perfilId-erro' : null"
          >
            <option value="">Selecione um perfil</option>
            @for (perfil of perfis(); track perfil.id) {
              <option [value]="perfil.id">{{ perfil.nome }}</option>
            }
          </select>
          @if (perfilSelecionado(); as perfil) {
            <span class="field__hint">{{ perfil.descricao }}</span>
          }
          @if (invalido('perfilId')) {
            <span class="field__error" id="cfg-pedir-perfilId-erro">Selecione o perfil.</span>
          }
        </label>
      }

      @if (exigeUnidade()) {
        <label class="field" [class.is-error]="invalido('unidadeId')">
          <span class="field__label is-required">Unidade</span>
          <select
            class="select"
            formControlName="unidadeId"
            [attr.aria-invalid]="invalido('unidadeId') ? 'true' : null"
            [attr.aria-describedby]="invalido('unidadeId') ? 'cfg-pedir-unidadeId-erro' : null"
          >
            <option value="">Selecione a unidade</option>
            @for (unidade of unidades(); track unidade.id) {
              <option [value]="unidade.id">{{ unidade.sigla }} — {{ unidade.nome }}</option>
            }
          </select>
          @if (invalido('unidadeId')) {
            <span class="field__error" id="cfg-pedir-unidadeId-erro">Selecione a unidade.</span>
          }
        </label>
      } @else {
        <p class="field__hint">Este perfil vale para a instituição, sem unidade.</p>
      }

      <label class="field" [class.is-error]="invalido('justificativa')">
        <span class="field__label is-required">Justificativa</span>
        <textarea
          class="textarea"
          formControlName="justificativa"
          [attr.aria-invalid]="invalido('justificativa') ? 'true' : null"
          [attr.aria-describedby]="
            invalido('justificativa') ? 'cfg-pedir-justificativa-erro' : null
          "
        ></textarea>
        <span class="field__hint"
          >Explique por que o trabalho exige o acesso (de 10 a 2000 caracteres).</span
        >
        @if (invalido('justificativa')) {
          <span class="field__error" id="cfg-pedir-justificativa-erro"
            >A justificativa deve ter de 10 a 2000 caracteres.</span
          >
        }
      </label>

      <ui-file-upload
        [fieldLabel]="exigeDocumento() ? 'Documento de designação' : 'Documento (opcional)'"
        [isRequired]="exigeDocumento()"
        acceptedFileTypes=".pdf"
        acceptLabel="PDF de até 10 MB"
        [allowedMimeTypes]="['application/pdf']"
        [maxSizeMb]="10"
        [disabled]="enviando()"
        [mensagemExterna]="erroDoDocumento()"
        [(selectedFile)]="arquivo"
      />
      <p class="field__hint">
        O documento de designação é obrigatório para os perfis de gestor de acessos e de proteção de
        dados de dados. O pedido só segue para aprovação depois que o documento é verificado.
      </p>

      @if (faseDoEnvio(); as fase) {
        <p role="status">{{ fase }}</p>
      }

      <div class="cfg-form-footer">
        <a class="btn btn--tertiary btn--rect" routerLink="/acessos/pedidos">Cancelar</a>
        <button type="submit" class="btn btn--primary" [disabled]="enviando()">
          @if (enviando()) {
            <ui-spinner size="sm" />
          }
          {{ enviando() ? 'Enviando…' : 'Enviar pedido' }}
        </button>
      </div>
    </form>
  `,
})
export class PedirAcessoPage {
  private readonly api = inject(PedidosDeConcessaoApi);
  private readonly anexos = inject(AnexoDoPedidoService);
  private readonly problemas = inject(ProblemI18nService);
  private readonly notificacoes = inject(NotificationService);
  private readonly router = inject(Router);
  private chaveDaCriacao = idempotencyKey.create();
  /**
   * Corpo de uma criação sem resposta definitiva (rede ou 5xx): o servidor pode tê-la executado, então
   * a retentativa repete o mesmo corpo sob a mesma chave e recebe o replay em vez de um segundo pedido.
   */
  private corpoPendente: CorpoDoPedido | null = null;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly perfis = signal<readonly PerfilParaPedidoDto[]>([]);
  /** A recusa da leitura dos perfis (por exemplo, e-mail não institucional), já em texto para a pessoa. */
  protected readonly perfisIndisponiveis = signal<string | null>(null);
  private readonly escopo = nomesDeEscopo();

  protected readonly form = new FormGroup({
    paraQuem: new FormControl<ParaQuem>('mim', { nonNullable: true }),
    beneficiarioEmail: new FormControl('', { nonNullable: true }),
    perfilId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    unidadeId: new FormControl('', { nonNullable: true }),
    justificativa: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(10), Validators.maxLength(2000)],
    }),
  });

  protected readonly arquivo = signal<File | null>(null);
  private readonly tentouEnviar = signal(false);
  protected readonly enviando = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly faseDoEnvio = signal<string | null>(null);

  protected readonly paraQuem = toSignal(this.form.controls.paraQuem.valueChanges, {
    initialValue: this.form.controls.paraQuem.value,
  });
  private readonly perfilId = toSignal(this.form.controls.perfilId.valueChanges, {
    initialValue: '',
  });

  protected readonly unidades = this.escopo.unidades.opcoes;
  protected readonly perfilSelecionado = computed(
    () => this.perfis().find((perfil) => perfil.id === this.perfilId()) ?? null,
  );
  /** O perfil de governança (gestor de acessos, proteção de dados) só se pede com o documento de designação. */
  protected readonly exigeDocumento = computed(
    () => (this.perfilSelecionado()?.governanca ?? null) !== null,
  );
  protected readonly erroDoDocumento = computed(() =>
    this.tentouEnviar() && this.exigeDocumento() && this.arquivo() === null
      ? DOCUMENTO_OBRIGATORIO
      : null,
  );
  /** O perfil de escopo institucional vale para a instituição, sem unidade. */
  protected readonly exigeUnidade = computed(
    () => this.perfilSelecionado()?.escopo !== 'instituicao',
  );

  constructor() {
    this.carregarPerfis();
    this.form.controls.paraQuem.valueChanges.subscribe((valor) => this.aoMudarParaQuem(valor));
  }

  protected invalido(nome: keyof typeof this.form.controls): boolean {
    const controle = this.form.controls[nome];
    return controle.invalid && (controle.touched || controle.dirty);
  }

  protected async enviar(): Promise<void> {
    this.aplicarObrigatoriedades();
    this.tentouEnviar.set(true);
    if (this.form.invalid || this.erroDoDocumento() !== null) {
      this.form.markAllAsTouched();
      this.focarPrimeiroInvalido();
      return;
    }
    if (this.enviando()) return;
    this.enviando.set(true);
    this.erro.set(null);

    const valor = this.form.getRawValue();
    const corpo: CorpoDoPedido = this.corpoPendente ?? {
      beneficiarioEmail: valor.paraQuem === 'outra' ? valor.beneficiarioEmail.trim() : null,
      perfilId: valor.perfilId,
      unidadeId: this.exigeUnidade() && valor.unidadeId !== '' ? valor.unidadeId : null,
      justificativa: valor.justificativa.trim(),
    };
    try {
      const resultado = await firstValueFrom(
        this.api.criar(corpo, withIdempotencyKey(this.chaveDaCriacao)),
      );
      if (!resultado.ok) {
        const anterior = this.chaveDaCriacao;
        this.chaveDaCriacao = proximaChave(anterior, resultado);
        const inconclusiva = this.chaveDaCriacao === anterior;
        this.corpoPendente = inconclusiva ? corpo : null;
        if (inconclusiva) this.form.disable({ emitEvent: false });
        else this.form.enable({ emitEvent: false });
        const motivo = textoDaRecusa(this.problemas.resolve(resultado.problem));
        this.erro.set(
          inconclusiva
            ? `${motivo} Não foi possível saber se o pedido foi registrado. Confira a lista de pedidos; se ele não aparecer, envie de novo: o pedido é o mesmo e não se repete.`
            : motivo,
        );
        return;
      }
      this.chaveDaCriacao = idempotencyKey.create();
      this.corpoPendente = null;
      await this.concluir(resultado.data.id);
    } catch {
      this.erro.set(FALHA_INESPERADA);
    } finally {
      this.enviando.set(false);
      this.faseDoEnvio.set(null);
    }
  }

  private carregarPerfis(): void {
    coletarPaginas((cursor) =>
      this.api.perfisParaPedir({ cursor, direction: 'next', limit: API_MAX_PAGE_SIZE }),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultado) => {
          if (resultado.ok) this.perfis.set(resultado.data);
          else
            this.perfisIndisponiveis.set(textoDaRecusa(this.problemas.resolve(resultado.problem)));
        },
        error: () => this.perfisIndisponiveis.set(FALHA_INESPERADA),
      });
  }

  /** Leva o foco ao primeiro campo com erro depois que a tela o marca, para o leitor de tela anunciá-lo. */
  private focarPrimeiroInvalido(): void {
    afterNextRender(
      () => {
        const host = this.host.nativeElement;
        const alvo =
          host.querySelector<HTMLElement>('[aria-invalid="true"]:not([type="file"])') ??
          (this.erroDoDocumento() !== null
            ? host.querySelector<HTMLElement>('.uni-uploader__drop')
            : null);
        alvo?.focus();
      },
      { injector: this.injector },
    );
  }

  /**
   * O pedido já existe: o que falhar daqui em diante não pode mostrar erro de envio nem manter o
   * formulário, que levaria a um segundo pedido igual. Segue para o pedido criado.
   */
  private async concluir(pedidoId: string): Promise<void> {
    try {
      await this.anexarSeHouver(pedidoId);
    } catch {
      this.notificacoes.warning(
        'Pedido enviado, mas o documento não foi anexado',
        'Anexe-o pela página do pedido.',
      );
    }
    await this.router.navigate(['/acessos/pedidos', pedidoId]);
  }

  private async anexarSeHouver(pedidoId: string): Promise<void> {
    const arquivo = this.arquivo();
    if (arquivo === null) {
      this.notificacoes.success('Pedido enviado');
      return;
    }
    const desfecho = await this.anexos.anexar(pedidoId, arquivo, (fase) =>
      this.faseDoEnvio.set(FASE[fase]),
    );
    if (desfecho.ok)
      this.notificacoes.success('Pedido enviado', 'O documento segue para verificação.');
    else
      this.notificacoes.warning(
        'Pedido enviado, mas o documento não foi anexado',
        `${desfecho.mensagem} Anexe-o pela página do pedido.`,
      );
  }

  private aoMudarParaQuem(valor: ParaQuem): void {
    const email = this.form.controls.beneficiarioEmail;
    email.setValue('');
    email.markAsUntouched();
    this.aplicarObrigatoriedades(valor);
  }

  private aplicarObrigatoriedades(paraQuem: ParaQuem = this.form.controls.paraQuem.value): void {
    const email = this.form.controls.beneficiarioEmail;
    email.setValidators(paraQuem === 'outra' ? [Validators.required, Validators.email] : []);
    email.updateValueAndValidity({ emitEvent: false });

    const unidade = this.form.controls.unidadeId;
    unidade.setValidators(this.exigeUnidade() ? [Validators.required] : []);
    unidade.updateValueAndValidity({ emitEvent: false });
  }
}
