import type { FormularioDto, ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import {
  conteudoInicial,
  FINALIDADE_INSCRICAO,
  type ConteudoDoFormulario,
  type FatoDoFormulario,
} from '@uniplus/shared-inscricao/formulario';
import { comCamposQueAsExigenciasPressupoem } from '../passos/formulario/campos-pressupostos-da-inscricao';
import {
  conteudoDoFormulario,
  faseDaInscricao,
  fatosColetadosPor,
  fatosDasOutrasFinalidades,
  formularioDaFinalidade,
  type FormularioParaGravar,
} from '../passos/formulario/formulario-do-processo';
import { CamposPostosPelasExigencias } from './campos-postos-pelas-exigencias';
import type { CamposPressupostos } from './campos-pressupostos.service';

export class PlanoDosCamposPressupostos {
  readonly gravado: FormularioDto | null;
  readonly conteudoGravado: ConteudoDoFormulario;
  readonly desejado: ConteudoDoFormulario;
  readonly faseDaInscricao: string | null;
  private readonly outrasFinalidades: readonly string[];

  constructor(
    servidor: ProcessoSeletivoDto,
    private readonly citados: ReadonlySet<string>,
    private readonly catalogo: readonly FatoDoFormulario[],
    outrasFinalidades: readonly string[],
  ) {
    this.outrasFinalidades = outrasFinalidadesDoProcesso(servidor, outrasFinalidades);
    this.gravado = formularioDaFinalidade(servidor.formularios ?? [], FINALIDADE_INSCRICAO);
    this.conteudoGravado =
      this.gravado === null ? conteudoInicial() : conteudoDoFormulario(this.gravado);
    this.desejado = this.comOsCamposQueFaltam(this.conteudoGravado);
    this.faseDaInscricao = this.gravado?.faseId ?? idDaFaseDeInscricao(servidor.cronogramaFases);
  }

  /** Os postos por exigência vão vazios de propósito: só o passo Formulário decide remover. */
  comOsCamposQueFaltam(conteudo: ConteudoDoFormulario): ConteudoDoFormulario {
    return comCamposQueAsExigenciasPressupoem(conteudo, {
      citados: this.citados,
      catalogo: this.catalogo,
      postosPelasExigencias: CamposPostosPelasExigencias.vazia(),
      fatosDeOutrasFinalidades: this.outrasFinalidades,
    });
  }

  coletaTudo(): boolean {
    return this.desejado === this.conteudoGravado;
  }

  fatosNaoColetados(): readonly string[] {
    const coletados = new Set([
      ...fatosColetadosPor(this.conteudoGravado),
      ...this.outrasFinalidades,
    ]);
    return [...this.citados].filter((codigo) => !coletados.has(codigo));
  }

  desconhecidosDoCatalogo(): readonly string[] {
    const conhecidos = new Set(this.catalogo.map((fato) => fato.codigo));
    return this.fatosNaoColetados().filter((codigo) => !conhecidos.has(codigo));
  }

  desfechoSemGravar(): CamposPressupostos | null {
    if (this.coletaTudo()) return { tipo: 'garantidos' };
    if (this.faseDaInscricao === null) return { tipo: 'semFaseDeInscricao' };
    return null;
  }

  cabecalhoParaCriar(): FormularioParaGravar & { readonly faseId: string } {
    if (this.faseDaInscricao === null) throw new Error('Fase de inscrição ausente');
    return {
      faseId: this.faseDaInscricao,
      conteudo: { ...this.desejado, itens: [], grupos: [], termos: [] },
    };
  }

  gravacaoSobre(formulario: FormularioDto): {
    servidor: FormularioParaGravar;
    desejado: FormularioParaGravar & { readonly faseId: string };
  } {
    if (this.faseDaInscricao === null) throw new Error('Fase de inscrição ausente');
    const conteudo = conteudoDoFormulario(formulario);
    return {
      servidor: { faseId: formulario.faseId, conteudo },
      desejado: { faseId: this.faseDaInscricao, conteudo: this.comOsCamposQueFaltam(conteudo) },
    };
  }
}

function idDaFaseDeInscricao(fases: ProcessoSeletivoDto['cronogramaFases']): string | null {
  return faseDaInscricao(fases.map((fase) => ({ id: fase.id, ...fase.faseCanonica })))?.id ?? null;
}

function outrasFinalidadesDoProcesso(
  servidor: ProcessoSeletivoDto,
  rascunho: readonly string[],
): readonly string[] {
  return [
    ...new Set([
      ...fatosDasOutrasFinalidades(servidor.formularios ?? [], FINALIDADE_INSCRICAO),
      ...rascunho,
    ]),
  ];
}
