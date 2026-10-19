import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  SituacaoDoProdutoPrevisto,
  type AtoDoProcessoDto,
  type ProdutoPrevistoDto,
} from '@uniplus/shared-data/selecao';
import { EmptyStateComponent, TagComponent } from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';

import { rotuloDoAto } from './apresentacao-do-ato';
import { ArquivosDoAtoComponent } from './arquivos-do-ato.component';
import {
  atoQueACorrecaoCorrige,
  ehResultado,
  fasesDePrevistos,
  politicaParaConfirmar,
  type PoliticaParaConfirmar,
  rotuloDoPapel,
} from './previstos-do-edital';
import type { PrevistosLidos } from './publicacoes-do-processo.service';
import type { ModoDaPublicacao } from './publicar-documento.component';
import { SituacaoDoAtoComponent } from './situacao-do-ato.component';

/**
 * Os documentos que o edital declara publicar, por fase e etapa, com a situação de cada um, a
 * publicação e a correção. Só apresenta: o que vale para cada item — se já saiu, se o preliminar
 * precisa vir antes — é decisão do servidor, que devolve o impedimento já em palavras de negócio.
 * Abrir o formulário e abrir um documento são pedidos à página.
 */
@Component({
  selector: 'sel-previstos-no-edital',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    ArquivosDoAtoComponent,
    DateBrPipe,
    EmptyStateComponent,
    SituacaoDoAtoComponent,
    TagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './previstos-no-edital.component.html',
  styleUrl: './previstos-no-edital.component.css',
})
export class PrevistosNoEditalComponent {
  readonly previstos = input.required<PrevistosLidos>();
  /** O documento cujo acesso está sendo pedido, para o botão anunciar a espera. */
  readonly abrindo = input<string | null>(null);

  /** O formulário que o item pede: publicar a primeira vez ou corrigir. */
  readonly publicar = output<ModoDaPublicacao>();
  readonly abrir = output<string>();

  protected readonly rotuloDoAto = rotuloDoAto;
  protected readonly rotuloDoPapel = rotuloDoPapel;
  protected readonly aberto = SituacaoDoProdutoPrevisto.aberto;
  protected readonly publicado = SituacaoDoProdutoPrevisto.publicado;

  protected readonly fases = computed(() => {
    const { consulta, nomeDaFase } = this.previstos();
    return fasesDePrevistos(consulta, nomeDaFase, 'Etapas fora de uma fase');
  });

  protected nomeDoItem(item: ProdutoPrevistoDto): string {
    return item.tipoNome ?? item.tipoCodigo;
  }

  /** O ato que a correção do item aponta, quando o item admite ser corrigido agora. */
  protected corrigivel(item: ProdutoPrevistoDto): AtoDoProcessoDto | null {
    return atoQueACorrecaoCorrige(item);
  }

  protected publicarItem(item: ProdutoPrevistoDto): void {
    this.publicar.emit({ tipo: 'previsto', item, politica: this.politicaDe(item), corrigido: null });
  }

  protected corrigirItem(item: ProdutoPrevistoDto): void {
    const corrigido = atoQueACorrecaoCorrige(item);
    if (corrigido === null) return;
    this.publicar.emit({ tipo: 'previsto', item, politica: this.politicaDe(item), corrigido });
  }

  /** A política só se mostra, e só se confirma, no item que é resultado. */
  private politicaDe(item: ProdutoPrevistoDto): PoliticaParaConfirmar | null {
    if (!ehResultado(item)) return null;
    const { consulta, camposDeDivulgacao } = this.previstos();
    return politicaParaConfirmar(consulta.politicaDeDivulgacao, camposDeDivulgacao);
  }
}
