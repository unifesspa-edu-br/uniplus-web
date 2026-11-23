import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { buscaDeMunicipiosNoGeo, leituraDeMunicipioNoGeo } from '@uniplus/shared-data/geo';
import {
  BUSCA_DE_MUNICIPIOS,
  LEITURA_DE_MUNICIPIO_POR_CODIGO,
  NomesDeMunicipios,
  ValorDeMunicipioComponent,
} from '@uniplus/shared-ui/components';

import { focarAposRenderizar } from '../../shared/foco-apos-renderizar';
import { haRecusaAtiva, type RecusaOrdenada } from '../../shared/recusas/ordem-das-recusas';
import { RecusasDoCampoComponent } from '../../shared/recusas/recusas-do-campo.component';
import { rotuloDoMunicipio, type MunicipioDeProva } from './declaracao-da-prova-presencial';

@Component({
  selector: 'sel-municipios-de-prova',
  standalone: true,
  imports: [ValorDeMunicipioComponent, RecusasDoCampoComponent],
  providers: [
    { provide: BUSCA_DE_MUNICIPIOS, useFactory: buscaDeMunicipiosNoGeo },
    { provide: LEITURA_DE_MUNICIPIO_POR_CODIGO, useFactory: leituraDeMunicipioNoGeo },
  ],
  templateUrl: './municipios-de-prova.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MunicipiosDeProvaComponent {
  readonly municipios = input.required<readonly MunicipioDeProva[]>();
  readonly recusasDaLista = input<readonly RecusaOrdenada[]>([]);
  readonly recusasPorMunicipio = input<ReadonlyMap<string, readonly RecusaOrdenada[]>>(new Map());
  readonly somenteLeitura = input(false);
  readonly desabilitado = input(false);
  readonly municipioAdicionado = output<MunicipioDeProva>();
  readonly municipioRemovido = output<string>();

  private readonly nomes = inject(NomesDeMunicipios);
  private readonly injector = inject(Injector);
  protected readonly busca = viewChild(ValorDeMunicipioComponent);
  protected readonly prefixo = `municipios-de-prova-${crypto.randomUUID().slice(0, 8)}`;
  protected readonly anuncio = signal('');
  protected readonly rotulo = rotuloDoMunicipio;
  protected readonly haRecusaAtiva = haRecusaAtiva;
  protected readonly codigos = computed(() =>
    this.municipios().map((municipio) => municipio.codigoIbge),
  );
  protected readonly rotulos = computed(() =>
    Object.fromEntries(
      this.municipios().map((municipio) => [municipio.codigoIbge, rotuloDoMunicipio(municipio)]),
    ),
  );

  focarBusca(): boolean {
    const id = this.busca()?.campoId();
    const campo = document.getElementById(id ?? `${this.prefixo}-lista`);
    campo?.focus();
    return campo !== null;
  }

  focarMunicipio(codigo: string): boolean {
    const botao = codigo ? document.getElementById(this.idDoBotao(codigo)) : null;
    if (!botao) return this.focarBusca();
    botao.focus();
    return true;
  }

  protected alterarEscolha(codigos: readonly string[]): void {
    const removido = this.municipios().find((municipio) => !codigos.includes(municipio.codigoIbge));
    if (removido) {
      this.remover(removido);
      return;
    }
    const novoCodigo = codigos.find((codigo) => !this.codigos().includes(codigo));
    const municipio = novoCodigo ? this.nomes.municipio(novoCodigo) : null;
    if (municipio) {
      this.anuncio.set(`Município adicionado: ${rotuloDoMunicipio(municipio)}.`);
      this.municipioAdicionado.emit(municipio);
    }
  }

  protected remover(municipio: MunicipioDeProva): void {
    const indice = this.municipios().findIndex((item) => item.codigoIbge === municipio.codigoIbge);
    const proximo = this.municipios()[indice + 1] ?? this.municipios()[indice - 1];
    this.anuncio.set(`Município removido: ${rotuloDoMunicipio(municipio)}.`);
    this.municipioRemovido.emit(municipio.codigoIbge);
    const campoId = this.busca()?.campoId();
    focarAposRenderizar(
      this.injector,
      ...(proximo ? [this.idDoBotao(proximo.codigoIbge)] : []),
      ...(campoId ? [campoId] : []),
    );
  }

  protected idDoBotao(codigo: string): string {
    return `${this.prefixo}-remover-${codigo}`;
  }

  protected idDaRecusa(codigo: string): string {
    return `${this.prefixo}-recusa-${codigo}`;
  }
}
