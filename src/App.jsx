import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './components/HomePage.jsx'
import Interaction from './components/interaction.jsx'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/interaction" element={<Interaction />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
