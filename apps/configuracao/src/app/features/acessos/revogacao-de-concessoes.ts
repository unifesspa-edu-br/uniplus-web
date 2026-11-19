import {
  ElementRef,
  Injectable,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import {
  ChaveDeSubstituicao,
  ProblemI18nService,
  comChave,
  type ProblemDetails,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { ConcessoesApi, type ConcessaoDto } from '@uniplus/shared-data/autorizacao';
import { aguardarRecarga } from '../../shared/foco';
import { descartarRecusasDoServidor, marcarRecusaDoServidor } from '../../shared/formulario';
import { mensagemDaRecusa } from './falha-de-servidor';
import { FALHA_INESPERADA } from './mensagens-de-acesso';
import { LIMITE_DO_MOTIVO } from './motivo-dialog.component';
import { ConcessoesStore } from './concessoes.store';

/** Recusas que mostram que a lista está desatualizada: a concessão já não está como a tela a exibe. */
const CODIGOS_DE_LISTA_DESATUALIZADA: ReadonlySet<string> = new Set([
  'uniplus.autorizacao.concessao.ja_revogada',
  'uniplus.autorizacao.concessao.nao_encontrada',
]);

interface CorpoDaRevogacao {
  readonly motivo: string;
  readonly confirmacaoEmail: string;
}

/** Revogação de concessões e suas recusas. */
@Injectable()
export class RevogacaoDeConcessoes {
  private readonly store = inject(ConcessoesStore);
  private readonly api = inject(ConcessoesApi);
  private readonly problemas = inject(ProblemI18nService);
  private readonly notificacoes = inject(NotificationService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly chave = new ChaveDeSubstituicao();
  readonly email = new FormControl('', { nonNullable: true });
  readonly motivo = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(LIMITE_DO_MOTIVO)],
  });
  readonly tentou = signal(false);
  readonly revogando = signal(false);
  readonly enviando = signal(false);
  private readonly recarga = aguardarRecarga(
    this.store.carregando,
    computed(() => this.store.mensagemDeErro() !== null),
  );
  /** Inclui a espera pela recarga: o foco só volta à lista quando ela reflete a revogação. */
  readonly gravando = computed(() => this.enviando() || this.recarga.aguardando());
  readonly erroDaRevogacao = signal<string | null>(null);
  readonly concessaoARevogar = signal<ConcessaoDto | null>(null);
  pedirRevogacao(concessao: ConcessaoDto): void {
    this.email.reset('');
    this.motivo.reset('');
    this.tentou.set(false);
    this.concessaoARevogar.set(concessao);
    this.erroDaRevogacao.set(null);
    this.revogando.set(true);
  }

  confirmar(): void {
    this.tentou.set(true);
    descartarRecusasDoServidor(this.motivo);
    descartarRecusasDoServidor(this.email);
    const motivo = this.motivo.value.trim();
    const email = this.email.value.trim();
    if (!motivo || this.motivo.invalid || !email) {
      if (!motivo) this.motivo.setErrors({ required: true });
      this.focarErro();
      return;
    }
    void this.revogar(motivo, email);
  }

  async revogar(motivo: string, confirmacaoEmail: string): Promise<void> {
    const concessao = this.concessaoARevogar();
    if (concessao === null || this.enviando()) return;
    this.enviando.set(true);
    this.erroDaRevogacao.set(null);
    try {
      const { resultado } = await this.enviarRevogacao(concessao.id, { motivo, confirmacaoEmail });
      if (resultado.ok) this.concluirRevogacao();
      else this.mostrarRecusa(resultado.problem);
    } catch {
      this.erroDaRevogacao.set(FALHA_INESPERADA);
    } finally {
      this.enviando.set(false);
    }
  }

  /** A revogação sob a chave de idempotência do corpo: o reenvio do mesmo corpo repete a chave. */
  private enviarRevogacao(id: string, corpo: CorpoDaRevogacao) {
    return comChave(this.chave, { id, ...corpo }, (contexto) =>
      this.api.revogar(id, corpo, contexto),
    );
  }

  private concluirRevogacao(): void {
    this.revogando.set(false);
    this.notificacoes.success('Concessão revogada');
    this.recarregarLista();
  }

  private mostrarRecusa(problema: ProblemDetails): void {
    const texto = mensagemDaRecusa(this.problemas, this.notificacoes, problema);
    if (this.aplicarErrosDeCampo(problema)) return;
    this.erroDaRevogacao.set(texto);
    if (CODIGOS_DE_LISTA_DESATUALIZADA.has(problema.code)) this.recarregarLista();
  }

  private recarregarLista(): void {
    this.recarga.iniciar();
    this.store.recarregar();
  }

  private aplicarErrosDeCampo(problema: ProblemDetails): boolean {
    let aplicado = false;
    for (const erro of problema.errors ?? []) {
      const controle = this.controleDoCampo(erro.field);
      if (!controle) continue;
      marcarRecusaDoServidor(controle, erro.code, erro.message);
      aplicado = true;
    }
    if (aplicado) {
      this.tentou.set(true);
      this.focarErro();
    }
    return aplicado;
  }

  /** O campo do diálogo a que a API se refere no erro; os demais não têm onde aparecer. */
  private controleDoCampo(campo: string): FormControl<string> | null {
    const nome = campo.toLowerCase();
    if (nome === 'motivo') return this.motivo;
    return nome === 'confirmacaoemail' ? this.email : null;
  }

  private focarErro(): void {
    afterNextRender(
      () => this.host.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      { injector: this.injector },
    );
  }
}
