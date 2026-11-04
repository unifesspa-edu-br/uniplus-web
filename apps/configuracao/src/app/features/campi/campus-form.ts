import { FormControl, FormGroup, Validators } from '@angular/forms';
import {
  AtualizarCampusCommand,
  CampusDto,
  CriarCampusCommand,
} from '@uniplus/shared-data/configuracao';
import type { EnderecoEstruturado } from '@uniplus/shared-ui/components';
import {
  cidadeObrigatoriaValidator,
  enderecoEstruturadoDe,
  enderecoParaCommand,
} from '../../shared/endereco';
import { controlNameFromBackendField, nullIfBlank } from '../../shared/formulario';

export interface CampusForm {
  sigla: FormControl<string>;
  nome: FormControl<string>;
  codigoEmec: FormControl<string>;
  endereco: FormControl<EnderecoEstruturado | null>;
}

type ValoresDoCampus = ReturnType<FormGroup<CampusForm>['getRawValue']>;

export const CAMPUS_EM_BRANCO: ValoresDoCampus = {
  sigla: '',
  nome: '',
  codigoEmec: '',
  endereco: null,
};

const CONTROLES_DO_SERVIDOR: ReadonlySet<string> = new Set<keyof CampusForm>([
  'sigla',
  'nome',
  'codigoEmec',
]);

export function criarFormularioDeCampus(): FormGroup<CampusForm> {
  return new FormGroup<CampusForm>({
    sigla: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(50)],
    }),
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(250)],
    }),
    codigoEmec: new FormControl('', { nonNullable: true }),
    endereco: new FormControl<EnderecoEstruturado | null>(null, {
      validators: [cidadeObrigatoriaValidator],
    }),
  });
}

export function valoresDoCampus(campus: CampusDto): ValoresDoCampus {
  return {
    sigla: campus.sigla,
    nome: campus.nome,
    codigoEmec: campus.codigoEmec ?? '',
    endereco: enderecoEstruturadoDe(campus.cidade, campus.endereco),
  };
}

/** O controle do formulário que corresponde ao campo recusado pelo servidor, se houver. */
export function controleDoCampoDoServidor(field: string): keyof CampusForm | null {
  return controlNameFromBackendField<keyof CampusForm>(field, CONTROLES_DO_SERVIDOR);
}

export function comandoDeCriacao(valores: ValoresDoCampus): CriarCampusCommand {
  // A cidade é obrigatória (validator cidadeObrigatoria) e o submit está bloqueado sem ela. Os
  // três campos seguem como vêm de enderecoParaCommand: o contrato os aceita nulos, então a
  // ausência chega à validação de domínio em vez de ser mascarada por uma string vazia.
  const { cidadeCodigoIbge, cidadeNome, cidadeUf, endereco } = enderecoParaCommand(
    valores.endereco,
  );
  return {
    sigla: nullIfBlank(valores.sigla),
    nome: nullIfBlank(valores.nome),
    codigoEmec: nullIfBlank(valores.codigoEmec),
    cidadeCodigoIbge,
    cidadeNome,
    cidadeUf,
    endereco,
  };
}

export function comandoDeAtualizacao(id: string, valores: ValoresDoCampus): AtualizarCampusCommand {
  return { id, ...comandoDeCriacao(valores) };
}
