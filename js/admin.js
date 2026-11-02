import { supabase } from './supabase-config.js';

const formLocal = document.getElementById('form-local');
const gridLocales = document.getElementById('grid-locales');
const btnCrear = document.getElementById('btn-crear');

// Elementos del Modal
const modalEditar = document.getElementById('modal-editar');
const formEditar = document.getElementById('form-editar');
const btnCerrarModal = document.getElementById('btn-cerrar-modal');

// 1. Cargar locales
async function cargarLocales() {
    try {
        const { data: locales, error } = await supabase
            .from('locales')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        renderizarLocales(locales);
    } catch (error) {
        console.error('Error:', error);
        gridLocales.innerHTML = `<p class="text-red-500">Error al cargar.</p>`;
    }
}

// 2. Dibujar las tarjetas (con logo y estado)
function renderizarLocales(locales) {
    if (locales.length === 0) {
        gridLocales.innerHTML = `<p class="text-reminder-gray">No hay locales registrados.</p>`;
        return;
    }

    // Guardamos los locales de forma global para poder editarlos fácilmente
    window.localesData = locales;

    gridLocales.innerHTML = locales.map(local => {
        // Renderizado condicional del logo
        const logoHtml = local.logo_url 
            ? `<img src="${local.logo_url}" alt="Logo" class="w-10 h-10 rounded-full object-cover border border-neutral-700">`
            : `<div class="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black font-extrabold text-sm">${local.nombre.substring(0, 2).toUpperCase()}</div>`;
        
        // Renderizado condicional del estado (Activo/Suspendido)
        const estadoBadge = local.activo !== false // !== false por si es null en locales antiguos
            ? `<span class="bg-green-500/20 text-green-400 text-[0.65rem] font-bold px-2 py-0.5 rounded uppercase">Activo</span>`
            : `<span class="bg-red-500/20 text-red-400 text-[0.65rem] font-bold px-2 py-0.5 rounded uppercase">Suspendido</span>`;
        
        const opacidadCard = local.activo !== false ? 'opacity-100' : 'opacity-60 grayscale';

        return `
        <div class="bg-reminder-card p-5 rounded-2xl border border-neutral-800 flex flex-col justify-between transition-all ${opacidadCard}">
            <div class="flex justify-between items-start mb-4">
                <div class="flex items-center gap-3">
                    ${logoHtml}
                    <div>
                        <div class="flex items-center gap-2">
                            <h3 class="font-extrabold text-lg leading-tight uppercase">${local.nombre}</h3>
                            ${estadoBadge}
                        </div>
                        <p class="text-reminder-gray text-[0.65rem] font-mono mt-1">ID: ${local.id}</p>
                    </div>
                </div>
            </div>
            
            <div class="flex justify-between items-center mt-2 pt-4 border-t border-neutral-800/50">
                <span class="text-xs text-reminder-gray font-semibold">${local.max_sellos} sellos max.</span>
                
                <div class="flex gap-3">
                    <button onclick="abrirModalEdicion('${local.id}')" class="text-white hover:text-reminder-neon text-sm font-bold flex items-center gap-1">
                        Editar
                    </button>
                    <button onclick="toggleEstado('${local.id}', ${local.activo !== false})" class="${local.activo !== false ? 'text-orange-400 hover:text-orange-300' : 'text-green-400 hover:text-green-300'} text-sm font-bold flex items-center gap-1 transition-colors">
                        ${local.activo !== false ? 'Suspender' : 'Reactivar'}
                    </button>
                </div>
            </div>
        </div>
    `}).join('');
}

// 3. Crear Local (ahora con logo)
formLocal.addEventListener('submit', async (e) => {
    e.preventDefault();
    btnCrear.textContent = 'Creando...';
    btnCrear.disabled = true;

    const nombre = document.getElementById('nombre-local').value;
    const max_sellos = document.getElementById('max-sellos').value;
    const logo_url = document.getElementById('logo-local').value;

    try {
        const { error } = await supabase
            .from('locales')
            .insert([{ nombre, max_sellos, logo_url }]);

        if (error) throw error;
        formLocal.reset();
        await cargarLocales(); 
    } catch (error) {
        alert('Error al crear: ' + error.message);
    } finally {
        btnCrear.textContent = 'Crear Barbería';
        btnCrear.disabled = false;
    }
});

// 4. Lógica del Modal de Edición
window.abrirModalEdicion = function(id) {
    const local = window.localesData.find(l => l.id === id);
    if (!local) return;

    document.getElementById('edit-id').value = local.id;
    document.getElementById('edit-nombre').value = local.nombre;
    document.getElementById('edit-sellos').value = local.max_sellos;
    document.getElementById('edit-logo').value = local.logo_url || '';

    modalEditar.classList.remove('hidden');
    modalEditar.classList.add('flex');
};

btnCerrarModal.addEventListener('click', () => {
    modalEditar.classList.add('hidden');
    modalEditar.classList.remove('flex');
});

formEditar.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const nombre = document.getElementById('edit-nombre').value;
    const max_sellos = document.getElementById('edit-sellos').value;
    const logo_url = document.getElementById('edit-logo').value;

    try {
        const { error } = await supabase
            .from('locales')
            .update({ nombre, max_sellos, logo_url })
            .eq('id', id);

        if (error) throw error;
        modalEditar.classList.add('hidden');
        modalEditar.classList.remove('flex');
        await cargarLocales();
    } catch (error) {
        alert('Error al actualizar: ' + error.message);
    }
});

// 5. Suspender / Reactivar Local (Soft Delete)
window.toggleEstado = async function(id, estadoActual) {
    const accion = estadoActual ? 'suspender' : 'reactivar';
    if (!confirm(`¿Seguro que quieres ${accion} este local?`)) return;

    try {
        const { error } = await supabase
            .from('locales')
            .update({ activo: !estadoActual }) // Invertimos el estado actual
            .eq('id', id);

        if (error) throw error;
        await cargarLocales();
    } catch (error) {
        alert(`Error al ${accion}: ` + error.message);
    }
};

cargarLocales();