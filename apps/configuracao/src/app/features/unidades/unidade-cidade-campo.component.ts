import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import {
  FalhaDeLeituraDoCampoComponent,
  type LeituraAcompanhada,
} from '@uniplus/shared-ui/components';
import type { CidadeResumoDto } from '@uniplus/shared-data/geo';
import type { CidadeRef } from '@uniplus/shared-ui/components';

/** O campo "cidade-sede": a cidade escolhida ou a busca na Geo com as opções encontradas. */
@Component({
  selector: 'cfg-unidade-cidade-campo',
  imports: [FalhaDeLeituraDoCampoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './unidade-cidade-campo.component.html',
})
export class UnidadeCidadeCampoComponent {
  readonly selecionada = input.required<CidadeRef | null>();
  readonly termo = model.required<string>();
  readonly opcoes = input.required<readonly CidadeResumoDto[]>();
  readonly buscando = input.required<boolean>();
  /** A leitura da busca de cidade, com o aviso de falha e a nova tentativa. */
  readonly leitura = input.required<LeituraAcompanhada>();
  readonly semResultado = input.required<boolean>();
  /** A recusa da referência de cidade no salvamento. */
  readonly erroDoSalvamento = input.required<string | null>();
  readonly escolher = output<CidadeRef>();
  readonly trocar = output<void>();

  /** Hint, a recusa do salvamento (sempre relevante) e a falha da busca (só no ramo de busca). */
  protected readonly descricao = computed(() => this.idsDaDescricao(true));
  protected readonly descricaoDaSelecionada = computed(() => this.idsDaDescricao(false));

  protected aoDigitar(evento: Event): void {
    this.termo.set((evento.target as HTMLInputElement).value);
  }

  protected escolherOpcao(opcao: CidadeResumoDto): void {
    this.escolher.emit({ codigoIbge: opcao.codigoIbge, nome: opcao.nome, uf: opcao.uf });
  }

  private idsDaDescricao(comErroDaBusca: boolean): string {
    const ids = ['cfg-unidade-cidade-hint'];
    if (this.erroDoSalvamento() !== null) ids.push('cfg-unidade-cidade-erro');
    if (comErroDaBusca && this.leitura().visivel()) ids.push('cfg-unidade-cidade-busca-erro');
    return ids.join(' ');
  }
}
