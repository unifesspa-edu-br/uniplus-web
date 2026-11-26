import { ID_DO_TIPO_DE_DADO_DA_DEFINICAO } from './ids-do-fato';
import { acompanharTiposDoDado } from './leituras-do-fato';
import { VOCABULARIO_DE_TIPOS_DO_DADO } from '@uniplus/shared-data/configuracao';
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import {
  AlertComponent,
  FalhaDeLeituraComponent,
  FalhaDeLeituraDoCampoComponent,
  IndicadorDaLeituraDirective,
  RecolhivelComponent,
} from '@uniplus/shared-ui/components';
import { mensagemDeErroDoControle } from '../../shared/formulario';
import { bloquearEnvio } from './bloquear-envio';
import { comOpcaoAtual, lerVocabularioDoFato } from './vocabulario-do-fato';
import { EdicaoDoFato } from './edicao-do-fato';
import { eixosSomenteLeitura } from './eixos-somente-leitura';
import { FatoProtecaoDaDefinicaoComponent } from './fato-protecao-da-definicao.component';
import { ROTULO_DO_COMPONENTE_PADRAO } from './fato-candidato.regras';
import { ID_DO_SALVAR_DA_DEFINICAO } from './ids-do-fato';

type CampoDaDefinicao = keyof EdicaoDoFato['definicao']['controls'];

/**
 * A definição do fato: o que o tipo dele deixa editar, a proteção de dados e as recusas da API.
 * O fato de sistema só altera a proteção; os demais fatos só leem.
 */
@Component({
  selector: 'cfg-fato-definicao',
  imports: [
    NgTemplateOutlet,
    ReactiveFormsModule,
    AlertComponent,
    FalhaDeLeituraComponent,
    FalhaDeLeituraDoCampoComponent,
    IndicadorDaLeituraDirective,
    FatoProtecaoDaDefinicaoComponent,
    RecolhivelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fato-definicao.component.html',
  styleUrl: './fato-edicao.css',
})
export class FatoDefinicaoComponent {
  protected readonly tiposDoDado = inject(VOCABULARIO_DE_TIPOS_DO_DADO);
  protected readonly leituraDosTipos = acompanharTiposDoDado(ID_DO_TIPO_DE_DADO_DA_DEFINICAO);

  constructor() {
    this.tiposDoDado.carregar();
  }

  private readonly edicao = inject(EdicaoDoFato);

  protected readonly leitura = this.edicao.leitura;
  protected readonly fato = this.leitura.fato;
  protected readonly comOpcaoAtual = comOpcaoAtual;
  protected readonly form = this.edicao.definicao;
  protected readonly dep = this.edicao.dependencias;
  protected readonly bloqueado = this.edicao.bloqueado;
  protected readonly citacoes = this.edicao.citacoes;
  protected readonly recusa = this.edicao.recusaDaDefinicao;
  protected readonly fases = this.leitura.fases;
  protected readonly eixosSomenteLeitura = computed(() =>
    eixosSomenteLeitura(this.fato(), this.leitura.tipo()),
  );

  protected readonly opcoesDasHipoteses = computed(() => {
    const opcoes = this.dep.hipoteses();
    const codigo = this.dep.valores().hipoteseLegal;
    if (this.dep.vocabularioDasHipoteses() !== null || !codigo) return opcoes;
    const atual = this.fato()?.definicao.protecao.hipoteseLegal;
    return [{ valor: codigo, rotulo: atual?.codigo === codigo ? atual.rotulo : codigo }];
  });

  protected readonly idDoSalvar = ID_DO_SALVAR_DA_DEFINICAO;
  protected readonly hipoteses = lerVocabularioDoFato(
    'hipoteses-legais-tratamento',
    'as hipóteses legais',
    'cfg-fato-def-hipoteses',
  );
  private readonly acompanharHipoteses = effect(() => {
    const leitura = this.hipoteses.vocabulario;
    const itens = leitura.carregando() || leitura.erro() !== null ? null : leitura.itens();
    this.dep.vocabularioDasHipoteses.set(itens);
  });
  protected readonly cardinalidades = lerVocabularioDoFato(
    'quantidades-de-valores',
    'as quantidades de valores',
    'cfg-fato-def-cardinalidades',
  );
  protected readonly fontes = lerVocabularioDoFato(
    'fontes-valores-fato',
    'as fontes de valores',
    'cfg-fato-def-fontes',
  );
  protected readonly formatos = lerVocabularioDoFato(
    'formatos-texto',
    'os formatos de texto',
    'cfg-fato-def-formatos',
  );
  protected readonly escopos = lerVocabularioDoFato(
    'escopos-fato',
    'os escopos',
    'cfg-fato-def-escopos',
  );
  protected readonly rotuloDoPadrao = ROTULO_DO_COMPONENTE_PADRAO;

  protected erroDoCampo(campo: CampoDaDefinicao): string | null {
    return mensagemDeErroDoControle(this.form.controls[campo]);
  }

  protected descritor(campo: CampoDaDefinicao): string | null {
    return this.erroDoCampo(campo) ? `cfg-fato-def-${campo}-erro` : null;
  }

  protected salvar(): void {
    this.edicao.salvarDefinicao();
  }

  protected aoClicarEmSalvar(evento: Event): void {
    bloquearEnvio(evento, this.bloqueado());
  }
}
