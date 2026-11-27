import type { FormularioDto, ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import {
  conteudoInicial,
  type ConteudoDoFormulario,
  type FatoDoFormulario,
} from '@uniplus/shared-inscricao/formulario';
import { comCamposQueAsExigenciasPressupoem } from '../passos/formulario/campos-pressupostos-da-inscricao';
import {
  conteudoDoFormulario,
  fatosColetadosPor,
  fatosDosOutrosFormularios,
  formularioDaInscricaoDoServidor,
  paraGravarDoServidor,
  type FormularioParaGravar,
} from '../passos/formulario/formulario-do-processo';
import { CamposPostosPelasExigencias } from './campos-postos-pelas-exigencias';
import type { CamposPressupostos } from './campos-pressupostos.service';

/** O que o plano sabe do passo Formulário, fora do que o servidor tem. */
export interface EntradasDoPlano {
  readonly citados: ReadonlySet<string>;
  readonly catalogo: readonly FatoDoFormulario[];
  /** Os fatos que os outros formulários do rascunho coletam. */
  readonly fatosDosOutrosFormularios: readonly string[];
  /** O código do formulário de inscrição declarado no rascunho e ainda não gravado; nulo sem ele. */
  readonly codigoParaCriar: string | null;
}

export class PlanoDosCamposPressupostos {
  readonly gravado: FormularioDto | null;
  readonly conteudoGravado: ConteudoDoFormulario;
  readonly desejado: ConteudoDoFormulario;
  readonly faseDaInscricao: string | null;
  readonly codigoParaCriar: string | null;
  private readonly fatosDosOutros: readonly string[];
  private readonly citados: ReadonlySet<string>;
  private readonly catalogo: readonly FatoDoFormulario[];

  constructor(servidor: ProcessoSeletivoDto, entradas: EntradasDoPlano) {
    this.citados = entradas.citados;
    this.catalogo = entradas.catalogo;
    this.codigoParaCriar = entradas.codigoParaCriar;
    this.gravado = formularioDaInscricaoDoServidor(servidor);
    this.fatosDosOutros = fatosDosOutrosDoProcesso(servidor, this.gravado, entradas);
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
      fatosDeOutrosFormularios: this.fatosDosOutros,
    });
  }

  coletaTudo(): boolean {
    return this.desejado === this.conteudoGravado;
  }

  fatosNaoColetados(): readonly string[] {
    const coletados = new Set([...fatosColetadosPor(this.conteudoGravado), ...this.fatosDosOutros]);
    return [...this.citados].filter((codigo) => !coletados.has(codigo));
  }

  desconhecidosDoCatalogo(): readonly string[] {
    const conhecidos = new Set(this.catalogo.map((fato) => fato.codigo));
    return this.fatosNaoColetados().filter((codigo) => !conhecidos.has(codigo));
  }

  desfechoSemGravar(): CamposPressupostos | null {
    if (this.coletaTudo()) return { tipo: 'garantidos' };
    if (this.faseDaInscricao === null) return { tipo: 'semFaseDeInscricao' };
    if (this.gravado === null && this.codigoParaCriar === null) {
      return { tipo: 'semFormularioDeInscricao' };
    }
    return null;
  }

  cabecalhoParaCriar(): FormularioParaGravar & { readonly faseId: string } {
    if (this.faseDaInscricao === null) throw new Error('Fase de inscrição ausente');
    return {
      faseId: this.faseDaInscricao,
      obrigatorio: true,
      consequenciaDaFaltaDeEnvio: null,
      conteudo: { ...this.desejado, itens: [], grupos: [], termos: [] },
    };
  }

  gravacaoSobre(formulario: FormularioDto): {
    servidor: FormularioParaGravar;
    desejado: FormularioParaGravar & { readonly faseId: string };
  } {
    if (this.faseDaInscricao === null) throw new Error('Fase de inscrição ausente');
    const servidor = paraGravarDoServidor(formulario);
    return {
      servidor,
      desejado: {
        ...servidor,
        faseId: this.faseDaInscricao,
        conteudo: this.comOsCamposQueFaltam(servidor.conteudo),
      },
    };
  }
}

function idDaFaseDeInscricao(fases: ProcessoSeletivoDto['cronogramaFases']): string | null {
  return fases.find((fase) => fase.faseCanonica.coletaInscricao)?.id ?? null;
}

function fatosDosOutrosDoProcesso(
  servidor: ProcessoSeletivoDto,
  inscricao: FormularioDto | null,
  entradas: EntradasDoPlano,
): readonly string[] {
  return [
    ...new Set([
      ...fatosDosOutrosFormularios(servidor.formularios ?? [], inscricao?.codigo ?? ''),
      ...entradas.fatosDosOutrosFormularios,
    ]),
  ];
}
