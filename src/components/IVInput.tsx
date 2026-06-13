import { NumberInput } from '@mantine/core';

interface IVInputProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  id?: string;
}

export function IVInput({ label, value, onChange, id }: IVInputProps) {
  return (
    <NumberInput
      id={id}
      label={label}
      value={value}
      onChange={(val) => {
        const num = typeof val === 'number' ? val : parseInt(String(val), 10);
        onChange(isNaN(num) ? 0 : Math.min(31, Math.max(0, num)));
      }}
      onBlur={(e) => {
        const num = parseInt(e.currentTarget.value, 10);
        onChange(isNaN(num) ? 0 : Math.min(31, Math.max(0, num)));
      }}
      min={0}
      max={31}
      step={1}
      clampBehavior="blur"
      aria-label={label}
      allowDecimal={false}
    />
  );
}
