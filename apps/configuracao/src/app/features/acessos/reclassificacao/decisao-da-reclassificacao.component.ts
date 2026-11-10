import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  untracked,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type {
  ConcessaoSuspensaDto,
  EtapaDaVersao,
  ReclassificacaoDto,
} from '@uniplus/shared-data/autorizacao';
import { AlertComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { MotivoDialogComponent } from '../motivo-dialog.component';
import { etapa as rotuloDaEtapa } from '../rotulos-de-acesso';
import { EscritaDoPerfil } from '../versoes/escrita-do-perfil';
import { LeituraDosPerfis } from '../versoes/leitura-dos-perfis';
import { PESSOA_SEM_NOME, decidiveisDaEtapa } from './concessoes-da-etapa';
import { DecisaoDaReclassificacao } from './decisao-da-reclassificacao';
import { focarQuandoPedir } from './foco-por-pedido';
import { FILA_DA_ETAPA } from './rotulos-da-reclassificacao';

/** A decisão de uma etapa: libera ou mantém suspensas as concessões marcadas ou todas as pendentes. */
@Component({
  selector: 'cfg-decisao-da-reclassificacao',
  standalone: true,
  imports: [AlertComponent, MotivoDialogComponent, RouterLink, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './decisao-da-reclassificacao.component.html',
})
export class DecisaoDaReclassificacaoComponent {
  readonly reclassificacao = input.required<ReclassificacaoDto>();
  /** As etapas que a pessoa decide, pelas permissões dela. */
  readonly etapas = input.required<readonly EtapaDaVersao[]>();
  readonly nomeDoEscopo = input.required<(concessao: ConcessaoSuspensaDto) => string>();

  protected readonly decisao = inject(DecisaoDaReclassificacao);
  protected readonly gravando = inject(EscritaDoPerfil).gravando;
  private readonly leitura = inject(LeituraDosPerfis);
  private readonly erroDaAcao = viewChild<ElementRef<HTMLElement>>('erroDaAcao');
  protected readonly rotulo = rotuloDaEtapa;
  protected readonly substituida = computed(
    () => !this.reclassificacao().vigente || this.decisao.superada(),
  );
  protected readonly voltar = computed(
    () => FILA_DA_ETAPA[this.decisao.etapa() ?? this.etapas()[0] ?? 'gestao_de_acessos'],
  );
  protected readonly pendentes = computed(() => {
    const etapa = this.decisao.etapa();
    return etapa === undefined
      ? 0
      : decidiveisDaEtapa(this.reclassificacao().concessoes, etapa).length;
  });

  constructor() {
    effect(() => {
      const primeira = this.etapas()[0];
      if (primeira !== undefined && untracked(this.decisao.etapa) === undefined) {
        untracked(() => this.decisao.escolherEtapa(primeira));
      }
    });
    focarQuandoPedir(this.decisao.pedidoDeFocoNoErro, this.erroDaAcao);
  }

  protected descricao(concessao: ConcessaoSuspensaDto): string {
    const versao = concessao.versao === null ? '' : `, versão ${concessao.versao}`;
    return `${concessao.beneficiarioNome ?? PESSOA_SEM_NOME} — ${this.nomeDoEscopo()(concessao)}${versao}`;
  }

  protected ausentes(quantidade: number): string {
    return quantidade === 1
      ? 'Uma concessão do resultado não está mais na lista lida.'
      : `${quantidade} concessões do resultado não estão mais na lista lida.`;
  }

  protected recarregar(): void {
    this.leitura.recarregar();
  }

  protected liberar(): void {
    void this.decisao.liberar(this.reclassificacao());
  }

  protected manter(): void {
    void this.decisao.manter(this.reclassificacao());
  }

  protected quantidade(total: number): string {
    return total === 1 ? '1 concessão' : `${total} concessões`;
  }
}
