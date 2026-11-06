import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  acompanharNovaTentativa,
  AlertaNovaTentativaComponent,
  AlertComponent,
  DialogComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import { focoEstaLivre } from '../../shared/foco';
import { devolverFocoDaAcao } from './devolver-foco-da-acao';
import { EdicaoDosTermosConsentimento } from './edicao-dos-termos-consentimento';
import { TermoConsentimentoDetalheComponent } from './termo-consentimento-detalhe.component';
import { TermoConsentimentoFormularioComponent } from './termo-consentimento-formulario.component';
import { TermoConsentimentoStore } from './termo-consentimento.store';

const ID_DO_TITULO = 'cfg-termo-consentimento-titulo';

const ALERTA_DE_LEITURA_DEFASADA = {
  titulo: 'Os dados na tela podem estar desatualizados',
  texto: 'O termo foi alterado por outra pessoa. Recarregue os dados antes de continuar.',
};

@Component({
  selector: 'cfg-termos-consentimento-detail-page',
  standalone: true,
  imports: [
    TermoConsentimentoFormularioComponent,
    TermoConsentimentoDetalheComponent,
    ConfirmacaoDeRemocaoComponent,
    RouterLink,
    AlertComponent,
    DialogComponent,
    SpinnerComponent,
    AlertaNovaTentativaComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './termos-consentimento-detail.page.html',
  providers: [TermoConsentimentoStore, EdicaoDosTermosConsentimento],
})
export class TermosConsentimentoDetailPage {
  protected readonly store = inject(TermoConsentimentoStore);
  protected readonly edicao = inject(EdicaoDosTermosConsentimento);
  protected readonly idDoTitulo = ID_DO_TITULO;
  protected readonly modoEdicao = computed(() => this.store.id() !== null);
  protected readonly titulo = computed(
    () => this.store.termo()?.nome ?? (this.modoEdicao() ? 'Termo de consentimento' : 'Novo termo'),
  );
  protected readonly mensagemDaRemocao = computed(
    () => `Remover o termo ${this.store.termo()?.nome ?? ''}? Essa ação não pode ser desfeita.`,
  );
  protected readonly indisponivel = computed(
    () => this.store.carregando() || this.edicao.processando(),
  );

  protected readonly alertaDaAcao = computed(() => {
    const erro = this.edicao.acaoErro();
    if (erro && !this.edicao.confirmRemoverAberto()) {
      return { titulo: 'Não foi possível concluir a ação', texto: erro };
    }
    return this.edicao.leituraDefasada() ? ALERTA_DE_LEITURA_DEFASADA : null;
  });

  private readonly tituloPagina = viewChild<ElementRef<HTMLHeadingElement>>('tituloPagina');
  protected readonly novaTentativa = acompanharNovaTentativa({
    pendente: this.store.carregando,
    falhou: computed(() => this.store.erro() !== null),
    destino: () => this.tituloPagina()?.nativeElement,
  });

  private readonly injector = inject(Injector);

  constructor() {
    afterNextRender(() => this.tituloPagina()?.nativeElement.focus());
    this.levarFocoAoTituloAoFimDaCarga();
    devolverFocoDaAcao({
      processando: this.edicao.processando,
      acao: this.edicao.acaoEmAndamento,
      idDoTitulo: ID_DO_TITULO,
    });
  }

  protected tentarNovamente(): void {
    if (this.edicao.pedirConfirmacaoDaRecarga()) return;
    this.novaTentativa.executar(() => this.edicao.recarregarTermo());
  }

  protected recarregarConfirmado(): void {
    this.novaTentativa.executar(() => this.edicao.recarregarConfirmado());
  }

  /**
   * A carga sai da tela junto com o alerta e o botão que a pediu, e o foco cai no `body`: ao fim
   * dela, volta ao título, se ninguém o levou a outro lugar.
   */
  private levarFocoAoTituloAoFimDaCarga(): void {
    let carregou = false;
    effect(() => {
      if (this.store.carregando()) {
        carregou = true;
        return;
      }
      if (!carregou) return;
      carregou = false;
      afterNextRender(
        () => {
          if (focoEstaLivre()) this.tituloPagina()?.nativeElement.focus();
        },
        { injector: this.injector },
      );
    });
  }
}
