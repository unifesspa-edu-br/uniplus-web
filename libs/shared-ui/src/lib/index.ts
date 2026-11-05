// Components
export { A11yMenuComponent } from './components/a11y-menu/a11y-menu';
export { AlertComponent, type UiAlertVariant } from './components/alert/alert';
export { AppShellComponent, type UiShellNavItem } from './components/app-shell/app-shell';
export { BackToTopComponent } from './components/back-to-top/back-to-top';
export { BackToTopContainerDirective } from './components/back-to-top/back-to-top-container.directive';
export { BackToTopScrollService } from './components/back-to-top/back-to-top.service';
export { BreadcrumbComponent, type UiBreadcrumbItem } from './components/breadcrumb/breadcrumb';
export {
  ButtonComponent,
  type UiButtonSize,
  type UiButtonType,
  type UiButtonVariant,
} from './components/button/button';
export { CardComponent } from './components/card/card';
export { CpfInputComponent } from './components/cpf-input/cpf-input';
export { DadoRevelavelComponent } from './components/dado-revelavel/dado-revelavel';
export { DataTableComponent, type UiDataTableColumn } from './components/data-table/data-table';
export { DialogComponent } from './components/dialog/dialog';
export { DrawerComponent } from './components/drawer/drawer';
export { EmptyStateComponent } from './components/empty-state/empty-state';
export { FileUploadComponent, type ArquivoEmEnvio, type FaseDoArquivo } from './components/file-upload/file-upload';
export { FilterBarComponent } from './components/filter-bar/filter-bar';
export {
  FilterChipsComponent,
  type UiFilterChipOption,
} from './components/filter-chips/filter-chips';
export { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog';
export { FormFieldComponent } from './components/form-field/form-field';
export { InstitutionalBarComponent } from './components/institutional-bar/institutional-bar';
export { IconButtonComponent, type UiTooltipPosition } from './components/icon-button/icon-button';
export { LoadingOverlayComponent } from './components/loading-overlay/loading-overlay';
export { NotificationHostComponent } from './components/notification-host/notification-host';
export { PageHeaderComponent } from './components/page-header/page-header';
export {
  DEFAULT_PAGE_SIZE,
  DEFAULT_PAGE_SIZE_OPTIONS,
  ListFooterComponent,
} from './components/list-footer/list-footer';
export { PagerComponent } from './components/pager/pager';
export { SegmentedComponent, type UiSegmentedOption } from './components/segmented/segmented';
export {
  ComboboxComponent,
  type UiComboboxGroup,
  type UiComboboxOption,
} from './components/combobox/combobox';
export { SelectComponent, type UiSelectOption } from './components/select/select';
export { CondicaoDeFatoComponent } from './components/editor-de-condicoes/condicao-de-fato';
export { EditorDeCondicoesComponent } from './components/editor-de-condicoes/editor-de-condicoes';
export { type ClausulaDeCondicoes, type CondicaoEmClausula, type CondicaoPosicionada, clausulasDe, comClausulaEm, comCondicaoEm, comCondicaoTrocadaEm, condicaoNova, numerosDeClausula, renumerarClausulas, semClausulaEm, semCondicaoEm } from './components/editor-de-condicoes/condicoes/condicoes-em-clausulas';
export { type CondicaoNoWire, deClausulasDoWire, paraClausulasDoWire } from './components/editor-de-condicoes/condicoes/condicoes-no-wire';
export { alcanceDaCondicao, problemaDaCondicao, problemasDeCondicoes } from './components/editor-de-condicoes/condicoes/conferencia-da-condicao';
export { FONTE_GEO_MUNICIPIO, type FatoDoCatalogo, type FatoEscolhivel, type TipoDeDominio, type ValorDoCatalogo, fatoEscolhivel, fatosEscolhiveis, nomesDoCatalogo, rotuloDoValor } from './components/editor-de-condicoes/condicoes/fatos-escolhiveis';
export { type CondicaoDeFato, OPERADOR_DIFERENTE, OPERADOR_EM, OPERADOR_IGUAL, OPERADOR_MAIOR_IGUAL, OPERADOR_MENOR_IGUAL, OPERADOR_NAO_EM, type OperadorEscolhivel, RESPOSTAS_BOOLEANAS, VALOR_FALSO, VALOR_VERDADEIRO, comOperador, comValorEscalar, comValoresDeLista, comparaComLista, operadoresDoFato, valorEscalarDe, valoresDeListaDe } from './components/editor-de-condicoes/condicoes/valor-da-condicao';
export { SkeletonComponent } from './components/skeleton/skeleton';
export { SkipLinkComponent } from './components/skip-link/skip-link';
export { SpinnerComponent } from './components/spinner/spinner';
export {
  StatusBadgeComponent,
  type UiStatusBadgeStatus,
} from './components/status-badge/status-badge';
export { TagComponent, type UiTagVariant } from './components/tag/tag';
export { TextInputComponent } from './components/text-input/text-input';
export { TextareaComponent } from './components/textarea/textarea';
export { VlibrasLoaderComponent } from './components/vlibras-loader/vlibras-loader';
export {
  ValorEmConsultaComponent,
  type UiValorEmConsulta,
} from './components/valor-em-consulta/valor-em-consulta';
export { DadoDirective } from './components/lista-de-dados/dado';
export {
  ListaDeDadosComponent,
  type UiVarianteDaListaDeDados,
} from './components/lista-de-dados/lista-de-dados';
export { DocumentoComponent } from './components/documento/documento';
export {
  SecaoDeDocumentoComponent,
  type UiLarguraDaSecao,
  type UiNivelDaSecao,
} from './components/documento/secao-de-documento';
export { CodigoDeVerificacaoComponent } from './components/codigo-de-verificacao/codigo-de-verificacao';
export { MarcaInstitucionalComponent } from './components/marca-institucional/marca-institucional';
export { BulletComponent, type UiBulletVariant } from './components/bullet/bullet';
export {
  StepsComponent,
  type StepItem,
  type StepStatus,
  type StepsVariant,
} from './components/steps/steps.component';

// Pipes
export { DateBrPipe } from './pipes/date-br.pipe';
export { NomeSocialPipe } from './pipes/nome-social.pipe';

// Directives
export { CpfMaskDirective } from './directives/cpf-mask.directive';
export { RolagemFocavelDirective } from './directives/rolagem-focavel.directive';
export { ValorLegivelDirective } from './components/valor-legivel/valor-legivel.directive';
