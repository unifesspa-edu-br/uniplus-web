import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  inject,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AlertComponent, DialogComponent, SpinnerComponent } from '@uniplus/shared-ui/components';

import { EdicaoDaModalidade } from './edicao-da-modalidade';
import { EdicaoDaRegraDeAplicabilidade } from './edicao-da-regra-de-aplicabilidade';
import { ModalidadeEnquadramentoComponent } from './modalidade-enquadramento.component';
import { ModalidadeFormularioComponent } from './modalidade-formulario.component';
import { ModalidadeFormStore } from './modalidade-form.store';
import { ModalidadeIdentificacaoComponent } from './modalidade-identificacao.component';
import { ModalidadeRegraComponent } from './modalidade-regra.component';
import { ModalidadeRemanejamentoComponent } from './modalidade-remanejamento.component';
import { ModalidadeVagasComponent } from './modalidade-vagas.component';

/** Cadastro e edição de uma modalidade: compõe o formulário, suas seções e a confirmação de troca de natureza. */
@Component({
  selector: 'cfg-modalidade-form-page',
  providers: [ModalidadeFormStore, EdicaoDaRegraDeAplicabilidade, EdicaoDaModalidade],
  standalone: true,
  imports: [
    RouterLink,
    AlertComponent,
    DialogComponent,
    SpinnerComponent,
    ModalidadeFormularioComponent,
    ModalidadeIdentificacaoComponent,
    ModalidadeVagasComponent,
    ModalidadeRemanejamentoComponent,
    ModalidadeRegraComponent,
    ModalidadeEnquadramentoComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modalidade-form.page.html',
})
export class ModalidadeFormPage {
  protected readonly store = inject(ModalidadeFormStore);
  protected readonly edicao = inject(EdicaoDaModalidade);
  protected readonly aplicabilidade = inject(EdicaoDaRegraDeAplicabilidade);
  protected readonly titulo = this.edicao.modoEdicao ? 'Editar modalidade' : 'Nova modalidade';

  private readonly tituloPagina =
    viewChild.required<ElementRef<HTMLHeadingElement>>('tituloPagina');

  constructor() {
    afterNextRender(() => this.tituloPagina().nativeElement.focus());
  }

  /** Sair da página destruiria a assinatura da gravação em curso: o link fica indisponível, mas focável. */
  protected aoClicarEmVoltar(evento: Event): void {
    if (this.edicao.salvando()) evento.preventDefault();
  }
}
