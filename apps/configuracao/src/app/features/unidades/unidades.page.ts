import { ChangeDetectionStrategy, Component, ElementRef, computed, inject } from '@angular/core';
import type { UnidadeDto } from '@uniplus/shared-data/organizacao';
import {
  acompanharNovaTentativa,
  AlertaNovaTentativaComponent,
  AlertComponent,
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

/** Estrutura organizacional: compõe a árvore, o detalhe, o formulário e a confirmação de remoção. */
@Component({
  selector: 'cfg-unidades-page',
  standalone: true,
  imports: [
    AlertaNovaTentativaComponent,
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

  protected readonly novaTentativa = acompanharNovaTentativa({
    assunto: 'unidades',
    pendente: this.pendente,
    falhou: computed(() => this.store.mensagemDeErro() !== null),
    destino: () => document.getElementById('cfg-unidades-list-title'),
  });

  protected readonly novaTentativaDaCidade = acompanharNovaTentativa({
    assunto: 'cidades',
    pendente: this.cidade.buscando,
    falhou: computed(() => this.cidade.erro() !== null),
    destino: () => this.raiz.querySelector<HTMLElement>('#cfg-unidade-cidade-busca'),
  });

  protected readonly novaTentativaDaSuperior = acompanharNovaTentativa({
    assunto: 'unidades superiores',
    pendente: this.superior.carregando,
    falhou: this.superior.comErro,
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
