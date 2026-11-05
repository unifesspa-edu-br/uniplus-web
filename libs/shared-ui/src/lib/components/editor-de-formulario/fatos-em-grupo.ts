import { type UiComboboxGroup } from '../combobox/combobox';
import { MOTIVO_DA_PROTECAO_PENDENTE } from '../editor-de-condicoes/motivo-da-protecao-pendente';
import { type FatoDoFormulario } from './modelo/tipos';

/**
 * Os fatos sob um título só: o catálogo não os classifica, e a busca do campo é pelo nome. O fato
 * cuja proteção de dados ainda não foi aprovada aparece indisponível, com o motivo no rótulo.
 */
export function fatosEmGrupo(fatos: readonly FatoDoFormulario[]): readonly UiComboboxGroup[] {
  return [
    {
      label: 'Fatos do candidato',
      options: fatos.map((fato) =>
        fato.protecaoAprovada === false
          ? {
              value: fato.codigo,
              label: `${fato.nome} — ${MOTIVO_DA_PROTECAO_PENDENTE}`,
              disabled: true,
            }
          : { value: fato.codigo, label: fato.nome },
      ),
    },
  ];
}
