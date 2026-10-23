import { useEffect, useState } from 'react'
import { getAccessToken } from '../../redux/Api/auth/AuthApi.js'

export function CategoryField({ kind, defaultValue = '' }) {
  const [categories, setCategories] = useState([])
  const [value, setValue] = useState(defaultValue)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/v1/categories/${kind}`, {
      headers: { Authorization: `Bearer ${getAccessToken()}` }, signal: controller.signal,
    }).then((response) => response.ok ? response.json() : Promise.reject(new Error('Categories unavailable')))
      .then((data) => setCategories(data.categories || []))
      .catch(() => {})
    return () => controller.abort()
  }, [kind])

  const label = value.trim()
  const isNew = label && !categories.some((category) => category.toLocaleLowerCase() === label.toLocaleLowerCase())
  return <label className="category-field">Category
    <input name="category" value={value} onChange={(event) => setValue(event.target.value)}
      onBlur={() => setValue((current) => current.trim().replace(/^\p{L}/u, (letter) => letter.toLocaleUpperCase()))}
      minLength="2" maxLength="80" list={`${kind}-categories`} placeholder="Select or enter a new category" required />
    <datalist id={`${kind}-categories`}>{categories.map((category) => <option key={category} value={category}/>)}</datalist>
    <small>{isNew ? 'New category will be saved with this listing.' : 'Choose a category or create your own.'}</small>
  </label>
}
