import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  computed,
  effect,
  inject,
  Injector,
  untracked,
} from '@angular/core';
import { AlertComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { focarAposNovaTentativa, focoEstaLivre } from '../../shared/foco';
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
    FatoDefinicaoComponent,
    FatoDescritivoComponent,
    FatoRegrasComponent,
    FatoValoresComponent,
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

  /** A falha de leitura troca o formulário pelo alerta: o foco vai a ele, para não cair no corpo da página. */
  private readonly focoNoAlerta = effect(() => {
    if (this.leitura.erroDeCarga() === null) return;
    untracked(() =>
      afterNextRender(() => document.getElementById('cfg-fato-erro-de-carga')?.focus(), {
        injector: this.injector,
      }),
    );
  });

  /** O alerta fica na tela durante a nova tentativa, com o foco no botão; ao dar certo, o foco vai ao início da edição. */
  private readonly novaTentativa = focarAposNovaTentativa(
    this.leitura.carregando,
    computed(() => this.leitura.erroDeCarga() !== null),
    () => document.getElementById(ID_DO_INICIO_DA_EDICAO),
  );
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

  protected tentarNovamente(): void {
    this.novaTentativa.executar(() => this.leitura.recarregar());
  }

  protected fechar(): void {
    this.fatos.fechar();
  }
}
