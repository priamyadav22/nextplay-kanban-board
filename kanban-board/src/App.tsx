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
  status: TaskStatus
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

  async function createTestTask(title: string) {
    if (!user?.id || !title.trim()) return

    try {
      setTaskError('')
      const { error } = await supabase.from('tasks').insert([
        {
          title,
          status: 'todo',
          user_id: user.id,
        },
      ])
      if (error) throw error

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

  const tasksByStatus: Record<TaskStatus, Task[]> = {
    todo: tasks.filter((task) => task.status === 'todo'),
    in_progress: tasks.filter((task) => task.status === 'in_progress'),
    in_review: tasks.filter((task) => task.status === 'in_review'),
    done: tasks.filter((task) => task.status === 'done'),
  }

  if (authLoading) {
    return <div className="page-state">Starting guest session...</div>
  }

  if (authError) {
    return <div className="page-state">Error: {authError}</div>
  }

  return (
    <main className="board-page">
      <header className="board-header">
        <div>
          <h1>Kanban Board</h1>
          <p className="subtext">Guest user id: {user?.id}</p>
        </div>

        <div className="task-input-wrapper">
          <input
            type="text"
            placeholder="Add a task..."
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            />
            <button
              className="create-button"
              onClick={() => {
                createTestTask(newTaskTitle)
                setNewTaskTitle('')
              }}
              >
                Add
              </button>

        </div>
      </header>

      {taskLoading && <p className="info-message">Loading tasks...</p>}
      {taskError && <p className="error-message">Error: {taskError}</p>}
    <DragDropContext onDragEnd={handleDragEnd}>
      <section className="board-grid">
        {columns.map((column) => (

        <Droppable droppableId={column.key} key={column.key}>
          {(provided) => (
          <div className="board-column">
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
                <div className="empty-state">No tasks</div>
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
                    <p className="task-status">{task.status}</p>
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
