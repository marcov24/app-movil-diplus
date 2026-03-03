import { useState, useEffect, type FormEvent } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, Mail, Lock, Loader2 } from 'lucide-react';
import { IonButton, IonIcon } from '@ionic/react';
import { logoGoogle, logoFacebook } from 'ionicons/icons';
import logoBg from '../assets/logo.png';
import { useToast, ToastContainer } from '@/components/ui/toast';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { toasts, remove: removeToast, error: showError, success: showSuccess } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { login, isAuthenticated, loading: authLoading } = useAuth();
  const history = useHistory();
  const location = useLocation();

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      history.replace('/config');
    }
  }, [isAuthenticated, authLoading, history]);

  // Load remembered email
  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const from = (location.state as any)?.from?.pathname || '/config';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (rememberMe) {
        localStorage.setItem('rememberedEmail', email);
      } else {
        localStorage.removeItem('rememberedEmail');
      }
      await login(email, password);
      showSuccess('Sesión iniciada correctamente');
      history.replace(from);
    } catch (err: any) {
      showError(err.message || 'Error al iniciar sesión');
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-5">
          {/* Email */}
          <div className="float-group float-group--icon">
            <input
              type="email"
              id="email"
              className="float-input float-input--glass pl-12"
              placeholder=" "
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
            <div className="float-icon"><Mail size={18} /></div>
            <label className="float-label" htmlFor="email">Correo electrónico</label>
          </div>

          {/* Password */}
          <div className="float-group float-group--icon">
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              className="float-input float-input--glass pl-12 pr-12"
              placeholder=" "
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
            <div className="float-icon"><Lock size={18} /></div>
            <label className="float-label" htmlFor="password">Contraseña</label>
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 active:scale-95 rounded-full z-10"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {/* Remember me / Forgot password */}
          <div className="flex items-center justify-between text-sm mt-2 w-full">
            <label className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 cursor-pointer transition-colors min-h-[44px]">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-5 h-5 rounded border-gray-400 text-[#3eaa76] focus:ring-[#3eaa76] accent-[#3eaa76] shrink-0"
              />
              Recordarme
            </label>
            <button
              type="button"
              onClick={() => history.push('/admin/forgot-password')}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 active:opacity-70 transition-colors min-h-[44px] flex items-center"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          {/* Submit button */}
          <div className="pt-2 w-full">
            <IonButton
              type="submit"
              expand="block"
              disabled={loading}
              className="w-full tracking-wider shadow-lg login-ion-btn"
              style={{ '--background': '#3eaa76ff', '--background-hover': '#0ea85e', '--border-radius': '0.75rem', height: '48px', fontWeight: 'bold', fontSize: '16px' }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                'Iniciar Sesión'
              )}
            </IonButton>
          </div>
        </form>

        {/* Social login divider */}
        <div className="w-full mt-10">
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-gray-700"></div>
            </div>
            <div className="relative px-3 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-950">
              O iniciar sesión con
            </div>
          </div>

          {/* Social buttons */}
          <div className="flex justify-center gap-4 mt-6">
            <IonButton
              fill="clear"
              // onClick={() => handleSocialLogin('Google')}
              className="social-button"
              style={{ '--background': '#f3f4f6', '--border-radius': '12px', width: '52px', height: '52px' }}
            >
              <IonIcon slot="icon-only" icon={logoGoogle} color="dark" style={{ fontSize: '24px' }} />
            </IonButton>
            <IonButton
              fill="clear"
              // onClick={() => handleSocialLogin('Facebook')}
              className="social-button"
              style={{ '--background': '#f3f4f6', '--border-radius': '12px', width: '52px', height: '52px' }}
            >
              <IonIcon slot="icon-only" icon={logoFacebook} color="dark" style={{ fontSize: '24px' }} />
            </IonButton>
          </div>
        </div>

        {/* Signup link */}
        <div className="mt-8 text-sm text-gray-600 dark:text-gray-400 min-h-[44px] flex items-center">
          ¿No tienes una cuenta?
          <span
            onClick={() => history.push('/admin/signup')}
            className="text-[#3eaa76] font-bold tracking-wide hover:text-[#0ea85e] hover:underline active:opacity-70 transition-colors ml-1 cursor-pointer"
          >
            Regístrate
          </span>
        </div>
      </div>
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}
