import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  acompanharLeitura,
  AlertComponent,
  EmptyStateComponent,
  FalhaDeLeituraComponent,
  PagerComponent,
  SpinnerComponent,
  TagComponent,
} from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';
import { mensagemDeErroDoCampoComFormato } from '../../../shared/formulario';
import { RecusaDaLeituraComponent } from '../../../shared/recusa-da-leitura';
import { LIMITES_DO_TERMO, PublicacaoDoTermo } from './publicacao-do-termo';
import { PublicacaoDoTermoStore } from './publicacao-do-termo.store';
import { TermoDeResponsabilidadeComponent } from './termo-de-responsabilidade.component';

const ID_DO_TITULO = 'cfg-publicacao-do-termo-titulo';

/** A versão vigente do termo de responsabilidade, o histórico e a publicação de uma versão nova. */
@Component({
  selector: 'cfg-publicacao-do-termo-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    DateBrPipe,
    AlertComponent,
    EmptyStateComponent,
    FalhaDeLeituraComponent,
    PagerComponent,
    RecusaDaLeituraComponent,
    SpinnerComponent,
    TagComponent,
    TermoDeResponsabilidadeComponent,
  ],
  providers: [PublicacaoDoTermoStore, PublicacaoDoTermo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cfg-page' },
  styleUrl: './publicacao-do-termo.page.css',
  templateUrl: './publicacao-do-termo.page.html',
})
export class PublicacaoDoTermoPage {
  protected readonly store = inject(PublicacaoDoTermoStore);
  protected readonly publicacao = inject(PublicacaoDoTermo);
  protected readonly idDoTitulo = ID_DO_TITULO;
  protected readonly limites = LIMITES_DO_TERMO;
  protected readonly leitura = acompanharLeitura({
    assunto: 'termo de responsabilidade',
    falha: this.store.falha,
    pendente: this.store.carregando,
    recusada: computed(() => this.store.recusa() !== null),
    recarregar: () => this.store.tentarNovamente(),
    destino: () => document.getElementById(ID_DO_TITULO),
  });

  protected erroDoCampo(campo: 'texto' | 'ato'): string | null {
    return mensagemDeErroDoCampoComFormato(this.publicacao.form.controls[campo], 'Valor inválido.');
  }
}
