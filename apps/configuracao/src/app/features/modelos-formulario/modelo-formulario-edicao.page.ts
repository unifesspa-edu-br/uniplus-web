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
import { BUSCA_DE_MUNICIPIOS } from '@uniplus/shared-ui/components';
import { focarAposNovaTentativa, type NovaTentativa } from '../../shared/foco';
import { anunciarLeitura } from './anuncio-da-leitura';
import { EdicaoDoConteudoDoModelo } from './edicao-do-conteudo-do-modelo';
import { ModeloFormularioEdicaoStore } from './modelo-formulario-edicao.store';
import {
  ModeloFormularioDetalheComponent,
  type LeiturasEmCurso,
} from './modelo-formulario-detalhe.component';

@Component({
  selector: 'cfg-modelo-formulario-edicao-page',
  imports: [ModeloFormularioDetalheComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    ModeloFormularioEdicaoStore,
    EdicaoDoConteudoDoModelo,
    { provide: BUSCA_DE_MUNICIPIOS, useFactory: buscaDeMunicipiosNoGeo },
  ],
  templateUrl: './modelo-formulario-edicao.page.html',
})
export class ModeloFormularioEdicaoPage {
  protected readonly store = inject(ModeloFormularioEdicaoStore);
  protected readonly edicao = inject(EdicaoDoConteudoDoModelo);
  protected readonly comMunicipios = inject(BUSCA_DE_MUNICIPIOS, { optional: true }) !== null;
  private readonly detalhe = viewChild(ModeloFormularioDetalheComponent);
  protected readonly anuncio = signal('');
  protected readonly tentando = computed<LeiturasEmCurso>(() => ({
    modelo: this.store.carregando(),
    termos: this.store.termosCarregando(),
    catalogo: this.store.catalogo.isLoading(),
    vocabulario: this.store.vocabularioDosDocumentosCarregando(),
  }));
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
    const foco = focarAposNovaTentativa(pendente, falhou, () =>
      document.getElementById('cfg-modelo-titulo'),
    );
    const anunciada = anunciarLeitura(nome, pendente, falhou, this.anuncio);
    return {
      executar: (disparar) =>
        foco.executar(() => {
          anunciada.iniciar();
          disparar();
        }),
    };
  }

  protected salvar(): void {
    if (this.edicao.salvar()) this.detalhe()?.focarPrimeiroCampoInvalido();
  }
}
