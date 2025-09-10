import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './globals.css'
import StudyRoomApp from './StudyRoomApp.jsx'
// firestoreのテスト用でApp.jsxを呼び出し
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* <StudyRoomApp /> */}
    <App />
  </StrictMode>,
)
