import { db, isFirebaseConfigured } from './firebase';
import { getCurrentUser } from './auth';
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    orderBy,
    Timestamp,
    writeBatch
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { formatShortDate, isOverdue, generateId } from './utils';

export interface Todo {
    id: string;
    text: string;
    completed: boolean;
    createdAt: Date;
    completedAt: Date | null;
    dueDate: string | null;
    order: number;
}

type TodosCallback = (todos: Todo[]) => void;

let unsubscribe: Unsubscribe | null = null;
let currentTodos: Todo[] = [];
let todosCallback: TodosCallback | null = null;
let currentFilter: string = 'all';

// Variables for handling focus and drag & drop
let focusedInputId: string | null = null;
let draggedItemId: string | null = null;

// ===== LocalStorage helpers (demo mode) =====
const LOCAL_KEY = 'todoNoteApp_todos';

function loadLocalTodos(): Todo[] {
    try {
        const raw = localStorage.getItem(LOCAL_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return parsed.map((t: any) => ({
            ...t,
            createdAt: new Date(t.createdAt),
            completedAt: t.completedAt ? new Date(t.completedAt) : null,
        }));
    } catch { return []; }
}

function saveLocalTodos(): void {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(currentTodos));
}

// ===== Firestore helpers =====
function getUserTodosRef() {
    const user = getCurrentUser();
    if (!user || !db) throw new Error('Not authenticated or DB not available');
    return collection(db, 'users', user.uid, 'todos');
}

export function subscribeTodos(callback: TodosCallback): void {
    todosCallback = callback;

    if (!isFirebaseConfigured || !db) {
        currentTodos = loadLocalTodos();
        renderTodos();
        return;
    }

    if (unsubscribe) {
        unsubscribe();
    }

    try {
        const todosRef = getUserTodosRef();
        // Sort by order ascending
        const q = query(todosRef, orderBy('order', 'asc'));

        unsubscribe = onSnapshot(q, (snapshot) => {
            // Restore focus safely
            const activeEl = document.activeElement as HTMLInputElement;
            if (activeEl && activeEl.dataset.id) {
                focusedInputId = activeEl.dataset.id;
            }

            currentTodos = snapshot.docs.map((docSnap) => {
                const data = docSnap.data();
                return {
                    id: docSnap.id,
                    text: data.text,
                    completed: data.completed,
                    createdAt: data.createdAt?.toDate() || new Date(),
                    completedAt: data.completedAt?.toDate() || null,
                    dueDate: data.dueDate || null,
                    order: data.order || 0,
                };
            });

            renderTodos();
        }, (error) => {
            console.error('Firestore listener error:', error);
        });
    } catch (error) {
        console.error('Subscribe error:', error);
    }
}

export function unsubscribeTodos(): void {
    if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
    }
    currentTodos = [];
    todosCallback = null;
}

export async function addTodo(text: string, dueDate: string | null): Promise<string | null> {
    if (!text.trim()) return null;

    // Calculate maximum order
    const maxOrder = currentTodos.length > 0
        ? Math.max(...currentTodos.map(t => t.order))
        : 0;

    if (!isFirebaseConfigured || !db) {
        const newId = generateId();
        const todo: Todo = {
            id: newId,
            text: text.trim(),
            completed: false,
            createdAt: new Date(),
            completedAt: null,
            dueDate: dueDate || null,
            order: maxOrder + 1000,
        };
        currentTodos.push(todo);
        saveLocalTodos();
        renderTodos();
        return newId;
    }

    try {
        const todosRef = getUserTodosRef();
        const docRef = await addDoc(todosRef, {
            text: text.trim(),
            completed: false,
            createdAt: Timestamp.now(),
            completedAt: null,
            dueDate: dueDate || null,
            order: maxOrder + 1000,
        });
        return docRef.id;
    } catch (error) {
        console.error('Add todo error:', error);
        return null;
    }
}

export async function updateTodoText(todoId: string, newText: string): Promise<void> {
    if (!newText.trim()) {
        deleteTodo(todoId);
        return;
    }

    if (!isFirebaseConfigured || !db) {
        const todo = currentTodos.find(t => t.id === todoId);
        if (todo && todo.text !== newText) {
            todo.text = newText;
            saveLocalTodos();
        }
        return;
    }

    try {
        const user = getCurrentUser();
        if (!user) return;
        const todoRef = doc(db, 'users', user.uid, 'todos', todoId);
        await updateDoc(todoRef, { text: newText });
    } catch (error) {
        console.error('Update text error:', error);
    }
}

