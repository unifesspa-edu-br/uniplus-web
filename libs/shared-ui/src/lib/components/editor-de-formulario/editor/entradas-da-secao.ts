import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  computed,
  inject,
  input,
  output,
} from '@angular/core';

import { aplicarEdicao } from '../edicao';
import { focarDepois } from '../foco';
import { GrupoDoFormularioComponent } from '../grupo-do-formulario';
import { idDaEtapa, idDoGrupo, idDoItem } from '../ids';
import { ItemDoFormularioComponent } from '../item-do-formulario';
import { type ContextoDoEditor } from '../modelo/contexto-do-editor';
import { comGrupo, motivoDaRemocaoTravadaDoGrupo, removerGrupo } from '../modelo/grupos';
import { comItem, ehAEntrada, moverEntrada, podeMoverEntrada, removerItem } from '../modelo/itens';
import { entradasDaSecao } from '../modelo/ordem-das-entradas';
import {
  type ChaveDaEntrada,
  type ConteudoDoFormulario,
  type EntradaDaSecao,
  type EtapaDoFormulario,
  type ItemDoFormulario,
} from '../modelo/tipos';

const SEM_RECUSAS = new Map<string, never[]>();

/** Os campos e os grupos repetíveis de uma seção, na ordem em que o candidato os vê. */
@Component({
  selector: 'ui-entradas-da-secao',
  standalone: true,
  imports: [ItemDoFormularioComponent, GrupoDoFormularioComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../anfitriao.css',
  template: `
    @if (entradas().length > 0) {
      <ol class="editor-formulario__itens" [attr.aria-label]="'Campos de ' + etapa().titulo">
        @for (entrada of entradas(); track chaveDa(entrada); let posicao = $index) {
          <li>
            @if (entrada.tipo === 'item') {
              <ui-item-do-formulario
                [item]="entrada.item"
                [posicao]="posicao + 1"
                [fatos]="contexto().fatosDoItem.get(entrada.item.fatoCodigo) ?? []"
                [idBase]="idDoItem(idBase(), entrada.item.fatoCodigo)"
                [exigeResposta]="contexto().exigemResposta.has(entrada.item.fatoCodigo)"
                [fatoDesativado]="contexto().desativados.has(entrada.item.fatoCodigo)"
                [podeSubir]="podeMover(entrada, -1)"
                [podeDescer]="podeMover(entrada, 1)"
                [disabled]="contexto().disabled"
                [erros]="contexto().recusas?.porItem?.get(entrada.item.fatoCodigo) ?? []"
                [remocaoTravadaPor]="
                  contexto().remocoesTravadas.get(entrada.item.fatoCodigo) ?? null
                "
                [valoresConhecidos]="regras(entrada.item)?.valoresConhecidos ?? []"
                [ufs]="regras(entrada.item)?.ufs ?? []"
                [fontesDeOpcoes]="regras(entrada.item)?.fontesDeOpcoes ?? []"
                [recusasDasRestricoes]="
                  contexto().recusas?.porRestricao?.get(entrada.item.fatoCodigo) ?? []
                "
                [impedimentoPermitido]="regras(entrada.item)?.impedimentoPermitido ?? false"
                [fatosDoImpedimento]="regras(entrada.item)?.fatosDoImpedimento ?? []"
                (itemChange)="conteudoChange.emit(comItem(contexto().conteudo, $event))"
                (mover)="moverAEntrada(entrada, $event)"
                (remover)="removerOItem(entrada.item)"
              />
            } @else {
              <ui-grupo-do-formulario
                [grupo]="entrada.grupo"
                [conteudo]="contexto().conteudoParaCitacoes"
                [catalogo]="contexto().catalogo"
                [remocoesTravadas]="contexto().remocoesTravadas"
                [fatosIndisponiveis]="contexto().naoColetaveisAqui"
                [posicao]="posicao + 1"
                [idBase]="idDoGrupo(idBase(), entrada.grupo.codigo)"
                [exigemResposta]="contexto().exigemResposta"
                [podeSubir]="podeMover(entrada, -1)"
                [podeDescer]="podeMover(entrada, 1)"
                [disabled]="contexto().disabled"
                [erros]="contexto().recusas?.porGrupo?.get(entrada.grupo.codigo) ?? []"
                [errosPorCampo]="contexto().recusas?.porItem ?? semRecusas"
                [recusasDasRestricoes]="contexto().recusas?.porRestricao ?? semRecusas"
                (grupoChange)="conteudoChange.emit(comGrupo(contexto().conteudo, $event))"
                (anuncio)="anuncio.emit($event)"
                (mover)="moverAEntrada(entrada, $event)"
                (remover)="removerOGrupo(entrada.grupo.codigo, entrada.grupo.rotulo)"
              />
            }
          </li>
        }
      </ol>
    } @else {
      <p class="field__hint">Nenhum campo nesta seção.</p>
    }
  `,
})
export class EntradasDaSecaoComponent {
  private readonly injector = inject(Injector);

  readonly contexto = input.required<ContextoDoEditor>();
  readonly etapa = input.required<EtapaDoFormulario>();

  readonly conteudoChange = output<ConteudoDoFormulario>();
  readonly anuncio = output<string>();

  protected readonly idDoItem = idDoItem;
  protected readonly idDoGrupo = idDoGrupo;
  protected readonly semRecusas = SEM_RECUSAS;
  protected readonly comItem = comItem;
  protected readonly comGrupo = comGrupo;

  protected readonly idBase = computed(() => this.contexto().idBase);
  protected readonly entradas = computed(() =>
    entradasDaSecao(this.contexto().conteudo, this.etapa().codigo),
  );

  protected chaveDa(entrada: EntradaDaSecao): string {
    return entrada.tipo === 'item'
      ? `item:${entrada.item.fatoCodigo}`
      : `grupo:${entrada.grupo.codigo}`;
  }

  protected regras(item: ItemDoFormulario) {
    return this.contexto().regrasProprias.get(item.fatoCodigo);
  }

  protected podeMover(entrada: EntradaDaSecao, direcao: -1 | 1): boolean {
    return podeMoverEntrada(this.contexto().conteudo, chaveDe(entrada), direcao);
  }

  protected moverAEntrada(entrada: EntradaDaSecao, direcao: -1 | 1): void {
    const chave = chaveDe(entrada);
    const resultado = moverEntrada(this.contexto().conteudo, chave, direcao, this.contexto().nomes);
    aplicarEdicao(resultado, this, (conteudo) => {
      const entradas = entradasDaSecao(conteudo, this.etapa().codigo);
      const posicao = entradas.findIndex((e) => ehAEntrada(e, chave)) + 1;
      this.anuncio.emit(
        `${descricaoDe(entrada)} movido para a posição ${posicao} de ${entradas.length} em ${this.etapa().titulo}.`,
      );
      const prefixo =
        entrada.tipo === 'item'
          ? idDoItem(this.idBase(), entrada.item.fatoCodigo)
          : idDoGrupo(this.idBase(), entrada.grupo.codigo);
      const [mesmo, oposto] = direcao < 0 ? ['subir', 'descer'] : ['descer', 'subir'];
      focarDepois(this.injector, `${prefixo}-${mesmo}`, `${prefixo}-${oposto}`);
    });
  }

  protected removerOItem(item: ItemDoFormulario): void {
    const travado = this.contexto().remocoesTravadas.get(item.fatoCodigo);
    if (travado !== undefined) {
      this.anuncio.emit(travado);
      return;
    }
    const resultado = removerItem(this.contexto().conteudo, item.fatoCodigo, this.contexto().nomes);
    aplicarEdicao(resultado, this, () => {
      this.anuncio.emit(`Campo “${item.rotulo}” removido de ${this.etapa().titulo}.`);
      this.devolverOFoco();
    });
  }

  protected removerOGrupo(codigo: string, rotulo: string): void {
    const { conteudo, remocoesTravadas } = this.contexto();
    const grupo = (conteudo.grupos ?? []).find((g) => g.codigo === codigo);
    const travado =
      grupo === undefined ? null : motivoDaRemocaoTravadaDoGrupo(grupo, remocoesTravadas);
    if (travado !== null) {
      this.anuncio.emit(`O grupo “${rotulo}” não pode ser removido: ${travado}`);
      return;
    }
    this.conteudoChange.emit(removerGrupo(conteudo, codigo));
    this.anuncio.emit(`Grupo “${rotulo}” removido de ${this.etapa().titulo}.`);
    this.devolverOFoco();
  }

  private devolverOFoco(): void {
    focarDepois(this.injector, `${idDaEtapa(this.idBase(), this.etapa().codigo)}-acrescentar`);
  }
}

function chaveDe(entrada: EntradaDaSecao): ChaveDaEntrada {
  return entrada.tipo === 'item'
    ? { tipo: 'item', fatoCodigo: entrada.item.fatoCodigo }
    : { tipo: 'grupo', codigo: entrada.grupo.codigo };
}

function descricaoDe(entrada: EntradaDaSecao): string {
  return entrada.tipo === 'item' ? `“${entrada.item.rotulo}”` : `Grupo “${entrada.grupo.rotulo}”`;
}
