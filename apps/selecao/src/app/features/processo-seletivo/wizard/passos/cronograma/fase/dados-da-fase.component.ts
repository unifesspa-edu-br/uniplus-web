import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ValorLegivelDirective } from '@uniplus/shared-ui/components';

import { haRecusaAtiva } from '../../../shared/recusas/ordem-das-recusas';
import { RecusasDoCampoComponent } from '../../../shared/recusas/recusas-do-campo.component';
import {
  campoNaTela,
  fimDaFaseNaTela,
  marcaDoMesmoMomentoNaTela,
  type CampoDaRecusaDaFase,
} from '../../fase/campo-da-fase';
import { SituacaoDosCatalogosDoCronograma } from '../catalogos/situacao-dos-catalogos-do-cronograma.service';
import { pisoDeData } from '../cronograma-form';
import { FORMULARIO_DO_PAI } from '../formulario-do-pai';
import type { FaseNaLinhaDoTempo } from '../servicos/formulario-do-cronograma.service';
import { LeituraDaLinhaDoTempo } from '../servicos/leitura-da-linha-do-tempo.service';
import { RecusasDoServidorNasFases } from '../servicos/recusas-do-servidor-nas-fases.service';
import { UnidadesResponsaveisDasFases } from '../servicos/unidades-responsaveis-das-fases.service';

@Component({
  selector: 'sel-dados-da-fase',
  imports: [ValorLegivelDirective, ReactiveFormsModule, RecusasDoCampoComponent],
  templateUrl: './dados-da-fase.component.html',
  viewProviders: [FORMULARIO_DO_PAI],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DadosDaFaseComponent {
  readonly fase = input.required<FaseNaLinhaDoTempo>();
  private readonly situacao = inject(SituacaoDosCatalogosDoCronograma);
  protected readonly unidades = inject(UnidadesResponsaveisDasFases);
  protected readonly leitura = inject(LeituraDaLinhaDoTempo);
  protected readonly unidadesSemLista = this.situacao.leituraDasUnidades.visivel;
  protected readonly pisoDeData = pisoDeData;
  protected readonly haRecusaAtiva = haRecusaAtiva;
  protected readonly campoNaTela = campoNaTela;
  private readonly recusas = inject(RecusasDoServidorNasFases);

  /** As recusas do servidor ao campo da fase, ativas e a conferir, na ordem em que se leem. */
  protected recusasDoCampo(item: FaseNaLinhaDoTempo, campo: CampoDaRecusaDaFase) {
    return this.recusas.recusasDoCampo(item.grupo.controls.faseCanonicaId.value, campo);
  }

  private readonly haFimOuRecusa = computed(() => {
    const item = this.fase();
    return item.grupo.controls.fim.value !== '' || this.recusasDoCampo(item, 'fim').length > 0;
  });

  /**
   * Depois de aparecer, o Fim fica: apagar o valor à mão não pode esconder o campo em que a pessoa
   * está digitando, e o foco se perderia.
   */
  private readonly fimJaVisto = linkedSignal<boolean, boolean>({
    source: this.haFimOuRecusa,
    computation: (haFimOuRecusa, anterior) => haFimOuRecusa || (anterior?.value ?? false),
  });

  protected readonly fimNaTela = computed(() =>
    fimDaFaseNaTela(this.fase().exigencias, this.fimJaVisto()),
  );

  private readonly estadoDaMarca = computed(() => {
    const item = this.fase();
    return {
      posicao: item.indice,
      ligada: item.grupo.controls.noMesmoMomentoDaAnterior.value,
      comRecusa: this.recusasDoCampo(item, 'noMesmoMomentoDaAnterior').length > 0,
    };
  });

  protected readonly marcaNaTela = linkedSignal({
    source: this.estadoDaMarca,
    computation: (estado, anterior) =>
      marcaDoMesmoMomentoNaTela(estado.posicao, estado.ligada, estado.comRecusa) ||
      (anterior?.source.posicao === estado.posicao && anterior.value) ||
      (estado.posicao === 0 && anterior?.source.ligada === true),
  });

  /** O nome do campo traz a indicação de que a publicação exige o Fim; gravar o rascunho não exige. */
  protected rotuloDoFim(): string {
    return this.fase().exigencias?.fimObrigatorio === true
      ? 'Fim (obrigatório para publicar)'
      : 'Fim';
  }

  /** Os textos que descrevem o Fim: o fuso, o início definido na execução e a recusa, quando há. */
  protected idsQueDescrevemOFim(): string {
    const item = this.fase();
    const ids = [`cr-fuso-${item.indice}`];
    if (item.exigencias !== null && !campoNaTela('inicio', item.exigencias))
      ids.push(`cr-sem-inicio-${item.indice}`);
    if (this.recusasDoCampo(item, 'fim').length > 0) ids.push(`cr-fim-erro-${item.indice}`);
    return ids.join(' ');
  }
}
