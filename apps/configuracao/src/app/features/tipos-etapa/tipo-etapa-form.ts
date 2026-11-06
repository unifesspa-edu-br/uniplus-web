import { FormControl, FormGroup, Validators } from '@angular/forms';
import {
  TipoEtapaDto,
  type AtualizarTipoEtapaCommand,
  type CriarTipoEtapaCommand,
} from '@uniplus/shared-data/configuracao';
import { controlNameFromBackendField, nullIfBlank } from '../../shared/formulario';

export interface EtapaForm {
  codigo: FormControl<string>;
  nome: FormControl<string>;
  admitePontuacao: FormControl<boolean>;
  admiteEliminacao: FormControl<boolean>;
  descricao: FormControl<string>;
}

type ValoresDaEtapa = ReturnType<FormGroup<EtapaForm>['getRawValue']>;

const CAMPOS: ReadonlySet<string> = new Set<keyof EtapaForm>([
  'codigo',
  'nome',
  'admitePontuacao',
  'admiteEliminacao',
  'descricao',
]);

export function criarFormularioDeEtapa(): FormGroup<EtapaForm> {
  return new FormGroup<EtapaForm>({
    codigo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(64)],
    }),
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    admitePontuacao: new FormControl(true, { nonNullable: true }),
    admiteEliminacao: new FormControl(true, { nonNullable: true }),
    descricao: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(1000)],
    }),
  });
}

export function valoresEmBrancoDaEtapa(): ValoresDaEtapa {
  return {
    codigo: '',
    nome: '',
    admitePontuacao: true,
    admiteEliminacao: true,
    descricao: '',
  };
}

export function valoresDaEtapa(tipo: TipoEtapaDto): ValoresDaEtapa {
  return {
    codigo: tipo.codigo,
    nome: tipo.nome,
    admitePontuacao: tipo.admitePontuacao,
    admiteEliminacao: tipo.admiteEliminacao,
    descricao: tipo.descricao ?? '',
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
    descricao: nullIfBlank(valor.descricao),
  };
}
