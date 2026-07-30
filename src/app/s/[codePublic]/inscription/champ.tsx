'use client';

import { useId } from 'react';

interface Props {
  label: string;
  name: string;
  type?: 'text' | 'email' | 'tel';
  inputMode?: 'email' | 'tel' | 'text';
  autoComplete?: string;
  placeholder?: string;
  defaultValue?: string;
  erreur?: string;
  requis?: boolean;
}

export function Champ({ label, name, type = 'text', inputMode, autoComplete, placeholder, defaultValue, erreur, requis }: Props) {
  const id = useId();
  const idErreur = `${id}-erreur`;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[length:var(--taille-md)] text-[color:var(--gris-800)]">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={requis}
        aria-invalid={erreur ? true : undefined}
        aria-describedby={erreur ? idErreur : undefined}
      />
      {erreur ? (
        <p id={idErreur} role="alert" className="text-[length:var(--taille-sm)] text-[color:var(--gris-900)]">
          {erreur}
        </p>
      ) : null}
    </div>
  );
}
