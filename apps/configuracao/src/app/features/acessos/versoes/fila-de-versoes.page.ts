import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { EtapaDaVersao, ItemDaFilaDeVersoesDto } from '@uniplus/shared-data/autorizacao';
import {
  acompanharLeitura,
  AlertComponent,
  FalhaDeLeituraComponent,
  IndicadorDaLeituraDirective,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { RecusaDaLeituraComponent } from '../../../shared/recusa-da-leitura';
import { MotivoDialogComponent } from '../motivo-dialog.component';
import { DecisaoDaVersao } from './decisao-da-versao';
import { DocumentoDaVersaoService } from './documento-da-versao.service';
import { EscritaDoPerfil } from './escrita-do-perfil';
import { devolverFocoAoTitulo } from './foco-ao-titulo';
import { FilaDeVersoesStore } from './fila-de-versoes.store';
import { LeituraDosPerfis } from './leitura-dos-perfis';
import { PropostasDaSessao } from './propostas-da-sessao';
import { ResumoDaVersaoComponent } from './resumo-da-versao.component';

const ID_DO_TITULO = 'cfg-fila-de-versoes-titulo';

interface Apresentacao {
  readonly titulo: string;
  readonly descricao: string;
}

const APRESENTACAO: Readonly<Record<EtapaDaVersao, Apresentacao>> = {
  gestao_de_acessos: {
    titulo: 'Versões de perfil na gestão de acessos',
    descricao: 'Versões de perfil que aguardam a sua aprovação da adequação funcional.',
  },
  protecao_de_dados: {
    titulo: 'Versões de perfil na proteção de dados',
    descricao:
      'Versões que acrescentam permissões sensíveis, já aprovadas pela gestão de acessos, e aguardam a adequação à proteção de dados.',
  },
};

/** A fila de aprovação das versões de perfil de uma etapa. */
@Component({
  selector: 'cfg-fila-de-versoes-page',
  standalone: true,
  imports: [
    RouterLink,
    AlertComponent,
    FalhaDeLeituraComponent,
    IndicadorDaLeituraDirective,
    MotivoDialogComponent,
    RecusaDaLeituraComponent,
    ResumoDaVersaoComponent,
    SpinnerComponent,
  ],
  providers: [
    FilaDeVersoesStore,
    { provide: LeituraDosPerfis, useExisting: FilaDeVersoesStore },
    EscritaDoPerfil,
    DecisaoDaVersao,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cfg-page' },
  templateUrl: './fila-de-versoes.page.html',
})
export class FilaDeVersoesPage {
  /** A etapa vem da rota (`data.etapa`). */
  readonly etapa = input.required<EtapaDaVersao>();

  protected readonly store = inject(FilaDeVersoesStore);
  protected readonly escrita = inject(EscritaDoPerfil);
  protected readonly decisao = inject(DecisaoDaVersao);
  private readonly documentos = inject(DocumentoDaVersaoService);
  private readonly propostas = inject(PropostasDaSessao);
  protected readonly idDoTitulo = ID_DO_TITULO;
  protected readonly texto = computed(() => APRESENTACAO[this.etapa()]);
  protected readonly leitura = acompanharLeitura({
    assunto: 'fila de versões',
    falha: this.store.falha,
    pendente: this.store.carregando,
    indisponivel: this.escrita.gravando,
    recusada: computed(() => this.store.recusa() !== null),
    recarregar: () => this.store.tentarNovamente(),
    destino: () => document.getElementById(ID_DO_TITULO),
  });
  private destruida = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.destruida = true));
    effect(() => {
      const etapa = this.etapa();
      untracked(() => this.store.etapa.set(etapa));
    });
    devolverFocoAoTitulo(this.escrita.gravando, ID_DO_TITULO);
  }

  /** A API recusa a aprovação de quem propôs; a tela nem a oferece à pessoa que acabou de propor. */
  protected podeAprovar(item: ItemDaFilaDeVersoesDto): boolean {
    return !this.propostas.propos(item.versao.versaoId);
  }

  protected documentoVerificado(item: ItemDaFilaDeVersoesDto): boolean {
    return item.versao.situacaoDoDocumento === 'verificado';
  }

  /** O que impede a aprovação, dito junto ao botão. */
  protected ajuda(item: ItemDaFilaDeVersoesDto): string | null {
    if (!this.podeAprovar(item)) return 'Você propôs esta versão. Outra pessoa precisa aprová-la.';
    return this.documentoVerificado(item)
      ? null
      : 'A aprovação espera a verificação do documento instituidor.';
  }

  protected aprovar(item: ItemDaFilaDeVersoesDto): void {
    void this.decisao.aprovar(item, this.etapa());
  }

  protected confirmarRecusa(): void {
    void this.decisao.recusar(this.etapa());
  }

  protected async abrirDocumento(item: ItemDaFilaDeVersoesDto): Promise<void> {
    const { versaoId } = item.versao;
    const desfecho = await this.documentos.abrir(item.perfilId, versaoId, () => !this.destruida);
    if (desfecho === 'bloqueada') {
      this.decisao.registrarErro(
        versaoId,
        'O navegador bloqueou a abertura do documento. Libere as janelas e tente de novo.',
      );
    } else if (typeof desfecho === 'object') {
      this.decisao.registrarErro(versaoId, desfecho.recusa);
    }
  }
}
