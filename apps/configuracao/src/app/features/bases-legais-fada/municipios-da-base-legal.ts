import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { MunicipioDaBaseLegalDoFadaDto } from '@uniplus/shared-data/configuracao';
import { NomesDeMunicipios } from '@uniplus/shared-ui/components';

export interface CampoDeMunicipios {
  readonly selecionados: readonly MunicipioDaBaseLegalDoFadaDto[];
  readonly erro: string | null;
}

/** Seleção dos municípios beneficiados e recusa apresentada junto ao campo. */
@Injectable()
export class MunicipiosDaBaseLegal {
  private readonly nomes = inject(NomesDeMunicipios);
  private readonly escolhidos = signal<readonly MunicipioDaBaseLegalDoFadaDto[]>([]);
  private readonly tocado = signal(false);
  private readonly recusa = signal<string | null>(null);
  readonly itens: Signal<readonly MunicipioDaBaseLegalDoFadaDto[]> = this.escolhidos.asReadonly();
  readonly vazia = computed(() => this.escolhidos().length === 0);
  private readonly erro = computed(
    () =>
      this.recusa() ?? (this.tocado() && this.vazia() ? 'Adicione ao menos um município.' : null),
  );
  readonly campo = computed<CampoDeMunicipios>(() => ({
    selecionados: this.escolhidos(),
    erro: this.erro(),
  }));

  carregar(municipios: readonly MunicipioDaBaseLegalDoFadaDto[]): void {
    this.escolhidos.set(municipios);
    this.tocado.set(false);
    this.recusa.set(null);
  }

  escolher(codigos: readonly string[]): void {
    const atuais = this.escolhidos();
    const selecionados = codigos.flatMap((codigo) => {
      const municipio =
        atuais.find((item) => item.codigoIbge === codigo) ?? this.nomes.municipio(codigo);
      if (!municipio) return [];
      const { codigoIbge, nome, uf } = municipio;
      return [{ codigoIbge, nome, uf }];
    });
    this.escolhidos.set(selecionados);
    this.tocado.set(true);
    this.recusa.set(null);
  }

  remover(codigoIbge: string): void {
    this.escolhidos.update((atuais) => atuais.filter((m) => m.codigoIbge !== codigoIbge));
    this.tocado.set(true);
    this.recusa.set(null);
  }

  exigir(): void {
    this.tocado.set(true);
  }
  recusar(mensagem: string): void {
    this.recusa.set(mensagem);
  }
  descartarRecusa(): void {
    this.recusa.set(null);
  }
}
