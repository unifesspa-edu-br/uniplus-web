import { ChangeDetectionStrategy, Component, ElementRef, computed, inject } from '@angular/core';
import type { UnidadeDto } from '@uniplus/shared-data/organizacao';
import {
  acompanharLeitura,
  AlertComponent,
  FalhaDeLeituraComponent,
} from '@uniplus/shared-ui/components';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import { devolverFocoDaLista } from '../../shared/foco';
import { BuscaDeCidade } from './busca-de-cidade';
import { DetalheDaUnidade } from './detalhe-da-unidade';
import { EdicaoDasUnidades } from './edicao-das-unidades';
import { OpcoesDaUnidadeSuperior } from './opcoes-da-unidade-superior';
import { UnidadeCidadeCampoComponent } from './unidade-cidade-campo.component';
import { UnidadeDetalheComponent } from './unidade-detalhe.component';
import { mensagemDoCampo } from './unidade-form';
import { UnidadeFormularioComponent } from './unidade-formulario.component';
import { UnidadeSuperiorCampoComponent } from './unidade-superior-campo.component';
import { UnidadesListaComponent } from './unidades-lista.component';
import { UnidadesStore } from './unidades.store';

const MENSAGEM_DA_SUPERIOR = 'Não foi possível carregar as unidades para seleção.';

/** Estrutura organizacional: compõe a árvore, o detalhe, o formulário e a confirmação de remoção. */
@Component({
  selector: 'cfg-unidades-page',
  standalone: true,
  imports: [
    AlertComponent,
    ConfirmacaoDeRemocaoComponent,
    FalhaDeLeituraComponent,
    UnidadeCidadeCampoComponent,
    UnidadeDetalheComponent,
    UnidadeFormularioComponent,
    UnidadeSuperiorCampoComponent,
    UnidadesListaComponent,
  ],
  providers: [
    UnidadesStore,
    OpcoesDaUnidadeSuperior,
    BuscaDeCidade,
    DetalheDaUnidade,
    EdicaoDasUnidades,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './unidades.page.html',
  host: { class: 'cfg-page' },
})
export class UnidadesPage {
  protected readonly store = inject(UnidadesStore);
  protected readonly edicao = inject(EdicaoDasUnidades);
  protected readonly detalhe = inject(DetalheDaUnidade);
  protected readonly superior = inject(OpcoesDaUnidadeSuperior);
  protected readonly cidade = inject(BuscaDeCidade);
  private readonly raiz = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  protected readonly indisponivel = computed(
    () => this.store.carregando() || this.edicao.gravando(),
  );

  protected readonly leitura = acompanharLeitura({
    assunto: 'unidades',
    falha: this.store.mensagemDeErro,
    pendente: this.store.carregando,
    indisponivel: this.edicao.gravando,
    recarregar: () => this.store.tentarNovamente(),
    destino: () => document.getElementById('cfg-unidades-list-title'),
  });

  protected readonly leituraDaCidade = acompanharLeitura({
    assunto: 'cidades',
    falha: this.cidade.erro,
    pendente: this.cidade.buscando,
    recarregar: () => this.cidade.tentarNovamente(),
    destino: () => this.raiz.querySelector<HTMLElement>('#cfg-unidade-cidade-busca'),
  });

  protected readonly leituraDaSuperior = acompanharLeitura({
    assunto: 'unidades superiores',
    falha: computed(() => (this.superior.comErro() ? MENSAGEM_DA_SUPERIOR : null)),
    pendente: this.superior.carregando,
    recarregar: () => this.superior.recarregar(),
    destino: () => this.raiz.querySelector<HTMLElement>('#cfg-unidade-superior'),
  });

  private readonly foco = devolverFocoDaLista({
    gravando: this.edicao.gravando,
    carregando: this.store.carregando,
    atributoDaLinha: 'data-unidade-id',
    elementoDaLinha: 'li',
    idDoTitulo: 'cfg-unidades-list-title',
    idDoCadastro: 'cfg-unidades-novo',
    sobreposicaoAberta: computed(
      () => this.edicao.aberto() || this.edicao.confirmando() || this.detalhe.aberto(),
    ),
    acionadorDeUsoUnico: true,
  });

  protected erroDaSuperior(): string | null {
    return mensagemDoCampo(this.edicao.form.controls.unidadeSuperiorId);
  }

  protected cadastrar(): void {
    this.foco.registrar(null);
    this.edicao.abrirCadastro();
  }

  protected editar(unidade: UnidadeDto): void {
    this.foco.registrar({ acao: 'editar', id: unidade.id });
    this.edicao.abrirEdicao(unidade);
  }

  protected remover(unidade: UnidadeDto): void {
    this.foco.registrar({ acao: 'remover', id: unidade.id });
    this.edicao.pedirRemocao(unidade);
  }
}
