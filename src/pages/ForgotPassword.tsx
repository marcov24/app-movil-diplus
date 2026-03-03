import { useState, type FormEvent } from 'react';
import { useHistory } from 'react-router-dom';
import { Mail, ArrowLeft, Loader2 } from 'lucide-react';
import { IonButton } from '@ionic/react';
import logoBg from '../assets/logo.png';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const history = useHistory();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // TODO: Implement actual password reset API call
      // await sendResetCode(email);
      await new Promise(resolve => setTimeout(resolve, 1500));
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Error al enviar el código');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen relative overflow-hidden bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
      <div className="w-full max-w-sm p-8 z-10 flex flex-col items-center">
        {/* Logo */}
        <div className="mb-10 w-full flex justify-center">
          <img src={logoBg} alt="Logo" className="h-20 object-contain" />
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Recuperar contraseña
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-8">
          Ingresa tu correo para recibir un código de verificación
        </p>

        {sent ? (
          <div className="w-full space-y-6">
            <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-center">
              <p className="text-green-700 dark:text-green-300 text-sm font-medium">
                Se ha enviado un código de verificación a <strong>{email}</strong>
              </p>
            </div>
            <IonButton
              expand="block"
              onClick={() => history.push('/admin/login')}
              style={{ '--background': '#3eaa76ff', '--background-hover': '#0ea85e', '--border-radius': '0.75rem', height: '48px', fontWeight: 'bold', fontSize: '16px' }}
            >
              Volver al inicio de sesión
            </IonButton>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="w-full space-y-5">
            {/* Email */}
            <div className="float-group float-group--icon">
              <input
                type="email"
                id="reset-email"
                className="float-input float-input--glass pl-12"
                placeholder=" "
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
              <div className="float-icon"><Mail size={18} /></div>
              <label className="float-label" htmlFor="reset-email">Correo electrónico</label>
            </div>

            {/* Error message */}
            {error && (
              <div className="p-3 rounded-lg text-sm text-center font-medium bg-red-500/80 text-white">
                {error}
              </div>
            )}

            {/* Submit button */}
            <div className="pt-2 w-full">
              <IonButton
                type="submit"
                expand="block"
                disabled={loading}
                className="w-full tracking-wider shadow-lg"
                style={{ '--background': '#3eaa76ff', '--background-hover': '#0ea85e', '--border-radius': '0.75rem', height: '48px', fontWeight: 'bold', fontSize: '16px' } as any}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'ENVIAR CÓDIGO'
                )}
              </IonButton>
            </div>
          </form>
        )}

        {/* Back to login */}
        <button
          onClick={() => history.push('/admin/login')}
          className="mt-10 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 active:opacity-70 transition-colors min-h-[44px] flex items-center gap-2"
        >
          <ArrowLeft size={16} />
          Volver al inicio de sesión
        </button>
      </div>
    </div>
  );
}
