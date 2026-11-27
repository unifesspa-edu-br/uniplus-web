import { FormControl, FormGroup, Validators } from '@angular/forms';
import {
  AtualizarInstituicaoCommand,
  CriarInstituicaoCommand,
  InstituicaoDto,
} from '@uniplus/shared-data/organizacao';
import type { EnderecoEstruturado } from '@uniplus/shared-ui/components';
import { enderecoEstruturadoDe, enderecoParaCommand } from '../../shared/endereco';
import { controleDeTexto, controlNameFromBackendField, nullIfBlank } from '../../shared/formulario';

/** Vendor code do 409 de segunda criação: a plataforma atende uma única instituição. */
export const INSTITUICAO_JA_EXISTE_CODE = 'uniplus.organizacao.instituicao.ja_existe';

/** Vendor code do 404 de edição: a instituição que a tela mostra já não existe no servidor. */
export const INSTITUICAO_NAO_ENCONTRADA_CODE = 'uniplus.organizacao.instituicao.nao_encontrada';

/** Vendor codes dos 422 de unidade raiz inválida, que apontam para o mesmo controle. */
export const UNIDADE_RAIZ_INVALIDA_CODES: ReadonlySet<string> = new Set([
  'uniplus.organizacao.instituicao.unidade_raiz_nao_encontrada',
  'uniplus.organizacao.instituicao.unidade_raiz_nao_eh_reitoria',
]);

export interface InstituicaoForm {
  nome: FormControl<string>;
  sigla: FormControl<string>;
  codigoEmec: FormControl<string>;
  cnpj: FormControl<string>;
  organizacaoAcademica: FormControl<string>;
  categoriaAdministrativa: FormControl<string>;
  mantenedora: FormControl<string>;
  codigoMantenedoraEmec: FormControl<string>;
  situacao: FormControl<string>;
  atoCredenciamento: FormControl<string>;
  atoRecredenciamento: FormControl<string>;
  conceitoInstitucional: FormControl<string>;
  igc: FormControl<string>;
  website: FormControl<string>;
  endereco: FormControl<EnderecoEstruturado | null>;
  unidadeRaizId: FormControl<string>;
}

export type ValoresDaInstituicao = ReturnType<FormGroup<InstituicaoForm>['getRawValue']>;

/** Limites de tamanho do Domain `Instituicao` (uniplus-api). */
const LIMITE = {
  codigoEmec: 20,
  nome: 250,
  sigla: 50,
  classificacao: 100,
  curto: 100,
  medio: 255,
  longo: 500,
} as const;

const CAMPOS_DO_SERVIDOR: ReadonlySet<string> = new Set<keyof InstituicaoForm>([
  'nome',
  'sigla',
  'codigoEmec',
  'cnpj',
  'organizacaoAcademica',
  'categoriaAdministrativa',
  'mantenedora',
  'codigoMantenedoraEmec',
  'situacao',
  'atoCredenciamento',
  'atoRecredenciamento',
  'conceitoInstitucional',
  'igc',
  'website',
  'unidadeRaizId',
]);

const obrigatorio = (maximo: number): FormControl<string> =>
  controleDeTexto(Validators.required, Validators.maxLength(maximo));

const opcional = (maximo: number): FormControl<string> =>
  controleDeTexto(Validators.maxLength(maximo));

const vazioSeNulo = (valor: string | null | undefined): string => valor ?? '';

const controlesDeIdentificacao = () => ({
  nome: obrigatorio(LIMITE.nome),
  sigla: obrigatorio(LIMITE.sigla),
  codigoEmec: obrigatorio(LIMITE.codigoEmec),
  cnpj: opcional(LIMITE.curto),
});

const controlesDeClassificacao = () => ({
  organizacaoAcademica: obrigatorio(LIMITE.classificacao),
  categoriaAdministrativa: obrigatorio(LIMITE.classificacao),
});

const controlesDeMantenedora = () => ({
  mantenedora: opcional(LIMITE.nome),
  codigoMantenedoraEmec: opcional(LIMITE.codigoEmec),
});

const controlesDeSituacaoRegulatoria = () => ({
  situacao: opcional(LIMITE.curto),
  atoCredenciamento: opcional(LIMITE.longo),
  atoRecredenciamento: opcional(LIMITE.longo),
});

const controlesDeIndicadores = () => ({
  conceitoInstitucional: opcional(LIMITE.curto),
  igc: opcional(LIMITE.curto),
});

const controlesDeContato = () => ({
  website: opcional(LIMITE.medio),
  endereco: new FormControl<EnderecoEstruturado | null>(null),
});

export function criarFormularioDeInstituicao(): FormGroup<InstituicaoForm> {
  return new FormGroup<InstituicaoForm>({
    ...controlesDeIdentificacao(),
    ...controlesDeClassificacao(),
    ...controlesDeMantenedora(),
    ...controlesDeSituacaoRegulatoria(),
    ...controlesDeIndicadores(),
    ...controlesDeContato(),
    unidadeRaizId: controleDeTexto(),
  });
}

