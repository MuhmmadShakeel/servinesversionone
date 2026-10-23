import { configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'
import { authApi } from '../Api/auth/AuthApi.js'
import { serviceApi } from '../Api/service/ServiceApi.js'
import { hiringApi } from '../Api/hiring/HiringApi.js'
import { productApi } from '../Api/product/ProductApi.js'
import { chatApi } from '../Api/chat/ChatApi.js'
import { apiToastMiddleware } from './apiToastMiddleware.js'

export const store = configureStore({
  reducer: { [authApi.reducerPath]: authApi.reducer, [serviceApi.reducerPath]: serviceApi.reducer, [hiringApi.reducerPath]: hiringApi.reducer, [productApi.reducerPath]: productApi.reducer, [chatApi.reducerPath]: chatApi.reducer },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(authApi.middleware, serviceApi.middleware, hiringApi.middleware, productApi.middleware, chatApi.middleware, apiToastMiddleware),
})

setupListeners(store.dispatch)
