import {
  Injectable,
  ElementRef,
  afterNextRender,
  Injector,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  type ApiFailure,
  type ProblemDetails,
  ProblemI18nService,
  proximaChave,
} from '@uniplus/shared-core/http';
import { idempotencyKey, withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { PedidosDeConcessaoApi } from '@uniplus/shared-data/autorizacao';
import { AnexoDoPedidoService, type FaseDoEnvio } from './anexo-do-pedido.service';
import { mensagemDaRecusa } from './falha-de-servidor';
import { FALHA_INESPERADA } from './mensagens-de-acesso';
import { nomesDeEscopo } from './nomes-de-escopo';
import { PedirAcessoStore } from './pedir-acesso.store';
import { focarAposNovaTentativa } from '../../shared/foco';
import { PRAZO_NO_PASSADO, fimDoDia, hojeNoFuso, prazoNoPassado } from './prazo-de-vigencia';

type ParaQuem = 'mim' | 'outra';

const DOCUMENTO_OBRIGATORIO =
  'O documento de designação é obrigatório para este perfil. Anexe o PDF.';

interface CorpoDoPedido {
  readonly beneficiarioEmail: string | null;
  readonly perfilId: string;
  readonly unidadeId: string | null;
  readonly justificativa: string;
  readonly validaAteSugerida?: string;
}

const FASE: Readonly<Record<FaseDoEnvio, string>> = {
  registrando: 'Registrando o documento…',
  enviando: 'Enviando o documento…',
  confirmando: 'Confirmando o envio…',
};

/** Escrita do pedido de acesso e estado do formulário. */
@Injectable()
export class EdicaoDoPedidoDeAcesso {
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
  private readonly store = inject(PedirAcessoStore);

  readonly hoje = hojeNoFuso;
  readonly mensagemDoPrazo = PRAZO_NO_PASSADO;

  readonly perfis = this.store.perfis;
  readonly perfisIndisponiveis = this.store.perfisIndisponiveis;
  readonly carregandoPerfis = this.store.carregandoPerfis;
  private readonly novaTentativaDosPerfis = focarAposNovaTentativa(
    this.store.carregandoPerfis,
    computed(() => this.store.perfisIndisponiveis() !== null),
    () => this.host.nativeElement.querySelector<HTMLElement>('select[formcontrolname="perfilId"]'),
  );
  private readonly escopo = nomesDeEscopo();

  readonly form = new FormGroup({
    paraQuem: new FormControl<ParaQuem>('mim', { nonNullable: true }),
    beneficiarioEmail: new FormControl('', { nonNullable: true }),
    perfilId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    unidadeId: new FormControl('', { nonNullable: true }),
    justificativa: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(10), Validators.maxLength(2000)],
    }),
    validaAteSugerida: new FormControl('', { nonNullable: true, validators: [prazoNoPassado] }),
  });

  readonly arquivo = signal<File | null>(null);
  private readonly tentouEnviar = signal(false);
  readonly enviando = signal(false);
  readonly aguardandoConfirmacao = signal(false);
  readonly erro = signal<string | null>(null);
  readonly faseDoEnvio = signal<string | null>(null);

  readonly paraQuem = toSignal(this.form.controls.paraQuem.valueChanges, {
    initialValue: this.form.controls.paraQuem.value,
  });
  private readonly perfilId = toSignal(this.form.controls.perfilId.valueChanges, {
    initialValue: '',
  });

  readonly unidades = this.escopo.unidades.opcoes;
  readonly perfilSelecionado = computed(
    () => this.perfis().find((perfil) => perfil.id === this.perfilId()) ?? null,
  );
  /** O perfil de governança (gestor de acessos, proteção de dados) só se pede com o documento de designação. */
  readonly exigeDocumento = computed(() => (this.perfilSelecionado()?.governanca ?? null) !== null);
  readonly erroDoDocumento = computed(() =>
    this.tentouEnviar() && this.exigeDocumento() && this.arquivo() === null
      ? DOCUMENTO_OBRIGATORIO
      : null,
  );
  /** O perfil de escopo institucional vale para a instituição, sem unidade. */
  readonly exigeUnidade = computed(() => this.perfilSelecionado()?.escopo !== 'instituicao');

  constructor() {
    this.form.controls.paraQuem.valueChanges.subscribe((valor) => this.aoMudarParaQuem(valor));
  }

  tentarPerfisNovamente(): void {
    this.novaTentativaDosPerfis.executar(() => this.store.recarregarPerfis());
  }

  invalido(nome: keyof typeof this.form.controls): boolean {
    const controle = this.form.controls[nome];
    return controle.invalid && (controle.touched || controle.dirty);
  }

  async enviar(): Promise<void> {
    if (this.enviando()) return;
    this.erro.set(null);
    if (!this.validarParaEnviar()) return;
    this.enviando.set(true);

    const corpo = this.corpoDoPedido();
    try {
      const resultado = await firstValueFrom(
        this.api.criar(corpo, withIdempotencyKey(this.chaveDaCriacao)),
      );
      if (!resultado.ok) {
        this.tratarRecusa(resultado, corpo);
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

  private validarParaEnviar(): boolean {
    Object.values(this.form.controls).forEach((controle) =>
      controle.updateValueAndValidity({ emitEvent: false }),
    );
    this.aplicarObrigatoriedades();
    this.tentouEnviar.set(true);
    if (this.form.invalid || this.erroDoDocumento() !== null) {
      this.form.markAllAsTouched();
      this.focarPrimeiroInvalido();
      return false;
    }
    return true;
  }

  impedirDuranteEnvio(evento: Event): void {
    if (this.enviando()) evento.preventDefault();
  }

  private corpoDoPedido(): CorpoDoPedido {
    const valor = this.form.getRawValue();
    return (
      this.corpoPendente ?? {
        beneficiarioEmail: valor.paraQuem === 'outra' ? valor.beneficiarioEmail.trim() : null,
        perfilId: valor.perfilId,
        unidadeId: this.exigeUnidade() && valor.unidadeId !== '' ? valor.unidadeId : null,
        justificativa: valor.justificativa.trim(),
        ...(this.exigeDocumento() || valor.validaAteSugerida === ''
          ? {}
          : { validaAteSugerida: fimDoDia(valor.validaAteSugerida) }),
      }
    );
  }

  private tratarRecusa(resultado: ApiFailure, corpo: CorpoDoPedido): void {
    const anterior = this.chaveDaCriacao;
    this.chaveDaCriacao = proximaChave(anterior, resultado);
    const inconclusiva = this.chaveDaCriacao === anterior;
    this.corpoPendente = inconclusiva ? corpo : null;
    this.aguardandoConfirmacao.set(inconclusiva);
    if (!inconclusiva && this.aplicarErrosDeCampo(resultado.problem)) return;
    const motivo = mensagemDaRecusa(this.problemas, this.notificacoes, resultado.problem);
    this.erro.set(
      inconclusiva
        ? `${motivo} Não foi possível saber se o pedido foi registrado. Confira a lista de pedidos; se ele não aparecer, envie de novo: o pedido é o mesmo e não se repete.`
        : motivo,
    );
  }

  private aplicarErrosDeCampo(problema: ProblemDetails): boolean {
    let aplicado = false;
    for (const erro of problema.errors ?? []) {
      const nome = (Object.keys(this.form.controls) as (keyof typeof this.form.controls)[]).find(
        (campo) => campo.toLowerCase() === erro.field.toLowerCase(),
      );
      if (!nome) continue;
      const controle = this.form.controls[nome];
      controle.setErrors({ backend: { code: erro.code, message: erro.message } });
      controle.markAsTouched();
      aplicado = true;
    }
    if (aplicado) this.focarPrimeiroInvalido();
    return aplicado;
  }

  mensagemDoCampo(nome: keyof typeof this.form.controls, padrao: string): string {
    return (
      (this.form.controls[nome].getError('backend') as { message: string } | null)?.message ??
      padrao
    );
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

    const prazo = this.form.controls.validaAteSugerida;
    prazo.setValidators(this.exigeDocumento() ? [] : [prazoNoPassado]);
    prazo.updateValueAndValidity({ emitEvent: false });
  }
}
