import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Search, Dumbbell, UserCheck, Play, Download, Check, Trash2, Loader2 } from 'lucide-react';

interface EjercicioLocal {
  id: string;
  nombre: string;
  grupo_muscular: string;
  video_url: string;
  instrucciones: string;
}

interface Alumno {
  id: string;
  nombre: string;
  email: string;
}

interface ExerciseDBItem {
  id: string;
  name: string;
  target: string;
  bodyPart: string;
  equipment: string;
  gifUrl: string;
  instructions: string[];
}

const MAPA_BODY_PARTS: Record<string, string> = {
  'back': 'Espalda',
  'cardio': 'Cardio',
  'chest': 'Pecho',
  'lower arms': 'Antebrazos',
  'lower legs': 'Gemelos / Pantorrillas',
  'neck': 'Cuello',
  'shoulders': 'Hombros',
  'upper arms': 'Brazos',
  'upper legs': 'Piernas / Cuádriceps',
  'waist': 'Abdominales / Cintura',
};

export default function PanelProfesor() {
  const [pestana, setPestana] = useState<'explorar' | 'biblioteca' | 'rutinas'>('explorar');

  // Estados ExerciseDB
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<ExerciseDBItem[]>([]);
  const [cargandoApi, setCargandoApi] = useState(false);
  const [importandoId, setImportandoId] = useState<string | null>(null);

  // Estados locales Supabase
  const [misEjercicios, setMisEjercicios] = useState<EjercicioLocal[]>([]);
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [modalMedia, setModalMedia] = useState<string | null>(null);

  // Estados Asignación
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState('');
  const [nombreRutina, setNombreRutina] = useState('');
  const [ejerciciosElegidos, setEjerciciosElegidos] = useState<
    { ejercicio_id: string; series: number; repeticiones: string; peso_sugerido: string }[]
  >([]);
  const [guardandoRutina, setGuardandoRutina] = useState(false);
  const [mensajeExito, setMensajeExito] = useState('');

  const rapidApiKey = import.meta.env.VITE_RAPIDAPI_KEY || '';

  useEffect(() => {
    cargarDatosLocales();
    consultarExerciseDB('');
  }, []);

  async function cargarDatosLocales() {
    const { data: ejData } = await supabase
      .from('ejercicios')
      .select('*')
      .order('created_at', { ascending: false });
    if (ejData) setMisEjercicios(ejData);

    const { data: alData } = await supabase
      .from('profiles')
      .select('id, nombre, email')
      .eq('rol', 'alumno');
    if (alData) setAlumnos(alData);
  }

  // Traductor MyMemory
  async function traducirTexto(texto: string): Promise<string> {
    if (!texto || texto.trim() === '') return '';
    try {
      const res = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(texto)}&langpair=en|es`
      );
      const data = await res.json();
      return data.responseData?.translatedText || texto;
    } catch {
      return texto;
    }
  }

  // 1. Consulta limpia a ExerciseDB API
  async function consultarExerciseDB(termino: string) {
    if (!rapidApiKey) {
      console.warn('Falta configurar VITE_RAPIDAPI_KEY en el archivo .env');
      return;
    }

    setCargandoApi(true);
    try {
      const endpoint = termino.trim()
        ? `https://exercisedb.p.rapidapi.com/exercises/name/${encodeURIComponent(termino.toLowerCase())}?limit=24`
        : `https://exercisedb.p.rapidapi.com/exercises?limit=24`;

      const res = await fetch(endpoint, {
        headers: {
          'x-rapidapi-host': 'exercisedb.p.rapidapi.com',
          'x-rapidapi-key': rapidApiKey,
        },
      });

      const data = await res.json();
      if (Array.isArray(data)) {
        setResultados(data);
      } else {
        setResultados([]);
      }
    } catch (err) {
      console.error('Error al conectar con ExerciseDB:', err);
    } finally {
      setCargandoApi(false);
    }
  }

  // 2. Importar ejercicio (datos garantizados y traducción)
  async function importarEjercicio(item: ExerciseDBItem) {
    setImportandoId(item.id);
    try {
      // Traducir nombre
      const nombreTraducido = await traducirTexto(item.name);

      // Traducir instrucciones
      const textoInstrucciones = Array.isArray(item.instructions)
        ? item.instructions.join(' ')
        : 'Realizar el movimiento de forma controlada.';
      const instruccionesTraducidas = await traducirTexto(textoInstrucciones);

      // Mapear grupo muscular
      const categoriaTraducida = MAPA_BODY_PARTS[item.bodyPart.toLowerCase()] || item.bodyPart;

      const { error } = await supabase.from('ejercicios').insert([
        {
          nombre: nombreTraducido,
          grupo_muscular: categoriaTraducida,
          video_url: item.gifUrl,
          instrucciones: instruccionesTraducidas,
        },
      ]);

      if (error) throw error;
      await cargarDatosLocales();
    } catch (err: any) {
      alert('Error al importar: ' + err.message);
    } finally {
      setImportandoId(null);
    }
  }

  // 3. Eliminar ejercicio
  async function eliminarEjercicio(id: string, nombre: string) {
    if (!window.confirm(`¿Eliminar "${nombre}" de tu biblioteca?`)) return;

    try {
      await supabase.from('rutina_ejercicios').delete().eq('ejercicio_id', id);
      const { error } = await supabase.from('ejercicios').delete().eq('id', id);
      if (error) throw error;

      setMisEjercicios((prev) => prev.filter((e) => e.id !== id));
      setEjerciciosElegidos((prev) => prev.filter((item) => item.ejercicio_id !== id));
    } catch (err: any) {
      alert('Error al eliminar: ' + err.message);
    }
  }

  // Selección para rutinas
  function toggleSeleccion(id: string) {
    const existe = ejerciciosElegidos.find((item) => item.ejercicio_id === id);
    if (existe) {
      setEjerciciosElegidos(ejerciciosElegidos.filter((item) => item.ejercicio_id !== id));
    } else {
      setEjerciciosElegidos([
        ...ejerciciosElegidos,
        { ejercicio_id: id, series: 4, repeticiones: '10-12', peso_sugerido: '' },
      ]);
    }
  }

  function actualizarParametro(id: string, campo: string, valor: any) {
    setEjerciciosElegidos(
      ejerciciosElegidos.map((item) =>
        item.ejercicio_id === id ? { ...item, [campo]: valor } : item
      )
    );
  }

  // Guardar rutina
  async function handleGuardarRutina(e: React.FormEvent) {
    e.preventDefault();
    if (!alumnoSeleccionado) return alert('Seleccioná un alumno.');
    if (ejerciciosElegidos.length === 0) return alert('Seleccioná al menos un ejercicio.');

    setGuardandoRutina(true);
    setMensajeExito('');

    try {
      const { data: rutina, error: errorRutina } = await supabase
        .from('rutinas')
        .insert([{ alumno_id: alumnoSeleccionado, nombre: nombreRutina }])
        .select()
        .single();

      if (errorRutina) throw errorRutina;

      const items = ejerciciosElegidos.map((item, index) => ({
        rutina_id: rutina.id,
        ejercicio_id: item.ejercicio_id,
        series: Number(item.series),
        repeticiones: item.repeticiones,
        peso_sugerido: item.peso_sugerido,
        orden: index + 1,
      }));

      const { error: errorItems } = await supabase.from('rutina_ejercicios').insert(items);
      if (errorItems) throw errorItems;

      setMensajeExito(`¡Rutina "${nombreRutina}" asignada con éxito!`);
      setNombreRutina('');
      setEjerciciosElegidos([]);
      setAlumnoSeleccionado('');
    } catch (err: any) {
      alert('Error al asignar rutina: ' + err.message);
    } finally {
      setGuardandoRutina(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Pestañas */}
      <div className="flex flex-wrap gap-2 border-b border-slate-700 pb-3">
        <button
          onClick={() => setPestana('explorar')}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
            pestana === 'explorar'
              ? 'bg-emerald-500 text-slate-900'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <Search size={16} /> 1. Explorador ExerciseDB
        </button>

        <button
          onClick={() => setPestana('biblioteca')}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
            pestana === 'biblioteca'
              ? 'bg-emerald-500 text-slate-900'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <Dumbbell size={16} /> 2. Biblioteca Importada ({misEjercicios.length})
        </button>

        <button
          onClick={() => setPestana('rutinas')}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
            pestana === 'rutinas'
              ? 'bg-emerald-500 text-slate-900'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <UserCheck size={16} /> 3. Asignar Rutina a Alumno
        </button>
      </div>

      {/* PESTAÑA 1: EXPLORADOR EXERCISEDB */}
      {pestana === 'explorar' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Buscar en inglés (ej: bench press, squat, bicep curl, pull-up)..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && consultarExerciseDB(busqueda)}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={() => consultarExerciseDB(busqueda)}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-bold px-4 py-2 rounded-lg text-sm transition"
            >
              Buscar
            </button>
          </div>

          {!rapidApiKey && (
            <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 p-3 rounded-lg text-xs">
              Recordá configurar <code>VITE_RAPIDAPI_KEY</code> en tu archivo <code>.env</code> para habilitar las búsquedas en ExerciseDB.
            </div>
          )}

          {cargandoApi ? (
            <p className="text-slate-400 text-sm animate-pulse">Cargando ejercicios de ExerciseDB...</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {resultados.map((item) => {
                const nombreEs = item.name;
                const estaImportando = importandoId === item.id;
                const categoriaTraducida = MAPA_BODY_PARTS[item.bodyPart.toLowerCase()] || item.bodyPart;

                return (
                  <div
                    key={item.id}
                    className="bg-slate-800 border border-slate-700 p-4 rounded-xl flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex gap-1.5 flex-wrap mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded">
                          {categoriaTraducida}
                        </span>
                        <span className="text-[10px] uppercase text-slate-400 bg-slate-900 px-2 py-0.5 rounded">
                          {item.equipment}
                        </span>
                      </div>
                      <h4 className="font-semibold text-white text-sm capitalize">{nombreEs}</h4>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => setModalMedia(item.gifUrl)}
                        className="flex-1 flex items-center justify-center gap-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 py-2 rounded transition"
                      >
                        <Play size={12} /> Ver Demo
                      </button>

                      <button
                        disabled={estaImportando}
                        onClick={() => importarEjercicio(item)}
                        className="flex-1 flex items-center justify-center gap-1 text-xs py-2 rounded font-semibold transition bg-emerald-500 hover:bg-emerald-600 text-slate-900 disabled:opacity-50"
                      >
                        {estaImportando ? (
                          <>
                            <Loader2 size={12} className="animate-spin" /> Traduciendo...
                          </>
                        ) : (
                          <>
                            <Download size={12} /> Importar (ES)
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA 2: BIBLIOTECA IMPORTADA */}
      {pestana === 'biblioteca' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {misEjercicios.length === 0 ? (
            <p className="text-slate-400 text-sm col-span-3">
              Aún no importaste ejercicios. Buscá e importá desde la pestaña "1. Explorador ExerciseDB".
            </p>
          ) : (
            misEjercicios.map((ej) => (
              <div
                key={ej.id}
                className="bg-slate-800 border border-slate-700 p-4 rounded-xl flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded">
                      {ej.grupo_muscular}
                    </span>
                    <button
                      onClick={() => eliminarEjercicio(ej.id, ej.nombre)}
                      title="Eliminar ejercicio"
                      className="text-slate-500 hover:text-rose-400 p-1 transition rounded hover:bg-slate-700/50"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <h4 className="font-semibold text-white mt-1.5 text-sm capitalize">{ej.nombre}</h4>
                  {ej.instrucciones && (
                    <p className="text-slate-400 text-xs mt-1 line-clamp-2">{ej.instrucciones}</p>
                  )}
                </div>

                {ej.video_url && (
                  <button
                    onClick={() => setModalMedia(ej.video_url)}
                    className="mt-3 flex items-center justify-center gap-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 py-1.5 rounded transition"
                  >
                    <Play size={12} /> Ver Animación
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* PESTAÑA 3: ASIGNAR RUTINA */}
      {pestana === 'rutinas' && (
        <div className="bg-slate-800 border border-slate-700 p-5 rounded-xl space-y-4">
          <h3 className="text-base font-bold text-emerald-400">Crear y Asignar Rutina</h3>

          {mensajeExito && (
            <div className="bg-emerald-500/10 border border-emerald-500 text-emerald-400 p-3 rounded-lg text-sm">
              {mensajeExito}
            </div>
          )}

          <form onSubmit={handleGuardarRutina} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Alumno</label>
                <select
                  required
                  value={alumnoSeleccionado}
                  onChange={(e) => setAlumnoSeleccionado(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white focus:border-emerald-500"
                >
                  <option value="">-- Elegí un alumno --</option>
                  {alumnos.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nombre} ({a.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Nombre de la Rutina</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Día 1 - Torso"
                  value={nombreRutina}
                  onChange={(e) => setNombreRutina(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-2">
                Seleccionar Ejercicios ({ejerciciosElegidos.length} elegidos)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto bg-slate-900 p-2.5 rounded-lg border border-slate-700">
                {misEjercicios.map((ej) => {
                  const seleccionado = ejerciciosElegidos.some((item) => item.ejercicio_id === ej.id);
                  return (
                    <button
                      type="button"
                      key={ej.id}
                      onClick={() => toggleSeleccion(ej.id)}
                      className={`p-2 rounded text-left text-xs border transition ${
                        seleccionado
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                          : 'bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      <span className="font-bold block truncate capitalize">{ej.nombre}</span>
                      <span className="text-[10px] text-slate-400">{ej.grupo_muscular}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {ejerciciosElegidos.map((item, index) => {
              const ejInfo = misEjercicios.find((e) => e.id === item.ejercicio_id);
              return (
                <div
                  key={item.ejercicio_id}
                  className="bg-slate-900 border border-slate-700 p-3 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <span className="font-semibold text-white capitalize">
                    {index + 1}. {ejInfo?.nombre}
                  </span>
                  <div className="flex items-center gap-2">
                    <span>Series:</span>
                    <input
                      type="number"
                      value={item.series}
                      onChange={(e) => actualizarParametro(item.ejercicio_id, 'series', e.target.value)}
                      className="w-14 bg-slate-800 border border-slate-600 rounded px-1.5 py-1 text-center text-white"
                    />
                    <span>Reps:</span>
                    <input
                      type="text"
                      value={item.repeticiones}
                      onChange={(e) => actualizarParametro(item.ejercicio_id, 'repeticiones', e.target.value)}
                      className="w-16 bg-slate-800 border border-slate-600 rounded px-1.5 py-1 text-center text-white"
                    />
                  </div>
                </div>
              );
            })}

            <button
              type="submit"
              disabled={guardandoRutina}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-bold px-5 py-2.5 rounded-lg text-sm transition disabled:opacity-50"
            >
              {guardandoRutina ? 'Guardando...' : 'Asignar Rutina'}
            </button>
          </form>
        </div>
      )}

      {/* Modal visor de demostración */}
      {modalMedia && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl max-w-sm w-full space-y-3">
            <h4 className="font-bold text-white text-sm">Demostración</h4>
            <img
              src={modalMedia}
              alt="Demostración de ejercicio"
              className="w-full rounded-lg bg-white aspect-square object-contain"
            />
            <button
              onClick={() => setModalMedia(null)}
              className="w-full bg-slate-700 hover:bg-slate-600 py-1.5 rounded-lg text-xs font-semibold text-white transition"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}