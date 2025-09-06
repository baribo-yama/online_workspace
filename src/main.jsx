import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './globals.css'
import StudyRoomApp from './StudyRoomApp.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <StudyRoomApp />
  </StrictMode>,
)
