'use client';

import { useState } from 'react';

type FormFields = {
  nombre: string;
  email: string;
  telefono: string;
  mensaje: string;
};

type FormErrors = Record<keyof FormFields, string>;
type FormTouched = Record<keyof FormFields, boolean>;

const INITIAL_FIELDS: FormFields = { nombre: '', email: '', telefono: '', mensaje: '' };
const INITIAL_ERRORS: FormErrors = { nombre: '', email: '', telefono: '', mensaje: '' };
const INITIAL_TOUCHED: FormTouched = { nombre: false, email: false, telefono: false, mensaje: false };

function validate(field: keyof FormFields, value: string): string {
  switch (field) {
    case 'nombre':
      if (!value.trim()) return 'El nombre es requerido';
      if (value.trim().length < 2) return 'El nombre debe tener al menos 2 caracteres';
      return '';
    case 'email':
      if (!value.trim()) return 'El email es requerido';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'El email no tiene formato válido';
      return '';
    case 'telefono':
      if (!value) return '';
      if (!/^\d{10}$/.test(value)) return 'El teléfono debe tener exactamente 10 dígitos';
      return '';
    case 'mensaje':
      if (!value.trim()) return 'El mensaje es requerido';
      if (value.trim().length < 10) return 'El mensaje debe tener al menos 10 caracteres';
      if (value.length > 500) return 'El mensaje no puede superar 500 caracteres';
      return '';
  }
}

function isFormValid(fields: FormFields, errors: FormErrors): boolean {
  const requiredFilled = fields.nombre && fields.email && fields.mensaje;
  const noErrors = Object.values(errors).every((e) => e === '');
  return Boolean(requiredFilled && noErrors);
}

export function ContactForm() {
  const [fields, setFields] = useState<FormFields>(INITIAL_FIELDS);
  const [errors, setErrors] = useState<FormErrors>(INITIAL_ERRORS);
  const [touched, setTouched] = useState<FormTouched>(INITIAL_TOUCHED);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (field: keyof FormFields, value: string) => {
    const error = validate(field, value);
    setFields((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: error }));
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validar todos los campos al submit
    const allErrors: FormErrors = {
      nombre: validate('nombre', fields.nombre),
      email: validate('email', fields.email),
      telefono: validate('telefono', fields.telefono),
      mensaje: validate('mensaje', fields.mensaje),
    };
    setErrors(allErrors);
    setTouched({ nombre: true, email: true, telefono: true, mensaje: true });

    if (!isFormValid(fields, allErrors)) return;

    setSubmitted(true);
    setFields(INITIAL_FIELDS);
    setErrors(INITIAL_ERRORS);
    setTouched(INITIAL_TOUCHED);

    setTimeout(() => setSubmitted(false), 4000);
  };

  const fieldClass = (field: keyof FormFields) => {
    if (!touched[field]) return 'border-gray-300 dark:border-gray-600';
    if (errors[field]) return 'border-red-500 focus:ring-red-500';
    if (fields[field]) return 'border-green-500 focus:ring-green-500';
    return 'border-gray-300 dark:border-gray-600';
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {submitted && (
        <div className="p-4 bg-green-50 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg text-green-700 dark:text-green-400 text-sm font-medium">
          ✅ Mensaje enviado correctamente.
        </div>
      )}

      {/* Nombre */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Nombre <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={fields.nombre}
          onChange={(e) => handleChange('nombre', e.target.value)}
          placeholder="Tu nombre completo"
          className={`w-full px-3 py-2 rounded-md border text-sm bg-white dark:bg-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 transition-colors ${fieldClass('nombre')}`}
        />
        {touched.nombre && errors.nombre && (
          <p className="text-xs text-red-500">{errors.nombre}</p>
        )}
        {touched.nombre && !errors.nombre && fields.nombre && (
          <p className="text-xs text-green-500">✓ Nombre válido</p>
        )}
      </div>

      {/* Email */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Email <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={fields.email}
          onChange={(e) => handleChange('email', e.target.value)}
          placeholder="tu@email.com"
          className={`w-full px-3 py-2 rounded-md border text-sm bg-white dark:bg-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 transition-colors ${fieldClass('email')}`}
        />
        {touched.email && errors.email && (
          <p className="text-xs text-red-500">{errors.email}</p>
        )}
        {touched.email && !errors.email && fields.email && (
          <p className="text-xs text-green-500">✓ Email válido</p>
        )}
      </div>

      {/* Teléfono */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Teléfono <span className="text-gray-400 text-xs">(opcional)</span>
        </label>
        <input
          type="text"
          value={fields.telefono}
          onChange={(e) => handleChange('telefono', e.target.value.replace(/\D/g, '').slice(0, 10))}
          placeholder="10 dígitos"
          className={`w-full px-3 py-2 rounded-md border text-sm bg-white dark:bg-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 transition-colors ${fieldClass('telefono')}`}
        />
        {touched.telefono && errors.telefono && (
          <p className="text-xs text-red-500">{errors.telefono}</p>
        )}
        {touched.telefono && !errors.telefono && fields.telefono && (
          <p className="text-xs text-green-500">✓ Teléfono válido</p>
        )}
      </div>

      {/* Mensaje */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Mensaje <span className="text-red-500">*</span>
        </label>
        <textarea
          value={fields.mensaje}
          onChange={(e) => handleChange('mensaje', e.target.value)}
          placeholder="Escribe tu mensaje..."
          rows={4}
          className={`w-full px-3 py-2 rounded-md border text-sm bg-white dark:bg-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 transition-colors resize-none ${fieldClass('mensaje')}`}
        />
        <div className="flex justify-between items-center">
          <div>
            {touched.mensaje && errors.mensaje && (
              <p className="text-xs text-red-500">{errors.mensaje}</p>
            )}
            {touched.mensaje && !errors.mensaje && fields.mensaje && (
              <p className="text-xs text-green-500">✓ Mensaje válido</p>
            )}
          </div>
          <span className={`text-xs ${fields.mensaje.length > 450 ? 'text-red-500' : 'text-gray-400'}`}>
            {fields.mensaje.length}/500
          </span>
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={!isFormValid(fields, errors)}
        className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white disabled:text-gray-500 rounded-md text-sm font-medium transition-colors"
      >
        Enviar mensaje
      </button>
    </form>
  );
}