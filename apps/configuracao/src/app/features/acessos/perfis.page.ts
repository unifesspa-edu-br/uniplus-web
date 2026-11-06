import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import type { PerfilDto } from '@uniplus/shared-data/autorizacao';
import { AlertComponent } from '@uniplus/shared-ui/components';
import { devolverFocoDaLista, focarAposNovaTentativa } from '../../shared/foco';
import { EdicaoDosPerfis } from './edicao-dos-perfis';
import { ID_DAS_PERMISSOES, PerfilFormularioComponent } from './perfil-formulario.component';
import { PerfisListaComponent } from './perfis-lista.component';
import { PerfisStore } from './perfis.store';

const ID_DO_TITULO = 'cfg-perfis-titulo';
const ID_DO_CADASTRO = 'cfg-perfis-novo';

@Component({
  selector: 'cfg-perfis-page',
  standalone: true,
  imports: [AlertComponent, PerfisListaComponent, PerfilFormularioComponent],
  providers: [PerfisStore, EdicaoDosPerfis],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cfg-page' },
  templateUrl: './perfis.page.html',
})
export class PerfisPage {
  protected readonly store = inject(PerfisStore);
  protected readonly edicao = inject(EdicaoDosPerfis);
  protected readonly idDoCadastro = ID_DO_CADASTRO;
  protected readonly pendente = computed(() => this.store.carregando() || this.edicao.gravando());
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
  private readonly novaTentativa = focarAposNovaTentativa(
    this.pendente,
    computed(() => this.store.mensagemDeErro() !== null),
    () => document.getElementById(ID_DO_TITULO),
  );

  private readonly novaTentativaDoCatalogo = focarAposNovaTentativa(
    this.store.carregandoCatalogo,
    this.store.erroDoCatalogo,
    () => document.getElementById(ID_DAS_PERMISSOES),
  );

  protected tentarNovamente(): void {
    this.novaTentativa.executar(() => this.store.recarregar());
  }

  protected tentarCatalogoNovamente(): void {
    this.novaTentativaDoCatalogo.executar(() => this.store.carregarCatalogo());
  }

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
