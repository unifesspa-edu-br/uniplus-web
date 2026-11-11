import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input } from '@angular/core';
import { acompanharLeitura, FalhaDeLeituraComponent } from '@uniplus/shared-ui/components';
import { Router, RouterLink } from '@angular/router';
import { type FilaDePedidos, type PedidoResumoDto } from '@uniplus/shared-data/autorizacao';
import { PedidosListaComponent } from './pedidos-lista.component';
import { RecusaDaLeituraComponent } from '../../shared/recusa-da-leitura';
import { nomesDeEscopo } from './nomes-de-escopo';
import { PedidosStore } from './pedidos.store';

interface Apresentacao {
  readonly titulo: string;
  readonly descricao: string;
  readonly vazio: string;
}

const APRESENTACAO: Readonly<Record<FilaDePedidos, Apresentacao>> = {
  meus: {
    titulo: 'Meus pedidos de acesso',
    descricao: 'Pedidos que você fez ou que pedem o seu aceite como beneficiário.',
    vazio: 'Você ainda não tem pedidos de acesso.',
  },
  gestor: {
    titulo: 'Fila da gestão de acessos',
    descricao: 'Pedidos que aguardam a sua aprovação da adequação funcional.',
    vazio: 'Nenhum pedido aguarda a sua aprovação.',
  },
  protecao_de_dados: {
    titulo: 'Fila da proteção de dados',
    descricao:
      'Pedidos de perfil com dado pessoal ou sensível, já aprovados pela gestão de acessos, que aguardam a adequação à proteção de dados.',
    vazio: 'Nenhum pedido aguarda a sua aprovação.',
  },
  todos: {
    titulo: 'Histórico de pedidos',
    descricao:
      'Todos os pedidos de acesso, em qualquer situação, inclusive os que você já decidiu ou que foram cancelados.',
    vazio: 'Nenhum pedido encontrado.',
  },
};

/** Lista de pedidos de concessão: os de quem pergunta, a fila de uma etapa de aprovação ou o histórico de todos. */
@Component({
  selector: 'cfg-pedidos-page',
  standalone: true,
  imports: [RouterLink, FalhaDeLeituraComponent, PedidosListaComponent, RecusaDaLeituraComponent],
  providers: [PedidosStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cfg-page' },
  templateUrl: './pedidos.page.html',
})
export class PedidosPage implements OnInit {
  /** A fila vem da rota (`data.fila`). */
  readonly fila = input<FilaDePedidos>('meus');

  protected readonly store = inject(PedidosStore);
  private readonly router = inject(Router);
  protected readonly leitura = acompanharLeitura({
    falha: this.store.falha,
    pendente: this.store.carregando,
    recusada: computed(() => this.store.recusa() !== null),
    recarregar: () => this.store.tentarNovamente(),
    destino: () => document.getElementById('cfg-pedidos-titulo'),
  });

  private readonly escopo = nomesDeEscopo();
  protected readonly nomesDosEscopos = computed(() => {
    const nomes = new Map<string, string>();
    for (const pedido of this.store.itens()) {
      const id = pedido.escopo.unidadeId;
      if (id !== null) nomes.set(id, this.escopo.nome(pedido.escopo));
    }
    return nomes;
  });
  protected readonly texto = computed(() => APRESENTACAO[this.fila()]);
  /** As filas das etapas já são uma situação só; a lista dos próprios pedidos e o histórico têm todas. */
  protected readonly filtraPorSituacao = computed(
    () => this.fila() === 'meus' || this.fila() === 'todos',
  );

  /** O detalhe sabe de onde a pessoa veio pelo parâmetro; os próprios pedidos são o padrão. */
  protected readonly origemDoLink = computed(() =>
    this.fila() === 'meus' ? null : { origem: this.fila() },
  );

  ngOnInit(): void {
    this.store.fila.set(this.fila());
  }

  /** A linha inteira abre o detalhe, como nas demais listas; o ícone da linha segue para quem navega por ele. */
  protected abrir(pedido: PedidoResumoDto): void {
    void this.router.navigate(['/acessos/pedidos', pedido.id], {
      queryParams: this.origemDoLink(),
    });
  }
}
