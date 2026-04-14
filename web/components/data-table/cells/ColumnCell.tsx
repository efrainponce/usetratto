'use client'

import type { CellProps } from '../types'
import { TextCell }        from './TextCell'
import { NumberCell }      from './NumberCell'
import { DateCell }        from './DateCell'
import { SelectCell }      from './SelectCell'
import { MultiSelectCell } from './MultiSelectCell'
import { PeopleCell }      from './PeopleCell'
import { BooleanCell }     from './BooleanCell'
import { RelationCell }    from './RelationCell'
import { PhoneCell }       from './PhoneCell'
import { EmailCell }       from './EmailCell'
import { AutonumberCell }  from './AutonumberCell'
import { FileCell }        from './FileCell'
import { ButtonCell }      from './ButtonCell'
import { SignatureCell }   from './SignatureCell'
import { FormulaCell }     from './FormulaCell'
import { RollupCell }      from './RollupCell'

export function ColumnCell(props: CellProps) {
  switch (props.column.kind) {
    case 'text':        return <TextCell        {...props} />
    case 'number':      return <NumberCell      {...props} />
    case 'date':        return <DateCell        {...props} />
    case 'select':      return <SelectCell      {...props} />
    case 'multiselect': return <MultiSelectCell {...props} />
    case 'people':      return <PeopleCell      {...props} />
    case 'boolean':     return <BooleanCell     {...props} />
    case 'relation':    return <RelationCell    {...props} />
    case 'phone':       return <PhoneCell       {...props} />
    case 'email':       return <EmailCell       {...props} />
    case 'autonumber':  return <AutonumberCell  {...props} />
    case 'file':        return <FileCell        {...props} />
    case 'button':      return <ButtonCell      {...props} />
    case 'signature':   return <SignatureCell   {...props} />
    case 'formula':     return <FormulaCell     {...props} />
    case 'rollup':      return <RollupCell      {...props} />
    default:            return (
      <span className="block w-full px-2 py-1 text-[13px] text-gray-400 truncate">
        {props.value != null ? String(props.value) : '—'}
      </span>
    )
  }
}
