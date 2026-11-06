import { ChangeDetectionStrategy, Component, ElementRef, computed, inject } from '@angular/core';
import type { UnidadeDto } from '@uniplus/shared-data/organizacao';
import { AlertComponent } from '@uniplus/shared-ui/components';
import { ConfirmacaoDeRemocaoComponent } from '../../shared/confirmacao-de-remocao';
import { devolverFocoDaLista, focarAposNovaTentativa } from '../../shared/foco';
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

/** Estrutura organizacional: compõe a árvore, o detalhe, o formulário e a confirmação de remoção. */
@Component({
  selector: 'cfg-unidades-page',
  standalone: true,
  imports: [
    AlertComponent,
    ConfirmacaoDeRemocaoComponent,
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

  protected readonly pendente = computed(() => this.store.carregando() || this.edicao.gravando());
  protected readonly indisponivel = this.pendente;

  private readonly novaTentativa = focarAposNovaTentativa(
    this.pendente,
    computed(() => this.store.mensagemDeErro() !== null),
    () => document.getElementById('cfg-unidades-list-title'),
  );

  private readonly novaTentativaDaCidade = focarAposNovaTentativa(
    this.cidade.buscando,
    computed(() => this.cidade.erro() !== null),
    () => this.raiz.querySelector<HTMLElement>('#cfg-unidade-cidade-busca'),
  );

  private readonly novaTentativaDaSuperior = focarAposNovaTentativa(
    this.superior.carregando,
    this.superior.comErro,
    () => this.raiz.querySelector<HTMLElement>('#cfg-unidade-superior'),
  );

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
  });

  protected tentarNovamente(): void {
    this.novaTentativa.executar(() => this.store.tentarNovamente());
  }

  protected recarregarSuperior(): void {
    this.novaTentativaDaSuperior.executar(() => this.superior.recarregar());
  }

  protected repetirBuscaDeCidade(): void {
    this.novaTentativaDaCidade.executar(() => this.cidade.tentarNovamente());
  }

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