export function valoresEmBrancoDaInstituicao(): ValoresDaInstituicao {
  return criarFormularioDeInstituicao().getRawValue();
}

const valoresDeIdentificacao = (instituicao: InstituicaoDto) => ({
  nome: instituicao.nome,
  sigla: instituicao.sigla,
  codigoEmec: instituicao.codigoEmec,
  cnpj: vazioSeNulo(instituicao.cnpj),
});

const valoresDeClassificacao = (instituicao: InstituicaoDto) => ({
  organizacaoAcademica: instituicao.organizacaoAcademica,
  categoriaAdministrativa: instituicao.categoriaAdministrativa,
});

const valoresDeMantenedora = (instituicao: InstituicaoDto) => ({
  mantenedora: vazioSeNulo(instituicao.mantenedora),
  codigoMantenedoraEmec: vazioSeNulo(instituicao.codigoMantenedoraEmec),
});

const valoresDeSituacaoRegulatoria = (instituicao: InstituicaoDto) => ({
  situacao: vazioSeNulo(instituicao.situacao),
  atoCredenciamento: vazioSeNulo(instituicao.atoCredenciamento),
  atoRecredenciamento: vazioSeNulo(instituicao.atoRecredenciamento),
});

const valoresDeIndicadores = (instituicao: InstituicaoDto) => ({
  conceitoInstitucional: vazioSeNulo(instituicao.conceitoInstitucional),
  igc: vazioSeNulo(instituicao.igc),
});

const valoresDeContato = (instituicao: InstituicaoDto) => ({
  website: vazioSeNulo(instituicao.website),
  endereco: enderecoEstruturadoDe(instituicao.cidade, instituicao.endereco),
});

export function valoresDaInstituicao(instituicao: InstituicaoDto): ValoresDaInstituicao {
  return {
    ...valoresDeIdentificacao(instituicao),
    ...valoresDeClassificacao(instituicao),
    ...valoresDeMantenedora(instituicao),
    ...valoresDeSituacaoRegulatoria(instituicao),
    ...valoresDeIndicadores(instituicao),
    ...valoresDeContato(instituicao),
    unidadeRaizId: vazioSeNulo(instituicao.unidadeRaizId),
  };
}

/** O controle do formulário que corresponde ao campo recusado pelo servidor, se houver. */
export function controleDoCampoDoServidor(field: string): keyof InstituicaoForm | null {
  return controlNameFromBackendField<keyof InstituicaoForm>(field, CAMPOS_DO_SERVIDOR);
}

const comandoDeIdentificacao = (valor: ValoresDaInstituicao) => ({
  codigoEmec: valor.codigoEmec.trim(),
  nome: valor.nome.trim(),
  sigla: valor.sigla.trim(),
  cnpj: nullIfBlank(valor.cnpj),
});

const comandoDeClassificacao = (valor: ValoresDaInstituicao) => ({
  organizacaoAcademica: valor.organizacaoAcademica.trim(),
  categoriaAdministrativa: valor.categoriaAdministrativa.trim(),
});

const comandoDeMantenedora = (valor: ValoresDaInstituicao) => ({
  mantenedora: nullIfBlank(valor.mantenedora),
  codigoMantenedoraEmec: nullIfBlank(valor.codigoMantenedoraEmec),
});

const comandoDeSituacaoRegulatoria = (valor: ValoresDaInstituicao) => ({
  situacao: nullIfBlank(valor.situacao),
  atoCredenciamento: nullIfBlank(valor.atoCredenciamento),
  atoRecredenciamento: nullIfBlank(valor.atoRecredenciamento),
});

const comandoDeIndicadores = (valor: ValoresDaInstituicao) => ({
  conceitoInstitucional: nullIfBlank(valor.conceitoInstitucional),
  igc: nullIfBlank(valor.igc),
});

const comandoDeContato = (valor: ValoresDaInstituicao) => ({
  website: nullIfBlank(valor.website),
  ...enderecoParaCommand(valor.endereco),
});

export function comandoDeCriacao(form: FormGroup<InstituicaoForm>): CriarInstituicaoCommand {
  const valor = form.getRawValue();
  return {
    ...comandoDeIdentificacao(valor),
    ...comandoDeClassificacao(valor),
    ...comandoDeMantenedora(valor),
    ...comandoDeSituacaoRegulatoria(valor),
    ...comandoDeIndicadores(valor),
    ...comandoDeContato(valor),
    unidadeRaizId: nullIfBlank(valor.unidadeRaizId),
  };
}

export function comandoDeAtualizacao(
  id: string,
  form: FormGroup<InstituicaoForm>,
): AtualizarInstituicaoCommand {
  return { id, ...comandoDeCriacao(form) };
}
