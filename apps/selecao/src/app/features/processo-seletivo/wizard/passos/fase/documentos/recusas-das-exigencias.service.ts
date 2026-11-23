import { Injectable, signal } from '@angular/core';

import type { RecusaDaExigencia } from '../../cronograma/servicos/gravacao-das-exigencias-documentais.service';

const CAMPOS_EXIBIDOS = [
  'documento.requisitos.formatosPermitidos',
  'documento.requisitos.tamanhoMaximoBytes',
  'documento.indeferimento.consequencia',
];

@Injectable()
export class RecusasDasExigencias {
  private readonly guardadas = signal<readonly RecusaDaExigencia[]>([]);

  registrar(recusas: readonly RecusaDaExigencia[]): void {
    this.guardadas.set(recusas);
  }

  todas(): readonly RecusaDaExigencia[] {
    return this.guardadas();
  }

  doCampo(identificadorDaRegra: string, campo: string): readonly RecusaDaExigencia[] {
    return this.guardadas().filter(
      (recusa) =>
        recusa.identificadorDaRegra === identificadorDaRegra &&
        (recusa.campo === campo ||
          recusa.campo.startsWith(campo + '[') ||
          recusa.campo.startsWith(campo + '.')),
    );
  }

  limparCampo(identificadorDaRegra: string, campo: string): void {
    this.guardadas.update((recusas) =>
      recusas.filter(
        (recusa) =>
          recusa.identificadorDaRegra !== identificadorDaRegra ||
          !(
            recusa.campo === campo ||
            recusa.campo.startsWith(campo + '[') ||
            recusa.campo.startsWith(campo + '.')
          ),
      ),
    );
  }

  daRegraSemCampo(identificadorDaRegra: string): readonly RecusaDaExigencia[] {
    return this.guardadas().filter(
      (recusa) =>
        recusa.identificadorDaRegra === identificadorDaRegra &&
        !CAMPOS_EXIBIDOS.some(
          (campo) =>
            recusa.campo === campo ||
            recusa.campo.startsWith(campo + '[') ||
            recusa.campo.startsWith(campo + '.'),
        ),
    );
  }

  limpar(): void {
    this.guardadas.set([]);
  }
}
