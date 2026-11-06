import {
  ChangeDetectionStrategy,
  Component,
  computed,
  Signal,
  inject,
  viewChild,
} from '@angular/core';
import { buscaDeMunicipiosNoGeo } from '@uniplus/shared-data/geo';
import {
  acompanharNovaTentativa,
  AlertaNovaTentativaComponent,
  AlertComponent,
  BUSCA_DE_MUNICIPIOS,
  EditorDeFormularioComponent,
  type NovaTentativa,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { acompanharFocoDoEnvio } from '../../shared/foco';
import { EdicaoDoConteudoDoModelo } from './edicao-do-conteudo-do-modelo';
import { ModeloFormularioEdicaoStore } from './modelo-formulario-edicao.store';
import { ModeloFormularioCabecalhoComponent } from './modelo-formulario-cabecalho.component';
import { ModeloFormularioDocumentosComponent } from './modelo-formulario-documentos.component';
import { ModeloFormularioIdentificacaoComponent } from './modelo-formulario-identificacao.component';
import { ModeloFormularioRodapeComponent } from './modelo-formulario-rodape.component';

/** O alerta da falha sai com o botão; o foco vai ao título, que a tela mantém. */
function novaTentativaDoTitulo(
  pendente: Signal<boolean>,
  falhou: Signal<boolean>,
  assunto: string,
): NovaTentativa {
  return acompanharNovaTentativa({
    pendente,
    falhou,
    assunto,
    destino: () => document.getElementById('cfg-modelo-titulo'),
  });
}

@Component({
  selector: 'cfg-modelo-formulario-edicao-page',
  imports: [
    AlertComponent,
    AlertaNovaTentativaComponent,
    SpinnerComponent,
    EditorDeFormularioComponent,
    ModeloFormularioCabecalhoComponent,
    ModeloFormularioDocumentosComponent,
    ModeloFormularioIdentificacaoComponent,
    ModeloFormularioRodapeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    ModeloFormularioEdicaoStore,
    EdicaoDoConteudoDoModelo,
    { provide: BUSCA_DE_MUNICIPIOS, useFactory: buscaDeMunicipiosNoGeo },
  ],
  templateUrl: './modelo-formulario-edicao.page.html',
  host: { class: 'cfg-page' },
})
export class ModeloFormularioEdicaoPage {
  protected readonly store = inject(ModeloFormularioEdicaoStore);
  protected readonly edicao = inject(EdicaoDoConteudoDoModelo);
  protected readonly comMunicipios = inject(BUSCA_DE_MUNICIPIOS, { optional: true }) !== null;
  private readonly editor = viewChild(EditorDeFormularioComponent);
  protected readonly novaTentativaDoModelo = novaTentativaDoTitulo(
    this.store.carregando,
    computed(() => this.store.erroAoCarregar() !== null),
    'modelo',
  );
  protected readonly novaTentativaDosTermos = novaTentativaDoTitulo(
    this.store.termosCarregando,
    this.store.termosComErro,
    'termos',
  );
  protected readonly novaTentativaDoCatalogo = novaTentativaDoTitulo(
    this.store.catalogo.isLoading,
    this.store.catalogoComErro,
    'catálogo',
  );
  protected readonly novaTentativaDoVocabulario = novaTentativaDoTitulo(
    this.store.vocabularioDosDocumentosCarregando,
    this.store.vocabularioDosDocumentosComErro,
    'vocabulário',
  );

  constructor() {
    acompanharFocoDoEnvio({
      salvando: this.edicao.somenteLeitura,
      aberto: computed(() => this.store.modelo() !== null),
    });
  }

  protected recarregarModelo(): void {
    this.novaTentativaDoModelo.executar(() => this.store.recarregar());
  }

  protected recarregarTermos(): void {
    this.novaTentativaDosTermos.executar(() => this.store.carregarTermos());
  }

  protected recarregarCatalogo(): void {
    this.novaTentativaDoCatalogo.executar(() => this.store.catalogo.reload());
  }

  protected recarregarVocabulario(): void {
    this.novaTentativaDoVocabulario.executar(() => this.store.recarregarVocabularioDosDocumentos());
  }

  protected salvar(): void {
    if (this.edicao.salvar()) void this.editor()?.focarPrimeiroCampoInvalido();
  }
}
