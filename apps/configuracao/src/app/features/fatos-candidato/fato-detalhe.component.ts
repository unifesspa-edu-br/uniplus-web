import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { PERMISSAO } from '@uniplus/shared-auth/bootstrap';
import { TemPermissaoDirective } from '@uniplus/shared-auth/components';
import { FatoCandidatoDto } from '@uniplus/shared-data/configuracao';
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
  rotuloDe,
} from '../../shared/protecao-do-catalogo';
import {
  CARDINALIDADES,
  COMPONENTES_DE_EXIBICAO,
  DOMINIOS,
  ESCOPOS,
  FONTES_DE_VALORES,
  FORMATOS_DE_TEXTO,
  ORIGENS,
  ROTULO_DO_COMPONENTE_PADRAO,
} from './fato-candidato.regras';
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
  protected readonly origens = ORIGENS;
  protected readonly dominios = DOMINIOS;
  protected readonly cardinalidades = CARDINALIDADES;
  protected readonly fontes = FONTES_DE_VALORES;
  protected readonly formatos = FORMATOS_DE_TEXTO;
  protected readonly escopos = ESCOPOS;
  protected readonly componentes = COMPONENTES_DE_EXIBICAO;
  protected readonly rotuloDoPadrao = ROTULO_DO_COMPONENTE_PADRAO;
  protected readonly rotulo = rotuloDe;
}
