import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import {
  NomesDeMunicipios,
  ValorDeMunicipioComponent,
  type CidadeRef,
} from '@uniplus/shared-ui/components';

/** Cidade-sede escolhida ou busca de município. */
@Component({
  selector: 'cfg-unidade-cidade-campo',
  imports: [ValorDeMunicipioComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './unidade-cidade-campo.component.html',
})
export class UnidadeCidadeCampoComponent {
  private readonly nomes = inject(NomesDeMunicipios);
  protected readonly campo = viewChild(ValorDeMunicipioComponent);
  readonly selecionada = input.required<CidadeRef | null>();
  readonly erroDoSalvamento = input.required<string | null>();
  readonly escolher = output<CidadeRef>();
  readonly trocar = output<void>();
  protected readonly descricao = computed(() =>
    [
      'cfg-unidade-cidade-hint',
      ...(this.erroDoSalvamento() ? ['cfg-unidade-cidade-erro'] : []),
    ].join(' '),
  );

  protected escolherCodigo(codigos: readonly string[]): void {
    const municipio = this.nomes.municipio(codigos[0] ?? '');
    if (municipio) {
      const { codigoIbge, nome, uf } = municipio;
      this.escolher.emit({ codigoIbge, nome, uf });
    }
  }
}
