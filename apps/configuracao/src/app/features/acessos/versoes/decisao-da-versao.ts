import { Injectable, inject, signal } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import {
  ChaveDeSubstituicao,
  ProblemI18nService,
  comChave,
  type ProblemDetails,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  VersoesDoPerfilApi,
  type EtapaDaVersao,
  type ItemDaFilaDeVersoesDto,
} from '@uniplus/shared-data/autorizacao';
import { descartarRecusasDoServidor, marcarRecusaDoServidor } from '../../../shared/formulario';
import { mensagemDaRecusa } from '../falha-de-servidor';
import { LIMITE_DO_MOTIVO } from '../motivo-dialog.component';
import { EscritaDoPerfil } from './escrita-do-perfil';

const RECUSAS_QUE_GRAVAM_ESTADO: readonly string[] = [
  'uniplus.autorizacao.perfil.aprovacoes_descartadas',
  'uniplus.autorizacao.perfil.versao_expirada',
];

/** Aprovar e recusar a versão que aguarda a etapa da fila; a recusa da API fica junto da versão. */
@Injectable()
export class DecisaoDaVersao {
  private readonly api = inject(VersoesDoPerfilApi);
  private readonly escrita = inject(EscritaDoPerfil);
  private readonly problemas = inject(ProblemI18nService);
  private readonly notificacoes = inject(NotificationService);
  private readonly chave = new ChaveDeSubstituicao();
  /** O que a API recusou de cada versão, pela versão. */
  readonly erros = signal<ReadonlyMap<string, string>>(new Map());
  /** O que explica a mudança que a recusa gravou; fica à vista mesmo que a versão saia da fila. */
  readonly aviso = signal<string | null>(null);
  readonly recusando = signal<ItemDaFilaDeVersoesDto | null>(null);
  readonly erroDaRecusa = signal<string | null>(null);
  readonly tentouRecusar = signal(false);
  /** Cresce a cada pedido de foco no campo do motivo; o diálogo o atende. */
  readonly pedidoDeFoco = signal(0);
  readonly aberto = signal(false);
  readonly motivo = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(LIMITE_DO_MOTIVO)],
  });

  aprovar(item: ItemDaFilaDeVersoesDto, etapa: EtapaDaVersao): Promise<void> {
    return this.escrita.executar(
      'decisao',
      () => this.enviarAprovacao(item, etapa),
      (mensagem) => this.registrarErro(item.versao.versaoId, mensagem),
    );
  }

  private async enviarAprovacao(item: ItemDaFilaDeVersoesDto, etapa: EtapaDaVersao): Promise<void> {
    const { versaoId } = item.versao;
    this.limparErro(versaoId);
    this.aviso.set(null);
    const { resultado } = await comChave(this.chave, { versaoId, etapa, tipo: 'aprovar' }, (c) =>
      this.api.aprovar(item.perfilId, versaoId, etapa, c),
    );
    if (resultado.ok) this.concluir('Versão aprovada', item);
    else this.recusadaNaAprovacao(item, resultado.problem);
  }

  abrirRecusa(item: ItemDaFilaDeVersoesDto): void {
    if (this.escrita.gravando()) return;
    this.motivo.reset('');
    this.erroDaRecusa.set(null);
    this.tentouRecusar.set(false);
    this.recusando.set(item);
    this.aberto.set(true);
  }

  recusar(etapa: EtapaDaVersao): Promise<void> {
    const item = this.recusando();
    const motivo = this.motivoDaRecusa();
    if (item === null || motivo === null) {
      this.focarMotivo();
      return Promise.resolve();
    }
    return this.escrita.executar(
      'decisao',
      () => this.enviarRecusa(item, etapa, motivo),
      (mensagem) => this.erroDaRecusa.set(mensagem),
    );
  }

  /** O motivo sem espaços nas pontas, ou `null` quando o campo recusa o envio. */
  private motivoDaRecusa(): string | null {
    this.tentouRecusar.set(true);
    descartarRecusasDoServidor(this.motivo);
    const motivo = this.motivo.value.trim();
    if (!motivo) this.motivo.setErrors({ required: true });
    return this.motivo.valid ? motivo : null;
  }

  private async enviarRecusa(
    item: ItemDaFilaDeVersoesDto,
    etapa: EtapaDaVersao,
    motivo: string,
  ): Promise<void> {
    this.erroDaRecusa.set(null);
    this.aviso.set(null);
    const { versaoId } = item.versao;
    const { resultado } = await comChave(this.chave, { versaoId, etapa, motivo }, (c) =>
      this.api.recusar(item.perfilId, versaoId, { etapa, motivo }, c),
    );
    if (resultado.ok) this.fecharRecusa(item, null);
    else if (this.gravouEstado(resultado.problem)) this.fecharRecusa(item, resultado.problem);
    else this.recusaDoMotivo(resultado.problem);
  }

  /** Fecha o diálogo: sem problema a recusa foi gravada; com ele, a API gravou outro estado. */
  private fecharRecusa(item: ItemDaFilaDeVersoesDto, problema: ProblemDetails | null): void {
    this.aberto.set(false);
    if (problema === null) this.concluir('Versão recusada', item);
    else this.avisarEReler(item, problema);
  }

  private recusadaNaAprovacao(item: ItemDaFilaDeVersoesDto, problema: ProblemDetails): void {
    this.registrarErro(item.versao.versaoId, this.texto(problema));
    if (this.gravouEstado(problema)) this.avisarEReler(item, problema);
  }

  private gravouEstado(problema: ProblemDetails): boolean {
    return RECUSAS_QUE_GRAVAM_ESTADO.includes(problema.code);
  }

  /** A API gravou estado ao recusar: a fila é relida e a explicação continua visível. */
  private avisarEReler(item: ItemDaFilaDeVersoesDto, problema: ProblemDetails): void {
    this.aviso.set(`${item.perfilNome}: ${this.texto(problema)}`);
    this.escrita.recarregar();
  }

  private concluir(titulo: string, item: ItemDaFilaDeVersoesDto): void {
    this.notificacoes.success(titulo, item.perfilNome);
    this.escrita.recarregar();
  }

  private recusaDoMotivo(problema: ProblemDetails): void {
    const doMotivo = problema.errors?.find((erro) => erro.field.toLowerCase() === 'motivo');
    if (doMotivo) {
      marcarRecusaDoServidor(this.motivo, doMotivo.code, doMotivo.message);
      this.focarMotivo();
    } else {
      this.erroDaRecusa.set(this.texto(problema));
    }
  }

  registrarErro(versaoId: string, mensagem: string): void {
    this.erros.update((atuais) => new Map(atuais).set(versaoId, mensagem));
  }

  private limparErro(versaoId: string): void {
    this.erros.update((atuais) => {
      const proximos = new Map(atuais);
      proximos.delete(versaoId);
      return proximos;
    });
  }

  private texto(problema: ProblemDetails): string {
    return mensagemDaRecusa(this.problemas, this.notificacoes, problema);
  }

  private focarMotivo(): void {
    this.pedidoDeFoco.update((n) => n + 1);
  }
}
