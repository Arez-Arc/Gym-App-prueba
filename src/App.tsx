import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import Login from './Login';
import PanelProfesor from './PanelProfesor';
import VistaAlumno from './VistaAlumno';

interface Perfil {
  id: string;
  email: string;
  nombre: string;
  rol: 'profesor' | 'alumno';
}

export default function App() {
  const [cargando, setCargando] = useState(true);
  const [perfil, setPerfil] = useState<Perfil | null>(null);

  async function cargarPerfil() {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setPerfil(null);
        return;
      }

      // Traemos los datos del perfil desde la tabla profiles
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (error) throw error;
      setPerfil(data);
    } catch (err) {
      console.error('Error cargando perfil:', err);
      setPerfil(null);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarPerfil();

    // Escucha cambios de sesión en tiempo real (login/logout)
    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      cargarPerfil();
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    setPerfil(null);
  }

  if (cargando) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <p className="text-emerald-400 animate-pulse">Cargando aplicación...</p>
      </div>
    );
  }

  // Si no está autenticado, mostramos el login
  if (!perfil) {
    return <Login onLoginSuccess={cargarPerfil} />;
  }

  // Si ya inició sesión, mostramos la vista según su rol
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Barra superior de navegación */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-emerald-400">Gym App</h1>
          <p className="text-xs text-slate-400">
            Hola, <span className="text-white font-medium">{perfil.nombre}</span> ({perfil.rol})
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="bg-slate-700 hover:bg-slate-600 text-sm px-3 py-1.5 rounded-lg border border-slate-600 transition"
        >
          Cerrar Sesión
        </button>
      </header>

      {/* Contenido dinámico según el rol */}
      <main className="p-6 max-w-4xl mx-auto">
        {perfil.rol === 'profesor' ? (
          <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl">
            <h2 className="text-2xl font-bold text-emerald-400 mb-2">Panel del Profesor</h2>
            <PanelProfesor/>
          </div>
        ) : (
          <div>
          <VistaAlumno alumnoId={perfil.id}/>
          </div>
        )}
      </main>
    </div>
  );
}