import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { type FilaDePedidos, type PedidoResumoDto } from '@uniplus/shared-data/autorizacao';
import { AlertComponent } from '@uniplus/shared-ui/components';
import { focarAposNovaTentativa } from '../../shared/foco';
import { PedidosListaComponent } from './pedidos-lista.component';
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
    titulo: 'Fila do gestor de acessos',
    descricao: 'Pedidos que aguardam a sua aprovação da adequação funcional.',
    vazio: 'Nenhum pedido aguarda a sua aprovação.',
  },
  protecao_de_dados: {
    titulo: 'Fila da proteção de dados',
    descricao:
      'Pedidos de perfil com dado pessoal ou sensível, já aprovados pelo gestor de acessos, que aguardam a adequação à proteção de dados.',
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
  imports: [RouterLink, AlertComponent, PedidosListaComponent],
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
  private readonly novaTentativa = focarAposNovaTentativa(
    this.store.carregando,
    computed(() => this.store.mensagemDeErro() !== null),
    () => document.getElementById('cfg-pedidos-titulo'),
  );

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

  protected recarregar(): void {
    this.novaTentativa.executar(() => this.store.recarregar());
  }
}
