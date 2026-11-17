import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
  input,
  output,
} from '@angular/core';
import type { MotivoDeDecisaoDto } from '@uniplus/shared-data/selecao';
import { ValorEmConsultaComponent } from '@uniplus/shared-ui/components';

import { focarAposRenderizarSeSemFoco } from '../foco-apos-renderizar';
import type { ModoDaSecao } from '../modo-da-secao';
import type { RecusaDaEscolha } from './escolha-dos-motivos';
import {
  agruparPorTipo,
  tiposEscolhidosNaoDeclarados,
  type GrupoDeMotivos,
  type MotivoOferecido,
} from './grupos-de-motivos';
import { comoMotivoEscolhido, identidadeDoMotivoOferecido } from './motivo-escolhido';
import {
  ehOMesmoMotivo,
  type FaseOuEtapaDoMotivo,
  type IdentidadeDoMotivo,
  type MotivoNoDocumento,
} from './motivo-no-documento';
import { detalheDoMotivo, textoDoMotivoLido } from './texto-do-motivo';

/**
 * Os motivos de decisão que uma fase ou etapa escolhe, agrupados por tipo de decisão, com os tipos
 * que ela declara primeiro. Mostra os motivos de todos os tipos e nunca impede escolher o de um
 * tipo não declarado: avisa, sem bloquear. Só apresenta: o que está escolhido vem de quem o usa, e
 * escolher e retirar saem como eventos para ele atualizar o documento.
 */
@Component({
  selector: 'sel-motivos-da-fase-ou-etapa',
  imports: [ValorEmConsultaComponent],
  templateUrl: './motivos-da-fase-ou-etapa.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }
    .opcoes {
      display: flex;
      flex-direction: column;
    }
    .opcoes .checkbox {
      align-items: flex-start;
    }
    .motivo {
      display: flex;
      flex-direction: column;
      min-width: 0;
      overflow-wrap: anywhere;
    }
  `,
})
export class MotivosDaFaseOuEtapaComponent {
  readonly faseOuEtapa = input.required<FaseOuEtapaDoMotivo>();
  readonly nomeDaFaseOuEtapa = input.required<string>();
  /** Os motivos que esta fase ou etapa já escolheu no documento. */
  readonly escolhidos = input.required<readonly MotivoNoDocumento[]>();
  /** Os motivos do cadastro, de todos os tipos, inclusive os desativados. */
  readonly catalogo = input.required<readonly MotivoDeDecisaoDto[]>();
  /** Falso enquanto o cadastro não foi lido: a tela não afirma então que não há motivo nele. */
  readonly catalogoCarregado = input.required<boolean>();
  readonly tiposDeclarados = input.required<readonly string[]>();
  readonly recusas = input<readonly RecusaDaEscolha[]>([]);
  readonly modo = input<ModoDaSecao>('edicao');
  readonly idBase = input.required<string>();
  /** O nível do título na hierarquia de quem mostra a seção: 3 numa seção da fase, 4 dentro de uma etapa. */
  readonly nivelDoTitulo = input<3 | 4>(4);

  readonly escolher = output<MotivoNoDocumento>();
  readonly retirar = output<IdentidadeDoMotivo>();

  private readonly injector = inject(Injector);
  protected readonly detalheDoMotivo = detalheDoMotivo;

  protected readonly emConsulta = computed(() => this.modo() === 'consulta');
  protected readonly parte = computed(() =>
    this.faseOuEtapa().faseChave === undefined ? 'etapa' : 'fase',
  );
  protected readonly identificacaoDaParte = computed(
    () => `da ${this.parte()} ${this.nomeDaFaseOuEtapa()}`,
  );

  /** Na consulta valem as cópias que o documento guarda, nunca o cadastro vivo. */
  protected readonly grupos = computed<readonly GrupoDeMotivos[]>(() =>
    agruparPorTipo(
      this.emConsulta() ? [] : this.catalogo(),
      this.escolhidos(),
      this.tiposDeclarados(),
    ),
  );

  private readonly tiposEscolhidosSemDeclaracao = computed(
    () => new Set(tiposEscolhidosNaoDeclarados(this.escolhidos(), this.tiposDeclarados())),
  );

  protected readonly textosLidosPorTipo = computed<ReadonlyMap<string, readonly string[]>>(
    () =>
      new Map(
        this.grupos().map((grupo) => [
          grupo.tipoCodigo,
          grupo.motivos.filter((motivo) => motivo.escolhido).map(textoDoMotivoLido),
        ]),
      ),
  );

  protected temEscolhidoSemDeclaracao(grupo: GrupoDeMotivos): boolean {
    return this.tiposEscolhidosSemDeclaracao().has(grupo.tipoCodigo);
  }

  protected idDoMotivo(motivo: MotivoOferecido): string {
    return `${this.idBase()}-${motivo.tipoCodigo}-${motivo.codigo}`;
  }

  protected idDaRecusa(motivo: MotivoOferecido): string {
    return `${this.idDoMotivo(motivo)}-recusa`;
  }

  protected idDoAviso(grupo: GrupoDeMotivos): string {
    return `${this.idBase()}-${grupo.tipoCodigo}-aviso`;
  }

  protected temRecusa(motivo: MotivoOferecido): boolean {
    const identidade = identidadeDoMotivoOferecido(this.faseOuEtapa(), motivo);
    return this.recusas().some((recusa) => ehOMesmoMotivo(recusa.motivoRepetido, identidade));
  }

  protected descritoPor(grupo: GrupoDeMotivos, motivo: MotivoOferecido): string | null {
    const ids = [
      grupo.declarado ? null : this.idDoAviso(grupo),
      this.temRecusa(motivo) ? this.idDaRecusa(motivo) : null,
    ].filter((id) => id !== null);
    return ids.length === 0 ? null : ids.join(' ');
  }

  /**
   * A caixa mostra só o que o documento guarda: depois do evento ela volta ao estado de quem o
   * usa, mesmo que ele não tenha atendido o pedido.
   */
  protected alternar(caixa: HTMLInputElement, motivo: MotivoOferecido): void {
    const identidade = identidadeDoMotivoOferecido(this.faseOuEtapa(), motivo);
    if (motivo.escolhido) {
      this.retirar.emit(identidade);
      focarAposRenderizarSeSemFoco(this.injector, `${this.idBase()}-titulo`);
    } else {
      this.escolher.emit(comoMotivoEscolhido(this.faseOuEtapa(), motivo));
    }
    afterNextRender(() => (caixa.checked = this.estaEscolhido(identidade)), {
      injector: this.injector,
    });
  }

  private estaEscolhido(identidade: IdentidadeDoMotivo): boolean {
    return this.escolhidos().some((escolhido) => ehOMesmoMotivo(escolhido, identidade));
  }
}
