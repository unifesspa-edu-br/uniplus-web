import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { acompanharLeitura, FalhaDeLeituraComponent } from '@uniplus/shared-ui/components';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import { EdicaoDosMotivosDeDecisao } from './edicao-dos-motivos-de-decisao';
import { FundamentosOferecidos } from './fundamentos-oferecidos';
import { MotivoDeDecisaoFormularioComponent } from './motivo-de-decisao-formulario.component';
import { MotivosDeDecisaoListaComponent } from './motivos-de-decisao-lista.component';
import { MotivosDeDecisaoStore } from './motivos-de-decisao.store';
import { TIPOS_DE_MOTIVO } from './tipos-de-motivo';

@Component({
  selector: 'cfg-motivos-de-decisao-page',
  standalone: true,
  imports: [
    FalhaDeLeituraComponent,
    ConfirmacaoDeRemocaoComponent,
    MotivoDeDecisaoFormularioComponent,
    MotivosDeDecisaoListaComponent,
  ],
  providers: [MotivosDeDecisaoStore, EdicaoDosMotivosDeDecisao, FundamentosOferecidos],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './motivos-de-decisao.page.html',
  host: { class: 'cfg-page' },
})
export class MotivosDeDecisaoPage {
  protected readonly store = inject(MotivosDeDecisaoStore);
  protected readonly edicao = inject(EdicaoDosMotivosDeDecisao);
  protected readonly tipos = TIPOS_DE_MOTIVO;
  protected readonly leitura = acompanharLeitura({
    falha: this.store.mensagemDeErro,
    pendente: this.store.carregando,
    indisponivel: this.edicao.gravando,
    recarregar: () => this.store.tentarNovamente(),
    destino: () => document.getElementById('cfg-motivos-de-decisao-list-title'),
  });

  protected escolherTipo(evento: Event): void {
    this.edicao.abandonarPendencias();
    this.store.escolherTipo((evento.target as HTMLSelectElement).value);
  }

  protected alternarDesativados(evento: Event): void {
    this.edicao.abandonarPendencias();
    this.store.alternarDesativados((evento.target as HTMLInputElement).checked);
  }
}
