import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { getAccessToken } from '../auth/AuthApi.js'

export const productApi = createApi({
  reducerPath: 'productApi',
  baseQuery: fetchBaseQuery({
    baseUrl: '/v1/products',
    prepareHeaders: (headers) => {
      const token = getAccessToken()
      if (token) headers.set('Authorization', `Bearer ${token}`)
      return headers
    },
  }),
  tagTypes: ['MyProducts', 'BrowseProducts', 'Wishlist', 'Cart', 'MyOrders', 'SalesOrders', 'ProductBids', 'ReceivedBids'],
  endpoints: (builder) => ({
    getMyProducts: builder.query({ query: () => '/', providesTags: ['MyProducts'] }),
    browseProducts: builder.query({ query: (liveDeals) => liveDeals ? '/browse?liveDeals=1' : '/browse', providesTags: ['BrowseProducts'] }),
    getProductBids: builder.query({ query: (id) => `/${id}/bids`, providesTags: (_result, _error, id) => [{ type: 'ProductBids', id }] }),
    getReceivedBids: builder.query({ query: () => '/bids/received', providesTags: ['ReceivedBids'] }),
    placeBid: builder.mutation({
      query: ({ id, amount, note }) => ({ url: `/${id}/bids`, method: 'POST', body: { amount, note } }),
      invalidatesTags: (_result, _error, { id }) => ['BrowseProducts', 'MyProducts', 'ReceivedBids', { type: 'ProductBids', id }],
    }),
    getWishlist: builder.query({ query: () => '/wishlist', providesTags: ['Wishlist'] }),
    addWishlist: builder.mutation({ query: (id) => ({ url: `/wishlist/${id}`, method: 'POST' }), invalidatesTags: ['Wishlist'] }),
    removeWishlist: builder.mutation({ query: (id) => ({ url: `/wishlist/${id}`, method: 'DELETE' }), invalidatesTags: ['Wishlist'] }),
    getCart: builder.query({ query: () => '/cart', providesTags: ['Cart'] }),
    addCart: builder.mutation({ query: ({ id, quantity = 1 }) => ({ url: `/cart/${id}`, method: 'POST', body: { quantity } }), invalidatesTags: ['Cart'] }),
    updateCart: builder.mutation({ query: ({ id, quantity }) => ({ url: `/cart/${id}`, method: 'PUT', body: { quantity } }), invalidatesTags: ['Cart'] }),
    removeCart: builder.mutation({ query: (id) => ({ url: `/cart/${id}`, method: 'DELETE' }), invalidatesTags: ['Cart'] }),
    checkout: builder.mutation({ query: (body) => ({ url: '/checkout', method: 'POST', body }), invalidatesTags: ['Cart', 'MyOrders', 'SalesOrders', 'BrowseProducts', 'MyProducts', 'Wishlist'] }),
    getMyOrders: builder.query({ query: () => '/orders/mine', providesTags: ['MyOrders'] }),
    getSalesOrders: builder.query({ query: () => '/orders/sales', providesTags: ['SalesOrders'] }),
    updateSalesOrder: builder.mutation({ query: ({ id, status }) => ({ url: `/orders/${id}/status`, method: 'PATCH', body: { status } }), invalidatesTags: ['SalesOrders', 'MyOrders', 'BrowseProducts', 'MyProducts', 'Wishlist', 'Cart'] }),
    cancelOrder: builder.mutation({ query: (id) => ({ url: `/orders/${id}/cancel`, method: 'PATCH' }), invalidatesTags: ['MyOrders', 'SalesOrders', 'BrowseProducts', 'MyProducts', 'Wishlist', 'Cart'] }),
    createProduct: builder.mutation({ query: (body) => ({ url: '/', method: 'POST', body }), invalidatesTags: ['MyProducts', 'BrowseProducts'] }),
    updateProduct: builder.mutation({ query: ({ id, ...body }) => ({ url: `/${id}`, method: 'PUT', body }), invalidatesTags: ['MyProducts', 'BrowseProducts', 'Wishlist', 'Cart'] }),
    deleteProduct: builder.mutation({ query: (id) => ({ url: `/${id}`, method: 'DELETE' }), invalidatesTags: ['MyProducts', 'BrowseProducts', 'Wishlist', 'Cart'] }),
  }),
})

export const {
  useGetMyProductsQuery, useBrowseProductsQuery, useGetWishlistQuery,
  useGetProductBidsQuery, useGetReceivedBidsQuery, usePlaceBidMutation,
  useAddWishlistMutation, useRemoveWishlistMutation, useGetCartQuery,
  useAddCartMutation, useUpdateCartMutation, useRemoveCartMutation,
  useCheckoutMutation, useGetMyOrdersQuery, useGetSalesOrdersQuery,
  useUpdateSalesOrderMutation, useCancelOrderMutation,
  useCreateProductMutation, useUpdateProductMutation, useDeleteProductMutation,
} = productApi
