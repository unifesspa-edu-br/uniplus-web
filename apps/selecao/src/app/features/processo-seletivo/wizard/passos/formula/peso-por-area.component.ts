import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { PERMISSAO, PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { AppConfigService, resolveConfiguracaoWebUrl } from '@uniplus/shared-data/config';
import { ValorEmConsultaComponent } from '@uniplus/shared-ui/components';
import { formatarNumeroPtBr } from '@uniplus/shared-utils';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { focarAposRenderizarSeSemFoco } from '../../shared/foco-apos-renderizar';
import { MOTIVO_DA_RELEITURA } from '../../shared/motivo-da-releitura';
import {
  baseLegalComum,
  colunasDoQuadro,
  mesmoQuadro,
  ordemDasAreas,
  perdeuGrupo,
  quadroVigente,
  type AreaDoQuadro,
  type GrupoDoQuadro,
} from '../../shared/quadro-de-pesos';
import {
  ReleituraDoSnapshot,
  relerProcessoAPedido,
} from '../../shared/releitura-do-snapshot.service';
import { LeituraDoCadastroDePesos } from '../classificacao/leitura-do-cadastro-de-pesos.service';
import { CatalogosDeClassificacao } from '../classificacao/catalogos-de-classificacao.service';
import {
  TEXTO_DA_PENDENCIA_DA_RESOLUCAO,
  pendenciaDaResolucao,
} from '../classificacao/classificacao-para-comando';

/** Uma opção do seletor de resolução — o valor é o que o servidor recebe. */
interface ResolucaoEscolhivel {
  readonly valor: string;
  readonly rotulo: string;
}

const ID_DO_CAMPO_RESOLUCAO = 'f-resolucao-peso-area';
const ID_DO_TITULO_DA_SECAO = 'peso-area-titulo';

/**
 * A resolução de Peso por Área que pesa as notas das áreas do ENEM, com o quadro de pesos em
 * leitura. O quadro à vista é a cópia congelada no processo quando a resolução do rascunho é a que
 * ele já gravou, porque o Seleção não lê o cadastro vivo para mostrar o que já congelou; senão, é
 * a prévia do cadastro da Configuração, o que a Eliminação copia ao gravar a classificação.
 *
 * O passo só a apresenta quando a classificação exige a resolução (baseada em ENEM, com a média
 * ponderada local).
 */
@Component({
  selector: 'sel-peso-por-area',
  imports: [ValorEmConsultaComponent],
  templateUrl: './peso-por-area.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PesoPorAreaComponent {
  protected readonly store = inject(ProcessoSeletivoStore);
  protected readonly catalogos = inject(CatalogosDeClassificacao);
  private readonly cadastroDePesos = inject(LeituraDoCadastroDePesos);
  private readonly releitura = inject(ReleituraDoSnapshot);
  private readonly appConfig = inject(AppConfigService);
  private readonly permissoes = inject(PermissoesService);
  private readonly injector = inject(Injector);
  private destruida = false;

  /** O passo recusou a falta ou a saída da resolução: o campo mostra a pendência. */
  readonly invalido = input(false);

  protected readonly idDoCampo = ID_DO_CAMPO_RESOLUCAO;
  protected readonly formatarNumero = formatarNumeroPtBr;
  protected readonly relendoProcesso = signal(false);
  protected readonly avisoDaLista = signal<string | null>(null);

  protected readonly resolucaoEscolhida = computed(
    () => this.store.draft().classificacao.resolucaoPesoAreaEnem,
  );

  /** As rotas do cadastro de Peso por Área exigem a permissão de manter peso por área. */
  protected readonly podeAbrirCadastroDePesos = computed(() =>
    this.permissoes.tem(PERMISSAO.configuracao.pesosAreaEnemManter),
  );

  /**
   * O cadastro de Peso por Área, no app da Configuração. Abre em outra aba: o rascunho do
   * processo ainda não foi gravado, e sair da página o perderia.
   */
  protected readonly linkDoCadastroDePesos = computed(
    () => `${resolveConfiguracaoWebUrl(this.appConfig.config())}/pesos-por-area`,
  );

  /** A resolução escolhida saiu do cadastro — dito só depois de o cadastro ter sido lido. */
  private readonly resolucaoForaDoCadastro = computed(() =>
    this.cadastroDePesos.resolucaoForaDoCadastro(this.resolucaoEscolhida()),
  );

  /**
   * O aviso de que a resolução saiu do cadastro promete uma recusa na próxima gravação: só faz
   * sentido quando o processo aceita edição.
   */
  protected readonly avisaForaDoCadastro = computed(
    () => this.store.edicaoPermitida() && this.resolucaoForaDoCadastro(),
  );

  /**
   * As resoluções do cadastro. A escolha do rascunho que não está na lista continua oferecida —
   * como `regrasEscolhiveis` faz com as regras —, e só é marcada "fora do cadastro" quando a
   * leitura do cadastro permite afirmar isso.
   */
  protected readonly resolucoesEscolhiveis = computed<readonly ResolucaoEscolhivel[]>(() => {
    const doCadastro = this.catalogos.resolucoesPesoAreaEnem();
    const opcoes = doCadastro.map((resolucao) => ({ valor: resolucao, rotulo: resolucao }));
    const escolhida = this.resolucaoEscolhida();
    if (escolhida === '' || doCadastro.includes(escolhida)) return opcoes;

    const rotulo = this.resolucaoForaDoCadastro() ? `${escolhida} (fora do cadastro)` : escolhida;
    return [{ valor: escolhida, rotulo }, ...opcoes];
  });

  private readonly quadroGravado = computed(
    () => this.store.classificacao.copiaCongeladaEmVigor()?.grupos ?? [],
  );

  private readonly quadroVigente = computed(() =>
    quadroVigente(
      this.resolucaoEscolhida(),
      this.store.classificacao.copiaCongeladaEmVigor(),
      this.cadastroDePesos.quadroDaResolucaoEscolhida(),
    ),
  );

  protected readonly mostraQuadroGravado = computed(() => this.quadroVigente().daCopiaCongelada);
  protected readonly quadro = computed<readonly GrupoDoQuadro[]>(() => this.quadroVigente().grupos);

  /** O aviso de que o quadro à vista é a prévia, porque só uma releitura diz o que ficou congelado. */
  protected readonly avisoDeQuadroPorReler = computed(() => {
    const motivo = this.store.classificacao.motivoDaReleitura();
    return motivo !== null
      ? `${MOTIVO_DA_RELEITURA[motivo]}. Enquanto isso, o quadro abaixo é a prévia do cadastro.`
      : null;
  });

  /**
   * A falha ao ler o cadastro de Peso por Área. Em consulta o quadro à vista é a cópia congelada
   * no processo, que não depende do cadastro, e a falha dele não tem o que explicar.
   */
  protected readonly falhaDosPesosQueImporta = computed(() =>
    this.store.emConsulta() && this.mostraQuadroGravado() ? null : this.catalogos.pesosErro(),
  );

  protected readonly colunasDoQuadro = computed(() =>
    colunasDoQuadro(this.quadro(), ordemDasAreas(this.catalogos.areasEnem())),
  );

  protected readonly baseLegalDoQuadro = computed(() => baseLegalComum(this.quadro()));

  /**
   * O cadastro mudou depois de o processo congelar a resolução. Cada gravação da classificação —
   * inclusive a que a publicação faz — copia de novo do cadastro, então o operador precisa saber
   * que o quadro à vista não é o que a próxima gravação vai deixar no processo.
   */
  protected readonly cadastroMudouDesdeAGravacao = computed(
    () =>
      this.store.edicaoPermitida() &&
      this.mostraQuadroGravado() &&
      // Só um cadastro lido depois da cópia pode dizer que ela ficou para trás: a leitura da
      // classificação que traz outra cópia deixa a do cadastro sem valer até ele ser relido (ver
      // `LeituraDoCadastroDePesos`).
      this.cadastroDePesos.leitura().lido &&
      !this.resolucaoForaDoCadastro() &&
      !mesmoQuadro(this.quadroGravado(), this.cadastroDePesos.quadroDaResolucaoEscolhida()),
  );

  /**
   * A diferença é um grupo que saiu do cadastro: a próxima gravação não copia, é recusada por
   * resolução incompleta, e o aviso tem de dizer isso.
   */
  protected readonly cadastroPerdeuGrupo = computed(
    () =>
      this.cadastroMudouDesdeAGravacao() &&
      perdeuGrupo(this.quadroGravado(), this.cadastroDePesos.quadroDaResolucaoEscolhida()),
  );

  /**
   * O que aparece sob o seletor: a pendência local depois de "Próximo", e senão as recusas que o
   * servidor devolveu para o campo na última gravação da classificação — a da resolução e a de um
   * critério de desempate gravado, as duas quando vierem.
   */
  protected readonly erroDaResolucao = computed<string | null>(() => {
    const pendencia = this.invalido()
      ? pendenciaDaResolucao(
          this.store.draft().classificacao,
          this.cadastroDePesos.resolucaoForaDoCadastro,
        )
      : null;
    return pendencia !== null
      ? TEXTO_DA_PENDENCIA_DA_RESOLUCAO[pendencia].campo
      : [
          this.store.classificacao.recusaDaResolucaoPesoAreaEnem(),
          this.store.classificacao.recusaPeloDesempatePorArea(),
        ]
          .filter((recusa) => recusa !== null)
          .join(' ') || null;
  });

  protected readonly descricaoDaResolucao = computed(() => {
    const ids = [`${ID_DO_CAMPO_RESOLUCAO}-dica`];
    if (this.erroDaResolucao() !== null) ids.unshift(`${ID_DO_CAMPO_RESOLUCAO}-erro`);
    return ids.join(' ');
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.destruida = true));
  }

  protected areaDoGrupo(grupo: GrupoDoQuadro, codigoDaArea: string): AreaDoQuadro | undefined {
    return grupo.areas.find((area) => area.codigo === codigoDaArea);
  }

  protected aoEscolherResolucao(evento: Event): void {
    if (evento.target instanceof HTMLSelectElement) this.escolherResolucao(evento.target.value);
  }

  protected escolherResolucao(valor: string): void {
    if (!this.store.aceitaEdicao() || valor === this.resolucaoEscolhida()) return;
    this.store.patchObjectSection('classificacao', { resolucaoPesoAreaEnem: valor });
    // A recusa era sobre a escolha anterior; a nova ainda não foi julgada pelo servidor.
    this.store.classificacao.descartarRecusas();
  }

  /**
   * "Atualizar lista": o operador criou ou corrigiu uma resolução no app da Configuração, na outra
   * aba, e voltou. O anúncio diz que a lista foi atualizada, sem mover o foco.
   */
  protected atualizarListaDePesos(): void {
    if (this.catalogos.pesosCarregando()) return;
    this.avisoDaLista.set(null);
    this.cadastroDePesos.relerCadastroAPedido(() =>
      this.avisoDaLista.set('Lista de resoluções de Peso por Área atualizada.'),
    );
  }

  /**
   * "Tentar novamente" do cadastro de pesos. O alerta, com o botão focado, fica na tela enquanto
   * a nova tentativa corre — tirá-lo no clique jogaria o foco no `body`. Quando a lista chega e o
   * alerta sai, o foco vai ao seletor da resolução, ou ao título da seção quando o processo não
   * aceita edição.
   */
  protected tentarCarregarPesosDeNovo(): void {
    this.cadastroDePesos.relerCadastroAPedido(() => this.focarDepoisDeReler());
  }

  /**
   * "Reler o processo" do aviso de quadro não relido. O aviso fica, com o botão focado, enquanto a
   * leitura corre; quando ela decide e o aviso sai, o foco vai ao título da seção. Uma leitura
   * superada por outra mais nova não mexe no foco: quem decide é a mais nova.
   */
  protected async relerProcesso(): Promise<void> {
    const decidiu = await relerProcessoAPedido(this.releitura, this.relendoProcesso);
    if (decidiu && !this.store.classificacao.porReler()) {
      this.focarQuemSobrou(ID_DO_TITULO_DA_SECAO);
    }
  }

  private focarDepoisDeReler(): void {
    // Sem edição o seletor fica desabilitado e não recebe foco: o título da seção é o destino.
    this.focarQuemSobrou(this.store.aceitaEdicao() ? ID_DO_CAMPO_RESOLUCAO : ID_DO_TITULO_DA_SECAO);
  }

  /**
   * Só recupera o foco que um aviso levou embora; quem já foi para outro campo não é arrastado.
   * A leitura que pede o foco pode terminar depois de o passo ser desmontado (troca de processo),
   * e aí não há o que focar.
   */
  private focarQuemSobrou(destino: string): void {
    if (this.destruida) return;
    focarAposRenderizarSeSemFoco(this.injector, destino);
  }
}
