import { textoDoFormatoDoCodigo } from '@uniplus/shared-utils';
import { ID_DO_TIPO_DE_DADO_DA_CRIACAO } from './ids-do-fato';
import { acompanharTiposDoDado } from './leituras-do-fato';
import { VOCABULARIO_DE_TIPOS_DO_DADO } from '@uniplus/shared-data/configuracao';
import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import {
  AlertComponent,
  FalhaDeLeituraComponent,
  FalhaDeLeituraDoCampoComponent,
  IndicadorDaLeituraDirective,
  SpinnerComponent,
} from '@uniplus/shared-ui/components';
import { acompanharFocoDoEnvio } from '../../shared/foco';
import { bloquearEnvio } from './bloquear-envio';
import { FatoProtecaoDaDefinicaoComponent } from './fato-protecao-da-definicao.component';
import { lerVocabularioDoFato } from './vocabulario-do-fato';
import { EdicaoDosFatos } from './edicao-dos-fatos';
import { LIMITE_DO_CODIGO_DO_FATO, CampoDaCriacao, mensagemDoCampo } from './fato-candidato-form';
import {
  ROTULO_DO_COMPONENTE_PADRAO,
  fatosDeMembroAgregaveis,
  resumoDoAgregado,
} from './fato-candidato.regras';
import { ID_DO_FATO_DE_MEMBRO, ID_DO_PONTO_DE_RESOLUCAO_DA_CRIACAO } from './ids-do-fato';
import { lerCatalogoDeFatos, lerFasesCanonicas } from './leituras-do-fato';

/**
 * O formulário de criação do fato, com o rodapé do drawer. Existe só com o drawer aberto em
 * criação, então as fases e o catálogo de fatos de membro são lidos de novo a cada abertura: o fato
 * de membro pode ter sido criado há pouco.
 */
@Component({
  selector: 'cfg-fato-criacao',
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    FalhaDeLeituraComponent,
    FalhaDeLeituraDoCampoComponent,
    IndicadorDaLeituraDirective,
    SpinnerComponent,
    FatoProtecaoDaDefinicaoComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fato-criacao.component.html',
  styleUrl: './fato-drawer.css',
})
export class FatoCriacaoComponent {
  protected readonly ajudaDoCodigo = textoDoFormatoDoCodigo(LIMITE_DO_CODIGO_DO_FATO);
  protected readonly tiposDoDado = inject(VOCABULARIO_DE_TIPOS_DO_DADO);
  protected readonly leituraDosTipos = acompanharTiposDoDado(ID_DO_TIPO_DE_DADO_DA_CRIACAO);

  constructor() {
    this.tiposDoDado.carregar();
  }

  private readonly edicao = inject(EdicaoDosFatos);

  protected readonly avisoDoNome = this.edicao.ligacaoDoCodigo.avisoDoNome;
  protected readonly form = this.edicao.form;
  protected readonly dep = this.edicao.dependencias;
  protected readonly salvando = this.edicao.criando;
  protected readonly fases = lerFasesCanonicas(
    () => true,
    () => document.getElementById(ID_DO_PONTO_DE_RESOLUCAO_DA_CRIACAO),
  );
  protected readonly catalogo = lerCatalogoDeFatos(() => this.dep.agregado(), {
    assunto: 'fatos de membro',
    consequencia:
      'Sem o catálogo de fatos não é possível escolher o fato de membro que o agregado resume.',
    destino: () => document.getElementById(ID_DO_FATO_DE_MEMBRO),
  });

  protected readonly hipoteses = lerVocabularioDoFato(
    'hipoteses-legais-tratamento',
    'as hipóteses legais',
    'cfg-fato-hipoteses',
  );
  private readonly acompanharHipoteses = effect(() => {
    const leitura = this.hipoteses.vocabulario;
    const itens = leitura.carregando() || leitura.erro() !== null ? null : leitura.itens();
    this.dep.vocabularioDasHipoteses.set(itens);
  });
  /** Enquanto a lista não chega, a hipótese já escolhida continua entre as opções. */
  protected readonly opcoesDasHipoteses = computed(() => {
    const codigo = this.dep.valores().hipoteseLegal;
    if (this.dep.vocabularioDasHipoteses() !== null || !codigo) return this.dep.hipoteses();
    return [{ valor: codigo, rotulo: codigo }];
  });
  protected readonly cardinalidades = lerVocabularioDoFato(
    'quantidades-de-valores',
    'as quantidades de valores',
    'cfg-fato-cardinalidades',
  );
  protected readonly fontes = lerVocabularioDoFato(
    'fontes-valores-fato',
    'as fontes de valores',
    'cfg-fato-fontes',
  );
  protected readonly formatos = lerVocabularioDoFato(
    'formatos-texto',
    'os formatos de texto',
    'cfg-fato-formatos',
  );
  protected readonly escopos = lerVocabularioDoFato(
    'escopos-fato',
    'os escopos',
    'cfg-fato-escopos',
  );
  protected readonly componentes = lerVocabularioDoFato(
    'componentes-de-exibicao',
    'os componentes de exibição',
    'cfg-fato-componente',
  );
  protected readonly rotuloDoPadrao = ROTULO_DO_COMPONENTE_PADRAO;
  protected readonly resumo = resumoDoAgregado;

  protected readonly erro = this.edicao.erro;
  protected readonly anuncio = this.edicao.anuncioDaCriacao;
  protected readonly fatosDeMembro = computed(() => fatosDeMembroAgregaveis(this.catalogo.itens()));
  protected readonly membroEscolhido = computed(
    () =>
      this.fatosDeMembro().find((fato) => fato.codigo === this.dep.valores().fatoDeMembro) ?? null,
  );
  protected readonly rotuloDoBotao = computed(() =>
    this.salvando() ? 'Criando...' : 'Criar fato',
  );

  private readonly foco = acompanharFocoDoEnvio({
    salvando: this.salvando,
    aberto: this.edicao.aberto,
  });

  protected erroDoCampo(campo: CampoDaCriacao): string | null {
    return mensagemDoCampo(this.form.controls[campo]);
  }

  protected nomeDaFase(codigo: string): string {
    return this.fases.itens().find((fase) => fase.codigo === codigo)?.nome ?? codigo;
  }

  protected cancelar(): void {
    this.edicao.fechar();
  }

  protected aoClicarEmCriar(evento: Event): void {
    bloquearEnvio(evento, this.salvando());
  }

  protected aoEnviar(): void {
    this.edicao.criar();
    if (this.form.invalid) this.foco.focarPrimeiroInvalido();
  }
}
