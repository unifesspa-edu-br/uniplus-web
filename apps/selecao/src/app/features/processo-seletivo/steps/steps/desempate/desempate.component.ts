import { ChangeDetectionStrategy, Component, computed, inject, Injector } from '@angular/core';
import { OrigemCandidatos } from '@uniplus/shared-data/selecao';

import { CriterioDesempateConfigurado, StepValidation } from '../../processo-seletivo.models';
import { fatosColetadosPelaInscricao } from '../formulario/fatos-coletados-da-inscricao';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import type { ConfirmacaoDeGravacao } from '../../passo-do-wizard';
import { provePassoDoWizard } from '../../passo-do-wizard';
import { focarAposRenderizar } from '../../shared/foco-apos-renderizar';
import { AreasDoDesempateService } from './areas-do-desempate.service';
import { EdicaoDosCriteriosService } from './edicao-dos-criterios.service';
import { FatosDoDesempateService } from './fatos-do-desempate.service';
import { GravacaoDoDesempate } from './gravacao-do-desempate.service';
import { CriterioDeDesempateComponent } from './criterio-de-desempate.component';
import { textoDoCriterio } from '../classificacao/confirmacao-da-classificacao';
import { CatalogosDeClassificacaoService } from '../classificacao/catalogos-de-classificacao.service';
import {
  desempateIdosoSemApuracao,
  desempateSemDataDeNascimento,
  PASSO_FORMULARIO,
} from './desempate-por-idade';
import { desempateUsaAreas, desempateTemShapeConhecido } from './desempate-para-comando';
import { mensagensDoDesempate } from './validacao-do-desempate';

/**
 * Critérios de desempate (`PUT …/criterios-desempate`), na ordem em que serão
 * avaliados. A ordem é a posição na lista — reescrita a cada mover/remover —
 * e não um vocabulário institucional fixo: `CRITERIOS_DESEMPATE` com ids de 1
 * a 7 saiu inteiro, porque nenhum campo dele coincide com o contrato.
 */
