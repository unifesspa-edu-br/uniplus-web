import { FormControl, FormGroup, Validators } from '@angular/forms';
import {
  AtualizarInstituicaoCommand,
  CriarInstituicaoCommand,
  InstituicaoDto,
} from '@uniplus/shared-data/organizacao';
import type { EnderecoEstruturado } from '@uniplus/shared-ui/components';
import { enderecoEstruturadoDe, enderecoParaCommand } from '../../shared/endereco';
import { controlNameFromBackendField, nullIfBlank } from '../../shared/formulario';

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
  new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(maximo)],
  });

const opcional = (maximo: number): FormControl<string> =>
  new FormControl('', { nonNullable: true, validators: [Validators.maxLength(maximo)] });

export function criarFormularioDeInstituicao(): FormGroup<InstituicaoForm> {
  return new FormGroup<InstituicaoForm>({
    nome: obrigatorio(LIMITE.nome),
    sigla: obrigatorio(LIMITE.sigla),
    codigoEmec: obrigatorio(LIMITE.codigoEmec),
    cnpj: opcional(LIMITE.curto),
    organizacaoAcademica: obrigatorio(LIMITE.classificacao),
    categoriaAdministrativa: obrigatorio(LIMITE.classificacao),
    mantenedora: opcional(LIMITE.nome),
    codigoMantenedoraEmec: opcional(LIMITE.codigoEmec),
    situacao: opcional(LIMITE.curto),
    atoCredenciamento: opcional(LIMITE.longo),
    atoRecredenciamento: opcional(LIMITE.longo),
    conceitoInstitucional: opcional(LIMITE.curto),
    igc: opcional(LIMITE.curto),
    website: opcional(LIMITE.medio),
    endereco: new FormControl<EnderecoEstruturado | null>(null),
    unidadeRaizId: new FormControl('', { nonNullable: true }),
  });
}

export function valoresEmBrancoDaInstituicao(): ValoresDaInstituicao {
  return {
    nome: '',
    sigla: '',
    codigoEmec: '',
    cnpj: '',
    organizacaoAcademica: '',
    categoriaAdministrativa: '',
    mantenedora: '',
    codigoMantenedoraEmec: '',
    situacao: '',
    atoCredenciamento: '',
    atoRecredenciamento: '',
    conceitoInstitucional: '',
    igc: '',
    website: '',
    endereco: null,
    unidadeRaizId: '',
  };
}

const vazioSeNulo = (valor: string | null | undefined): string => valor ?? '';

export function valoresDaInstituicao(instituicao: InstituicaoDto): ValoresDaInstituicao {
  return {
    nome: instituicao.nome,
    sigla: instituicao.sigla,
    codigoEmec: instituicao.codigoEmec,
    cnpj: vazioSeNulo(instituicao.cnpj),
    organizacaoAcademica: instituicao.organizacaoAcademica,
    categoriaAdministrativa: instituicao.categoriaAdministrativa,
    mantenedora: vazioSeNulo(instituicao.mantenedora),
    codigoMantenedoraEmec: vazioSeNulo(instituicao.codigoMantenedoraEmec),
    situacao: vazioSeNulo(instituicao.situacao),
    atoCredenciamento: vazioSeNulo(instituicao.atoCredenciamento),
    atoRecredenciamento: vazioSeNulo(instituicao.atoRecredenciamento),
    conceitoInstitucional: vazioSeNulo(instituicao.conceitoInstitucional),
    igc: vazioSeNulo(instituicao.igc),
    website: vazioSeNulo(instituicao.website),
    endereco: enderecoEstruturadoDe(instituicao.cidade, instituicao.endereco),
    unidadeRaizId: vazioSeNulo(instituicao.unidadeRaizId),
  };
}

/** O controle do formulário que corresponde ao campo recusado pelo servidor, se houver. */
export function controleDoCampoDoServidor(field: string): keyof InstituicaoForm | null {
  return controlNameFromBackendField<keyof InstituicaoForm>(field, CAMPOS_DO_SERVIDOR);
}

export function comandoDeCriacao(form: FormGroup<InstituicaoForm>): CriarInstituicaoCommand {
  const valor = form.getRawValue();
  return {
    codigoEmec: valor.codigoEmec.trim(),
    nome: valor.nome.trim(),
    sigla: valor.sigla.trim(),
    organizacaoAcademica: valor.organizacaoAcademica.trim(),
    categoriaAdministrativa: valor.categoriaAdministrativa.trim(),
    cnpj: nullIfBlank(valor.cnpj),
    mantenedora: nullIfBlank(valor.mantenedora),
    codigoMantenedoraEmec: nullIfBlank(valor.codigoMantenedoraEmec),
    situacao: nullIfBlank(valor.situacao),
    atoCredenciamento: nullIfBlank(valor.atoCredenciamento),
    atoRecredenciamento: nullIfBlank(valor.atoRecredenciamento),
    conceitoInstitucional: nullIfBlank(valor.conceitoInstitucional),
    igc: nullIfBlank(valor.igc),
    website: nullIfBlank(valor.website),
    ...enderecoParaCommand(valor.endereco),
    unidadeRaizId: nullIfBlank(valor.unidadeRaizId),
  };
}

export function comandoDeAtualizacao(
  id: string,
  form: FormGroup<InstituicaoForm>,
): AtualizarInstituicaoCommand {
  return { id, ...comandoDeCriacao(form) };
}
