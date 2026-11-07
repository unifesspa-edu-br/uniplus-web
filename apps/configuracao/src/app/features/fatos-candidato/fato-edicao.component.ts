import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  effect,
  inject,
  Injector,
  untracked,
} from '@angular/core';
import {
  AlertComponent,
  FalhaDeLeituraComponent,
  IndicadorDaLeituraDirective,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { focoEstaLivre } from '../../shared/foco';
import { SituacaoDaAprovacaoComponent } from '../../shared/protecao-do-catalogo';
import { EdicaoDosFatos } from './edicao-dos-fatos';
import { EdicaoDoFato } from './edicao-do-fato';
import { FatoDefinicaoComponent } from './fato-definicao.component';
import { FatoDescritivoComponent } from './fato-descritivo.component';
import { FatoRegrasComponent } from './fato-regras.component';
import { FatoValoresComponent } from './fato-valores.component';
import { ID_DO_INICIO_DA_EDICAO } from './ids-do-fato';

/**
 * A edição de um fato do catálogo, com o rodapé do drawer: nome e descrição sempre; a definição,
 * os valores e as regras padrão quando o fato os tem (o derivado categórico precisa dos valores
 * antes das regras, porque a regra contribui um deles). O fato de sistema só altera nome,
 * descrição, componente e proteção de dados.
 */
@Component({
  selector: 'cfg-fato-edicao',
  imports: [
    AlertComponent,
    FalhaDeLeituraComponent,
    FatoDefinicaoComponent,
    FatoDescritivoComponent,
    FatoRegrasComponent,
    FatoValoresComponent,
    IndicadorDaLeituraDirective,
    SituacaoDaAprovacaoComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fato-edicao.component.html',
  styleUrl: './fato-drawer.css',
})
export class FatoEdicaoComponent {
  protected readonly edicao = inject(EdicaoDoFato);
  protected readonly leitura = this.edicao.leitura;
  private readonly fatos = inject(EdicaoDosFatos);
  private readonly injector = inject(Injector);

  /**
   * A falha de leitura troca o formulário pelo aviso: o foco vai a ele, para não cair no corpo da
   * página. Se o foco já está dentro do aviso (o "Tentar novamente" de uma nova falha), fica onde está.
   */
  private readonly focoNoAviso = effect(() => {
    if (this.leitura.erroDeCarga() === null) return;
    untracked(() =>
      afterNextRender(
        () => {
          const aviso = document.getElementById('cfg-fato-erro-de-carga');
          if (!aviso?.contains(document.activeElement)) aviso?.focus();
        },
        { injector: this.injector },
      ),
    );
  });

  protected readonly idDoInicio = ID_DO_INICIO_DA_EDICAO;

  /** Criado o fato, o botão de criar sai da tela; o foco recomeça no início da edição quando o fato chega. */
  private readonly focoNoFatoCriado = effect(() => {
    if (!this.fatos.focoNoFatoCriado() || this.leitura.fato() === null) return;
    untracked(() => {
      this.fatos.focoNoFatoCriado.set(false);
      afterNextRender(
        () => {
          if (focoEstaLivre()) document.getElementById(ID_DO_INICIO_DA_EDICAO)?.focus();
        },
        { injector: this.injector },
      );
    });
  });

  protected fechar(): void {
    this.fatos.fechar();
  }
}
