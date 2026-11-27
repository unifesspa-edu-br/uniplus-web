import type {
  FormularioDeInscricao,
  FormularioDoProcessoNoRascunho,
} from '../processo-seletivo.models';
import { todosOsCampos } from '@uniplus/shared-inscricao/formulario';
import { fatosCitadosPelaDerivacao } from '../passos/formulario/citantes-no-processo';
import { fatosColetadosPelaInscricao } from '../passos/formulario/fatos-coletados-da-inscricao';
import { ehDaInscricao, ehDaIsencao } from '../passos/formulario/obrigatoriedade-na-fase';
import type {
  FaseNoCronograma,
  FatoComFase,
  FormularioQueColeta,
  GrupoDaProducao,
  ProducaoDosFatos,
} from './producao-dos-fatos';

/** O que o processo do rascunho diz sobre a produção de cada fato. */
export function producaoDoRascunho(
  formulario: FormularioDeInscricao,
  fases: readonly FaseNoCronograma[],
  catalogo: readonly FatoComFase[],
): ProducaoDosFatos {
  return {
    fases,
    formularios: formulariosQueColetam(formulario, fases),
    derivacoes: derivacoesDoRascunho(formulario),
    catalogo: new Map(catalogo.map((fato) => [fato.codigo, fato])),
    grupos: gruposDoRascunho(formulario),
  };
}

function formulariosQueColetam(
  formulario: FormularioDeInscricao,
  fases: readonly FaseNoCronograma[],
): readonly FormularioQueColeta[] {
  return formulario.formularios.map((doRascunho) =>
    formularioNaProducao(
      doRascunho,
      fases.find((item) => item.codigo === doRascunho.faseCodigo),
    ),
  );
}

function formularioNaProducao(
  doRascunho: FormularioDoProcessoNoRascunho,
  fase: FaseNoCronograma | undefined,
): FormularioQueColeta {
  const daInscricao = ehDaInscricao(doRascunho, fase);
  return {
    codigo: doRascunho.codigo,
    faseCodigo: doRascunho.faseCodigo,
    daInscricao,
    daIsencao: ehDaIsencao(doRascunho, fase),
    fatos: fatosColetadosPeloFormulario(doRascunho, daInscricao),
  };
}

function fatosColetadosPeloFormulario(
  { conteudo }: FormularioDoProcessoNoRascunho,
  daInscricao: boolean,
): ReadonlySet<string> {
  return daInscricao
    ? fatosColetadosPelaInscricao(conteudo)
    : new Set(todosOsCampos(conteudo).map((campo) => campo.fatoCodigo));
}

function derivacoesDoRascunho(formulario: FormularioDeInscricao): ProducaoDosFatos['derivacoes'] {
  return new Map(
    formulario.derivacao.map((config) => [
      config.codigoFato,
      fatosCitadosPelaDerivacao(config.regras).filter((fato) => fato !== config.codigoFato),
    ]),
  );
}

function gruposDoRascunho(formulario: FormularioDeInscricao): ProducaoDosFatos['grupos'] {
  return new Map(
    formulario.formularios.flatMap((doRascunho) =>
      (doRascunho.conteudo.grupos ?? []).map((grupo): [string, GrupoDaProducao] => [
        grupo.codigo,
        {
          codigo: grupo.codigo,
          rotulo: grupo.rotulo,
          campos: grupo.subitens.map((campo) => campo.fatoCodigo),
        },
      ]),
    ),
  );
}