export async function updateTodoDueDate(todoId: string, dueDate: string | null): Promise<void> {
    if (!isFirebaseConfigured || !db) {
        const todo = currentTodos.find(t => t.id === todoId);
        if (todo) {
            todo.dueDate = dueDate;
            saveLocalTodos();
            renderTodos();
        }
        return;
    }

    try {
        const user = getCurrentUser();
        if (!user) return;
        const todoRef = doc(db, 'users', user.uid, 'todos', todoId);
        await updateDoc(todoRef, { dueDate });
    } catch (error) {
        console.error('Update date error:', error);
    }
}

export async function toggleTodo(todoId: string): Promise<void> {
    if (!isFirebaseConfigured || !db) {
        // Demo mode
        const todo = currentTodos.find(t => t.id === todoId);
        if (!todo) return;
        todo.completed = !todo.completed;
        todo.completedAt = todo.completed ? new Date() : null;
        saveLocalTodos();
        renderTodos();

        if (todo.completed) {
            setTimeout(() => renderTodos(), 10000);
        }
        return;
    }

    try {
        const user = getCurrentUser();
        if (!user) return;

        const todoRef = doc(db, 'users', user.uid, 'todos', todoId);
        const todo = currentTodos.find(t => t.id === todoId);
        if (!todo) return;

        if (todo.completed) {
            await updateDoc(todoRef, {
                completed: false,
                completedAt: null,
            });
        } else {
            await updateDoc(todoRef, {
                completed: true,
                completedAt: Timestamp.now(),
            });
            setTimeout(() => renderTodos(), 10000);
        }
    } catch (error) {
        console.error('Toggle todo error:', error);
    }
}

export async function deleteTodo(todoId: string): Promise<void> {
    if (!isFirebaseConfigured || !db) {
        currentTodos = currentTodos.filter(t => t.id !== todoId);
        saveLocalTodos();
        renderTodos();
        return;
    }

    try {
        const user = getCurrentUser();
        if (!user) return;
        const todoRef = doc(db, 'users', user.uid, 'todos', todoId);
        await deleteDoc(todoRef);
    } catch (error) {
        console.error('Delete todo error:', error);
    }
}

// Drag & Drop logic
export async function reorderTodosLocal(draggedId: string, targetId: string): Promise<void> {
    if (draggedId === targetId) return;

    // Sort logic
    currentTodos.sort((a, b) => a.order - b.order);

    const dragIdx = currentTodos.findIndex(t => t.id === draggedId);
    const targetIdx = currentTodos.findIndex(t => t.id === targetId);
    if (dragIdx === -1 || targetIdx === -1) return;

    const [draggedItem] = currentTodos.splice(dragIdx, 1);
    currentTodos.splice(targetIdx, 0, draggedItem);

    // Reassign orders
    currentTodos.forEach((t, i) => { t.order = i * 1000; });

    renderTodos();

    if (!isFirebaseConfigured || !db) {
        saveLocalTodos();
        return;
    }

    // Update Firestore via batch
    try {
        const user = getCurrentUser();
        if (!user) return;
        const b = writeBatch(db);
        currentTodos.forEach(t => {
            const ref = doc(db!, 'users', user.uid, 'todos', t.id);
            b.update(ref, { order: t.order });
        });
        await b.commit();
    } catch (e) {
        console.error('Batch order update failed', e);
    }
}

export function setFilter(filter: string): void {
    currentFilter = filter;
    renderTodos();
}

export function getTodos(): Todo[] {
    return currentTodos;
}

function getFilteredTodos(): Todo[] {
    const now = Date.now();
    let sorted = [...currentTodos].sort((a, b) => a.order - b.order);

    // Globally filter out completed tasks that were completed more than 10 seconds ago
    sorted = sorted.filter(t => {
        if (!t.completed) return true;
        if (t.completedAt) {
            return (now - t.completedAt.getTime()) <= 10000;
        }
        return false;
    });

    switch (currentFilter) {
        case 'active':
            return sorted.filter(t => !t.completed);
        case 'completed':
            return sorted.filter(t => t.completed);
        default:
            return sorted;
    }
}

