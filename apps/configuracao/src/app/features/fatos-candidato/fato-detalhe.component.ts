import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { PERMISSAO } from '@uniplus/shared-auth/bootstrap';
import { TemPermissaoDirective } from '@uniplus/shared-auth/components';
import { FatoCandidatoDto, FonteValoresFatoCodigo } from '@uniplus/shared-data/configuracao';
import {
  DrawerComponent,
  FalhaDeLeituraComponent,
  type LeituraAcompanhada,
  TagComponent,
} from '@uniplus/shared-ui/components';
import { DetalheDaProtecaoComponent } from '../../shared/detalhe-do-catalogo';
import {
  HistoricoDaProtecaoComponent,
  HistoricoDasManifestacoesComponent,
  SituacaoDaAprovacaoComponent,
} from '../../shared/protecao-do-catalogo';
import { ROTULO_DO_COMPONENTE_PADRAO, protecaoExibidaDoFato } from './fato-candidato.regras';
import { ID_DAS_REGRAS_DO_DETALHE } from './ids-do-fato';

/** O detalhe de leitura de um fato do catálogo, com as ações que levam à edição e ao aceite. */
@Component({
  selector: 'cfg-fato-detalhe',
  imports: [
    TemPermissaoDirective,
    DetalheDaProtecaoComponent,
    DrawerComponent,
    HistoricoDaProtecaoComponent,
    HistoricoDasManifestacoesComponent,
    SituacaoDaAprovacaoComponent,
    TagComponent,
    FalhaDeLeituraComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fato-detalhe.component.html',
  styleUrl: '../../shared/sobreposicao/sobreposicao.css',
})
export class FatoDetalheComponent {
  readonly aberto = model.required<boolean>();
  readonly fato = input.required<FatoCandidatoDto | null>();
  /** As regras padrão do fato em prosa, na ordem em que a API as devolve. */
  readonly regras = input.required<readonly string[]>();
  /** A lista está sendo lida ou gravada: nada se abre a partir de uma lista que vai mudar. */
  readonly indisponivel = input.required<boolean>();
  /** A leitura do catálogo que nomeia os fatos das regras. */
  readonly leituraDoCatalogo = input.required<LeituraAcompanhada>();
  readonly editar = output<FatoCandidatoDto>();
  readonly aceitar = output<FatoCandidatoDto>();

  protected readonly titulo = computed(() => this.fato()?.descritivo.nome ?? 'Fato do candidato');
  /** Os municípios da prova presencial: cada processo declara os seus, e esta tela não os cadastra. */
  protected readonly valoresDeCadaProcesso = computed(
    () =>
      this.fato()?.definicao.valores.fonte?.codigo ===
      FonteValoresFatoCodigo.MUNICIPIOS_PROVA_PRESENCIAL,
  );
  protected readonly idDasRegras = ID_DAS_REGRAS_DO_DETALHE;
  /**
   * O histórico das manifestações técnicas, só para ler: quem administra o cadastro ou quem
   * consulta a proteção de dados.
   */
  protected readonly permissoesDasManifestacoes = [
    PERMISSAO.configuracao.fatosCandidatoConsultar,
    PERMISSAO.configuracao.protecaoDoCatalogoConsultar,
  ];
  protected readonly permissaoDeManter = PERMISSAO.configuracao.fatosCandidatoManter;
  protected readonly permissaoDeConsultar = PERMISSAO.configuracao.fatosCandidatoConsultar;
  protected readonly rotuloDoPadrao = ROTULO_DO_COMPONENTE_PADRAO;
  protected readonly protecaoDe = protecaoExibidaDoFato;
}
