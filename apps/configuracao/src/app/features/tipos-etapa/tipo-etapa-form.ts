import { FormControl, FormGroup, Validators } from '@angular/forms';
import {
  TipoEtapaDto,
  type AtualizarTipoEtapaCommand,
  type CriarTipoEtapaCommand,
} from '@uniplus/shared-data/configuracao';
import {
  controlNameFromBackendField,
  controleDeMarca,
  controleDeTexto,
  nullIfBlank,
} from '../../shared/formulario';

export interface EtapaForm {
  codigo: FormControl<string>;
  nome: FormControl<string>;
  admitePontuacao: FormControl<boolean>;
  admiteEliminacao: FormControl<boolean>;
  exigeCorrecaoIndependente: FormControl<boolean>;
  descricao: FormControl<string>;
  /** Códigos dos conceitos admitidos: a API exige a lista a cada gravação, ainda que vazia. */
  conceitosAdmitidos: FormControl<readonly string[]>;
}

type ValoresDaEtapa = ReturnType<FormGroup<EtapaForm>['getRawValue']>;

const CAMPOS: ReadonlySet<string> = new Set<keyof EtapaForm>([
  'codigo',
  'nome',
  'admitePontuacao',
  'admiteEliminacao',
  'exigeCorrecaoIndependente',
  'descricao',
  'conceitosAdmitidos',
]);

export function criarFormularioDeEtapa(): FormGroup<EtapaForm> {
  return new FormGroup<EtapaForm>({
    codigo: controleDeTexto(Validators.required, Validators.maxLength(64)),
    nome: controleDeTexto(Validators.required, Validators.maxLength(200)),
    admitePontuacao: controleDeMarca(true),
    admiteEliminacao: controleDeMarca(true),
    exigeCorrecaoIndependente: controleDeMarca(false),
    descricao: controleDeTexto(Validators.maxLength(1000)),
    conceitosAdmitidos: new FormControl<readonly string[]>([], { nonNullable: true }),
  });
}

export function valoresEmBrancoDaEtapa(): ValoresDaEtapa {
  return {
    codigo: '',
    nome: '',
    admitePontuacao: true,
    admiteEliminacao: true,
    exigeCorrecaoIndependente: false,
    descricao: '',
    conceitosAdmitidos: [],
  };
}

export function valoresDaEtapa(tipo: TipoEtapaDto): ValoresDaEtapa {
  return {
    codigo: tipo.codigo,
    nome: tipo.nome,
    admitePontuacao: tipo.admitePontuacao,
    admiteEliminacao: tipo.admiteEliminacao,
    exigeCorrecaoIndependente: tipo.exigeCorrecaoIndependente,
    descricao: tipo.descricao ?? '',
    conceitosAdmitidos: tipo.conceitosAdmitidos.map((conceito) => conceito.codigo),
  };
}

export function controleDoCampoDoServidor(field: string): keyof EtapaForm | null {
  return controlNameFromBackendField<keyof EtapaForm>(field, CAMPOS);
}

export function comandoDeCriacao(form: FormGroup<EtapaForm>): CriarTipoEtapaCommand {
  const valor = form.getRawValue();
  return {
    codigo: valor.codigo.trim(),
    nome: valor.nome.trim(),
    admitePontuacao: valor.admitePontuacao,
    admiteEliminacao: valor.admiteEliminacao,
    exigeCorrecaoIndependente: valor.exigeCorrecaoIndependente,
    conceitosAdmitidos: [...valor.conceitosAdmitidos],
    descricao: nullIfBlank(valor.descricao),
  };
}

export function comandoDeAtualizacao(
  id: string,
  form: FormGroup<EtapaForm>,
): AtualizarTipoEtapaCommand {
  const valor = form.getRawValue();
  return {
    id,
    nome: valor.nome.trim(),
    admitePontuacao: valor.admitePontuacao,
    admiteEliminacao: valor.admiteEliminacao,
    exigeCorrecaoIndependente: valor.exigeCorrecaoIndependente,
    conceitosAdmitidos: [...valor.conceitosAdmitidos],
    descricao: nullIfBlank(valor.descricao),
  };
}
