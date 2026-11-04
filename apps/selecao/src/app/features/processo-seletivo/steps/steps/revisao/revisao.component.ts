import { PERMISSAO, PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { TemPermissaoDirective } from '@uniplus/shared-auth/components';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';

import type { ConfirmacaoDeGravacao } from '../../passo-do-wizard';
import { provePassoDoWizard } from '../../passo-do-wizard';
import { StepValidation } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { AnexoEditalComponent } from '../../shared/anexo-edital/anexo-edital.component';
import { AnexosDoEditalComponent } from '../../shared/anexos-do-edital/anexos-do-edital.component';
import { documentosPorFase } from '../../shared/documentos-exigidos';
import { RegrasDasModalidadesComponent } from '../../shared/regras-das-modalidades.component';
import { CatalogosDoCronogramaService } from '../cronograma/catalogos-do-cronograma.service';
import { AvisosDaRevisaoComponent } from './avisos-da-revisao.component';
import { confirmacaoDaPublicacao } from './confirmacao-da-publicacao';
import { PreflightDaPublicacaoService } from './preflight-da-publicacao.service';
import { AtoDaPublicacaoComponent } from './secoes/ato-da-publicacao.component';
import { ConformidadeEstruturalComponent } from './secoes/conformidade-estrutural.component';
import { ConformidadeLegalComponent } from './secoes/conformidade-legal.component';
import { ConferenciaDaPublicacaoService } from './servicos/conferencia-da-publicacao.service';
import { PublicacaoDoProcessoService } from './servicos/publicacao-do-processo.service';

/**
 * Passo Revisão e Publicação. Confere, contra o que o servidor realmente aplica, o checklist
 * estrutural, a conformidade legal e o par documento e tipo de ato, e publica o processo.
 *
 * O passo é o único que entra e sai do wizard (`validate`, `persistir`, `confirmacaoDeGravacao`):
 * a conferência e a publicação são serviços do passo, e as seções que mostram o resultado
 * injetam o que ele provê. Recarrega o checklist a cada entrada, porque qualquer passo anterior
 * muda o que o servidor considera conforme.
 */
@Component({
  selector: 'sel-step-revisao',
  imports: [
    AnexoEditalComponent,
    AnexosDoEditalComponent,
    RegrasDasModalidadesComponent,
    AvisosDaRevisaoComponent,
    TemPermissaoDirective,
    ConformidadeEstruturalComponent,
    ConformidadeLegalComponent,
    AtoDaPublicacaoComponent,
  ],
  templateUrl: './revisao.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    provePassoDoWizard(RevisaoStepComponent),
    PreflightDaPublicacaoService,
    ConferenciaDaPublicacaoService,
    PublicacaoDoProcessoService,
  ],
})
export class RevisaoStepComponent {
  protected readonly store = inject(ProcessoSeletivoStore);
  protected readonly preflight = inject(PreflightDaPublicacaoService);
  protected readonly conferencia = inject(ConferenciaDaPublicacaoService);
  protected readonly publicacao = inject(PublicacaoDoProcessoService);
  private readonly permissoes = inject(PermissoesService);
  private readonly catalogosDoCronograma = inject(CatalogosDoCronogramaService);

  protected readonly permissaoDePublicar = PERMISSAO.selecao.processosPublicar;

  /** Só quem publica vê o campo de anexo; a orientação de anexar não serve a quem não o vê. */
  protected readonly podePublicar = computed(() => this.permissoes.tem(this.permissaoDePublicar));

  /** Quem concorre em cada modalidade ofertada, pela regra que o processo congelou. */
  protected readonly regrasDasModalidades = this.store.regrasDasModalidades;

  /**
   * Os documentos exigidos por fase, com a situação da base legal que a publicação confere: a
   * exigência que decide o resultado precisa de norma resolvida.
   */
  protected readonly documentosDasFases = computed(() => {
    const { documentos, cronograma } = this.store.draft();
    const nomeDaFase = this.catalogosDoCronograma.nomeDaFase();
    return documentosPorFase(
      documentos,
      cronograma.fases.map((fase) => fase.codigo),
    ).map((fase) => ({ ...fase, nome: nomeDaFase(fase.faseCodigo) }));
  });

  constructor() {
    effect(() => {
      const id = this.store.processoSeletivoId();
      if (id === null || !this.store.isLast()) return;
      untracked(() => {
        void this.preflight.recarregar(id, this.conferencia.dataReferenciaLegal());
      });
    });
  }

  validate(): StepValidation {
    return this.conferencia.validate();
  }

  persistir(): Promise<StepValidation> {
    return this.publicacao.persistir();
  }

  /**
   * Relê o checklist do servidor. A página o chama depois de gravar de novo um passo anterior
   * corrigido, para a conferência em tela refletir a correção antes de julgar de novo.
   */
  recarregarChecklist(): Promise<void> {
    return this.conferencia.atualizar();
  }

  rotuloDeAvanco(): string {
    return 'Publicar processo';
  }

  confirmacaoDeGravacao(): ConfirmacaoDeGravacao | null {
    if (!this.conferencia.validate().valid) return null;

    return confirmacaoDaPublicacao(
      this.store.draft(),
      this.preflight.tiposAto(),
      this.catalogosDoCronograma.fasePorId(),
    );
  }
}
