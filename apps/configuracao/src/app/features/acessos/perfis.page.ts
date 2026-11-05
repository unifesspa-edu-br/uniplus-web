import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AlertComponent } from '@uniplus/shared-ui/components';
import { EdicaoDosPerfis } from './edicao-dos-perfis';
import { PerfilFormularioComponent } from './perfil-formulario.component';
import { PerfisListaComponent } from './perfis-lista.component';
import { PerfisStore } from './perfis.store';

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
}
