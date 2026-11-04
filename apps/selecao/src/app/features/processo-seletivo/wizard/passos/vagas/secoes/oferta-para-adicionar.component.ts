import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ValorLegivelDirective } from '@uniplus/shared-ui/components';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { CatalogosDeDistribuicao } from '../catalogos-de-distribuicao.service';
import { comOfertasAdicionadas } from '../edicao-do-quadro';
import { EstadoDoPassoDeVagas } from '../servicos/estado-do-passo-de-vagas';

/** A escolha das ofertas de curso que entram no quadro, com filtro e marcação em bloco. */
@Component({
  selector: 'details[selOfertaParaAdicionar]',
  imports: [ValorLegivelDirective, FormsModule],
  templateUrl: './oferta-para-adicionar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfertaParaAdicionarComponent {
  protected readonly store = inject(ProcessoSeletivoStore);
  protected readonly catalogos = inject(CatalogosDeDistribuicao);
  protected readonly estado = inject(EstadoDoPassoDeVagas);

  protected alternarMarcada(ofertaCursoId: string): void {
    const marcadas = new Set(this.estado.ofertasMarcadas());
    if (!marcadas.delete(ofertaCursoId)) marcadas.add(ofertaCursoId);
    this.estado.ofertasMarcadas.set(marcadas);
  }

  protected marcarTodas(marcar: boolean): void {
    this.estado.ofertasMarcadas.set(
      marcar ? new Set(this.estado.ofertasParaEscolher().map((oferta) => oferta.id)) : new Set(),
    );
  }

  protected adicionar(): void {
    const marcadas = this.estado.ofertasMarcadas();
    if (marcadas.size === 0) return;

    const novas = this.estado
      .ofertasDisponiveis()
      .filter((oferta) => marcadas.has(oferta.id))
      .map((oferta) => oferta.id);
    this.estado.substituir(
      comOfertasAdicionadas(this.estado.distribuicoes(), this.estado.padrao(), novas),
    );
    this.estado.ofertasMarcadas.set(new Set());
    this.estado.filtroDeOferta.set('');
  }
}
