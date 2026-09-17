import { Field, Select, TextInput } from '@/components/Form';
import { useCrews } from '@/features/crews/queries';

export interface RangeFilterValue {
  from: string;
  to: string;
  crewId: string;
}

interface RangeFilterProps {
  value: RangeFilterValue;
  onChange: (value: RangeFilterValue) => void;
  /** 額外的快捷按鈕（例如「本月」）。 */
  presets?: { label: string; apply: () => RangeFilterValue }[];
}

export function RangeFilter({ value, onChange, presets = [] }: RangeFilterProps) {
  const crewsQuery = useCrews();

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="起始日">
          {(id) => (
            <TextInput
              id={id}
              type="date"
              className="tnum"
              value={value.from}
              max={value.to}
              onChange={(event) => onChange({ ...value, from: event.target.value })}
            />
          )}
        </Field>
        <Field label="結束日">
          {(id) => (
            <TextInput
              id={id}
              type="date"
              className="tnum"
              value={value.to}
              min={value.from}
              onChange={(event) => onChange({ ...value, to: event.target.value })}
            />
          )}
        </Field>
      </div>

      <Field label="工班">
        {(id) => (
          <Select
            id={id}
            value={value.crewId}
            onChange={(event) => onChange({ ...value, crewId: event.target.value })}
          >
            <option value="">全部工班</option>
            {(crewsQuery.data ?? []).map((crew) => (
              <option key={crew.id} value={crew.id}>
                {crew.name}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {presets.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => onChange(preset.apply())}
              className="tap rounded-xl border border-line-strong px-3 text-sm font-semibold text-ink-soft hover:bg-surface-sunken"
            >
              {preset.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
