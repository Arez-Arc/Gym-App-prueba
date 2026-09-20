import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Plus, Dumbbell, UserCheck, Play, Trash2, Upload, Loader2 } from 'lucide-react';

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

export default function PanelProfesor() {
  const [pestana, setPestana] = useState<'crear' | 'biblioteca' | 'rutinas'>('crear');

  // Estados Formulario de Ejercicio
  const [nombre, setNombre] = useState('');
  const [grupoMuscular, setGrupoMuscular] = useState('Pecho');
  const [instrucciones, setInstrucciones] = useState('');
  const [archivoVideo, setArchivoVideo] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  // Estados Base de Datos (Supabase)
  const [misEjercicios, setMisEjercicios] = useState<EjercicioLocal[]>([]);
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [videoModal, setVideoModal] = useState<string | null>(null);

  // Estados Asignación de Rutinas
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState('');
  const [nombreRutina, setNombreRutina] = useState('');
  const [ejerciciosElegidos, setEjerciciosElegidos] = useState<
    { ejercicio_id: string; series: number; repeticiones: string; peso_sugerido: string }[]
  >([]);
  const [guardandoRutina, setGuardandoRutina] = useState(false);
  const [mensajeExito, setMensajeExito] = useState('');

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    // 1. Cargar biblioteca de ejercicios
    const { data: ejData } = await supabase
      .from('ejercicios')
      .select('*')
      .order('created_at', { ascending: false });
    if (ejData) setMisEjercicios(ejData);

    // 2. Cargar alumnos registrados
    const { data: alData } = await supabase
      .from('profiles')
      .select('id, nombre, email')
      .eq('rol', 'alumno');
    if (alData) setAlumnos(alData);
  }

  // 1. Subir video a Supabase Storage y guardar ejercicio
  async function handleCrearEjercicio(e: React.FormEvent) {
    e.preventDefault();
    if (!archivoVideo) {
      alert('Por favor seleccioná un archivo de video');
      return;
    }

    setSubiendo(true);
    try {
      // Generar nombre de archivo único para evitar sobrescribir
      const fileExt = archivoVideo.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `ejercicios/${fileName}`;

      // Subir archivo al bucket 'videos-ejercicios'
      const { error: uploadError } = await supabase.storage
        .from('videos-ejercicios')
        .upload(filePath, archivoVideo);

      if (uploadError) throw uploadError;

      // Obtener URL pública directa
      const { data: urlData } = supabase.storage
        .from('videos-ejercicios')
        .getPublicUrl(filePath);

      // Guardar en la tabla ejercicios
      const { error: insertError } = await supabase.from('ejercicios').insert([
        {
          nombre: nombre.trim(),
          grupo_muscular: grupoMuscular,
          video_url: urlData.publicUrl,
          instrucciones: instrucciones.trim() || 'Sin instrucciones adicionales.',
        },
      ]);

      if (insertError) throw insertError;

      // Limpiar formulario y recargar
      setNombre('');
      setInstrucciones('');
      setArchivoVideo(null);
      await cargarDatos();
      setPestana('biblioteca');
      alert('¡Ejercicio y video subidos con éxito!');
    } catch (err: any) {
      alert('Error al subir ejercicio: ' + err.message);
    } finally {
      setSubiendo(false);
    }
  }

  // 2. Eliminar ejercicio
  async function eliminarEjercicio(id: string, nombreEj: string) {
    if (!window.confirm(`¿Seguro que querés eliminar "${nombreEj}"?`)) return;

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

  // 3. Selección y configuración de ejercicios para la rutina
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

  // 4. Guardar y Asignar la Rutina
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
      {/* Pestañas de Navegación */}
      <div className="flex flex-wrap gap-2 border-b border-slate-700 pb-3">
        <button
          onClick={() => setPestana('crear')}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
            pestana === 'crear'
              ? 'bg-emerald-500 text-slate-900'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <Plus size={16} /> 1. Subir Ejercicio con Video
        </button>

        <button
          onClick={() => setPestana('biblioteca')}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
            pestana === 'biblioteca'
              ? 'bg-emerald-500 text-slate-900'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <Dumbbell size={16} /> 2. Biblioteca del Gimnasio ({misEjercicios.length})
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

      {/* PESTAÑA 1: FORMULARIO DE CARGA DE VIDEO */}
      {pestana === 'crear' && (
        <div className="max-w-xl mx-auto bg-slate-800 border border-slate-700 p-6 rounded-xl space-y-4">
          <div>
            <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
              <Upload size={20} /> Cargar Ejercicio a Supabase
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              El video se guardará en tu bucket de Supabase y estará disponible para las rutinas de los alumnos.
            </p>
          </div>

          <form onSubmit={handleCrearEjercicio} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Nombre del Ejercicio</label>
              <input
                type="text"
                required
                placeholder="Ej: Press banca con mancuernas"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Grupo Muscular</label>
              <select
                value={grupoMuscular}
                onChange={(e) => setGrupoMuscular(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="Pecho">Pecho</option>
                <option value="Espalda">Espalda</option>
                <option value="Piernas">Piernas</option>
                <option value="Hombros">Hombros</option>
                <option value="Brazos">Brazos</option>
                <option value="Abdominales / Core">Abdominales / Core</option>
                <option value="Cardio">Cardio</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Instrucciones o Consejos</label>
              <textarea
                rows={2}
                placeholder="Ej: Mantener escápulas retraídas y apoyar bien los pies en el piso..."
                value={instrucciones}
                onChange={(e) => setInstrucciones(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Archivo de Video (.mp4 / .webm)</label>
              <input
                type="file"
                accept="video/mp4,video/webm"
                required
                onChange={(e) => setArchivoVideo(e.target.files ? e.target.files[0] : null)}
                className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-700 file:text-emerald-400 hover:file:bg-slate-600 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500 mt-1">Recomendado: videos de 5 a 10 segundos en vertical, livianos.</p>
            </div>

            <button
              type="submit"
              disabled={subiendo}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-bold py-2.5 rounded-lg text-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {subiendo ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Subiendo video a Supabase...
                </>
              ) : (
                'Guardar en Biblioteca'
              )}
            </button>
          </form>
        </div>
      )}

      {/* PESTAÑA 2: BIBLIOTECA DEL GIMNASIO */}
      {pestana === 'biblioteca' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {misEjercicios.length === 0 ? (
            <p className="text-slate-400 text-sm col-span-3">
              Aún no cargaste ejercicios. Creá el primero desde la pestaña "1. Subir Ejercicio con Video".
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
                  <h4 className="font-semibold text-white mt-1.5 text-sm">{ej.nombre}</h4>
                  {ej.instrucciones && (
                    <p className="text-slate-400 text-xs mt-1 line-clamp-2">{ej.instrucciones}</p>
                  )}
                </div>

                {ej.video_url && (
                  <button
                    onClick={() => setVideoModal(ej.video_url)}
                    className="mt-3 flex items-center justify-center gap-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 py-1.5 rounded transition"
                  >
                    <Play size={12} /> Ver Video
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
                Seleccionar Ejercicios de la Biblioteca ({ejerciciosElegidos.length} elegidos)
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
                      <span className="font-bold block truncate">{ej.nombre}</span>
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
                  <span className="font-semibold text-white">
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

      {/* Modal Visor de Video */}
      {videoModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl max-w-sm w-full space-y-3">
            <h4 className="font-bold text-white text-sm">Demostración</h4>
            <video
              src={videoModal}
              autoPlay
              loop
              muted
              playsInline
              controls
              className="w-full rounded-lg bg-black aspect-video object-cover"
            />
            <button
              onClick={() => setVideoModal(null)}
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