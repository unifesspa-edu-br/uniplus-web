import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AlertComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { TermoConsentimentoStore } from './termo-consentimento.store';
import { EdicaoDosTermosConsentimento } from './edicao-dos-termos-consentimento';
import { TermoConsentimentoFormularioComponent } from './termo-consentimento-formulario.component';
import { TermoConsentimentoDetalheComponent } from './termo-consentimento-detalhe.component';
import { TermoConsentimentoRemocaoComponent } from './termo-consentimento-remocao.component';

@Component({
  selector: 'cfg-termos-consentimento-detail-page',
  standalone: true,
  imports: [
    TermoConsentimentoFormularioComponent,
    TermoConsentimentoDetalheComponent,
    TermoConsentimentoRemocaoComponent,
    RouterLink,
    AlertComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './termos-consentimento-detail.page.html',
  providers: [TermoConsentimentoStore, EdicaoDosTermosConsentimento],
})
export class TermosConsentimentoDetailPage {
  private readonly store = inject(TermoConsentimentoStore);
  protected readonly edicao = inject(EdicaoDosTermosConsentimento);

  private readonly tituloPagina = viewChild<ElementRef<HTMLHeadingElement>>('tituloPagina');

  private readonly id = this.store.id;
  protected readonly modoEdicao = computed(() => this.id() !== null);
  protected readonly termo = this.store.termo;
  protected readonly titulo = computed(
    () => this.termo()?.nome ?? (this.modoEdicao() ? 'Termo de consentimento' : 'Novo termo'),
  );
  protected readonly carregando = this.store.carregando;
  protected readonly erroCarregar = this.store.erro;
  protected readonly formError = this.edicao.formError;
  protected readonly acaoErro = this.edicao.acaoErro;
  protected readonly tentouSalvar = this.edicao.tentouSalvar;
  protected readonly criando = this.edicao.criando;
  protected readonly acaoEmAndamento = this.edicao.acaoEmAndamento;
  protected readonly processando = this.edicao.processando;
  protected readonly confirmRemoverAberto = this.edicao.confirmRemoverAberto;
  protected readonly podeRevisar = this.edicao.podeRevisar;
  protected readonly podePromover = this.edicao.podePromover;
  protected readonly podeRemover = this.edicao.podeRemover;
  protected readonly criarForm = this.edicao.criarForm;
  protected readonly rascunhoForm = this.edicao.rascunhoForm;
  protected readonly criar = this.edicao.criar.bind(this.edicao);
  protected readonly salvarRascunho = this.edicao.salvarRascunho.bind(this.edicao);
  protected readonly marcarRevisado = this.edicao.marcarRevisado.bind(this.edicao);
  protected readonly promoverVersao = this.edicao.promoverVersao.bind(this.edicao);
  protected readonly pedirRemocao = this.edicao.pedirRemocao.bind(this.edicao);
  protected readonly removerConfirmado = this.edicao.removerConfirmado.bind(this.edicao);
  protected readonly recarregarTermo = this.edicao.recarregarTermo.bind(this.edicao);

  constructor() {
    afterNextRender(() => this.tituloPagina()?.nativeElement.focus());
  }
}
