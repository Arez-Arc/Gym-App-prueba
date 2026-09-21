import { useState } from 'react';
import { supabase } from './supabaseClient';

interface LoginProps {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [esRegistro, setEsRegistro] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    setCargando(true);

    try {
      if (esRegistro) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              nombre,
            },
          },
        });
        if (error) throw error;
        onLoginSuccess();
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password, 
        });
        if (error) throw error;
        onLoginSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Ocurrió un error');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl">
        <h2 className="text-2xl font-bold text-center text-emerald-400 mb-2">
          {esRegistro ? 'Crear Cuenta' : 'Iniciar Sesión'}
        </h2>
        <p className="text-slate-400 text-sm text-center mb-6">
          {esRegistro ? 'Registrate para acceder a tus rutinas' : 'Ingresá tus credenciales para continuar'}
        </p>

        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500 text-rose-400 p-3 rounded-lg text-sm mb-4">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {esRegistro && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                  placeholder="Ej: Juan Pérez"
                />
              </div>

            
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={cargando}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-bold py-2.5 rounded-lg transition duration-200 disabled:opacity-50"
          >
            {cargando ? 'Procesando...' : esRegistro ? 'Registrarse' : 'Ingresar'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setEsRegistro(!esRegistro);
              setErrorMsg('');
            }}
            className="text-sm text-emerald-400 hover:underline"
          >
            {esRegistro ? '¿Ya tenés cuenta? Iniciá sesión' : '¿No tenés cuenta? Registrate acá'}
          </button>
        </div>
      </div>
    </div>
  );
}