import { useEffect, useState } from 'react'
import { Icon } from '../common/Icon.jsx'
import { getAccessToken } from '../../redux/Api/auth/AuthApi.js'

export function ServiceImage({ service }) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    if (!service?.hasImage) return undefined
    const controller = new AbortController()
    let objectUrl
    fetch(`/v1/services/${service.id}/image`, {
      headers: { Authorization: `Bearer ${getAccessToken()}` }, signal: controller.signal,
    }).then((response) => {
      if (!response.ok) throw new Error('Image unavailable')
      return response.blob()
    }).then((blob) => {
      if (controller.signal.aborted) return
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
    }).catch(() => {})
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [service?.id, service?.hasImage, service?.updatedAt])

  return <div className="service-cover">{service.hasImage && url ? <img src={url} alt={service.title}/> : <span><Icon name="image" size={28}/></span>}</div>
}