function renderTodos(): void {
    const listEl = document.getElementById('todo-list') as HTMLElement;
    if (!listEl) return;

    let html = getFilteredTodos().map(todo => renderTodoItem(todo)).join('');

    // Virtual empty row at the bottom
    html += renderVirtualRow();

    listEl.innerHTML = html;

    bindEvents(listEl);

    // Restore focus if needed
    if (focusedInputId) {
        let inputToFocus: HTMLInputElement | null = null;
        if (focusedInputId === 'virtual') {
            inputToFocus = listEl.querySelector('.add-virtual') as HTMLInputElement;
        } else {
            inputToFocus = listEl.querySelector(`input[data-id="${focusedInputId}"]`) as HTMLInputElement;
        }

        if (inputToFocus) {
            // Move cursor to end
            inputToFocus.focus();
            const val = inputToFocus.value;
            inputToFocus.value = '';
            inputToFocus.value = val;
        }
        focusedInputId = null;
    }

    if (todosCallback) {
        todosCallback(currentTodos);
    }
}

function renderTodoItem(todo: Todo): string {
    const isCompleted = todo.completed;
    const completedClass = isCompleted ? 'completed' : '';
    const createdStr = formatShortDate(todo.createdAt);
    let completedStr = todo.completedAt ? formatShortDate(todo.completedAt) : '';

    let dueClass = '';
    let dueIcon = '📅';
    if (todo.dueDate) {
        const overdue = !todo.completed && isOverdue(todo.dueDate);
        dueClass = overdue ? 'overdue' : 'has-due';
        const d = new Date(todo.dueDate + 'T00:00:00');
        dueIcon = `${d.getMonth() + 1}/${d.getDate()}`;
    }

    let countdownHtml = '';
    if (isCompleted && todo.completedAt) {
        const expiresAt = new Date(todo.completedAt).getTime() + 10000;
        const remaining = expiresAt - Date.now();
        if (remaining > 0) {
            const secs = Math.ceil(remaining / 1000);
            countdownHtml = `<span class="countdown-timer" style="color: var(--text-muted); font-size: 0.8rem; margin-right: 8px;" data-expires="${expiresAt}">(${secs}초 뒤 숨김)</span>`;
        }
    }

    return `
    <div class="todo-item ${completedClass}" data-id="${todo.id}" draggable="true">
      <div class="drag-handle" title="드래그하여 순서 변경">⠿</div>
      <label class="todo-checkbox">
        <input type="checkbox" class="check-toggle" ${todo.completed ? 'checked' : ''} data-id="${todo.id}" />
        <span class="checkmark"></span>
      </label>
      <div class="todo-content">
        <input type="text" class="todo-text-input edit-todo" value="${escapeHtml(todo.text)}" data-id="${todo.id}" placeholder="비어 있는 할 일..." autocomplete="off" spellcheck="false" />
      </div>
      <div class="todo-meta">
        ${countdownHtml}
        <span class="date-label created">${createdStr}</span>
        ${completedStr ? `<span class="date-label completed">${completedStr}</span>` : ''}
        <label class="btn-due-date ${dueClass}" title="마감일 설정">
          <span>${dueIcon}</span>
          <input type="date" class="due-date-picker" data-id="${todo.id}" value="${todo.dueDate || ''}" />
        </label>
      </div>
      <button class="btn-delete" data-id="${todo.id}" title="삭제">🗑</button>
    </div>
  `;
}

function renderVirtualRow(): string {
    return `
    <div class="todo-item virtual-row">
      <div class="drag-handle" style="opacity:0; cursor:default;">⠿</div>
      <label class="todo-checkbox">
        <input type="checkbox" disabled />
        <span class="checkmark"></span>
      </label>
      <div class="todo-content">
        <input type="text" class="todo-text-input add-virtual" placeholder="새로운 할 일을 자유롭게 타이핑하세요..." autocomplete="off" spellcheck="false" />
      </div>
      <div class="todo-meta">
      </div>
    </div>
  `;
}

