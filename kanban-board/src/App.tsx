import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { ensureAnonymousSession } from './lib/auth'
import './App.css'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'


type UserType = {
  id: string
} | null

type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done'

type Task = {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: string | null
  due_date: string | null
  user_id: string
  created_at: string
}

const columns: { key: TaskStatus; label: string }[] = [
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'in_review', label: 'In Review' },
  { key: 'done', label: 'Done!' },

]

function App() {
  const [user, setUser] = useState<UserType>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [authLoading, setAuthLoading] = useState(true)
  const [taskLoading, setTaskLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [taskError, setTaskError] = useState('')
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDescription, setNewTaskDescription] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState('normal')
  const [newTaskDueDate, setNewTaskDueDate] = useState('')

//Ensure every user has a session (anonymous auth removes login friction
// while still giving each user a unique ID for data isolation)
  useEffect(() => {
    let mounted = true

    async function initAuth() {
      try {
        setAuthLoading(true)
        const session = await ensureAnonymousSession()

        if (mounted) {
          setUser(session?.user ? { id: session.user.id } : null)
        }

      } catch (error: any) {
        console.error('Anonymous auth failed:', error)
        if (mounted) {
          setAuthError(error.message || 'Failed to start guest session.')
        }

      } finally {
        if (mounted) {
          setAuthLoading(false)
        }
      }
    }

    initAuth()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id } : null)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  //Fetch tasks for the current user
  //Row Level Security(RLS) automatically filters data by auth.uid()
  async function fetchTasks() {
    try {
      setTaskLoading(true)
      setTaskError('')

      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      setTasks((data || []) as Task[])
    } catch (error: any) {
      console.error('Fetch tasks failed:', error)
      setTaskError(error.message || 'Failed to load tasks.')
    } finally {
      setTaskLoading(false)
    }
  }
//Create a new task tied to the current user session
//Additional fields (priority, due date, description) support richer task management
  async function createTask() {
    if (!user?.id || !newTaskTitle.trim()) return

    try {
      setTaskError('')
      const { error } = await supabase.from('tasks').insert([
        {
          title: newTaskTitle.trim(),
          description: newTaskDescription.trim() || null,
          priority: newTaskPriority,
          due_date: newTaskDueDate || null,
          status: 'todo',
          user_id: user.id,
        },
      ])
      if (error) throw error
      setNewTaskTitle('')
      setNewTaskDescription('')
      setNewTaskPriority('')
      setNewTaskDueDate('')

      await fetchTasks()
    } catch (error: any) {
      console.error('Create task failed:', error)
      setTaskError(error.message || 'Failed to create task.')
    }
  }

  useEffect(() => {
    if (user?.id) {
      fetchTasks()
    }
  }, [user?.id])

  //Update task status when moved between columns (drag-and-drop)
  //Persist change in Supabase so UI stays in sync with backend
  async function updateTaskStatus(taskId: string, newStatus: TaskStatus) {
    try {
      setTaskError('')
      const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', taskId)

      if (error) throw error

      await fetchTasks()
    } catch (error: any) {
      console.error('Update task status failed:', error)
      setTaskError(error.message || 'Failed to update task status.')
    }
  }

  //Delete a task by ID
  //RLS ensures users can only delete their own tasks
  async function deleteTask(taskId: string) {
    try {
      setTaskError('')
      const { error } = await supabase.from('tasks').delete().eq('id', taskId)
      if (error) throw error
      await fetchTasks()
    } catch (error: any) {
      console.error('Delete task failed:', error)
      setTaskError(error.message || 'Failed to delete task.')
    }
  }
 
  //Handle drag-and-drop interactions
  //Determines destination column and updates task status accordingly
  function handleDragEnd(result: any) {
    const { destination, source, draggableId } = result

    if(!destination) return

    const sourceColumn = source.droppableId as TaskStatus
    const destinationColumn = destination.droppableId as TaskStatus

    if (
      sourceColumn === destinationColumn &&
      source.index === destination.index
    ) {
      return
    }
    updateTaskStatus(draggableId, destinationColumn)
  }

  //Group tasks by status to render them into Kanban columns
  const tasksByStatus: Record<TaskStatus, Task[]> = {
    todo: tasks.filter((task) => task.status === 'todo'),
    in_progress: tasks.filter((task) => task.status === 'in_progress'),
    in_review: tasks.filter((task) => task.status === 'in_review'),
    done: tasks.filter((task) => task.status === 'done'),
  }
  const totalTasks = tasks.length 
  const completedTasks = tasksByStatus.done.length 
  const overdueTasks = tasks.filter(
    (task) => task.due_date && getDueDateStatus(task.due_date) === 'overdue').length
  

  if (authLoading) {
    return <div className="page-state">Starting guest session...</div>
  }

  if (authError) {
    return <div className="page-state">Error: {authError}</div>
  }

  //Determine urgency level of a task's due date (normal, soon, overdue)
  //Used to visually highlight time-sensitive tasks
  function getDueDateStatus(dueDate: string | null) {
    if (!dueDate) return 'normal'
    const today = new Date()
    const due = new Date(dueDate)

    today.setHours(0, 0, 0, 0)
    due.setHours(0, 0, 0, 0)
    const diff = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)

    if (diff < 0 ) return 'overdue'
    if (diff <=2) return 'soon'
    return 'normal'
  }

  //Format due date into a human-relatable string for better UX
  function formatDueDate(dueDate: string | null) {
    if (!dueDate) return ''
    const date = new Date(dueDate)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <main className="board-page">
      <header className="board-header">
        <div className="board-stats">
          <div className="stat-pill">
          <span className="stat-label">Total</span>
          <span className="stat-value">{totalTasks}</span>
        </div>
        <div className="stat-pill">
          <span className="stat-label">Done</span>
          <span className="stat-value">{completedTasks}</span>
        </div>
        <div className="stat-pill stat-pill-alert">
          <span className="stat-label">Overdue</span>
          <span className="stat-value">{overdueTasks}</span>

        </div>
        </div>


        <div>
          <h1>Kanban Board</h1>
          <p className="subtext">
            Guest session active: tasks persist locally
          </p>
        </div>

        <div className="task-form">
          <input
            type="text"
            placeholder="Task title"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            />
            <input
            type="text"
            placeholder="Description (optional)"
            value={newTaskDescription}
            onChange={(e) => setNewTaskDescription(e.target.value)}
            />

            <select
              value={newTaskPriority}
              onChange={(e) => setNewTaskPriority(e.target.value)}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            
            <input
              type="date"
              value={newTaskDueDate}
              onChange={(e) => setNewTaskDueDate(e.target.value)}
              />

            <button className="create-button" onClick={createTask}>
                Add Task
              </button>

        </div>
      </header>

      {taskLoading && <p className="info-message">Loading tasks...</p>}
      {taskError && <p className="error-message">Error: {taskError}</p>}

    <DragDropContext onDragEnd={handleDragEnd}>
      <section className="board-grid">
        {columns.map((column) => (

        <Droppable droppableId={column.key} key={column.key}>
          {(provided, snapshot) => (
          <div className={`board-column ${snapshot.isDraggingOver ? 'column-drag-over' : ''}`}>
            <div className="column-header">
              <h2>{column.label}</h2>
              <span className="task-count">{tasksByStatus[column.key].length}</span>
            </div>

            <div 
            className="column-body"
            ref={provided.innerRef}
            {...provided.droppableProps}
            >
              {tasksByStatus[column.key].length === 0 ? (
                <div className="empty-state">
                  <p>No tasks yet</p>
                  <span>Drag tasks here or create one</span></div>
              ) : (
                tasksByStatus[column.key].map((task, index) => (
                <Draggable draggableId={task.id} index={index} key={task.id}>
                  {(provided) => (
                  <article
                    className="task-card"
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    >
                  
                    <h3>{task.title}</h3>
                    {task.description && (
                      <p className="task-description">{task.description}</p>
                    )}

                    <div className="task-meta">
                      {task.priority && (
                        <span className={`priority-badge priority-${task.priority}`}>
                          {task.priority}
                        </span>
                      )}
                      {task.due_date && (
                        <span className={`due-date due-date-${getDueDateStatus(task.due_date)}`}>
                          Due {formatDueDate(task.due_date)}
                        </span>
                      )}
                    </div>
                  <button 
                    className="delete-task-button"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteTask(task.id)
                    }}
                    >
                      Delete
                    </button>
                  </article>
                  )}
                  </Draggable>

                ))
              )}
              {provided.placeholder}
            </div>
          </div>
          )}
          </Droppable>


        ))}
      </section>
    
    </DragDropContext>
    </main>
  )
}

export default App
