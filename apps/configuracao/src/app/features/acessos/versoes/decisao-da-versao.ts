import { ElementRef, Injectable, Injector, afterNextRender, inject, signal } from '@angular/core';
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

/** Aprovar e recusar a versão que aguarda a etapa da fila; a recusa da API fica junto da versão. */
@Injectable()
export class DecisaoDaVersao {
  private readonly api = inject(VersoesDoPerfilApi);
  private readonly escrita = inject(EscritaDoPerfil);
  private readonly problemas = inject(ProblemI18nService);
  private readonly notificacoes = inject(NotificationService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly chave = new ChaveDeSubstituicao();
  /** O que a API recusou de cada versão, pela versão. */
  readonly erros = signal<ReadonlyMap<string, string>>(new Map());
  readonly recusando = signal<ItemDaFilaDeVersoesDto | null>(null);
  readonly erroDaRecusa = signal<string | null>(null);
  readonly tentouRecusar = signal(false);
  readonly aberto = signal(false);
  readonly motivo = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(LIMITE_DO_MOTIVO)],
  });

  aprovar(item: ItemDaFilaDeVersoesDto, etapa: EtapaDaVersao): Promise<void> {
    const { versaoId } = item.versao;
    return this.escrita.executar(
      'decisao',
      async () => {
        this.limparErro(versaoId);
        const { resultado } = await comChave(this.chave, { versaoId, etapa, tipo: 'aprovar' }, (c) =>
          this.api.aprovar(item.perfilId, versaoId, etapa, c),
        );
        if (resultado.ok) this.concluir('Versão aprovada', item);
        else this.registrarErro(versaoId, this.texto(resultado.problem));
      },
      (mensagem) => this.registrarErro(versaoId, mensagem),
    );
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
    this.tentouRecusar.set(true);
    descartarRecusasDoServidor(this.motivo);
    const motivo = this.motivo.value.trim();
    if (!motivo) this.motivo.setErrors({ required: true });
    if (item === null || this.motivo.invalid) {
      this.focarMotivo();
      return Promise.resolve();
    }
    return this.escrita.executar(
      'decisao',
      () => this.enviarRecusa(item, etapa, motivo),
      (mensagem) => this.erroDaRecusa.set(mensagem),
    );
  }

  private async enviarRecusa(
    item: ItemDaFilaDeVersoesDto,
    etapa: EtapaDaVersao,
    motivo: string,
  ): Promise<void> {
    this.erroDaRecusa.set(null);
    const { versaoId } = item.versao;
    const { resultado } = await comChave(this.chave, { versaoId, etapa, motivo }, (c) =>
      this.api.recusar(item.perfilId, versaoId, { etapa, motivo }, c),
    );
    if (resultado.ok) {
      this.aberto.set(false);
      this.concluir('Versão recusada', item);
    } else {
      this.recusaDoMotivo(resultado.problem);
    }
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
    afterNextRender(
      () =>
        this.host.nativeElement
          .querySelector<HTMLElement>('cfg-motivo-dialog [aria-invalid="true"]')
          ?.focus(),
      { injector: this.injector },
    );
  }
}