function bindEvents(listEl: HTMLElement): void {
    // Checkbox toggle
    listEl.querySelectorAll('.check-toggle').forEach((el) => {
        el.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            if (target.dataset.id) toggleTodo(target.dataset.id);
        });
    });

    // Delete button
    listEl.querySelectorAll('.btn-delete').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLElement;
            if (target.dataset.id) deleteTodo(target.dataset.id);
        });
    });

    // Inline edit logic
    listEl.querySelectorAll('.edit-todo').forEach((input) => {
        const el = input as HTMLInputElement;

        // Auto-save on blur
        el.addEventListener('blur', () => {
            const id = el.dataset.id;
            if (id) updateTodoText(id, el.value);
        });

        // Also save on enter key
        el.addEventListener('keydown', (e: Event) => {
            const keyEvent = e as KeyboardEvent;
            if (keyEvent.key === 'Enter') {
                el.blur();
                // Optionally jump to the virtual row
                const virtualInput = listEl.querySelector('.add-virtual') as HTMLInputElement;
                if (virtualInput) virtualInput.focus();
            }
        });
    });

    // Virtual row auto-create mechanics
    const virtualInput = listEl.querySelector('.add-virtual') as HTMLInputElement;
    if (virtualInput) {
        let isComposing = false;

        virtualInput.addEventListener('compositionstart', () => { isComposing = true; });
        virtualInput.addEventListener('compositionend', () => { isComposing = false; });

        virtualInput.addEventListener('input', () => {
            const val = virtualInput.value;
            const metaContainer = virtualInput.closest('.todo-item')?.querySelector('.todo-meta');

            if (val.trim().length > 0) {
                // Show date instantly to user without breaking DOM / IME
                if (metaContainer && !metaContainer.querySelector('.date-label.created')) {
                    const dateStr = formatShortDate(new Date());
                    metaContainer.innerHTML = `<span class="date-label created">${dateStr}</span>`;
                }
            } else {
                if (metaContainer) metaContainer.innerHTML = '';
            }
        });

        // Actually save the row
        let isSaving = false;
        const saveVirtualRow = async () => {
            if (isSaving) return;
            const val = virtualInput.value;
            if (val.trim().length > 0 && !isComposing) {
                isSaving = true;
                virtualInput.value = ''; // synchronously clear the value before await
                await addTodo(val, null);
                // Default behavior: focus the newly rendered virtual row 
                focusedInputId = 'virtual';
                isSaving = false;
            }
        };

        virtualInput.addEventListener('blur', saveVirtualRow);

        virtualInput.addEventListener('keydown', (e: Event) => {
            const keyEvent = e as KeyboardEvent;
            if (keyEvent.key === 'Enter') {
                if (isComposing) return; // ignore Enter from IME
                saveVirtualRow();
            }
        });
    }

    // Due Date change
    listEl.querySelectorAll('.due-date-picker').forEach((picker) => {
        picker.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            const id = target.dataset.id;
            if (id) {
                updateTodoDueDate(id, target.value || null);
            }
        });
    });

    // Drag and Drop
    listEl.querySelectorAll('.todo-item[draggable="true"]').forEach(item => {
        const el = item as HTMLElement;

        el.addEventListener('dragstart', (e) => {
            draggedItemId = el.dataset.id || null;
            el.classList.add('dragging');
            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', draggedItemId || '');
            }
        });

        el.addEventListener('dragend', () => {
            el.classList.remove('dragging');
            listEl.querySelectorAll('.todo-item').forEach(i => i.classList.remove('drag-over'));
            draggedItemId = null;
        });

        el.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';

            // Only add visual cue if it's not the same item
            if (el.dataset.id !== draggedItemId && !el.classList.contains('virtual-row')) {
                el.classList.add('drag-over');
            }
        });

        el.addEventListener('dragleave', () => {
            el.classList.remove('drag-over');
        });

        el.addEventListener('drop', (e) => {
            e.preventDefault();
            el.classList.remove('drag-over');
            if (draggedItemId && el.dataset.id && draggedItemId !== el.dataset.id) {
                reorderTodosLocal(draggedItemId, el.dataset.id);
            }
        });
    });
}

function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    // Replace quotes so it doesn't break input values
    return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
