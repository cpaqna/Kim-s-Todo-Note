import type { Todo } from './todo';
import { toDateString, isSameDay, formatDateFull, isOverdue } from './utils';

let currentDate = new Date();
let allTodos: Todo[] = [];
let currentDetailDateStr: string | null = null;
const uncompletedGraceRefs = new Map<string, { dateStr: string, expiresAt: number, todo: Todo }>();
const completedGraceRefs = new Map<string, { dateStr: string, expiresAt: number, todo: Todo }>();

export function initCalendar(): void {
    renderCalendar();

    document.getElementById('prev-month')?.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });

    document.getElementById('next-month')?.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });

    document.getElementById('today-btn')?.addEventListener('click', () => {
        currentDate = new Date();
        renderCalendar();
    });

    document.getElementById('day-detail-close')?.addEventListener('click', () => {
        const detail = document.getElementById('day-detail') as HTMLElement;
        if (detail) {
            detail.style.display = 'none';
            currentDetailDateStr = null;
        }
    });

    // We can run the global countdown updating logic here or in todo.ts. 
    // We already have 10-second setTimeouts in place to actually perform the UI refresh.
}

export function updateCalendarTodos(todos: Todo[]): void {
    allTodos = todos;
    renderCalendar();
}

function renderCalendar(): void {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Update title
    const titleEl = document.getElementById('calendar-title');
    if (titleEl) {
        titleEl.textContent = `${year}년 ${month + 1}월`;
    }

    // Generate calendar days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay(); // 0=Sun
    const totalDays = lastDay.getDate();

    const prevMonthLast = new Date(year, month, 0);
    const prevMonthDays = prevMonthLast.getDate();

    const daysContainer = document.getElementById('calendar-days');
    if (!daysContainer) return;

    let html = '';
    const today = new Date();

    // Previous month days
    for (let i = startDay - 1; i >= 0; i--) {
        const day = prevMonthDays - i;
        const date = new Date(year, month - 1, day);
        const items = getItemsForDate(date);
        html += renderCalDay(day, items, 'other-month', date);
    }

    // Current month days
    for (let day = 1; day <= totalDays; day++) {
        const date = new Date(year, month, day);
        const isToday = isSameDay(date, today);
        const items = getItemsForDate(date);
        const extraClass = isToday ? 'today' : '';
        html += renderCalDay(day, items, extraClass, date);
    }

    // Next month days (fill remaining grid cells)
    const totalCells = Math.ceil((startDay + totalDays) / 7) * 7;
    const remaining = totalCells - (startDay + totalDays);
    for (let day = 1; day <= remaining; day++) {
        const date = new Date(year, month + 1, day);
        const items = getItemsForDate(date);
        html += renderCalDay(day, items, 'other-month', date);
    }

    daysContainer.innerHTML = html;

    // Bind click events
    daysContainer.querySelectorAll('.cal-day').forEach((el) => {
        el.addEventListener('click', () => {
            const dateStr = (el as HTMLElement).dataset.date;
            if (dateStr) {
                currentDetailDateStr = dateStr;
                showDayDetail(dateStr);
            }
        });
    });

    // Re-render detail view if open
    if (currentDetailDateStr && document.getElementById('day-detail')?.style.display === 'block') {
        showDayDetail(currentDetailDateStr);
    }
}

function getItemsForDate(date: Date): Todo[] {
    const dateStr = toDateString(date);
    const items: Todo[] = [];
    const now = Date.now();

    allTodos.forEach(t => {
        if (t.completed) {
            // Allocate to completedAt
            const isCompletedToday = t.completedAt && toDateString(t.completedAt) === dateStr;
            if (isCompletedToday) {
                items.push(t);
            }
            // Check completed grace period (keep an item on its due date cell for 10s after completion)
            const compGrace = completedGraceRefs.get(t.id);
            if (compGrace && compGrace.dateStr === dateStr && now < compGrace.expiresAt) {
                if (!isCompletedToday) {
                    items.push(t);
                }
            } else if (compGrace && now >= compGrace.expiresAt) {
                completedGraceRefs.delete(t.id);
            }
        } else {
            // Check grace period first
            const grace = uncompletedGraceRefs.get(t.id);
            if (grace && grace.dateStr === dateStr) {
                if (now < grace.expiresAt) {
                    // Inject a fake completed state so it renders correctly
                    items.push({ ...t, completed: true, completedAt: new Date(grace.dateStr) });
                } else {
                    uncompletedGraceRefs.delete(t.id);
                }
            } else if (t.dueDate === dateStr) {
                // Allocate to dueDate
                items.push(t);
            }
        }
    });

    return items;
}

