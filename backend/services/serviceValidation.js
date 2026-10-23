import { ApiError } from '../common/utils/ApiError.js'
import { validateVoice } from '../common/voice/voiceStorage.js'
import { validateProductImage } from '../products/productValidation.js'

export const serviceIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function requiredText(value, label, min, max) {
  if (typeof value !== 'string') throw new ApiError(400, `${label} is required.`)
  const text = value.trim().replace(/\s+/g, ' ')
  if (text.length < min || text.length > max) throw new ApiError(400, `${label} must be ${min}–${max} characters.`)
  return text
}

export function validateService(input) {
  const fields = ['title', 'category', 'city', 'description', 'price', 'originalPrice', 'experienceYears', 'status', 'voice', 'image']
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some((key) => !fields.includes(key))) {
    throw new ApiError(400, 'Enter valid service details.')
  }
  const priceText = String(input.price ?? '')
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(priceText)) throw new ApiError(400, 'Price must be a non-negative amount with up to two decimal places.')
  const originalPrice = String(input.originalPrice ?? priceText)
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(originalPrice) || Number(originalPrice) < Number(priceText)) throw new ApiError(400, 'Original price must be at least the discounted price.')
  const experienceText = String(input.experienceYears ?? '')
  const experienceYears = Number(experienceText)
  if (!/^(0|[1-9]\d?)$/.test(experienceText) || experienceYears > 60) {
    throw new ApiError(400, 'Experience must be between 0 and 60 years.')
  }
  const status = input.status ?? 'draft'
  if (!['draft', 'active'].includes(status)) throw new ApiError(400, 'Choose Draft or Active status.')
  return {
    title: requiredText(input.title, 'Title', 3, 120),
    category: requiredText(input.category, 'Category', 2, 80),
    ...(input.city === undefined ? {} : { city: requiredText(input.city, 'City', 2, 80) }),
    description: requiredText(input.description, 'Description', 10, 2000),
    price: priceText,
    originalPrice,
    experienceYears,
    status,
    ...(input.image === undefined ? {} : { image: validateProductImage(input.image) }),
    ...(input.voice === undefined ? {} : { voice: validateVoice(input.voice) }),
  }
}
