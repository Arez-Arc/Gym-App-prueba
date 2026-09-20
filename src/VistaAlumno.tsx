import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Play, CheckCircle2, Circle, Dumbbell } from 'lucide-react';

interface Rutina {
  id: string;
  nombre: string;
  created_at: string;
}

interface ItemRutina {
  id: string; // id de rutina_ejercicios
  rutina_id: string;
  ejercicio_id: string;
  series: number;
  repeticiones: string;
  peso_sugerido: string;
  orden: number;
  completado: boolean;
  ejercicios: {
    nombre: string;
    grupo_muscular: string;
    video_url: string;
    instrucciones: string;
  };
}

// Componente individual de tarjeta de ejercicio ordenable
function TarjetaEjercicio({
  item,
  onToggleCompletado,
  onActualizarPeso,
  onVerMedia,
}: {
  item: ItemRutina;
  onToggleCompletado: (id: string, actual: boolean) => void;
  onActualizarPeso: (id: string, peso: string) => void;
  onVerMedia: (url: string, nombre: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-slate-800 border rounded-xl p-4 transition shadow-sm ${
        item.completado
          ? 'border-emerald-500/40 bg-slate-800/60 opacity-80'
          : 'border-slate-700'
      } ${isDragging ? 'shadow-2xl border-emerald-400 opacity-90' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        {/* Manija para arrastrar */}
        <button
          {...attributes}
          {...listeners}
          className="text-slate-500 hover:text-slate-300 p-1 cursor-grab active:cursor-grabbing touch-none"
          title="Arrastrar para reordenar"
        >
          <GripVertical size={20} />
        </button>

        {/* Info principal del ejercicio */}
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded">
              {item.ejercicios?.grupo_muscular || 'General'}
            </span>
            <span className="text-xs text-slate-400">
              {item.series} series × {item.repeticiones} reps
            </span>
          </div>

          <h3
            className={`font-semibold text-base mt-1 text-white capitalize ${
              item.completado ? 'line-through text-slate-400' : ''
            }`}
          >
            {item.ejercicios?.nombre}
          </h3>

          {item.ejercicios?.instrucciones && (
            <p className="text-xs text-slate-400 mt-1 line-clamp-2">
              {item.ejercicios.instrucciones}
            </p>
          )}

          {/* Campo para registrar peso real levantado */}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-slate-400">Carga:</span>
            <input
              type="text"
              defaultValue={item.peso_sugerido || ''}
              onBlur={(e) => onActualizarPeso(item.id, e.target.value)}
              placeholder="Ej: 20kg"
              className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Acciones: Video y Check */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => onToggleCompletado(item.id, item.completado)}
            className="p-1 text-slate-400 hover:text-emerald-400 transition"
            title={item.completado ? 'Marcar como pendiente' : 'Marcar como completado'}
          >
            {item.completado ? (
              <CheckCircle2 size={24} className="text-emerald-400" />
            ) : (
              <Circle size={24} />
            )}
          </button>

          {item.ejercicios?.video_url && (
            <button
              onClick={() => onVerMedia(item.ejercicios.video_url, item.ejercicios.nombre)}
              className="p-2 bg-slate-700/80 hover:bg-slate-700 text-emerald-400 rounded-lg transition"
              title="Ver técnica"
            >
              <Play size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VistaAlumno({ alumnoId }: { alumnoId: string }) {
  const [rutinas, setRutinas] = useState<Rutina[]>([]);
  const [rutinaActiva, setRutinaActiva] = useState<string | null>(null);
  const [items, setItems] = useState<ItemRutina[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalMedia, setModalMedia] = useState<{ url: string; nombre: string } | null>(null);

  // Configuración de sensores para DnD (soporte táctil fluido en celulares)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // evita disparar el drag al hacer scroll vertical
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    cargarRutinas();
  }, [alumnoId]);

  useEffect(() => {
    if (rutinaActiva) {
      cargarEjerciciosDeRutina(rutinaActiva);
    }
  }, [rutinaActiva]);

  // 1. Obtener todas las rutinas asignadas a este alumno
  async function cargarRutinas() {
    setCargando(true);
    try {
      const { data, error } = await supabase
        .from('rutinas')
        .select('*')
        .eq('alumno_id', alumnoId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRutinas(data || []);
      if (data && data.length > 0 && !rutinaActiva) {
        setRutinaActiva(data[0].id);
      }
    } catch (err: any) {
      console.error('Error cargando rutinas:', err.message);
    } finally {
      setCargando(false);
    }
  }

  // 2. Cargar los ejercicios de la rutina activa ordenados por columna 'orden'
  async function cargarEjerciciosDeRutina(rutinaId: string) {
    try {
      const { data, error } = await supabase
        .from('rutina_ejercicios')
        .select(`
          id,
          rutina_id,
          ejercicio_id,
          series,
          repeticiones,
          peso_sugerido,
          orden,
          completado,
          ejercicios (
            nombre,
            grupo_muscular,
            video_url,
            instrucciones
          )
        `)
        .eq('rutina_id', rutinaId)
        .order('orden', { ascending: true });

      if (error) throw error;
      setItems((data as any) || []);
    } catch (err: any) {
      console.error('Error cargando ejercicios:', err.message);
    }
  }

  // 3. Manejar soltado de Drag & Drop y guardar nuevo orden en Supabase
  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const viejoIndice = items.findIndex((i) => i.id === active.id);
    const nuevoIndice = items.findIndex((i) => i.id === over.id);

    const nuevaLista = arrayMove(items, viejoIndice, nuevoIndice).map((item, idx) => ({
      ...item,
      orden: idx + 1,
    }));

    // Actualizamos estado de UI al instante
    setItems(nuevaLista);

    // Persistimos los nuevos números de orden en Supabase
    try {
      const updates = nuevaLista.map((item) =>
        supabase.from('rutina_ejercicios').update({ orden: item.orden }).eq('id', item.id)
      );
      await Promise.all(updates);
    } catch (err) {
      console.error('Error al guardar el nuevo orden:', err);
    }
  }

  // 4. Marcar o desmarcar completado
  async function handleToggleCompletado(id: string, estadoActual: boolean) {
    const nuevoEstado = !estadoActual;
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, completado: nuevoEstado } : it))
    );
    await supabase.from('rutina_ejercicios').update({ completado: nuevoEstado }).eq('id', id);
  }

  // 5. Guardar carga/peso anotado
  async function handleActualizarPeso(id: string, peso: string) {
    await supabase.from('rutina_ejercicios').update({ peso_sugerido: peso }).eq('id', id);
  }

  if (cargando) {
    return (
      <div className="text-center py-12 text-slate-400">
        <p className="animate-pulse">Cargando tus entrenamientos...</p>
      </div>
    );
  }

  if (rutinas.length === 0) {
    return (
      <div className="bg-slate-800 border border-slate-700 p-8 rounded-2xl text-center space-y-3">
        <Dumbbell className="mx-auto text-emerald-400" size={36} />
        <h3 className="text-lg font-bold text-white">No tenés rutinas asignadas todavía</h3>
        <p className="text-sm text-slate-400">
          Avisale a tu profe para que te prepare tu primer plan de entrenamiento.
        </p>
      </div>
    );
  }

  const completados = items.filter((i) => i.completado).length;
  const progreso = items.length > 0 ? Math.round((completados / items.length) * 100) : 0;

  return (
    <div className="space-y-5 pb-12">
      {/* Selector horizontal de Rutinas */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {rutinas.map((r) => (
          <button
            key={r.id}
            onClick={() => setRutinaActiva(r.id)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition ${
              rutinaActiva === r.id
                ? 'bg-emerald-500 text-slate-900 shadow-md'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
            }`}
          >
            {r.nombre}
          </button>
        ))}
      </div>

      {/* Barra de Progreso del día */}
      <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl">
        <div className="flex justify-between items-center text-xs font-semibold mb-2">
          <span className="text-slate-400">Progreso de la sesión</span>
          <span className="text-emerald-400">
            {completados} de {items.length} ({progreso}%)
          </span>
        </div>
        <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
          <div
            className="bg-emerald-500 h-full transition-all duration-300"
            style={{ width: `${progreso}%` }}
          />
        </div>
      </div>

      {/* Lista de Ejercicios con Drag & Drop */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {items.map((item) => (
              <TarjetaEjercicio
                key={item.id}
                item={item}
                onToggleCompletado={handleToggleCompletado}
                onActualizarPeso={handleActualizarPeso}
                onVerMedia={(url, nombre) => setModalMedia({ url, nombre })}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Modal Reproductor de Demostración */}
      {modalMedia && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 p-4 rounded-2xl max-w-sm w-full space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-white text-sm capitalize">{modalMedia.nombre}</h4>
              <button
                onClick={() => setModalMedia(null)}
                className="text-slate-400 hover:text-white text-xs font-bold px-2 py-1 rounded"
              >
                ✕
              </button>
            </div>

            {modalMedia.url.endsWith('.mp4') || modalMedia.url.endsWith('.webm') ? (
              <video
                src={modalMedia.url}
                autoPlay
                loop
                muted
                playsInline
                controls
                className="w-full rounded-xl bg-black aspect-video object-cover"
              />
            ) : (
              <img
                src={modalMedia.url}
                alt={modalMedia.nombre}
                className="w-full rounded-xl bg-white aspect-square object-contain"
              />
            )}

            <button
              onClick={() => setModalMedia(null)}
              className="w-full bg-slate-700 hover:bg-slate-600 py-2 rounded-xl text-xs font-semibold text-white transition"
            >
              Listo / Volver a entrenar
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 