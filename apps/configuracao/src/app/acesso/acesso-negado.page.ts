import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AccessDeniedComponent } from '@uniplus/shared-auth/components';
import { UserContextService } from '@uniplus/shared-auth/bootstrap';
import { PedidosDeConcessaoApi, type PedidoResumoDto } from '@uniplus/shared-data/autorizacao';
import { TagComponent } from '@uniplus/shared-ui/components';
import { ehOBeneficiario } from '../features/acessos/beneficiario-do-pedido';
import { situacaoDoPedido } from '../features/acessos/rotulos-de-acesso';

/** Situações em que o pedido ainda espera alguém; as demais já foram decididas ou canceladas. */
const EM_ABERTO = [
  'aguardando_documento',
  'aguardando_beneficiario',
  'aguardando_gestor',
  'aguardando_protecao_de_dados',
];

const ROTULO_DA_ACAO = {
  aceitar: 'Aceitar o pedido',
  anexar: 'Anexar o documento',
  ver: 'Ver o pedido',
} as const;

interface PedidoEmAberto {
  readonly pedido: PedidoResumoDto;
  readonly acao: 'aceitar' | 'anexar' | 'ver';
}

/**
 * Acesso negado do Configuração. Quem entra sem nenhum perfil pode já ter pedido em seu nome,
 * como o do gestor que espera o seu aceite; mostrá-lo evita que a pessoa abra um segundo pedido
 * igual, que a API recusaria como duplicado. A consulta que falha não atrapalha: a tela segue
 * como sem pedidos.
 */
function acaoDo(
  pedido: PedidoResumoDto,
  eu: { readonly id: string; readonly email: string } | null,
): PedidoEmAberto['acao'] {
  if (pedido.situacao === 'aguardando_documento') return 'anexar';
  const aceitavel =
    pedido.situacao === 'aguardando_beneficiario' &&
    eu !== null &&
    ehOBeneficiario(pedido.beneficiario, eu);
  return aceitavel ? 'aceitar' : 'ver';
}

@Component({
  selector: 'cfg-acesso-negado-page',
  standalone: true,
  imports: [AccessDeniedComponent, RouterLink, TagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <auth-access-denied>
      @if (emAberto().length > 0) {
        <section class="cfg-pedidos-em-aberto" aria-labelledby="cfg-pedidos-em-aberto-titulo">
          <h2 id="cfg-pedidos-em-aberto-titulo" class="u-caption">
            Você tem pedidos de acesso em aberto
          </h2>
          <ul>
            @for (item of emAberto(); track item.pedido.id) {
              <li>
                <span>
                  <strong>{{ item.pedido.perfil.nome }}</strong>
                  <ui-tag [variant]="rotulo(item.pedido.situacao).variante">{{
                    rotulo(item.pedido.situacao).texto
                  }}</ui-tag>
                </span>
                <a
                  class="btn btn--sm"
                  [class.btn--primary]="item.acao !== 'ver'"
                  [class.btn--secondary]="item.acao === 'ver'"
                  [routerLink]="['/acessos/pedidos', item.pedido.id]"
                  [attr.aria-label]="ROTULO_DA_ACAO[item.acao] + ' de ' + item.pedido.perfil.nome"
                  >{{ ROTULO_DA_ACAO[item.acao] }}</a
                >
              </li>
            }
          </ul>
          <a class="btn btn--tertiary" routerLink="/acessos/pedidos">Meus pedidos</a>
        </section>
      }
    </auth-access-denied>
  `,
})
export class AcessoNegadoPage implements OnInit {
  private readonly api = inject(PedidosDeConcessaoApi);
  private readonly usuario = inject(UserContextService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly emAberto = signal<readonly PedidoEmAberto[]>([]);
  protected readonly rotulo = situacaoDoPedido;
  protected readonly ROTULO_DA_ACAO = ROTULO_DA_ACAO;

  ngOnInit(): void {
    // Uma consulta por situação em aberto: a fila completa é paginada e o pedido em aberto pode
    // estar atrás de uma página de pedidos já encerrados.
    const consulta = forkJoin(
      EM_ABERTO.map((situacao) => this.api.listar({ fila: 'meus', situacao })),
    ).subscribe({
      next: (resultados) => {
        const eu = this.usuario.user();
        const porId = new Map<string, PedidoResumoDto>();
        for (const resultado of resultados) {
          if (!resultado.ok) continue;
          for (const pedido of resultado.data) {
            if (EM_ABERTO.includes(pedido.situacao)) porId.set(pedido.id, pedido);
          }
        }
        this.emAberto.set(
          [...porId.values()].map((pedido) => ({
            pedido,
            acao: acaoDo(pedido, eu),
          })),
        );
      },
    });
    this.destroyRef.onDestroy(() => consulta.unsubscribe());
  }
}
