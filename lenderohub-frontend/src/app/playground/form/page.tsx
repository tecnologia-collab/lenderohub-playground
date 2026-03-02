import { ContactForm } from '@/components/playground/contact-form';

export default function FormPlaygroundPage() {
  return (
    <div className="max-w-lg mx-auto p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Formulario — Demo</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Validación en tiempo real con mensajes de error.
        </p>
      </div>
      <ContactForm />
    </div>
  );
}