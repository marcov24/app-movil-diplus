import { useState, type FormEvent } from 'react';
import { useHistory } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, User, Loader2 } from 'lucide-react';
import { IonButton, IonIcon } from '@ionic/react';
import { logoGoogle, logoFacebook } from 'ionicons/icons';
import logoBg from '../assets/logo.png';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const history = useHistory();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      // TODO: Implement actual signup API call
      // await signup(name, email, password);
      await new Promise(resolve => setTimeout(resolve, 1500));
      history.push('/admin/login');
    } catch (err: any) {
      setError(err.message || 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen relative overflow-hidden bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
      <div className="w-full max-w-sm p-8 z-10 flex flex-col items-center">
        {/* Logo */}
        <div className="mb-8 w-full flex justify-center">
          <img src={logoBg} alt="Logo" className="h-20 object-contain" />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          {/* Name */}
          <div className="float-group float-group--icon">
            <input
              type="text"
              id="signup-name"
              className="float-input float-input--glass pl-12"
              placeholder=" "
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
            />
            <div className="float-icon"><User size={18} /></div>
            <label className="float-label" htmlFor="signup-name">Usuario</label>
          </div>

          {/* Email */}
          <div className="float-group float-group--icon">
            <input
              type="email"
              id="signup-email"
              className="float-input float-input--glass pl-12"
              placeholder=" "
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
            <div className="float-icon"><Mail size={18} /></div>
            <label className="float-label" htmlFor="signup-email">Correo electrónico</label>
          </div>

          {/* Password */}
          <div className="float-group float-group--icon">
            <input
              type={showPassword ? "text" : "password"}
              id="signup-password"
              className="float-input float-input--glass pl-12 pr-12"
              placeholder=" "
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
            <div className="float-icon"><Lock size={18} /></div>
            <label className="float-label" htmlFor="signup-password">Contraseña</label>
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 active:scale-95 rounded-full z-10"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {/* Confirm Password */}
          <div className="float-group float-group--icon">
            <input
              type={showConfirmPassword ? "text" : "password"}
              id="signup-confirm-password"
              className="float-input float-input--glass pl-12 pr-12"
              placeholder=" "
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
            />
            <div className="float-icon"><Lock size={18} /></div>
            <label className="float-label" htmlFor="signup-confirm-password">Confirmar contraseña</label>
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 active:scale-95 rounded-full z-10"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
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
                  Registrando...
                </>
              ) : (
                'REGISTRARSE'
              )}
            </IonButton>
          </div>
        </form>

        {/* Social signup divider */}
        <div className="w-full mt-8">
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-gray-700"></div>
            </div>
            <div className="relative px-3 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-950">
              O registrarse con
            </div>
          </div>

          {/* Social buttons */}
          <div className="flex justify-center gap-4 mt-6">
            <IonButton
              fill="clear"
              className="social-button"
              style={{ '--background': '#f3f4f6', '--border-radius': '12px', width: '52px', height: '52px' } as any}
            >
              <IonIcon slot="icon-only" icon={logoGoogle} color="dark" style={{ fontSize: '24px' }} />
            </IonButton>
            <IonButton
              fill="clear"
              className="social-button"
              style={{ '--background': '#f3f4f6', '--border-radius': '12px', width: '52px', height: '52px' } as any}
            >
              <IonIcon slot="icon-only" icon={logoFacebook} color="dark" style={{ fontSize: '24px' }} />
            </IonButton>
          </div>
        </div>

        {/* Login link */}
        <div className="mt-8 text-sm text-gray-600 dark:text-gray-400 min-h-[44px] flex items-center">
          ¿Ya tienes una cuenta?
          <span
            onClick={() => history.push('/admin/login')}
            className="text-[#3eaa76] font-bold tracking-wide hover:text-[#0ea85e] hover:underline active:opacity-70 transition-colors ml-1 cursor-pointer"
          >
            Iniciar sesión
          </span>
        </div>
      </div>
    </div>
  );
}
