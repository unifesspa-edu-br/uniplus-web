import { RouterLink } from '@angular/router';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import type { PerfilDto } from '@uniplus/shared-data/autorizacao';
import {
  acompanharLeitura,
  AlertComponent,
  destinoAcessivel,
  FalhaDeLeituraComponent,
} from '@uniplus/shared-ui/components';
import { devolverFocoDaLista } from '../../shared/foco';
import { EdicaoDosPerfis } from './edicao-dos-perfis';
import { ID_DAS_PERMISSOES, PerfilFormularioComponent } from './perfil-formulario.component';
import { PerfisListaComponent } from './perfis-lista.component';
import { RecusaDaLeituraComponent } from '../../shared/recusa-da-leitura';
import { PerfisStore } from './perfis.store';

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
  providers: [PerfisStore, EdicaoDosPerfis],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cfg-page' },
  templateUrl: './perfis.page.html',
})
export class PerfisPage {
  protected readonly store = inject(PerfisStore);
  protected readonly edicao = inject(EdicaoDosPerfis);
  protected readonly idDoCadastro = ID_DO_CADASTRO;
  protected readonly permissoesMarcadas = computed(() =>
    this.store
      .catalogo()
      .flatMap((modulo) =>
        modulo.resources.flatMap((resource) =>
          resource.permissoes
            .filter((permissao) => this.edicao.marcada(permissao.codigo))
            .map((permissao) => permissao.codigo),
        ),
      ),
  );
  private readonly foco = devolverFocoDaLista({
    gravando: this.edicao.gravando,
    carregando: this.store.carregando,
    atributoDaLinha: 'data-perfil-id',
    idDoTitulo: ID_DO_TITULO,
    idDoCadastro: ID_DO_CADASTRO,
  });
  protected readonly leitura = acompanharLeitura({
    assunto: 'perfis',
    falha: this.store.falha,
    pendente: this.store.carregando,
    indisponivel: this.edicao.gravando,
    recusada: computed(() => this.store.recusa() !== null),
    recarregar: () => this.store.tentarNovamente(),
    destino: () => document.getElementById(ID_DO_TITULO),
  });
  protected readonly leituraDoCatalogo = acompanharLeitura({
    assunto: 'permissões',
    falha: this.store.falhaDoCatalogo,
    pendente: this.store.carregandoCatalogo,
    recusada: computed(() => this.store.recusaDoCatalogo() !== null),
    recarregar: () => this.store.tentarCatalogoNovamente(),
    destino: () =>
      destinoAcessivel(
        document.getElementById(ID_DAS_PERMISSOES),
        document.getElementById(ID_DO_TITULO),
      ),
  });

  protected criar(): void {
    this.foco.registrar(null);
    this.edicao.abrirCriacao();
  }

  protected editar(perfil: PerfilDto): void {
    this.foco.registrar({ acao: 'editar', id: perfil.id });
    this.edicao.abrirEdicao(perfil);
  }

  protected alternarAtivacao(perfil: PerfilDto): void {
    this.foco.registrar({ acao: 'situacao', id: perfil.id });
    void this.edicao.alternarAtivacao(perfil);
  }
}
