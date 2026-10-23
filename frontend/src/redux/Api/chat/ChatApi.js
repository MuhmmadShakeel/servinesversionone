import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { getAccessToken, getStoredUser } from '../auth/AuthApi.js'

export const chatApi = createApi({
  reducerPath: 'chatApi',
  baseQuery: fetchBaseQuery({
    baseUrl: '/v1/chat',
    prepareHeaders: (headers) => {
      const token = getAccessToken()
      if (token) headers.set('Authorization', `Bearer ${token}`)
      return headers
    },
  }),
  tagTypes: ['Conversations', 'Messages'],
  endpoints: (builder) => ({
    getConversations: builder.query({ query: () => '/conversations', providesTags: ['Conversations'] }),
    startConversation: builder.mutation({
      query: (body) => ({ url: '/conversations', method: 'POST', body }),
      invalidatesTags: ['Conversations'],
    }),
    getMessages: builder.query({
      query: ({ id, before }) => `/conversations/${id}/messages${before ? `?before=${before}` : ''}`,
      providesTags: (_result, _error, { id }) => [{ type: 'Messages', id }],
    }),
    markRead: builder.mutation({
      query: ({ id, messageId }) => ({ url: `/conversations/${id}/read`, method: 'POST', body: { messageId } }),
      invalidatesTags: ['Conversations'],
    }),
    sendMessage: builder.mutation({
      query: ({ id, body }) => ({ url: `/conversations/${id}/messages`, method: 'POST', body: { body } }),
      async onQueryStarted({ id, body }, { dispatch, queryFulfilled }) {
        const pendingId = `pending-${Date.now()}-${Math.random()}`
        const pending = dispatch(chatApi.util.updateQueryData('getMessages', { id }, (draft) => {
          draft.messages.push({ id: pendingId, conversationId: id, senderUserId: getStoredUser()?.id, senderName: 'You', body, createdAt: new Date().toISOString(), seenAt: null, pending: true })
        }))
        try {
          const { data } = await queryFulfilled
          if (pending.patches.length) {
            dispatch(chatApi.util.updateQueryData('getMessages', { id }, (draft) => {
              const index = draft.messages.findIndex((item) => item.id === pendingId)
              if (index >= 0) draft.messages[index] = data.message
              else draft.messages.push(data.message)
            }))
          } else dispatch(chatApi.util.invalidateTags([{ type: 'Messages', id }]))
        } catch { pending.undo() }
      },
      invalidatesTags: ['Conversations'],
    }),
    editMessage: builder.mutation({
      query: ({ id, messageId, body }) => ({ url: `/conversations/${id}/messages/${messageId}`, method: 'PATCH', body: { body } }),
      invalidatesTags: (_result, _error, { id }) => ['Conversations', { type: 'Messages', id }],
    }),
    deleteMessage: builder.mutation({
      query: ({ id, messageId }) => ({ url: `/conversations/${id}/messages/${messageId}`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, { id }) => ['Conversations', { type: 'Messages', id }],
    }),
    clearConversation: builder.mutation({
      query: (id) => ({ url: `/conversations/${id}/messages`, method: 'DELETE' }),
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled
          dispatch(chatApi.util.updateQueryData('getMessages', { id }, (draft) => {
            draft.messages = []
            draft.nextCursor = null
          }))
        } catch { /* Keep the existing history if clearing fails. */ }
      },
      invalidatesTags: (_result, _error, id) => ['Conversations', { type: 'Messages', id }],
    }),
  }),
})

export const {
  useGetConversationsQuery, useStartConversationMutation,
  useGetMessagesQuery, useLazyGetMessagesQuery, useSendMessageMutation,
  useMarkReadMutation,
  useEditMessageMutation, useDeleteMessageMutation, useClearConversationMutation,
} = chatApi
