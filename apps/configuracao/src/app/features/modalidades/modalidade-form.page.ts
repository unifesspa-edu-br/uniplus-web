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
import {
  acompanharCatalogo,
  acompanharLeitura,
  AlertComponent,
  DialogComponent,
  FalhaDeLeituraComponent,
  IndicadorDaLeituraDirective,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';

import { EdicaoDaModalidade } from './edicao-da-modalidade';
import { EdicaoDaRegraDeAplicabilidade } from './edicao-da-regra-de-aplicabilidade';
import { ModalidadeEnquadramentoComponent } from './modalidade-enquadramento.component';
import { ModalidadeFormularioComponent } from './modalidade-formulario.component';
import { ModalidadeFormStore } from './modalidade-form.store';
import { ModalidadeIdentificacaoComponent } from './modalidade-identificacao.component';
import { ModalidadeRegraComponent } from './modalidade-regra.component';
import { ModalidadeRemanejamentoComponent } from './modalidade-remanejamento.component';
import { ModalidadeVagasComponent } from './modalidade-vagas.component';

const ID_DO_TITULO = 'cfg-modalidade-form-titulo';
const MENSAGEM_DAS_OPCOES =
  'Os campos Origem, Destino, Par e Fallback ficam sem opções, e o código informado não é conferido contra os já cadastrados, até a lista ser lida de novo.';

/** Cadastro e edição de uma modalidade: compõe o formulário, suas seções e a confirmação de troca de natureza. */
@Component({
  selector: 'cfg-modalidade-form-page',
  providers: [ModalidadeFormStore, EdicaoDaRegraDeAplicabilidade, EdicaoDaModalidade],
  standalone: true,
  imports: [
    RouterLink,
    AlertComponent,
    DialogComponent,
    FalhaDeLeituraComponent,
    IndicadorDaLeituraDirective,
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
  protected readonly idDoTitulo = ID_DO_TITULO;
  protected readonly titulo = this.edicao.modoEdicao ? 'Editar modalidade' : 'Nova modalidade';

  protected readonly leitura = acompanharLeitura({
    assunto: 'modalidade',
    falha: this.store.falhaAoCarregar,
    pendente: this.store.carregando,
    recusada: this.store.inexistente,
    recarregar: () => this.store.tentarNovamente(),
    destino: () => document.getElementById(ID_DO_TITULO),
  });

  /** As opções vêm de uma lista lida por páginas: ela é completa só depois da última. */
  protected readonly leituraDasOpcoes = acompanharCatalogo({
    assunto: 'modalidades de referência',
    falha: computed(() => (this.store.opcoesComErro() ? MENSAGEM_DAS_OPCOES : null)),
    pendente: this.store.carregandoOpcoes,
    recarregar: () => this.store.recarregarOpcoes(),
    destino: () => document.getElementById(ID_DO_TITULO),
  });

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
