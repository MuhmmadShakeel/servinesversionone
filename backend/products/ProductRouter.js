import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { browseProducts, createProduct, deleteProduct, getProductImage, getProductVoice, listMyProducts, updateProduct } from './ProductController.js'
import {
  addCart, addWishlist, cancelOrder, checkout, listCart, listWishlist,
  myOrders, removeCart, removeWishlist, sellerOrders, updateCart, updateSellerOrder,
} from './CommerceController.js'
import { listProductBids, listReceivedBids, placeBid } from './ProductBidController.js'

const router = Router()
const bidLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false })
router.get('/', listMyProducts)
router.post('/', createProduct)
router.get('/browse', browseProducts)
router.get('/bids/received', listReceivedBids)
router.get('/wishlist', listWishlist)
router.post('/wishlist/:id', addWishlist)
router.delete('/wishlist/:id', removeWishlist)
router.get('/cart', listCart)
router.post('/cart/:id', addCart)
router.put('/cart/:id', updateCart)
router.delete('/cart/:id', removeCart)
router.post('/checkout', checkout)
router.get('/orders/mine', myOrders)
router.get('/orders/sales', sellerOrders)
router.patch('/orders/:id/status', updateSellerOrder)
router.patch('/orders/:id/cancel', cancelOrder)
router.get('/:id/image', getProductImage)
router.get('/:id/voice', getProductVoice)
router.get('/:id/bids', listProductBids)
router.post('/:id/bids', bidLimit, placeBid)
router.put('/:id', updateProduct)
router.delete('/:id', deleteProduct)

export default router
