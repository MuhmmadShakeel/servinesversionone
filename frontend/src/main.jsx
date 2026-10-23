import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { Provider } from 'react-redux'
import App from './App.jsx'
import './index.css'
import './styles/dashboard.css'
import './styles/auth.css'
import './styles/services.css'
import './styles/hiring.css'
import './styles/products.css'
import './styles/chat.css'
import './styles/share.css'
import './styles/listing-filters.css'
import './styles/pricing.css'
import './styles/boost.css'
import './styles/reviews.css'
import './styles/polish.css'
import { store } from './redux/store/Store.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <App />
      <ToastContainer
        position="top-right"
        autoClose={4000}
        limit={3}
        newestOnTop
        closeOnClick
        pauseOnHover
        draggable
        theme="light"
      />
    </Provider>
  </StrictMode>,
)
