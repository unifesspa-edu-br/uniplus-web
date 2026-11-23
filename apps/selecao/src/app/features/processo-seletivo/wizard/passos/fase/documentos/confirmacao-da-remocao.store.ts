import { Injectable, inject, signal } from '@angular/core';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import {
  efeitoDaRemocao,
  textoDoEfeito,
  type EfeitoDaRemocao,
} from '../../../shared/exigencias/efeito-da-remocao';
import { ExigenciasDaFaseStore } from './exigencias-da-fase.store';

@Injectable()
export class ConfirmacaoDaRemocaoStore {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly exigencias = inject(ExigenciasDaFaseStore);
  readonly aberta = signal(false);
  readonly texto = signal('');
  documento = '';
  destino: HTMLElement | null = null;

  solicitar(id: string, nome: string, destino: HTMLElement): void {
    const efeito = efeitoDaRemocao(this.store.draft().documentos, id);
    const nomes = this.nomesDosDocumentos(efeito);
    this.texto.set(textoDoEfeito(efeito, nome, nomes));
    this.documento = id;
    this.destino = destino;
    this.aberta.set(true);
  }
  private nomesDosDocumentos(efeito: EfeitoDaRemocao): string {
    const identificadores =
      efeito.tipo === 'grupoComUmDocumento'
        ? [efeito.documento]
        : efeito.tipo === 'semEfeitoNoGrupo'
          ? (efeito.documentos ?? [])
          : [];
    return identificadores
      .map(
        (identificador) =>
          this.exigencias.documentosDaFase().find((documento) => documento.id === identificador)
            ?.nome ?? identificador,
      )
      .join(', ');
  }
}