@Component({
  selector: 'sel-step-desempate',
  standalone: true,
  templateUrl: './desempate.component.html',
  imports: [CriterioDeDesempateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    AreasDoDesempateService,
    EdicaoDosCriteriosService,
    FatosDoDesempateService,
    GravacaoDoDesempate,
    provePassoDoWizard(DesempateStepComponent),
  ],
})
export class DesempateStepComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly catalogos = inject(CatalogosDeClassificacaoService);
  protected readonly areas = inject(AreasDoDesempateService);
  protected readonly fatos = inject(FatosDoDesempateService);
  private readonly gravacao = inject(GravacaoDoDesempate);

  private readonly injector = inject(Injector);

  constructor() {
    this.catalogos.carregar();
    this.fatos.carregar();
  }

  protected readonly edicao = inject(EdicaoDosCriteriosService);
  readonly criterios = this.edicao.criterios;

  /**
   * "Reler o processo" do aviso de releitura. Quando ela decide e o aviso sai, o foco vai ao
   * primeiro critério por área; se ela falha, o aviso fica e a falha é anunciada.
   */
  async relerProcesso(): Promise<void> {
    const resultado = await this.areas.relerProcesso();
    if (resultado === 'ainda-por-reler') {
      this.edicao.anunciar('Não foi possível reler o processo. Tente novamente.');
    } else if (resultado === 'lida') {
      this.focarNoPrimeiroCriterioPorArea();
    }
  }

  /**
   * O alerta, com o botão focado, fica na tela enquanto a nova tentativa corre. Quando a leitura dá
   * certo e ele sai, o foco vai ao primeiro critério por área.
   */
  tentarLerOCadastroDeNovo(): void {
    this.areas.relerCadastro(() => this.focarNoPrimeiroCriterioPorArea());
  }

  private focarNoPrimeiroCriterioPorArea(): void {
    const indice = this.criterios().findIndex((criterio) => this.usaAreas(criterio));
    // Sem critério por área — a regra pode ter sido trocada enquanto a leitura corria —, o destino
    // é o botão de acrescentar critério, que está sempre na tela.
    focarAposRenderizar(
      this.injector,
      ...(indice < 0 ? [] : [`desemp-area-nova-${indice}`, `desemp-regra-${indice}`]),
      'desempate-acrescentar',
    );
  }

  /**
   * Com inscrição feita no sistema o desempate é obrigatório; com resultado importado a lista já
   * vem classificada e o passo não o exige (a API aceita critérios, mas não os cobra).
   */
  readonly desempateObrigatorio = computed(
    () => this.store.draft().identificacao.origemCandidatos === OrigemCandidatos.inscricaoPropria,
  );

  /** Só diz que o desempate não é obrigatório quando a origem já foi escolhida como importação. */
  readonly desempateDispensado = computed(
    () => this.store.draft().identificacao.origemCandidatos === OrigemCandidatos.importacaoExterna,
  );

  /**
   * O desempate por maior idade sem a data de nascimento no formulário. Em consulta não há o que
   * corrigir, e o aviso só ofereceria uma ação a um processo que não aceita edição.
   */
  readonly semDataDeNascimento = computed(
    () =>
      !this.store.emConsulta() &&
      desempateSemDataDeNascimento(
        this.criterios(),
        fatosColetadosPelaInscricao(this.store.draft().formulario.conteudo),
      ),
  );

  /** O desempate por idoso sem a apuração da idade no formulário. */
  readonly idosoSemApuracao = computed(
    () =>
      !this.store.emConsulta() &&
      desempateIdosoSemApuracao(this.criterios(), this.store.draft().formulario.referenciaTemporal),
  );

  irParaFormulario(): void {
    this.store.goTo(PASSO_FORMULARIO);
  }

  readonly etapasReferenciaveis = computed(() =>
    this.store.draft().cronograma.etapas.filter((etapa) => etapa.id !== null),
  );

  /** Quantas regras do catálogo esta tela ainda não sabe configurar. */
  readonly regrasSemSuporte = computed(
    () =>
      this.catalogos
        .criteriosDesempate()
        .filter((regra) => !desempateTemShapeConhecido(regra.codigo)).length,
  );

  private usaAreas(criterio: CriterioDesempateConfigurado): boolean {
    return desempateUsaAreas(criterio.regraCodigo);
  }

  rotuloDeAvanco(): string {
    return 'Gravar e avançar';
  }

  confirmacaoDeGravacao(): ConfirmacaoDeGravacao | null {
    if (!this.validate().valid) return null;

    const criterios = this.criterios();
    if (criterios.length === 0) {
      return {
        titulo: 'Confirmar a ausência de critérios de desempate',
        aviso: 'Nenhum critério de desempate será declarado para este processo.',
        rotuloDeConfirmar: 'Confirmar sem critérios',
        itens: [{ rotulo: 'Critérios de desempate', valor: 'Nenhum' }],
      };
    }

    const adia = this.areas.adiaAGravacao();
    return {
      titulo: 'Confirmar os critérios de desempate',
      aviso: adia
        ? 'A ordem exibida é a ordem em que os critérios serão avaliados. Eles serão gravados junto com a classificação, no passo Eliminação.'
        : 'A ordem exibida é a ordem em que os critérios serão avaliados.',
      rotuloDeConfirmar: adia ? 'Confirmar critérios' : 'Gravar critérios',
      itens: criterios.map((criterio, indice) => ({
        rotulo: `${indice + 1}º critério`,
        valor: textoDoCriterio(criterio, (codigo) => this.areas.rotuloDaArea(codigo)),
      })),
    };
  }

  /** Validação declarativa — acionada pela page ao clicar em "Próximo". */
  validate(): StepValidation {
    const messages = mensagensDoDesempate({
      criterios: this.criterios(),
      obrigatorio: this.desempateObrigatorio(),
      etapas: this.etapasReferenciaveis(),
      fatos: this.fatos.porCodigo(),
      situacaoDoQuadro: this.areas.situacaoDoQuadro(),
      rotuloDaArea: (codigo) => this.areas.rotuloDaArea(codigo),
    });
    return messages.length ? { valid: false, messages } : { valid: true };
  }

  /**
   * Grava a coleção inteira, na ordem em que está na tela (CA-05). Com critério por área e sem o
   * quadro gravado, só marca a gravação como pendente: quem grava a classificação grava os
   * critérios em seguida (`gravarAposAClassificacao`).
   */
  async persistir(): Promise<StepValidation> {
    const conferencia = this.validate();
    if (!conferencia.valid) return conferencia;
    if (this.store.processoSeletivoId() !== null && this.areas.adiaAGravacao()) {
      this.store.classificacao.desempatePendenteDeGravacao.set(true);
      return { valid: true };
    }
    return this.gravar();
  }

  /** Grava os critérios que ficaram para depois da classificação, se ficaram. */
  async gravarAposAClassificacao(): Promise<StepValidation> {
    if (!this.store.classificacao.desempatePendenteDeGravacao()) return { valid: true };
    const conferencia = this.validate();
    return conferencia.valid ? this.gravar() : conferencia;
  }

  private gravar(): Promise<StepValidation> {
    return this.gravacao.gravar(this.criterios(), (codigo) => this.areas.rotuloDaArea(codigo));
  }
}
