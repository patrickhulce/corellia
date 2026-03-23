import { FloorplanProvider } from './context/FloorplanContext'
import { Sidebar } from './components/Sidebar'
import { FloorplanCanvas } from './components/FloorplanCanvas'
import './App.css'

function App() {
  return (
    <FloorplanProvider>
      <div className="app-shell">
        <Sidebar />
        <FloorplanCanvas />
      </div>
    </FloorplanProvider>
  )
}

export default App
