import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { consequenciasDaFase } from '@uniplus/shared-utils';

import type { BaseLegalConfig, RegraDeComprovacao } from '../../../processo-seletivo.models';
import { descreverFase } from '../../../shared/descricao-da-fase';
import { documentosDe } from '../../../shared/exigencias/consulta-das-exigencias';
import { CatalogoDasConsequenciasDeIndeferimento } from '../../cronograma/catalogos/catalogo-das-consequencias-de-indeferimento.service';
import { CatalogoDeDocumentos } from '../../cronograma/catalogos/catalogo-de-documentos.service';
import { CatalogoDeFases } from '../../cronograma/catalogos/catalogo-de-fases.service';
import { CatalogoDasFormasDeComprovacao } from '../../cronograma/catalogos/catalogo-das-formas-de-comprovacao.service';
import { FormularioDoCronograma } from '../../cronograma/servicos/formulario-do-cronograma.service';
import { FaseEmEdicao } from '../fase-em-edicao';
import { CriterioDeDistincaoComponent } from './criterio-de-distincao.component';
import { ConsequenciaENormasComponent } from './consequencia-e-normas.component';
import { GrupoDeDocumentosComponent, type DocumentoDoGrupo } from './grupo-de-documentos.component';
import { RecusasDasExigencias } from './recusas-das-exigencias.service';
import { GruposDeDocumentosStore } from './grupos-de-documentos.store';

@Component({
  selector: 'sel-edicao-de-grupos',
  imports: [GrupoDeDocumentosComponent, ConsequenciaENormasComponent, CriterioDeDistincaoComponent],
  providers: [GruposDeDocumentosStore, CatalogoDasFormasDeComprovacao],
  templateUrl: './edicao-de-grupos.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EdicaoDeGruposComponent {
  protected readonly grupos = inject(GruposDeDocumentosStore);
  protected readonly recusas = inject(RecusasDasExigencias, { optional: true });
  protected readonly catalogo = inject(CatalogoDasFormasDeComprovacao);
  protected readonly cronograma = inject(FormularioDoCronograma);
  private readonly documentos = inject(CatalogoDeDocumentos);
  private readonly fases = inject(CatalogoDeFases);
  private readonly fase = inject(FaseEmEdicao);
  private readonly consequencias = inject(CatalogoDasConsequenciasDeIndeferimento);
  protected readonly aberto = signal(false);
  protected readonly escolhidos = signal<ReadonlySet<string>>(new Set());
  protected readonly aviso = signal('');
  protected readonly opcoes = computed(() => {
    const fase = this.fase.faseDoRascunho();
    const permite =
      fase !== null && descreverFase(fase, this.fases.fasePorId()).permiteComplementacao;
    const opcoes = this.consequencias
      .consequencias()
      .map(({ codigo, rotulo }) => ({ valor: codigo, rotulo }));
    return consequenciasDaFase([{ valor: '', rotulo: 'Não decide sozinha' }, ...opcoes], permite);
  });

  constructor() {
    effect(() => {
      const identificadores =
        this.recusas?.todas().map((recusa) => recusa.identificadorDaRegra) ?? [];
      if (
        this.grupos
          .grupos()
          .some((grupo) => identificadores.includes(grupo.identificadorNoRascunho))
      ) {
        this.aberto.set(true);
        this.catalogo.carregar();
      }
    });
  }

  protected recusasDoCampo(identificador: string, campo: string) {
    return (this.recusas?.doCampo(identificador, campo) ?? []).map((recusa) => ({
      ...recusa,
      pagina: null,
    }));
  }

  protected abrir(): void {
    this.aberto.set(!this.aberto());
    if (this.aberto()) this.catalogo.carregar();
  }

  protected escolher(identificador: string, marcado: boolean): void {
    this.escolhidos.update((atuais) => {
      const proximos = new Set(atuais);
      if (marcado) proximos.add(identificador);
      else proximos.delete(identificador);
      return proximos;
    });
  }

  protected criar(destino: HTMLElement): void {
    const quantidade = this.grupos.grupos().length;
    this.grupos.criar([...this.escolhidos()]);
    if (this.grupos.grupos().length === quantidade) {
      this.aviso.set('Escolha documentos do mesmo momento de coleta e formulário.');
      return;
    }
    this.escolhidos.set(new Set());
    this.aviso.set('Documentos combinados em um grupo.');
    destino.focus();
  }

  protected disponiveis(grupo: RegraDeComprovacao): readonly DocumentoDoGrupo[] {
    const primeiro = documentosDe([grupo])[0];
    const regras = this.grupos.documentosSoltos().filter((regra) => {
      const documento = regra.documento;
      return (
        documento !== null &&
        primeiro !== undefined &&
        documento.etapaId === primeiro.etapaId &&
        documento.finalidade === primeiro.finalidade
      );
    });
    return this.nomes(regras);
  }

  protected retirar(grupo: RegraDeComprovacao, identificador: string, destino: HTMLElement): void {
    this.grupos.retirar(grupo.identificadorNoRascunho, identificador);
    this.aviso.set('Documento retirado do grupo.');
    destino.focus();
  }

  protected incluir(grupo: RegraDeComprovacao, identificador: string, destino: HTMLElement): void {
    this.grupos.incluir(grupo.identificadorNoRascunho, identificador);
    this.aviso.set('Documento incluído no grupo.');
    destino.focus();
  }

  protected nomes(regras: readonly RegraDeComprovacao[]): readonly DocumentoDoGrupo[] {
    return regras.map((regra) => ({
      identificador: regra.identificadorNoRascunho,
      nome: documentosDe([regra])
        .map(
          (documento) =>
            this.documentos.tipoDocumentoPorId().get(documento.tipoDocumentoId)?.nome ??
            documento.tipoDocumentoId,
        )
        .join(', '),
    }));
  }

  protected atualizarConsequencia(grupo: RegraDeComprovacao, consequencia: string): void {
    this.grupos.editar(grupo.identificadorNoRascunho, {
      consequencia: consequencia || null,
      basesLegais: grupo.basesLegais,
    });
    this.recusas?.limparCampo(grupo.identificadorNoRascunho, 'indeferimento.consequencia');
    this.aviso.set('Consequência do grupo atualizada.');
  }

  protected atualizarNormas(
    grupo: RegraDeComprovacao,
    basesLegais: readonly BaseLegalConfig[],
  ): void {
    this.grupos.editar(grupo.identificadorNoRascunho, {
      consequencia: grupo.consequencia,
      basesLegais,
    });
    this.recusas?.limparCampo(grupo.identificadorNoRascunho, 'indeferimento.basesLegais');
    this.aviso.set('Normas do grupo atualizadas.');
  }
}
