import {
  ChangeDetectionStrategy,
  Component,
  computed,
  Signal,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { buscaDeMunicipiosNoGeo } from '@uniplus/shared-data/geo';
import {
  AlertComponent,
  BUSCA_DE_MUNICIPIOS,
  EditorDeFormularioComponent,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { AlertaNovaTentativaComponent } from '../../shared/alerta-nova-tentativa';
import {
  acompanharFocoDoEnvio,
  novaTentativaAnunciada,
  type NovaTentativa,
} from '../../shared/foco';
import { EdicaoDoConteudoDoModelo } from './edicao-do-conteudo-do-modelo';
import { ModeloFormularioEdicaoStore } from './modelo-formulario-edicao.store';
import { ModeloFormularioCabecalhoComponent } from './modelo-formulario-cabecalho.component';
import { ModeloFormularioDocumentosComponent } from './modelo-formulario-documentos.component';
import { ModeloFormularioIdentificacaoComponent } from './modelo-formulario-identificacao.component';
import { ModeloFormularioRodapeComponent } from './modelo-formulario-rodape.component';

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
  protected readonly anuncio = signal('');
  private readonly novaTentativaDoModelo = this.novaTentativa(
    'modelo',
    this.store.carregando,
    computed(() => this.store.erroAoCarregar() !== null),
  );
  private readonly novaTentativaDosTermos = this.novaTentativa(
    'termos de consentimento',
    this.store.termosCarregando,
    this.store.termosComErro,
  );
  private readonly novaTentativaDoCatalogo = this.novaTentativa(
    'catálogo de fatos',
    this.store.catalogo.isLoading,
    this.store.catalogoComErro,
  );
  private readonly novaTentativaDoVocabulario = this.novaTentativa(
    'fases e tipos de documento',
    this.store.vocabularioDosDocumentosCarregando,
    this.store.vocabularioDosDocumentosComErro,
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

  /** O alerta da falha sai com o botão; o foco vai ao título, que a tela mantém. */
  private novaTentativa(
    nome: string,
    pendente: Signal<boolean>,
    falhou: Signal<boolean>,
  ): NovaTentativa {
    return novaTentativaAnunciada({
      nome,
      pendente,
      falhou,
      destino: () => document.getElementById('cfg-modelo-titulo'),
      anuncio: this.anuncio,
    });
  }

  protected salvar(): void {
    if (this.edicao.salvar()) void this.editor()?.focarPrimeiroCampoInvalido();
  }
}
