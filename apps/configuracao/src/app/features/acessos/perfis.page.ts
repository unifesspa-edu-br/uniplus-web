import { RouterLink } from '@angular/router';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import {
  acompanharLeitura,
  AlertComponent,
  FalhaDeLeituraComponent,
} from '@uniplus/shared-ui/components';
import { devolverFocoDaLista } from '../../shared/foco';
import { EdicaoDosPerfis } from './edicao-dos-perfis';
import { PerfilFormularioComponent } from './perfil-formulario.component';
import { PerfisListaComponent } from './perfis-lista.component';
import { RecusaDaLeituraComponent } from '../../shared/recusa-da-leitura';
import { PerfisStore } from './perfis.store';
import { EscritaDoPerfil } from './versoes/escrita-do-perfil';
import { LeituraDosPerfis } from './versoes/leitura-dos-perfis';
import { PROVEDORES_DE_ESCRITA_DE_PERFIS } from './versoes/provedores-de-perfis';

const ID_DO_TITULO = 'cfg-perfis-titulo';
const ID_DO_CADASTRO = 'cfg-perfis-novo';

@Component({
  selector: 'cfg-perfis-page',
  standalone: true,
  imports: [
    RouterLink,
    AlertComponent,
    FalhaDeLeituraComponent,
    PerfisListaComponent,
    PerfilFormularioComponent,
    RecusaDaLeituraComponent,
  ],
  providers: [
    PerfisStore,
    { provide: LeituraDosPerfis, useExisting: PerfisStore },
    ...PROVEDORES_DE_ESCRITA_DE_PERFIS,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cfg-page' },
  templateUrl: './perfis.page.html',
})
export class PerfisPage {
  protected readonly store = inject(PerfisStore);
  protected readonly edicao = inject(EdicaoDosPerfis);
  protected readonly escrita = inject(EscritaDoPerfil);
  protected readonly idDoCadastro = ID_DO_CADASTRO;
  private readonly foco = devolverFocoDaLista({
    gravando: this.escrita.gravando,
    carregando: this.store.carregando,
    atributoDaLinha: 'data-perfil-id',
    idDoTitulo: ID_DO_TITULO,
    idDoCadastro: ID_DO_CADASTRO,
  });
  protected readonly leitura = acompanharLeitura({
    assunto: 'perfis',
    falha: this.store.falha,
    pendente: this.store.carregando,
    indisponivel: this.escrita.gravando,
    recusada: computed(() => this.store.recusa() !== null),
    recarregar: () => this.store.tentarNovamente(),
    destino: () => document.getElementById(ID_DO_TITULO),
  });

  protected criar(): void {
    this.foco.registrar(null);
    this.edicao.abrirCriacao();
  }
}