function renderCalDay(day: number, items: Todo[], extraClass: string, date: Date): string {
    const dateStr = toDateString(date);

    // Only show up to 5 items
    const MAX_ITEMS = 5;
    const itemsToShow = items.slice(0, MAX_ITEMS);
    const extraCount = items.length - itemsToShow.length;

    let itemsHtml = '';
    if (items.length > 0) {
        itemsHtml = `<div class="cal-day-items">`;
        itemsToShow.forEach(t => {
            const isDone = t.completed ? 'done' : 'pending';
            itemsHtml += `<div class="cal-item-text ${isDone}" title="${escapeHtml(t.text)}">${escapeHtml(t.text)}</div>`;
        });
        if (extraCount > 0) {
            itemsHtml += `<div class="cal-item-more">+${extraCount}</div>`;
        }
        itemsHtml += `</div>`;
    }

    return `
    <div class="cal-day ${extraClass}" data-date="${dateStr}">
      <span class="cal-day-number">${day}</span>
      ${itemsHtml}
    </div>
  `;
}

function showDayDetail(dateStr: string): void {
    const detailEl = document.getElementById('day-detail') as HTMLElement;
    const titleEl = document.getElementById('day-detail-title') as HTMLElement;
    const contentEl = document.getElementById('day-detail-content') as HTMLElement;

    if (!detailEl || !titleEl || !contentEl) return;

    const date = new Date(dateStr + 'T00:00:00');
    titleEl.textContent = formatDateFull(date);

    const items: { todo: Todo; type: string; label: string, countdownHtml?: string }[] = [];
    const now = Date.now();

    allTodos.forEach(todo => {
        let isCompletedForThisDate = false;
        let countdownHtml = '';

        if (todo.completed) {
            const completedStr = todo.completedAt ? toDateString(todo.completedAt) : null;
            if (completedStr === dateStr) {
                isCompletedForThisDate = true;
            }

            const compGrace = completedGraceRefs.get(todo.id);
            if (compGrace && compGrace.dateStr === dateStr && now < compGrace.expiresAt) {
                const secs = Math.ceil((compGrace.expiresAt - now) / 1000);
                const dueCountdownHtml = `<span class="countdown-timer cal-countdown" style="font-size: 0.75rem; color: var(--text-muted); margin-left: auto;" data-expires="${compGrace.expiresAt}">(${secs}초)</span>`;
                // Add it specifically as a due item since it was checked from this date
                items.push({ todo: { ...todo, completed: true }, type: 'due', label: '마감일', countdownHtml: dueCountdownHtml });
            }
        } else {
            const grace = uncompletedGraceRefs.get(todo.id);
            if (grace && grace.dateStr === dateStr && now < grace.expiresAt) {
                isCompletedForThisDate = true;
                const secs = Math.ceil((grace.expiresAt - now) / 1000);
                countdownHtml = `<span class="countdown-timer cal-countdown" style="font-size: 0.75rem; color: var(--text-muted); margin-left: auto;" data-expires="${grace.expiresAt}">(${secs}초)</span>`;
            }
        }

        if (isCompletedForThisDate) {
            items.push({ todo: { ...todo, completed: todo.completed }, type: 'completed', label: '완료됨', countdownHtml });
        } else if (!todo.completed && todo.dueDate === dateStr) {
            const overdue = !todo.completed && isOverdue(todo.dueDate);
            items.push({
                todo,
                type: overdue ? 'overdue' : 'due',
                label: overdue ? '기한 초과' : '마감일'
            });
        }
    });

    if (items.length === 0) {
        contentEl.innerHTML = `<div class="detail-empty">이 날짜에 해당하는 항목이 없습니다.</div>`;
    } else {
        contentEl.innerHTML = items.map(item => {
            const doneClass = item.todo.completed ? 'done' : '';
            return `
        <div class="detail-item" style="display: flex; align-items: center; width: 100%;">
          <label class="todo-checkbox">
            <input type="checkbox" class="check-toggle cal-check-toggle" data-id="${item.todo.id}" ${item.todo.completed ? 'checked' : ''} />
            <span class="checkmark"></span>
          </label>
          <span class="detail-text ${doneClass}">${escapeHtml(item.todo.text)}</span>
          ${item.countdownHtml || ''}
        </div>
      `;
        }).join('');

        // Bind checkbox clicks
        contentEl.querySelectorAll('.cal-check-toggle').forEach(el => {
            el.addEventListener('change', async (e) => {
                const target = e.target as HTMLInputElement;
                const id = target.dataset.id;
                if (!id) return;

                const realTodo = allTodos.find(t => t.id === id);
                if (realTodo) {
                    if (realTodo.completed && realTodo.completedAt) {
                        // Added to uncompleted grace period
                        uncompletedGraceRefs.set(id, {
                            dateStr: toDateString(realTodo.completedAt),
                            expiresAt: Date.now() + 10000,
                            todo: realTodo
                        });
                        setTimeout(() => renderCalendar(), 10000);
                    } else if (!realTodo.completed && realTodo.dueDate) {
                        // Added to completed grace period
                        completedGraceRefs.set(id, {
                            dateStr: realTodo.dueDate,
                            expiresAt: Date.now() + 10000,
                            todo: realTodo
                        });
                        setTimeout(() => renderCalendar(), 10000);
                    }
                }

                // Actually toggle the state
                const { toggleTodo } = await import('./todo');
                toggleTodo(id);
            });
        });
    }

    detailEl.style.display = 'block';
    detailEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
