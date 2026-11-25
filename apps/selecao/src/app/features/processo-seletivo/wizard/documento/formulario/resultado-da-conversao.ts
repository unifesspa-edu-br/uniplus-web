import type { DocumentoDaConfiguracaoFormulario } from '@uniplus/shared-data/selecao';
import type {
  ConteudoDoFormulario,
  CamposEditadosDoFormulario,
} from '@uniplus/shared-ui/components';
import type { ReferenciasDosTermosDoFormulario } from './referencias-dos-termos';

export interface CatalogosDaConversaoDoFormulario {
  readonly fatos: readonly { readonly codigo: string; readonly tipoDeCampo: string }[] | null;
  readonly termos: ReferenciasDosTermosDoFormulario | null;
}

export interface ImpedimentoDaConversaoDoFormulario {
  readonly caminho: string;
  readonly mensagem: string;
}

export type ResultadoDaConversaoDoFormulario =
  | {
      readonly ok: true;
      readonly formulario: DocumentoDaConfiguracaoFormulario;
      readonly conteudo: ConteudoDoFormulario;
      readonly camposEditados: CamposEditadosDoFormulario;
    }
  | { readonly ok: false; readonly impedimentos: readonly ImpedimentoDaConversaoDoFormulario[] };
