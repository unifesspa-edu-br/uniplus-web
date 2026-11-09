import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import {
  FalhaDeLeituraComponent,
  TagComponent,
  acompanharLeitura,
  destinoAcessivel,
} from '@uniplus/shared-ui/components';
import { RecusaDaLeituraComponent } from '../../../shared/recusa-da-leitura';
import { sensibilidade } from '../rotulos-de-acesso';
import { CatalogoDePermissoesStore } from './catalogo-de-permissoes.store';
import { mudancaDaPermissao, type DiferencaDaVersao } from './diferenca-da-versao';

/** Destino do foco quando o catálogo volta a carregar depois de uma falha. */
export const ID_DAS_PERMISSOES = 'cfg-perfil-permissoes';
const ID_DO_ERRO_DAS_PERMISSOES = 'cfg-perfil-erro-permissoes';

/** As permissões do catálogo por módulo e resource, com a mudança de cada uma em relação ao que está em vigor. */
@Component({
  selector: 'cfg-permissoes-do-perfil',
  standalone: true,
  imports: [FalhaDeLeituraComponent, RecusaDaLeituraComponent, TagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './permissoes-do-perfil.component.html',
})
export class PermissoesDoPerfilComponent {
  protected readonly catalogo = inject(CatalogoDePermissoesStore);
  readonly marcadas = input.required<ReadonlySet<string>>();
  readonly diferenca = input.required<DiferencaDaVersao>();
  readonly bloqueado = input.required<boolean>();
  readonly erro = input.required<string | null>();
  readonly alternar = output<string>();
  protected readonly sensibilidadeDe = sensibilidade;
  protected readonly idDasPermissoes = ID_DAS_PERMISSOES;
  protected readonly idDoErro = ID_DO_ERRO_DAS_PERMISSOES;
  protected readonly descritoPor = computed(() => (this.erro() ? ID_DO_ERRO_DAS_PERMISSOES : null));
  protected readonly leitura = acompanharLeitura({
    assunto: 'permissões',
    falha: this.catalogo.falha,
    pendente: this.catalogo.carregando,
    recusada: computed(() => this.catalogo.recusa() !== null),
    recarregar: () => this.catalogo.tentarNovamente(),
    destino: () =>
      destinoAcessivel(
        document.getElementById(ID_DAS_PERMISSOES),
        document.getElementById('cfg-perfis-titulo'),
      ),
  });

  protected mudanca(codigo: string) {
    return mudancaDaPermissao(codigo, this.diferenca());
  }
}
